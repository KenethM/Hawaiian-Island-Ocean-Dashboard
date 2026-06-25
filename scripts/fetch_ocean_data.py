#!/usr/bin/env python3
"""
Fetch ocean data from ERDDAP and Open-Meteo and write JSON files for
static hosting on GitHub Pages.

Usage:
    python scripts/fetch_ocean_data.py --output data
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import httpx

# ---------------------------------------------------------------------------
# Reef sites
# ---------------------------------------------------------------------------

REEF_SITES = [
    {
        "id": "hanauma-bay",
        "name": "Hanauma Bay",
        "island": "Oahu",
        "lat": 21.2683,
        "lng": -157.6924,
        "depth_m": 9,
        "mmm_c": 27.9,
        "description": "Marine life conservation district and protected bay, one of Oahu's premier snorkel sites.",
    },
    {
        "id": "kaneohe-bay",
        "name": "Kaneohe Bay",
        "island": "Oahu",
        "lat": 21.4389,
        "lng": -157.7964,
        "depth_m": 8,
        "mmm_c": 27.6,
        "description": "Largest sheltered body of water in Hawaii; home to the only barrier reef in the continental US.",
    },
    {
        "id": "sharks-cove",
        "name": "Shark's Cove",
        "island": "Oahu",
        "lat": 21.6476,
        "lng": -158.0613,
        "depth_m": 12,
        "mmm_c": 27.4,
        "description": "Popular North Shore dive site with lava tubes, caves, and abundant marine life.",
    },
    {
        "id": "molokini",
        "name": "Molokini Crater",
        "island": "Maui",
        "lat": 20.6333,
        "lng": -156.4965,
        "depth_m": 40,
        "mmm_c": 28.1,
        "description": "Partially submerged volcanic crater; visibility up to 45 m. One of Hawaii's top dive destinations.",
    },
    {
        "id": "honolua-bay",
        "name": "Honolua Bay",
        "island": "Maui",
        "lat": 21.0122,
        "lng": -156.6363,
        "depth_m": 12,
        "mmm_c": 27.8,
        "description": "Marine life conservation district on Maui's northwest coast with thriving coral gardens.",
    },
    {
        "id": "kealakekua-bay",
        "name": "Kealakekua Bay",
        "island": "Big Island",
        "lat": 19.4786,
        "lng": -155.9222,
        "depth_m": 10,
        "mmm_c": 27.5,
        "description": "State marine life conservation district; known for spinner dolphins and pristine coral.",
    },
    {
        "id": "kona-coast",
        "name": "Kona Coast",
        "island": "Big Island",
        "lat": 19.639,
        "lng": -156.0128,
        "depth_m": 15,
        "mmm_c": 27.7,
        "description": "Sheltered leeward coast with diverse coral ecosystems and frequent manta ray sightings.",
    },
    {
        "id": "tunnels-reef",
        "name": "Tunnels Reef",
        "island": "Kauai",
        "lat": 22.2268,
        "lng": -159.5836,
        "depth_m": 18,
        "mmm_c": 27.2,
        "description": "Named for its lava tube network. Rich in reef fish and seasonal hammerhead sharks.",
    },
    {
        "id": "poipu",
        "name": "Poipu Beach Reef",
        "island": "Kauai",
        "lat": 21.8738,
        "lng": -159.4587,
        "depth_m": 6,
        "mmm_c": 27.3,
        "description": "Shallow fringing reef popular with beginner snorkelers; frequent Hawaiian monk seal sightings.",
    },
    {
        "id": "french-frigate",
        "name": "French Frigate Shoals",
        "island": "Northwestern Hawaii",
        "lat": 23.8743,
        "lng": -166.1444,
        "depth_m": 12,
        "mmm_c": 28.3,
        "description": "Remote atoll in Papahānaumokuākea Marine National Monument. Critical habitat for endangered species.",
    },
    {
        "id": "midway-atoll",
        "name": "Midway Atoll",
        "island": "Northwestern Hawaii",
        "lat": 28.1997,
        "lng": -177.3578,
        "depth_m": 20,
        "mmm_c": 26.5,
        "description": "Coral reefs within a National Wildlife Refuge; among the most remote reefs in the Hawaiian chain.",
    },
]

# ---------------------------------------------------------------------------
# Weather grid points
# ---------------------------------------------------------------------------

WEATHER_GRID = [
    {"name": "Kauai-N", "lat": 22.20, "lon": -159.50},
    {"name": "Kauai-S", "lat": 21.90, "lon": -159.45},
    {"name": "Niihau", "lat": 21.90, "lon": -160.20},
    {"name": "Oahu-N", "lat": 21.70, "lon": -158.10},
    {"name": "Oahu-W", "lat": 21.40, "lon": -158.20},
    {"name": "Oahu-C", "lat": 21.35, "lon": -158.00},
    {"name": "Oahu-E", "lat": 21.38, "lon": -157.72},
    {"name": "Oahu-S", "lat": 21.27, "lon": -157.82},
    {"name": "Molokai-W", "lat": 21.18, "lon": -157.10},
    {"name": "Molokai-E", "lat": 21.10, "lon": -156.80},
    {"name": "Lanai", "lat": 20.85, "lon": -156.92},
    {"name": "Maui-N", "lat": 21.00, "lon": -156.38},
    {"name": "Maui-W", "lat": 20.88, "lon": -156.62},
    {"name": "Maui-S", "lat": 20.72, "lon": -156.38},
    {"name": "Maui-E", "lat": 20.80, "lon": -155.95},
    {"name": "Kahoolawe", "lat": 20.58, "lon": -156.60},
    {"name": "BigIsland-NW", "lat": 20.02, "lon": -155.70},
    {"name": "BigIsland-N", "lat": 20.18, "lon": -155.50},
    {"name": "BigIsland-NE", "lat": 19.90, "lon": -155.10},
    {"name": "BigIsland-E", "lat": 19.52, "lon": -154.93},
    {"name": "BigIsland-SE", "lat": 19.10, "lon": -155.48},
    {"name": "BigIsland-S", "lat": 18.98, "lon": -155.78},
    {"name": "BigIsland-SW", "lat": 19.20, "lon": -156.05},
    {"name": "BigIsland-W", "lat": 19.72, "lon": -155.92},
    {"name": "BigIsland-C", "lat": 19.55, "lon": -155.52},
]

# ---------------------------------------------------------------------------
# ERDDAP base URLs
# ---------------------------------------------------------------------------

ERDDAP_BASE = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
SITE_TIMEOUT = 30.0

# ---------------------------------------------------------------------------
# Alert helpers
# ---------------------------------------------------------------------------

BAA_COLORS = {
    0: "#22c55e",
    1: "#f97316",
    2: "#ef4444",
    3: "#dc2626",
    4: "#7f1d1d",
}

BAA_LABELS = {
    0: "No Stress",
    1: "Watch",
    2: "Warning",
    3: "Alert Level 1",
    4: "Alert Level 2",
}


def compute_alert(baa, sst, mmm_c):
    """Return (level, color, label) for the alert state."""
    if baa is not None and baa >= 0:
        level = int(baa)
        return level, BAA_COLORS.get(level, "#6b7280"), BAA_LABELS.get(level, "Unknown")
    if sst is not None:
        diff = sst - mmm_c
        if diff >= 2:
            return 2, "#ef4444", "Warning"
        if diff >= 1:
            return 1, "#f97316", "Watch"
        if diff >= 0:
            return 0, "#22c55e", "No Stress"
        return -1, "#3b82f6", "Below MMM"
    return -99, "#6b7280", "No Data"


# ---------------------------------------------------------------------------
# CSV parsing helpers
# ---------------------------------------------------------------------------

def _parse_csv(text: str):
    """Parse ERDDAP CSV response, skipping the units row.

    Returns list-of-dicts with column headers as keys and float/string values.
    """
    lines = [l for l in text.strip().splitlines() if l.strip()]
    if len(lines) < 3:
        return []
    headers = [h.strip() for h in lines[0].split(",")]
    # lines[1] is the units row — skip it
    rows = []
    for line in lines[2:]:
        parts = line.split(",")
        row = {}
        for i, h in enumerate(headers):
            val = parts[i].strip() if i < len(parts) else ""
            try:
                row[h] = float(val)
            except ValueError:
                row[h] = val
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# SST fetching
# ---------------------------------------------------------------------------

async def fetch_sst_site(client: httpx.AsyncClient, site: dict, date_str: str):
    """Fetch SST for a single site. Returns (site_id, sst_c) or (site_id, None)."""
    lat, lng = site["lat"], site["lng"]
    url = (
        f"{ERDDAP_BASE}/jplMURSST41.csv"
        f"?analysed_sst[({date_str}T09:00:00Z):1:({date_str}T09:00:00Z)]"
        f"[({lat}):1:({lat})][({lng}):1:({lng})]"
    )
    try:
        resp = await client.get(url, timeout=SITE_TIMEOUT)
        resp.raise_for_status()
        rows = _parse_csv(resp.text)
        if rows:
            raw = rows[0].get("analysed_sst")
            if raw is not None:
                return site["id"], float(raw)
    except Exception as exc:
        print(f"[SST] {site['id']}: {exc}", file=sys.stderr)
    return site["id"], None


async def fetch_all_sst(date_str: str):
    """Fetch SST for all sites concurrently. Returns dict site_id -> sst_c."""
    async with httpx.AsyncClient() as client:
        tasks = [fetch_sst_site(client, s, date_str) for s in REEF_SITES]
        results = await asyncio.gather(*tasks)
    return dict(results)


# ---------------------------------------------------------------------------
# CRW fetching
# ---------------------------------------------------------------------------

async def fetch_crw_site(client: httpx.AsyncClient, site: dict, date_str: str):
    """Fetch CRW (BAA, DHW, hotspot) for a single site."""
    lat, lng = site["lat"], site["lng"]
    url = (
        f"{ERDDAP_BASE}/NOAA_DHW.csv"
        f"?CRW_BAA,CRW_DHW,CRW_HOTSPOT"
        f"[({date_str}T12:00:00Z):1:({date_str}T12:00:00Z)]"
        f"[({lat}):1:({lat})][({lng}):1:({lng})]"
    )
    try:
        resp = await client.get(url, timeout=SITE_TIMEOUT)
        resp.raise_for_status()
        rows = _parse_csv(resp.text)
        if rows:
            row = rows[0]
            baa = row.get("CRW_BAA")
            dhw = row.get("CRW_DHW")
            hotspot = row.get("CRW_HOTSPOT")
            return site["id"], {
                "baa": float(baa) if baa is not None else None,
                "dhw": float(dhw) if dhw is not None else None,
                "hotspot": float(hotspot) if hotspot is not None else None,
            }
    except Exception as exc:
        print(f"[CRW] {site['id']}: {exc}", file=sys.stderr)
    return site["id"], {"baa": None, "dhw": None, "hotspot": None}


async def fetch_all_crw(date_str: str):
    """Fetch CRW for all sites concurrently. Returns dict site_id -> crw_dict."""
    async with httpx.AsyncClient() as client:
        tasks = [fetch_crw_site(client, s, date_str) for s in REEF_SITES]
        results = await asyncio.gather(*tasks)
    return dict(results)


# ---------------------------------------------------------------------------
# Chlorophyll fetching
# ---------------------------------------------------------------------------

async def fetch_chlorophyll():
    """Fetch VIIRS chlorophyll grid. Returns chlorophyll.json payload."""
    url = (
        f"{ERDDAP_BASE}/erdVHNchla1day.csv"
        "?chla[(last):1:(last)][(0.0):1:(0.0)][(18.5):50:(22.5)][(-161.0):50:(-154.0)]"
    )
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=60.0)
            resp.raise_for_status()
        rows = _parse_csv(resp.text)
        points = []
        fetched_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        for row in rows:
            chla = row.get("chla")
            lat = row.get("latitude") or row.get("lat")
            lng = row.get("longitude") or row.get("lon") or row.get("lng")
            if lat is not None and lng is not None and chla is not None:
                points.append({"lat": float(lat), "lng": float(lng), "chlorophyll": float(chla)})
            # Capture the date from the time column if present
            t = row.get("time")
            if t and isinstance(t, str) and len(t) >= 10:
                fetched_date = t[:10]
        return {
            "points": points,
            "fetched_date": fetched_date,
            "dataset": "VIIRS-N erdVHNchla1day",
        }
    except Exception as exc:
        print(f"[Chlorophyll] fetch failed: {exc}", file=sys.stderr)
        return {
            "points": [],
            "fetched_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "dataset": "VIIRS-N erdVHNchla1day",
        }


# ---------------------------------------------------------------------------
# Weather fetching
# ---------------------------------------------------------------------------

async def fetch_weather_point(client: httpx.AsyncClient, point: dict, today_str: str):
    """Fetch weather for one grid point. Returns point dict with 'daily' list."""
    params = {
        "latitude": point["lat"],
        "longitude": point["lon"],
        "daily": "precipitation_sum,precipitation_probability_max,weathercode",
        "timezone": "Pacific/Honolulu",
        "past_days": 30,
        "forecast_days": 7,
    }
    try:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params=params,
            timeout=SITE_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        daily_block = data.get("daily", {})
        dates = daily_block.get("time", [])
        precip = daily_block.get("precipitation_sum", [])
        rain_prob = daily_block.get("precipitation_probability_max", [])
        weather_code = daily_block.get("weathercode", [])
        daily = []
        for i, d in enumerate(dates):
            daily.append({
                "date": d,
                "precip_mm": precip[i] if i < len(precip) else None,
                "rain_prob": rain_prob[i] if i < len(rain_prob) else None,
                "weather_code": weather_code[i] if i < len(weather_code) else None,
                "is_forecast": d > today_str,
            })
        return {**point, "daily": daily}
    except Exception as exc:
        print(f"[Weather] {point['name']}: {exc}", file=sys.stderr)
        return {**point, "daily": []}


async def fetch_all_weather():
    """Fetch weather for all 25 grid points concurrently. Returns weather.json payload."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    async with httpx.AsyncClient() as client:
        tasks = [fetch_weather_point(client, p, today_str) for p in WEATHER_GRID]
        results = await asyncio.gather(*tasks)
    return {
        "grid": list(results),
        "fetched_at": today_str,
    }


