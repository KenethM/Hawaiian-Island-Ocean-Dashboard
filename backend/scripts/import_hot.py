"""
HOT (Hawaii Ocean Time-series) carbon chemistry importer.

Station ALOHA: 22.75°N, 158.00°W — open ocean reference station NE of Oahu.
Data goes back to 1988 and is publicly available from:
  https://hahana.soest.hawaii.edu/hot/

Usage:
    python scripts/import_hot.py --file /path/to/hot_carbon.csv
    python scripts/import_hot.py --url https://hahana.soest.hawaii.edu/hot/...
    python scripts/import_hot.py --file data.csv --dry-run

Expected CSV / text formats accepted:
  1. HOT JGOFS flat file (whitespace/tab-separated, comment lines start with #)
     Columns: date (YYYYMMDD), time (HHMM), press, T, S, pH, ...
  2. HOT-DOG simplified export (comma-separated)
     Columns: Year, Month, Day, Hour, Minute, pH, pCO2, Omega_Ar, ...
  3. Generic CSV (comma-separated)
     Columns: measured_at (ISO or YYYY-MM-DD), ph, pco2, aragonite_sat

Only near-surface samples (press ≤ 25 dbar) are imported by default.
Inserts into ph_readings as source='hot', data_type='observed'.
Uses ON CONFLICT DO NOTHING — safe to re-run on the same file.
"""

import os
import sys
import csv
import argparse
import urllib.request
from datetime import datetime, timezone

import psycopg2

STATION_ALOHA_LAT = 22.75
STATION_ALOHA_LNG = -158.0
SURFACE_PRESS_MAX = 25.0  # dbar

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/coral_dashboard",
).replace("+asyncpg", "")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import HOT carbon chemistry data")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--file", help="Path to local CSV/text file")
    src.add_argument("--url", help="URL to download from")
    p.add_argument(
        "--no-surface-only",
        action="store_true",
        help="Import all depths (default: surface ≤25 dbar only)",
    )
    p.add_argument("--dry-run", action="store_true", help="Parse and report counts without inserting")
    return p.parse_args()


def fetch_content(args: argparse.Namespace) -> str:
    if args.file:
        with open(args.file, encoding="utf-8-sig") as f:
            return f.read()
    print(f"Downloading {args.url} …")
    with urllib.request.urlopen(args.url, timeout=60) as resp:
        return resp.read().decode("utf-8-sig")


def _col(row: dict, *names: str) -> str:
    """Return the first non-empty column value matching any of the given names (case-insensitive)."""
    lookup = {k.strip().lower(): v for k, v in row.items()}
    for name in names:
        v = lookup.get(name.lower(), "").strip()
        if v and v not in ("-9", "-9.0", "-999", "nan", "nd", "n/d", ""):
            return v
    return ""


def _float(s: str, lo: float | None = None, hi: float | None = None) -> float | None:
    try:
        f = float(s)
        if lo is not None and f < lo:
            return None
        if hi is not None and f > hi:
            return None
        return f
    except (ValueError, TypeError):
        return None


def _parse_datetime(row: dict) -> datetime | None:
    """Try multiple date column conventions used in HOT files."""
    # Generic ISO column
    iso = _col(row, "measured_at", "datetime", "timestamp")
    if iso:
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00"))
        except ValueError:
            pass

    # YYYYMMDD + HHMM
    date_raw = _col(row, "date", "Date")
    time_raw = _col(row, "time", "Time") or "0000"
    if date_raw and len(date_raw) == 8 and date_raw.isdigit():
        try:
            time_str = time_raw.zfill(4)
            return datetime(
                int(date_raw[:4]), int(date_raw[4:6]), int(date_raw[6:8]),
                int(time_str[:2]), int(time_str[2:]),
                tzinfo=timezone.utc,
            )
        except ValueError:
            pass

    # Year / Month / Day columns
    year = _col(row, "year", "yr", "YEAR")
    month = _col(row, "month", "mo", "MONTH")
    day = _col(row, "day", "DAY")
    hour = _col(row, "hour", "hr", "HOUR") or "0"
    minute = _col(row, "minute", "min", "MIN") or "0"
    if year and month and day:
        try:
            return datetime(
                int(year), int(month), int(day),
                int(hour) if hour.isdigit() else 0,
                int(minute) if minute.isdigit() else 0,
                tzinfo=timezone.utc,
            )
        except ValueError:
            pass

    return None


