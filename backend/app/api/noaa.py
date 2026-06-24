"""
NOAA data fetching via ERDDAP.

SST source: NOAA/JPL MUR SST Analysis (jplMURSST41) — 1 km daily, in °C.
CRW source: NOAA Coral Reef Watch (NOAA_DHW) — 5 km daily.
  Provides Bleaching Alert Area (BAA 0-4), Degree Heating Weeks (DHW), and Hotspot.
Chlorophyll: MODIS Aqua erdMH1chla1day — 0.0125° daily.
ERDDAP URL: https://coastwatch.pfeg.noaa.gov/erddap/griddap/
"""

import asyncio
import logging
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any
import httpx
from fastapi import APIRouter, HTTPException

from app.data.reef_sites import REEF_SITES
from app.core import cache

log = logging.getLogger(__name__)

router = APIRouter(prefix="/noaa", tags=["noaa"])

ERDDAP_BASE = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
SST_DATASET = "jplMURSST41"
CRW_DATASET = "NOAA_DHW"

_BAA_ALERTS: dict[int, dict[str, Any]] = {
    0: {"level": 0, "label": "No Stress",      "color": "#22c55e"},
    1: {"level": 1, "label": "Watch",           "color": "#f97316"},
    2: {"level": 2, "label": "Warning",         "color": "#ef4444"},
    3: {"level": 3, "label": "Alert Level 1",   "color": "#dc2626"},
    4: {"level": 4, "label": "Alert Level 2",   "color": "#7f1d1d"},
}


def _baa_to_alert(baa: int | None) -> dict[str, Any]:
    """Map CRW Bleaching Alert Area (0-4) to AlertInfo."""
    if baa is None:
        return {"level": -99, "label": "No Data", "color": "#6b7280"}
    return _BAA_ALERTS.get(baa, {"level": -99, "label": "No Data", "color": "#6b7280"})


def _bleaching_level(sst: float, mmm: float) -> dict[str, Any]:
    """Fallback SST-based alert when CRW data is unavailable."""
    diff = sst - mmm
    if diff >= 2.0:
        return {"level": 2, "label": "Warning", "color": "#ef4444"}
    elif diff >= 1.0:
        return {"level": 1, "label": "Watch", "color": "#f97316"}
    elif diff >= 0:
        return {"level": 0, "label": "No Stress", "color": "#22c55e"}
    else:
        return {"level": -1, "label": "Below MMM", "color": "#3b82f6"}


# ── Hawaii bounding box (covers all reef sites) ───────────────────────────────
_HAWAII_LAT_MIN, _HAWAII_LAT_MAX = 18.5, 22.5
_HAWAII_LNG_MIN, _HAWAII_LNG_MAX = -161.0, -154.0

async def _fetch_sst_bbox(client: httpx.AsyncClient, date_str: str) -> list:
    """Fetch SST grid covering all Hawaiian sites in one ERDDAP request.
    stride=10 on a 0.01° dataset → 0.1° resolution → ~2,800 rows (vs 11,200 at stride=5).
    """
    url = (
        f"{ERDDAP_BASE}/{SST_DATASET}.json"
        f"?analysed_sst[({date_str}):1:({date_str})]"
        f"[({_HAWAII_LAT_MIN}):10:({_HAWAII_LAT_MAX})]"
        f"[({_HAWAII_LNG_MIN}):10:({_HAWAII_LNG_MAX})]"
    )
    resp = await client.get(url, timeout=45.0)
    resp.raise_for_status()
    return resp.json()["table"]["rows"]  # columns: time, lat, lng, analysed_sst

async def _fetch_crw_bbox(client: httpx.AsyncClient, date_str: str) -> list:
    """Fetch CRW grid covering all Hawaiian sites in one ERDDAP request.
    stride=2 on a 0.05° dataset → 0.1° resolution → ~2,800 rows (vs 11,200 at stride=1).
    """
    url = (
        f"{ERDDAP_BASE}/{CRW_DATASET}.json"
        f"?CRW_BAA,CRW_DHW,CRW_HOTSPOT"
        f"[({date_str}):1:({date_str})]"
        f"[({_HAWAII_LAT_MIN}):2:({_HAWAII_LAT_MAX})]"
        f"[({_HAWAII_LNG_MIN}):2:({_HAWAII_LNG_MAX})]"
    )
    resp = await client.get(url, timeout=45.0)
    resp.raise_for_status()
    return resp.json()["table"]["rows"]  # columns: time, lat, lng, CRW_BAA, CRW_DHW, CRW_HOTSPOT

