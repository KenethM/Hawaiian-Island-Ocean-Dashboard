"""
NOAA data fetching via ERDDAP.

SST source: NOAA/JPL MUR SST Analysis (jplMURSST41) — 1 km daily, in °C.
CRW source: NOAA Coral Reef Watch (NOAA_DHW) — 5 km daily.
  Provides Bleaching Alert Area (BAA 0-4), Degree Heating Weeks (DHW), and Hotspot.
ERDDAP URL: https://coastwatch.pfeg.noaa.gov/erddap/griddap/
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
import httpx
from fastapi import APIRouter, HTTPException

from app.data.reef_sites import REEF_SITES
from app.core import cache

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


async def _fetch_crw_point(
    client: httpx.AsyncClient, lat: float, lng: float, date_str: str
) -> dict[str, Any] | None:
    """Fetch CRW BAA, DHW, and Hotspot for a single point from NOAA_DHW dataset."""
    url = (
        f"{ERDDAP_BASE}/{CRW_DATASET}.json"
        f"?CRW_BAA,CRW_DHW,CRW_HOTSPOT"
        f"[({date_str}):1:({date_str})]"
        f"[({lat:.4f}):1:({lat:.4f})]"
        f"[({lng:.4f}):1:({lng:.4f})]"
    )
    resp = await client.get(url, timeout=20.0)
    resp.raise_for_status()
    data = resp.json()
    rows = data["table"]["rows"]
    if not rows:
        return None
    row = rows[-1]
    # columns: time, latitude, longitude, CRW_BAA, CRW_DHW, CRW_HOTSPOT
    return {
        "baa":     int(row[3])          if row[3] is not None else None,
        "dhw":     round(float(row[4]), 2) if row[4] is not None else None,
        "hotspot": round(float(row[5]), 2) if row[5] is not None else None,
    }


async def _fetch_sst_point(client: httpx.AsyncClient, lat: float, lng: float, start: str, end: str) -> list[dict]:
    url = (
        f"{ERDDAP_BASE}/{SST_DATASET}.json"
        f"?analysed_sst[({start}):1:({end})]"
        f"[({lat:.4f}):1:({lat:.4f})]"
        f"[({lng:.4f}):1:({lng:.4f})]"
    )
    resp = await client.get(url, timeout=20.0)
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
    sst_end_str = lag_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    sst_start_str = (lag_dt - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    crw_date_str = lag_dt.strftime("%Y-%m-%dT12:00:00Z")

    results = []
    async with httpx.AsyncClient() as client:
        for site in REEF_SITES:
            sst_result, crw_result = await asyncio.gather(
                _fetch_sst_point(client, site["lat"], site["lng"], sst_start_str, sst_end_str),
                _fetch_crw_point(client, site["lat"], site["lng"], crw_date_str),
                return_exceptions=True,
            )

            latest_sst = None
            if not isinstance(sst_result, Exception) and sst_result:
                latest_sst = sst_result[-1]["sst_c"]

            crw: dict | None = None
            if not isinstance(crw_result, Exception):
                crw = crw_result

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
