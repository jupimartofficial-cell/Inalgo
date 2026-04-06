#!/usr/bin/env python3
"""Probe Upstox V3 historical endpoint limits and earliest available candle dates."""

from __future__ import annotations

import datetime as dt
import json
import urllib.parse
import subprocess
from pathlib import Path
from typing import Any

INSTRUMENTS = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
]

TIMEFRAMES = [
    ("minutes", 1, "1minute"),
    ("minutes", 5, "5minute"),
    ("minutes", 15, "15minute"),
    ("minutes", 30, "30minute"),
    ("minutes", 60, "60minute"),
    ("days", 1, "1day"),
    ("weeks", 1, "1week"),
    ("months", 1, "1month"),
]

DEFAULT_WINDOW_DAYS = {
    "minutes": 29,
    "days": 365,
    "weeks": 1825,
    "months": 3650,
}


def load_token() -> str:
    prop_file = Path("backend/src/main/resources/upstox.properties")
    for line in prop_file.read_text().splitlines():
        if line.startswith("upstox.token="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("upstox.token not found")


def build_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://api.upstox.com",
        "Referer": "https://api.upstox.com/",
    }


def fetch_candles(
    headers: dict[str, str],
    instrument: str,
    unit: str,
    interval: int,
    from_date: dt.date,
    to_date: dt.date,
) -> dict[str, Any]:
    encoded = urllib.parse.quote(instrument, safe="")
    url = f"https://api.upstox.com/v3/historical-candle/{encoded}/{unit}/{interval}/{to_date}/{from_date}"
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
        f"User-Agent: {headers['User-Agent']}",
        "-H",
        f"Origin: {headers['Origin']}",
        "-H",
        f"Referer: {headers['Referer']}",
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
    error_code = None
    if isinstance(payload, dict) and payload.get("errors"):
        error_code = (payload["errors"][0] or {}).get("errorCode")

    earliest = min((row[0] for row in candles), default=None)
    return {
        "status": status,
        "count": len(candles),
        "earliest": earliest,
        "errorCode": error_code,
    }


def find_largest_valid_window(
    headers: dict[str, str],
    instrument: str,
    unit: str,
    interval: int,
) -> int:
    today = dt.date.today()
    candidates = [1, 3, 5, 7, 10, 15, 29, 30, 45, 60, 90, 120, 179, 180, 365, 730, 1825]
    valid = 1
    for days in candidates:
        result = fetch_candles(headers, instrument, unit, interval, today - dt.timedelta(days=days), today)
        if result["status"] == 200:
            valid = days
        elif result["errorCode"] == "UDAPI1148":
            break
    return valid


def find_earliest_available_date(
    headers: dict[str, str],
    instrument: str,
    unit: str,
    interval: int,
    window_days: int,
    min_probe_date: dt.date,
) -> str | None:
    cursor_to = dt.date.today()
    earliest_seen: str | None = None

    while cursor_to >= min_probe_date:
        cursor_from = max(min_probe_date, cursor_to - dt.timedelta(days=window_days))
        result = fetch_candles(headers, instrument, unit, interval, cursor_from, cursor_to)
        if result["status"] != 200:
            break
        if result["count"] == 0:
            break
        earliest_seen = result["earliest"]
        cursor_to = cursor_from - dt.timedelta(days=1)

    return earliest_seen


def main() -> None:
    token = load_token()
    headers = build_headers(token)
    min_probe_date = dt.date(2020, 1, 1)

    rows: list[dict[str, Any]] = []
    for instrument in INSTRUMENTS:
        for unit, interval, label in TIMEFRAMES:
            suggested_window = DEFAULT_WINDOW_DAYS[unit]
            if unit == "minutes":
                suggested_window = min(
                    suggested_window,
                    find_largest_valid_window(headers, instrument, unit, interval),
                )

            earliest = find_earliest_available_date(
                headers,
                instrument,
                unit,
                interval,
                suggested_window,
                min_probe_date,
            )
            rows.append(
                {
                    "instrument": instrument,
                    "timeframe": label,
                    "unit": unit,
                    "interval": interval,
                    "windowDays": suggested_window,
                    "earliestCandleAt": earliest,
                }
            )

    print(
        json.dumps(
            {
                "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                "minProbeDate": str(min_probe_date),
                "rows": rows,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