def _nearest_sst(rows: list, lat: float, lng: float) -> float | None:
    best_val, best_dist = None, float('inf')
    for r in rows:
        if r[3] is None:
            continue
        d = (r[1] - lat) ** 2 + (r[2] - lng) ** 2
        if d < best_dist:
            best_dist, best_val = d, r[3]
    return round(best_val, 2) if best_val is not None else None

def _nearest_crw(rows: list, lat: float, lng: float) -> dict | None:
    best_row, best_dist = None, float('inf')
    for r in rows:
        d = (r[1] - lat) ** 2 + (r[2] - lng) ** 2
        if d < best_dist:
            best_dist, best_row = d, r
    if best_row is None:
        return None
    return {
        "baa":     int(best_row[3])            if best_row[3] is not None else None,
        "dhw":     round(float(best_row[4]), 2) if best_row[4] is not None else None,
        "hotspot": round(float(best_row[5]), 2) if best_row[5] is not None else None,
    }


async def _fetch_sst_point(client: httpx.AsyncClient, lat: float, lng: float, start: str, end: str) -> list[dict]:
    url = (
        f"{ERDDAP_BASE}/{SST_DATASET}.json"
        f"?analysed_sst[({start}):1:({end})]"
        f"[({lat:.4f}):1:({lat:.4f})]"
        f"[({lng:.4f}):1:({lng:.4f})]"
    )
    resp = await client.get(url, timeout=45.0)
    resp.raise_for_status()
    data = resp.json()
    rows = data["table"]["rows"]
    return [{"time": r[0], "sst_c": round(r[3], 2)} for r in rows if r[3] is not None]


@router.get("/sst/{site_id}")
async def get_sst_for_site(site_id: str, days: int = 30):
    """Return daily SST for a reef site over the last N days."""
    site = next((s for s in REEF_SITES if s["id"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail="Reef site not found")

    cache_key = f"sst:{site_id}:{days}"
    if cached := cache.get(cache_key):
        return cached

    end_dt = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
    start_dt = end_dt - timedelta(days=days)
    # MUR SST lags ~1-2 days behind real-time
    end_dt -= timedelta(days=2)

    end_str = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    start_str = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        async with httpx.AsyncClient() as client:
            readings = await _fetch_sst_point(client, site["lat"], site["lng"], start_str, end_str)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"NOAA ERDDAP error: {exc}")

    result = {
        "site_id": site_id,
        "site_name": site["name"],
        "mmm_c": site["mmm_c"],
        "readings": readings,
    }
    cache.set(cache_key, result)
    return result


@router.get("/current-conditions")
async def get_current_conditions():
    """Return the latest SST, CRW bleaching alert, DHW, and hotspot for every reef site."""
    if cached := cache.get("current-conditions"):
        return cached

    lag_dt = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0) - timedelta(days=2)
    sst_date_str = lag_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    crw_date_str = lag_dt.strftime("%Y-%m-%dT12:00:00Z")

    async with httpx.AsyncClient() as client:
        sst_rows, crw_rows = await asyncio.gather(
            _fetch_sst_bbox(client, sst_date_str),
            _fetch_crw_bbox(client, crw_date_str),
            return_exceptions=True,
        )

    if isinstance(sst_rows, Exception):
        log.error("SST bbox fetch failed for %s: %s", sst_date_str, sst_rows)
    if isinstance(crw_rows, Exception):
        log.error("CRW bbox fetch failed for %s: %s", crw_date_str, crw_rows)

    results = []
    for site in REEF_SITES:
        latest_sst = _nearest_sst(sst_rows, site["lat"], site["lng"]) if not isinstance(sst_rows, Exception) else None
        crw = _nearest_crw(crw_rows, site["lat"], site["lng"]) if not isinstance(crw_rows, Exception) else None

        if crw and crw["baa"] is not None:
            alert = _baa_to_alert(crw["baa"])
        elif latest_sst is not None:
            alert = _bleaching_level(latest_sst, site["mmm_c"])
        else:
            alert = {"level": -99, "label": "No Data", "color": "#6b7280"}

        results.append({
            **{k: site[k] for k in ("id", "name", "island", "lat", "lng", "depth_m", "mmm_c", "description")},
            "sst_c": latest_sst,
            "dhw": crw["dhw"] if crw else None,
            "hotspot": crw["hotspot"] if crw else None,
            "alert": alert,
        })

    cache.set("current-conditions", results)
    return results


