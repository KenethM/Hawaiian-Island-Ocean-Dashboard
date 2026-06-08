"""
NOAA data fetching via ERDDAP.

SST source: NOAA/JPL MUR SST Analysis (jplMURSST41) — 1 km daily, in °C.
ERDDAP URL: https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41
"""

from datetime import datetime, timedelta, timezone
from typing import Any
import httpx
from fastapi import APIRouter, HTTPException

from app.data.reef_sites import REEF_SITES

router = APIRouter(prefix="/noaa", tags=["noaa"])

ERDDAP_BASE = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
SST_DATASET = "jplMURSST41"


def _bleaching_level(sst: float, mmm: float) -> dict[str, Any]:
    diff = sst - mmm
    if diff >= 2.0:
        return {"level": 2, "label": "Warning", "color": "#ef4444"}
    elif diff >= 1.0:
        return {"level": 1, "label": "Watch", "color": "#f97316"}
    elif diff >= 0:
        return {"level": 0, "label": "Normal", "color": "#22c55e"}
    else:
        return {"level": -1, "label": "Below MMM", "color": "#3b82f6"}


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

    return {
        "site_id": site_id,
        "site_name": site["name"],
        "mmm_c": site["mmm_c"],
        "readings": readings,
    }


@router.get("/current-conditions")
async def get_current_conditions():
    """Return the latest SST and bleaching alert level for every reef site."""
    end_dt = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0) - timedelta(days=2)
    start_dt = end_dt - timedelta(days=1)
    end_str = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    start_str = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    results = []
    async with httpx.AsyncClient() as client:
        for site in REEF_SITES:
            try:
                readings = await _fetch_sst_point(client, site["lat"], site["lng"], start_str, end_str)
                latest_sst = readings[-1]["sst_c"] if readings else None
            except httpx.HTTPError:
                latest_sst = None

            alert = _bleaching_level(latest_sst, site["mmm_c"]) if latest_sst is not None else {"level": -99, "label": "No Data", "color": "#6b7280"}

            results.append({
                **{k: site[k] for k in ("id", "name", "island", "lat", "lng", "depth_m", "mmm_c", "description")},
                "sst_c": latest_sst,
                "alert": alert,
            })

    return results