# ---------------------------------------------------------------------------
# SST history fetching (60 days)
# ---------------------------------------------------------------------------

async def fetch_sst_history_site(client: httpx.AsyncClient, site: dict, start_str: str, end_str: str):
    """Fetch 60-day SST history for one site."""
    lat, lng = site["lat"], site["lng"]
    url = (
        f"{ERDDAP_BASE}/jplMURSST41.csv"
        f"?analysed_sst[({start_str}T09:00:00Z):1:({end_str}T09:00:00Z)]"
        f"[({lat}):1:({lat})][({lng}):1:({lng})]"
    )
    readings = []
    try:
        resp = await client.get(url, timeout=60.0)
        resp.raise_for_status()
        rows = _parse_csv(resp.text)
        for row in rows:
            t = row.get("time")
            sst = row.get("analysed_sst")
            if t is not None and sst is not None:
                readings.append({"time": str(t), "sst_c": float(sst)})
    except Exception as exc:
        print(f"[SST-history] {site['id']}: {exc}", file=sys.stderr)
    return site["id"], {
        "site_id": site["id"],
        "site_name": site["name"],
        "mmm_c": site["mmm_c"],
        "readings": readings,
    }


async def fetch_all_sst_history(end_date_str: str):
    """Fetch SST history for all 11 sites concurrently. Returns dict site_id -> history."""
    end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
    start_dt = end_dt - timedelta(days=60)
    start_str = start_dt.strftime("%Y-%m-%d")
    async with httpx.AsyncClient() as client:
        tasks = [
            fetch_sst_history_site(client, s, start_str, end_date_str)
            for s in REEF_SITES
        ]
        results = await asyncio.gather(*tasks)
    return dict(results)


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