# ── Chlorophyll-a overlay ─────────────────────────────────────────────────────

# VIIRS-N (Suomi NPP) daily chlorophyll — active replacement for retired MODIS Aqua
CHLA_DATASET = "erdVHNchla1day"
_CHLA_LAT_MIN, _CHLA_LAT_MAX = 18.5, 22.5
_CHLA_LNG_MIN, _CHLA_LNG_MAX = -161.0, -154.0
_CHLA_STRIDE = 50  # ~0.375° resolution at 0.0075°/px native


@router.get("/chlorophyll")
async def get_chlorophyll_grid():
    """Return a VIIRS chlorophyll-a grid (mg/m³) covering Hawaiian waters."""
    if cached := cache.get("chlorophyll-grid"):
        return cached

    # (last) always fetches the most recently processed day
    url = (
        f"{ERDDAP_BASE}/{CHLA_DATASET}.json"
        f"?chla[(last):1:(last)][(0.0):1:(0.0)]"
        f"[({_CHLA_LAT_MIN}):{_CHLA_STRIDE}:({_CHLA_LAT_MAX})]"
        f"[({_CHLA_LNG_MIN}):{_CHLA_STRIDE}:({_CHLA_LNG_MAX})]"
    )
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=25.0)
        if resp.status_code == 200:
            data = resp.json()
            rows = data["table"]["rows"]
            # columns: time(0), altitude(1), latitude(2), longitude(3), chla(4)
            date_str = rows[0][0][:10] if rows else "unknown"
            points = [
                {"lat": r[2], "lng": r[3], "chlorophyll": round(r[4], 4) if r[4] is not None else None}
                for r in rows
            ]
            result = {"date": date_str, "points": points, "fetched_at": datetime.now(timezone.utc).isoformat()}
            cache.set("chlorophyll-grid", result)
            return result
        else:
            log.error("Chlorophyll ERDDAP returned %s", resp.status_code)
    except Exception as exc:
        log.exception("Chlorophyll fetch failed: %s", exc)

    raise HTTPException(status_code=502, detail="Chlorophyll data unavailable")


# ── Year-over-year SST comparison ─────────────────────────────────────────────

