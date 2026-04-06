#!/usr/bin/env python3
"""Probe earliest available candles via Upstox v2 expired-instruments endpoint."""

from __future__ import annotations

import datetime as dt
import json
import os
import urllib.parse
import subprocess
from pathlib import Path
from typing import Any

INSTRUMENTS = [
    # Format: "<segment>|<exchange_token>|<expiry_dd-mm-yyyy>"
    "NSE_FO|73507|24-04-2025",
]

TIMEFRAMES = [
    "1minute",
    "5minute",
    "15minute",
    "30minute",
    "60minute",
    "1day",
    "1week",
    "1month",
]

WINDOW_DAYS_BY_TIMEFRAME = {
    "1minute": 29,
    "5minute": 29,
    "15minute": 29,
    "30minute": 29,
    "60minute": 90,
    "1day": 365,
    "1week": 1825,
    "1month": 3650,
}


def load_token() -> str:
    env_token = os.environ.get("UPSTOX_ACCESS_TOKEN", "").strip()
    if env_token:
        return env_token

    prop_file = Path("backend/src/main/resources/upstox.properties")
    for line in prop_file.read_text().splitlines():
        if line.startswith("upstox.token="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("No token found in UPSTOX_ACCESS_TOKEN or upstox.properties")


def build_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def instrument_expiry(instrument: str) -> dt.date:
    expiry_str = instrument.rsplit("|", 1)[1]
    return dt.datetime.strptime(expiry_str, "%d-%m-%Y").date()


def fetch_candles(
    headers: dict[str, str],
    instrument: str,
    timeframe: str,
    to_date: dt.date,
    from_date: dt.date,
) -> dict[str, Any]:
    encoded = urllib.parse.quote(instrument, safe="")
    url = (
        f"https://api.upstox.com/v2/expired-instruments/historical-candle/"
        f"{encoded}/{timeframe}/{to_date}/{from_date}"
    )
    curl_cmd = [
        "curl",
        "-sS",
        "--max-time",
        "45",
        "-w",
        "\n%{http_code}",
        "-H",
        f"Authorization: {headers['Authorization']}",
        "-H",
        f"Accept: {headers['Accept']}",
        "-H",
        f"Content-Type: {headers['Content-Type']}",
        url,
    ]

    completed = subprocess.run(curl_cmd, capture_output=True, text=True, check=False)
    raw = completed.stdout if completed.stdout else ""
    if "\n" in raw:
        body, status_str = raw.rsplit("\n", 1)
    else:
        body, status_str = raw, "0"
    try:
        status = int(status_str.strip())
    except ValueError:
        status = 0

    payload: dict[str, Any] = {}
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        payload = {}

    candles = ((payload.get("data") or {}).get("candles") or []) if isinstance(payload, dict) else []
    earliest = min((row[0] for row in candles), default=None)
    latest = max((row[0] for row in candles), default=None)
    error_code = None
    error_message = None
    if isinstance(payload, dict) and payload.get("errors"):
        first_error = (payload["errors"][0] or {})
        error_code = first_error.get("errorCode")
        error_message = first_error.get("message")

    return {
        "status": status,
        "count": len(candles),
        "earliest": earliest,
        "latest": latest,
        "errorCode": error_code,
        "errorMessage": error_message,
    }


def find_earliest_available(
    headers: dict[str, str],
    instrument: str,
    timeframe: str,
    min_probe_date: dt.date,
) -> dict[str, Any]:
    window_days = WINDOW_DAYS_BY_TIMEFRAME.get(timeframe, 29)
    cursor_to = instrument_expiry(instrument)
    earliest_seen: str | None = None
    total_candles = 0
    last_status = 0
    last_error_code = None
    last_error_message = None

    while cursor_to >= min_probe_date:
        cursor_from = max(min_probe_date, cursor_to - dt.timedelta(days=window_days))
        result = fetch_candles(headers, instrument, timeframe, cursor_to, cursor_from)
        last_status = result["status"]
        last_error_code = result["errorCode"]
        last_error_message = result["errorMessage"]
        if result["status"] != 200:
            break
        if result["count"] == 0:
            break
        total_candles += int(result["count"])
        earliest_seen = result["earliest"]
        cursor_to = cursor_from - dt.timedelta(days=1)

    return {
        "earliestCandleAt": earliest_seen,
        "totalCandlesFetched": total_candles,
        "finalStatus": last_status,
        "errorCode": last_error_code,
        "errorMessage": last_error_message,
        "windowDays": window_days,
    }


def main() -> None:
    token = load_token()
    headers = build_headers(token)
    min_probe_date = dt.date(2020, 1, 1)
    rows: list[dict[str, Any]] = []

    for instrument in INSTRUMENTS:
        for timeframe in TIMEFRAMES:
            result = find_earliest_available(headers, instrument, timeframe, min_probe_date)
            rows.append(
                {
                    "instrument": instrument,
                    "timeframe": timeframe,
                    **result,
                }
            )

    print(
        json.dumps(
            {
                "timestampUtc": dt.datetime.now(dt.UTC).isoformat(),
                "endpoint": "/v2/expired-instruments/historical-candle",
                "minProbeDate": str(min_probe_date),
                "rows": rows,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
