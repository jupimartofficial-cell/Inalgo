#!/usr/bin/env python3
"""Run Upstox endpoint matrix checks for selected instruments/timeframes."""

import datetime as dt
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

INSTRUMENTS = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
]

ALL_TIMEFRAMES = [
    ("minutes", 1, "1minute"),
    ("minutes", 5, "5minute"),
    ("minutes", 15, "15minute"),
    ("minutes", 30, "30minute"),
    ("minutes", 60, "60minute"),
    ("days", 1, "1day"),
    ("weeks", 1, "1week"),
    ("months", 1, "1month"),
]

INTRADAY_SUPPORTED_TIMEFRAMES = [
    (unit, interval, label) for unit, interval, label in ALL_TIMEFRAMES if unit in {"minutes", "days"}
]


def load_token() -> str:
    prop_file = Path("backend/src/main/resources/upstox.properties")
    for line in prop_file.read_text().splitlines():
        if line.startswith("upstox.token="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("upstox.token not found")


def safe_date_range(unit: str) -> tuple[dt.date, dt.date]:
    to = dt.date.today()
    lookback_days = {
        "minutes": 7,
        "days": 60,
        "weeks": 365,
        "months": 730,
    }[unit]
    return to, to - dt.timedelta(days=lookback_days)


def fetch_status(url: str, headers: dict[str, str]) -> tuple[int | None, str]:
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read(200).decode("utf-8", "ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(200).decode("utf-8", "ignore")
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def main() -> None:
    token = load_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://api.upstox.com",
        "Referer": "https://api.upstox.com/",
    }

    checks: list[dict[str, object]] = []
    for instrument in INSTRUMENTS:
        encoded = urllib.parse.quote(instrument, safe="")

        for unit, interval, label in INTRADAY_SUPPORTED_TIMEFRAMES:
            intraday_url = f"https://api.upstox.com/v3/historical-candle/intraday/{encoded}/{unit}/{interval}"
            status, sample = fetch_status(intraday_url, headers)
            checks.append(
                {
                    "endpoint": "intraday",
                    "instrument": instrument,
                    "timeframe": label,
                    "status": status,
                    "ok": status == 200,
                    "sample": sample.replace("\n", " ")[:120],
                }
            )

        for unit, interval, label in ALL_TIMEFRAMES:
            to_date, from_date = safe_date_range(unit)
            historical_url = (
                f"https://api.upstox.com/v3/historical-candle/{encoded}/{unit}/{interval}/{to_date}/{from_date}"
            )
            status, sample = fetch_status(historical_url, headers)
            checks.append(
                {
                    "endpoint": "historical",
                    "instrument": instrument,
                    "timeframe": label,
                    "status": status,
                    "ok": status == 200,
                    "sample": sample.replace("\n", " ")[:120],
                }
            )

    result = {
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        "total": len(checks),
        "ok": sum(1 for item in checks if item["ok"]),
        "checks": checks,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
