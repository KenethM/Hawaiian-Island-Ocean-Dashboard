import asyncio
import logging
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, HTTPException

from app.core import cache

log = logging.getLogger(__name__)

router = APIRouter(prefix="/weather", tags=["weather"])

HAWAII_GRID = [
    {"name": "Kauai-N",        "lat": 22.20, "lon": -159.50},
    {"name": "Kauai-S",        "lat": 21.90, "lon": -159.45},
    {"name": "Niihau",         "lat": 21.90, "lon": -160.20},
    {"name": "Oahu-N",         "lat": 21.70, "lon": -158.10},
    {"name": "Oahu-W",         "lat": 21.40, "lon": -158.20},
    {"name": "Oahu-C",         "lat": 21.35, "lon": -158.00},
    {"name": "Oahu-E",         "lat": 21.38, "lon": -157.72},
    {"name": "Oahu-S",         "lat": 21.27, "lon": -157.82},
    {"name": "Molokai-W",      "lat": 21.18, "lon": -157.10},
    {"name": "Molokai-E",      "lat": 21.10, "lon": -156.80},
    {"name": "Lanai",          "lat": 20.85, "lon": -156.92},
    {"name": "Maui-N",         "lat": 21.00, "lon": -156.38},
    {"name": "Maui-W",         "lat": 20.88, "lon": -156.62},
    {"name": "Maui-S",         "lat": 20.72, "lon": -156.38},
    {"name": "Maui-E",         "lat": 20.80, "lon": -155.95},
    {"name": "Kahoolawe",      "lat": 20.58, "lon": -156.60},
    {"name": "BigIsland-NW",   "lat": 20.02, "lon": -155.70},
    {"name": "BigIsland-N",    "lat": 20.18, "lon": -155.50},
    {"name": "BigIsland-NE",   "lat": 19.90, "lon": -155.10},
    {"name": "BigIsland-E",    "lat": 19.52, "lon": -154.93},
    {"name": "BigIsland-SE",   "lat": 19.10, "lon": -155.48},
    {"name": "BigIsland-S",    "lat": 18.98, "lon": -155.78},
    {"name": "BigIsland-SW",   "lat": 19.20, "lon": -156.05},
    {"name": "BigIsland-W",    "lat": 19.72, "lon": -155.92},
    {"name": "BigIsland-C",    "lat": 19.55, "lon": -155.52},
]

FORECAST_CACHE_KEY = "weather_grid_v1"
FORECAST_TTL = 3600  # 1 hour


async def _fetch_point(client: httpx.AsyncClient, lat: float, lon: float) -> dict | None:
    """Fetch 30 days history + 7 day forecast from Open-Meteo for one point."""
    try:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "precipitation_sum,precipitation_probability_max,weathercode",
                "timezone": "Pacific/Honolulu",
                "past_days": 30,
                "forecast_days": 7,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        log.warning("Open-Meteo fetch failed for (%.2f, %.2f): %s", lat, lon, exc)
        return None


@router.get("/grid")
async def get_weather_grid():
    """
    Returns 30-day precipitation history + 7-day forecast for a grid of points
    across the Hawaiian Islands, sourced from Open-Meteo (no API key required).
    Each point includes daily precip_mm, rain probability, and WMO weather code.
    """
    cached = cache.get(FORECAST_CACHE_KEY, ttl=FORECAST_TTL)
    if cached:
        return cached

    async with httpx.AsyncClient() as client:
        raw = await asyncio.gather(
            *[_fetch_point(client, p["lat"], p["lon"]) for p in HAWAII_GRID]
        )

    today_str = date.today().isoformat()
    grid = []
    for point, result in zip(HAWAII_GRID, raw):
        if result is None:
            continue
        daily = result.get("daily", {})
        times = daily.get("time", [])
        precips = daily.get("precipitation_sum", [])
        probs = daily.get("precipitation_probability_max", [])
        codes = daily.get("weathercode", [])
        days = []
        for i, t in enumerate(times):
            days.append({
                "date": t,
                "precip_mm": precips[i] if i < len(precips) else None,
                "rain_prob": probs[i] if i < len(probs) else None,
                "weather_code": codes[i] if i < len(codes) else None,
                "is_forecast": t > today_str,
            })
        grid.append({
            "name": point["name"],
            "lat": point["lat"],
            "lon": point["lon"],
            "daily": days,
        })

    response = {"grid": grid, "fetched_at": today_str}
    cache.set(FORECAST_CACHE_KEY, response)
    return response