@router.get("/sst/{site_id}/yoy")
async def get_sst_yoy(site_id: str, days: int = 180):
    """Return SST for the current period vs. the same period last year."""
    site = next((s for s in REEF_SITES if s["id"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail="Reef site not found")

    cache_key = f"sst-yoy:{site_id}:{days}"
    if cached := cache.get(cache_key):
        return cached

    now = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0) - timedelta(days=2)
    this_year_end = now
    this_year_start = now - timedelta(days=days)
    last_year_end = now - timedelta(days=365)
    last_year_start = last_year_end - timedelta(days=days)

    fmt = "%Y-%m-%dT%H:%M:%SZ"

    try:
        async with httpx.AsyncClient() as client:
            this_year, last_year = await asyncio.gather(
                _fetch_sst_point(client, site["lat"], site["lng"],
                                 this_year_start.strftime(fmt), this_year_end.strftime(fmt)),
                _fetch_sst_point(client, site["lat"], site["lng"],
                                 last_year_start.strftime(fmt), last_year_end.strftime(fmt)),
                return_exceptions=True,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"NOAA ERDDAP error: {exc}")

    result = {
        "site_id": site_id,
        "site_name": site["name"],
        "mmm_c": site["mmm_c"],
        "this_year": this_year if not isinstance(this_year, Exception) else [],
        "last_year": last_year if not isinstance(last_year, Exception) else [],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    cache.set(cache_key, result)
    return result


# ── DHW Forecast ──────────────────────────────────────────────────────────────

def _calc_dhw(readings: list[dict], mmm: float) -> float:
    """Calculate Degree Heating Weeks from last 84 days of SST readings."""
    dhw = 0.0
    for r in readings[-84:]:
        hotspot = r["sst_c"] - (mmm + 1.0)
        if hotspot > 0:
            dhw += hotspot / 7.0
    return round(dhw, 2)


@router.get("/dhw-forecast/{site_id}")
async def get_dhw_forecast(site_id: str, forecast_days: int = 28):
    """Project DHW accumulation forward using current SST trend."""
    site = next((s for s in REEF_SITES if s["id"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail="Reef site not found")

    cache_key = f"dhw-forecast:{site_id}:{forecast_days}"
    if cached := cache.get(cache_key):
        return cached

    now = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0) - timedelta(days=2)
    start = now - timedelta(days=90)
    fmt = "%Y-%m-%dT%H:%M:%SZ"

    try:
        async with httpx.AsyncClient() as client:
            readings = await _fetch_sst_point(client, site["lat"], site["lng"],
                                               start.strftime(fmt), now.strftime(fmt))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"NOAA ERDDAP error: {exc}")

    if len(readings) < 14:
        raise HTTPException(status_code=422, detail="Insufficient SST data for forecast")

    mmm = site["mmm_c"]
    current_dhw = _calc_dhw(readings, mmm)

    # Linear trend from last 14 days
    recent_sst = [r["sst_c"] for r in readings[-14:]]
    sst_trend_per_day = (recent_sst[-1] - recent_sst[0]) / 14.0
    last_sst = recent_sst[-1]

    projected = []
    running_dhw = current_dhw
    for day in range(1, forecast_days + 1):
        proj_sst = last_sst + sst_trend_per_day * day
        hotspot = max(0.0, proj_sst - (mmm + 1.0))
        running_dhw += hotspot / 7.0
        projected.append({
            "day": day,
            "projected_sst_c": round(proj_sst, 2),
            "accumulated_dhw": round(running_dhw, 2),
        })

    result = {
        "site_id": site_id,
        "site_name": site["name"],
        "mmm_c": mmm,
        "current_dhw": current_dhw,
        "sst_trend_per_day": round(sst_trend_per_day, 4),
        "last_observed_sst": last_sst,
        "forecast": projected,
        "historical_readings": readings[-90:],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    cache.set(cache_key, result)
    return result


# ── Salinity (CO-OPS) ─────────────────────────────────────────────────────────

_SITE_TO_COOPS: dict[str, str] = {
    "hanauma_bay":    "1612340",  # Honolulu
    "kaneohe_bay":    "1612340",
    "sharks_cove":    "1612340",
    "molokini":       "1615680",  # Kahului, Maui
    "honolua_bay":    "1615680",
    "kealakekua_bay": "1617433",  # Kawaihae, Big Island
    "kona_coast":     "1617433",
    "tunnels_reef":   "1612480",  # Nawiliwili, Kauai
    "poipu":          "1612480",
    "french_frigate": "1619910",  # Sand Island, Midway (closest)
    "midway_atoll":   "1619910",
}

COOPS_API = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"


@router.get("/salinity/{site_id}")
async def get_salinity(site_id: str):
    """Return latest nearshore salinity (PSU) from the nearest NOAA CO-OPS station."""
    site = next((s for s in REEF_SITES if s["id"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail="Reef site not found")

    station_id = _SITE_TO_COOPS.get(site_id)
    if not station_id:
        return {"site_id": site_id, "salinity_psu": None, "station_id": None,
                "note": "No nearby salinity station", "fetched_at": datetime.now(timezone.utc).isoformat()}

    cache_key = f"salinity:{site_id}"
    if cached := cache.get(cache_key):
        return cached

    today = datetime.now(timezone.utc)
    begin = (today - timedelta(days=2)).strftime("%Y%m%d")
    end = today.strftime("%Y%m%d")

    url = (
        f"{COOPS_API}?product=salinity&application=coral_dashboard"
        f"&begin_date={begin}&end_date={end}&station={station_id}"
        f"&time_zone=GMT&units=metric&format=json"
    )
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=15.0)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {"site_id": site_id, "salinity_psu": None, "station_id": station_id,
                "note": "Salinity data unavailable", "fetched_at": datetime.now(timezone.utc).isoformat()}

    readings_raw = data.get("data", [])
    # Filter valid readings and take the most recent
    valid = [r for r in readings_raw if r.get("v") not in (None, "", "0.000")]
    salinity = round(float(valid[-1]["v"]), 2) if valid else None
    observed_at = valid[-1]["t"] if valid else None

    result = {
        "site_id": site_id,
        "station_id": station_id,
        "salinity_psu": salinity,
        "observed_at": observed_at,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    cache.set(cache_key, result)
    return result
