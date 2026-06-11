"""
Tide predictions and current water level from NOAA CO-OPS Tides and Currents API.

Docs: https://api.tidesandcurrents.noaa.gov/api/prod/
Returns hourly 48-hour predictions plus inferred high/low events.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import httpx
from fastapi import APIRouter, HTTPException

from app.data.reef_sites import REEF_SITES
from app.core import cache

router = APIRouter(prefix="/tides", tags=["tides"])

CO_OPS_BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"

# Nearest active NOAA CO-OPS tide gauge station per reef site
SITE_TIDE_STATION: dict[str, str | None] = {
    "hanauma-bay":      "1612340",  # Honolulu Harbor, Oahu
    "kaneohe-bay":      "1612480",  # Mokuoloe, within Kaneohe Bay
    "sharks-cove":      "1612340",  # Honolulu Harbor (~50 km S)
    "molokini":         "1615680",  # Kahului Harbor, Maui
    "honolua-bay":      "1615680",  # Kahului Harbor (~40 km SE)
    "kealakekua-bay":   "1617433",  # Kawaihae Harbor, Big Island W coast
    "kona-coast":       "1617433",  # Kawaihae Harbor
    "tunnels-reef":     "1611400",  # Nawiliwili Harbor, Kauai
    "poipu":            "1611400",  # Nawiliwili Harbor (~10 km E)
    "french-frigate":   None,
    "midway-atoll":     None,
}

STATION_NAMES: dict[str, str] = {
    "1612340": "Honolulu",
    "1612480": "Mokuoloe (Kaneohe Bay)",
    "1615680": "Kahului",
    "1617433": "Kawaihae",
    "1611400": "Nawiliwili",
}

_TIDE_TTL = 1800  # 30 min — tides change meaningfully within an hour


def _find_high_lows(predictions: list[dict]) -> list[dict]:
    """Detect local maxima/minima (high/low tides) from hourly predictions."""
    highs_lows = []
    h = [p["height_m"] for p in predictions]
    for i in range(1, len(h) - 1):
        if h[i] > h[i - 1] and h[i] > h[i + 1]:
            highs_lows.append({**predictions[i], "type": "H"})
        elif h[i] < h[i - 1] and h[i] < h[i + 1]:
            highs_lows.append({**predictions[i], "type": "L"})
    return highs_lows


def _tide_state(predictions: list[dict], now: datetime) -> str | None:
    """Rising or falling based on which direction predictions move around now."""
    now_str = now.strftime("%Y-%m-%d %H:00")
    for i, p in enumerate(predictions):
        if p["time"] >= now_str and i > 0:
            delta = p["height_m"] - predictions[i - 1]["height_m"]
            return "rising" if delta > 0 else "falling"
    return None


async def _fetch_predictions(client: httpx.AsyncClient, station_id: str, now: datetime) -> list[dict]:
    begin = now.strftime("%Y%m%d")
    end = (now + timedelta(days=2)).strftime("%Y%m%d")
    params = {
        "product": "predictions",
        "application": "hawaii_reef_dashboard",
        "begin_date": begin,
        "end_date": end,
        "datum": "MLLW",
        "station": station_id,
        "time_zone": "GMT",
        "interval": "h",
        "units": "metric",
        "format": "json",
    }
    resp = await client.get(CO_OPS_BASE, params=params, timeout=15.0)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        return []
    return [{"time": p["t"], "height_m": round(float(p["v"]), 3)} for p in data.get("predictions", [])]


async def _fetch_water_level(client: httpx.AsyncClient, station_id: str) -> dict | None:
    params = {
        "product": "water_level",
        "application": "hawaii_reef_dashboard",
        "date": "latest",
        "datum": "MLLW",
        "station": station_id,
        "time_zone": "GMT",
        "units": "metric",
        "format": "json",
    }
    resp = await client.get(CO_OPS_BASE, params=params, timeout=15.0)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        return None
    readings = data.get("data", [])
    if not readings:
        return None
    last = readings[-1]
    return {"time": last["t"], "height_m": round(float(last["v"]), 3)}


@router.get("/{site_id}")
async def get_tides(site_id: str):
    if not any(s["id"] == site_id for s in REEF_SITES):
        raise HTTPException(status_code=404, detail="Reef site not found")

    station_id = SITE_TIDE_STATION.get(site_id)
    if not station_id:
        return {
            "site_id": site_id, "station_id": None, "station_name": None,
            "current": None, "tide_state": None, "predictions": [], "high_lows": [],
        }

    cache_key = f"tides:{site_id}"
    if cached := cache.get(cache_key, ttl=_TIDE_TTL):
        return cached

    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient() as client:
        predictions_result, current_result = await asyncio.gather(
            _fetch_predictions(client, station_id, now),
            _fetch_water_level(client, station_id),
            return_exceptions=True,
        )

    predictions = [] if isinstance(predictions_result, Exception) else predictions_result
    current = None if isinstance(current_result, Exception) else current_result

    result = {
        "site_id": site_id,
        "station_id": station_id,
        "station_name": STATION_NAMES.get(station_id, station_id),
        "current": current,
        "tide_state": _tide_state(predictions, now) if predictions else None,
        "predictions": predictions,
        "high_lows": _find_high_lows(predictions),
    }
    cache.set(cache_key, result)
    return result