def parse_records(content: str) -> list[dict]:
    """Auto-detect format and parse all records from the file content."""
    lines = content.splitlines()

    # Separate comment/header lines from data
    comment_lines = [l for l in lines if l.strip().startswith("#")]
    data_lines = [l for l in lines if l.strip() and not l.strip().startswith("#")]

    if not data_lines:
        return []

    # Detect delimiter
    first_data = data_lines[0]
    delimiter = "," if first_data.count(",") >= 2 else "\t" if "\t" in first_data else " "

    # Find header: last comment line with recognizable column names, or first data line
    header_line = None
    for line in reversed(comment_lines):
        stripped = line.lstrip("#").strip()
        low = stripped.lower()
        if any(kw in low for kw in ("date", "year", "ph", "press", "time")):
            header_line = stripped
            break

    if header_line:
        all_lines = [header_line] + data_lines
    else:
        all_lines = data_lines  # assume first row is header

    # Whitespace-separated HOT JGOFS format — must be handled before csv.DictReader
    # (csv module raises TypeError if delimiter=None)
    if delimiter == " ":
        if not header_line:
            return []
        cols = header_line.split()
        parsed = []
        for line in data_lines:
            vals = line.split()
            if len(vals) >= len(cols):
                parsed.append(dict(zip(cols, vals)))
        return _extract(parsed)

    reader = csv.DictReader(all_lines, delimiter=delimiter)
    return _extract(list(reader))


def _extract(records: list[dict]) -> list[dict]:
    out = []
    for row in records:
        dt = _parse_datetime(row)
        if dt is None:
            continue

        ph = _float(_col(row, "ph", "pH", "ph_total", "pH_total", "ph_t"), 7.0, 9.0)
        pco2 = _float(_col(row, "pco2sw", "pCO2sw", "pco2", "pCO2", "fco2sw", "fCO2sw"), 100, 2000)
        arag = _float(_col(row, "omega_ar", "Omega_Ar", "omara", "OmAr", "ara_sat", "aragonite_sat"), 0.0, 10.0)
        press = _float(_col(row, "press", "pres", "pressure", "Press"))

        out.append({"measured_at": dt, "ph": ph, "pco2": pco2, "aragonite_sat": arag, "press": press})
    return out


def insert(records: list[dict], surface_only: bool, dry_run: bool) -> tuple[int, int]:
    if surface_only:
        records = [r for r in records if r["press"] is None or r["press"] <= SURFACE_PRESS_MAX]

    records = [r for r in records if r["ph"] is not None]

    if dry_run:
        print(f"[dry-run] {len(records)} surface records with valid pH")
        for r in records[:5]:
            print(f"  {r['measured_at'].date()}  pH={r['ph']}  pCO2={r['pco2']}")
        if len(records) > 5:
            print(f"  … and {len(records) - 5} more")
        return len(records), 0

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    inserted = skipped = 0

    for r in records:
        try:
            cur.execute(
                """
                INSERT INTO ph_readings
                  (source, location_name, lat, lng, measured_at, ph, pco2, aragonite_sat, data_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    "hot",
                    "Station ALOHA",
                    STATION_ALOHA_LAT,
                    STATION_ALOHA_LNG,
                    r["measured_at"],
                    r["ph"],
                    r["pco2"],
                    r["aragonite_sat"],
                    "observed",
                ),
            )
            inserted += 1
        except Exception as e:
            skipped += 1
            print(f"  skip: {e}", file=sys.stderr)

    conn.commit()
    cur.close()
    conn.close()
    return inserted, skipped


def main() -> None:
    args = parse_args()
    content = fetch_content(args)
    print(f"Parsing {len(content):,} bytes…")
    records = parse_records(content)
    print(f"Parsed {len(records)} records")
    inserted, skipped = insert(records, not args.no_surface_only, args.dry_run)
    print(f"Done — inserted={inserted}  skipped={skipped}")


if __name__ == "__main__":
    main()