async def main(output_dir: str):
    now_utc = datetime.now(timezone.utc)
    target_date = (now_utc - timedelta(days=2)).strftime("%Y-%m-%d")

    print(f"Target date: {target_date}")
    print(f"Output dir:  {output_dir}")

    os.makedirs(output_dir, exist_ok=True)

    # Run all top-level fetches concurrently
    sst_task = asyncio.create_task(fetch_all_sst(target_date))
    crw_task = asyncio.create_task(fetch_all_crw(target_date))
    chlorophyll_task = asyncio.create_task(fetch_chlorophyll())
    weather_task = asyncio.create_task(fetch_all_weather())
    sst_history_task = asyncio.create_task(fetch_all_sst_history(target_date))

    sst_data, crw_data, chlorophyll, weather, sst_history = await asyncio.gather(
        sst_task, crw_task, chlorophyll_task, weather_task, sst_history_task
    )

    # ----- current-conditions.json -----
    conditions = []
    for site in REEF_SITES:
        sid = site["id"]
        sst_c = sst_data.get(sid)
        crw = crw_data.get(sid, {})
        baa = crw.get("baa")
        dhw = crw.get("dhw")
        hotspot = crw.get("hotspot")
        level, color, label = compute_alert(baa, sst_c, site["mmm_c"])
        conditions.append({
            "id": sid,
            "name": site["name"],
            "island": site["island"],
            "lat": site["lat"],
            "lng": site["lng"],
            "depth_m": site["depth_m"],
            "mmm_c": site["mmm_c"],
            "description": site["description"],
            "sst_c": sst_c,
            "dhw": dhw,
            "hotspot": hotspot,
            "alert": {
                "level": level,
                "color": color,
                "label": label,
            },
        })

    # ----- Write files -----
    files_written = []

    def write_json(filename: str, payload):
        path = os.path.join(output_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        files_written.append(filename)

    write_json("current-conditions.json", conditions)
    write_json("chlorophyll.json", chlorophyll)
    write_json("weather.json", weather)
    write_json("sst-history.json", sst_history)

    # ----- Summary -----
    sst_ok = sum(1 for v in sst_data.values() if v is not None)
    crw_ok = sum(1 for v in crw_data.values() if v.get("baa") is not None)
    chla_pts = len(chlorophyll.get("points", []))
    wx_ok = sum(1 for g in weather.get("grid", []) if g.get("daily"))
    hist_ok = sum(1 for v in sst_history.values() if v.get("readings"))

    print("\n=== Fetch Summary ===")
    print(f"SST (current):   {sst_ok}/{len(REEF_SITES)} sites")
    print(f"CRW:             {crw_ok}/{len(REEF_SITES)} sites")
    print(f"Chlorophyll pts: {chla_pts}")
    print(f"Weather grids:   {wx_ok}/{len(WEATHER_GRID)} points")
    print(f"SST history:     {hist_ok}/{len(REEF_SITES)} sites with readings")
    print(f"\nFiles written to {output_dir}:")
    for fn in files_written:
        path = os.path.join(output_dir, fn)
        size = os.path.getsize(path)
        print(f"  {fn}  ({size:,} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch ocean data for Hawaii reef dashboard.")
    parser.add_argument(
        "--output",
        default="data",
        metavar="DIR",
        help="Directory to write JSON output files (default: data)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.output))
