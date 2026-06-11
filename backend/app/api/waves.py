"""
Ocean wave conditions from NOAA National Data Buoy Center (NDBC).

Fetches standard meteorological text files from:
  https://www.ndbc.noaa.gov/data/realtime2/{buoy_id}.txt

Key fields used:
  WVHT — significant wave height (m)
  DPD  — dominant wave period (s)
  MWD  — mean wave direction (degrees true, meteorological: direction waves come FROM)
  WTMP — water temperature (°C)
  WSPD — wind speed (m/s)
"""

import httpx
from fastapi import APIRouter, HTTPException

from app.data.reef_sites import REEF_SITES
from app.core import cache

router = APIRouter(prefix="/waves", tags=["waves"])

NDBC_BASE = "https://www.ndbc.noaa.gov/data/realtime2"

# Nearest active NDBC buoy per reef site
SITE_WAVE_BUOY: dict[str, str | None] = {
    "hanauma-bay":      "51214",  # Barbers Point, SE Oahu
    "kaneohe-bay":      "51212",  # Kaneohe Bay
    "sharks-cove":      "51202",  # Waimea Bay, Oahu North Shore
    "molokini":         "51213",  # Kaumalapau, Lanai
    "honolua-bay":      "51213",  # Kaumalapau, Lanai (~30 km S)
    "kealakekua-bay":   "51215",  # Kona, Big Island
    "kona-coast":       "51215",  # Kona, Big Island
    "tunnels-reef":     "51001",  # NW Hawaii offshore (closest available for Kauai N shore)
    "poipu":            "51001",  # NW Hawaii offshore
    "french-frigate":   "51001",  # NW Hawaii offshore
    "midway-atoll":     "51001",  # NW Hawaii offshore (nearest buoy)
}

BUOY_NAMES: dict[str, str] = {
    "51001": "NW Hawaii",
    "51202": "Waimea Bay",
    "51212": "Kaneohe Bay",
    "51213": "Kaumalapau",
    "51214": "Barbers Point",
    "51215": "Kona",
}

_CARDINALS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]


def _deg_to_cardinal(deg: int) -> str:
    return _CARDINALS[round(deg / 22.5) % 16]


def _wave_label(wvht: float) -> tuple[str, str]:
    """Return (conditions label, hex color) for a given significant wave height."""
    if wvht < 0.3:
        return "Calm", "#22c55e"
    elif wvht < 0.6:
        return "Light Chop", "#84cc16"
    elif wvht < 1.0:
        return "Moderate", "#eab308"
    elif wvht < 2.0:
        return "Rough", "#f97316"
    elif wvht < 3.0:
        return "Very Rough", "#ef4444"
    else:
        return "Dangerous", "#991b1b"


def _parse_ndbc(text: str) -> dict | None:
    """
    Parse the first usable data row from an NDBC realtime2 text file.
    Column order: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...
    MM = missing value sentinel.
    """
    data_lines = [l for l in text.splitlines() if l and not l.startswith("#")]
    for line in data_lines[:5]:
        parts = line.split()
        if len(parts) < 15:
            continue

        def _val(s: str, cast=float):
            return None if s == "MM" else cast(s)

        wvht = _val(parts[8])
        if wvht is None:
            continue  # try next row

        year, month, day, hour, minute = parts[0:5]
        mwd_raw = _val(parts[11], int)

        return {
            "wave_height_m":        round(wvht, 2),
            "dominant_period_s":    _val(parts[9]),
            "mean_direction_deg":   mwd_raw,
            "mean_direction_label": _deg_to_cardinal(mwd_raw) if mwd_raw is not None else None,
            "water_temp_c":         _val(parts[14]),
            "wind_speed_ms":        _val(parts[6]),
            "wind_dir_deg":         _val(parts[5], int),
            "observed_at":          f"{year}-{month}-{day}T{hour}:{minute}:00Z",
        }
    return None


@router.get("/{site_id}")
async def get_waves(site_id: str):
    if not any(s["id"] == site_id for s in REEF_SITES):
        raise HTTPException(status_code=404, detail="Reef site not found")

    buoy_id = SITE_WAVE_BUOY.get(site_id)
    if not buoy_id:
        return {"site_id": site_id, "buoy_id": None, "buoy_name": None, "data": None}

    cache_key = f"waves:{site_id}"
    if cached := cache.get(cache_key):
        return cached

    obs = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{NDBC_BASE}/{buoy_id}.txt", timeout=15.0)
            resp.raise_for_status()
            obs = _parse_ndbc(resp.text)
    except Exception:
        pass

    if obs and obs["wave_height_m"] is not None:
        label, color = _wave_label(obs["wave_height_m"])
        obs["conditions_label"] = label
        obs["conditions_color"] = color

    result = {
        "site_id": site_id,
        "buoy_id": buoy_id,
        "buoy_name": BUOY_NAMES.get(buoy_id, buoy_id),
        "data": obs,
    }
    cache.set(cache_key, result)
    return result
