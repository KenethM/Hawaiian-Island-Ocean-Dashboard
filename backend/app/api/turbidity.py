"""
Water clarity from NASA MODIS Aqua satellite via CoastWatch ERDDAP.

Dataset: erdMH1kd4901day — Diffuse Attenuation Coefficient at 490nm (Kd490), daily 4km resolution.
Lower Kd490 = clearer water. Typical Hawaiian reef values:
  < 0.06 m⁻¹  Very clear   (~28+ m estimated Secchi depth)
  0.06–0.10   Clear        (~17–28 m)
  0.10–0.20   Moderate     (~8–17 m)
  > 0.20      Turbid       (< 8 m)

Cloud cover causes data gaps. All 7 days are fetched in parallel so the user sees
a full week of history even when recent days are obscured.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import httpx
from fastapi import APIRouter, HTTPException

from app.data.reef_sites import REEF_SITES
from app.core import cache

router = APIRouter(prefix="/turbidity", tags=["turbidity"])

ERDDAP_BASE = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
# erdMH1kd4901day was retired 2022 — use the R2022 NRT reprocessing (2003-present)
KD490_DATASET = "erdMH1kd4901day_R2022NRT"
KD490_VAR = "Kd_490"
HISTORY_DAYS = 14


def _clarity_label(kd: float) -> tuple[str, str]:
    """Return (label, hex color) for a Kd490 value."""
    if kd < 0.06:
        return "Very Clear", "#22c55e"
    elif kd < 0.10:
        return "Clear", "#84cc16"
    elif kd < 0.15:
        return "Moderate", "#eab308"
    elif kd < 0.25:
        return "Slightly Turbid", "#f97316"
    else:
        return "Turbid", "#ef4444"


def _secchi_m(kd: float) -> float:
    """Approximate Secchi depth from Kd490 (Lee et al. relationship)."""
    return round(1.7 / kd, 1)


async def _fetch_kd490(client: httpx.AsyncClient, lat: float, lng: float, date_str: str) -> float | None:
    """Fetch Kd490 for a single point and day. Returns None on cloud cover or missing data."""
    url = (
        f"{ERDDAP_BASE}/{KD490_DATASET}.json"
        f"?{KD490_VAR}[({date_str}):1:({date_str})]"
        f"[({lat:.4f}):1:({lat:.4f})]"
        f"[({lng:.4f}):1:({lng:.4f})]"
    )
    try:
        resp = await client.get(url, timeout=20.0)
        resp.raise_for_status()
        rows = resp.json()["table"]["rows"]
        if rows and rows[0] and rows[0][-1] is not None:
            kd = float(rows[0][-1])
            if 0 < kd < 10:
                return kd
    except Exception:
        pass
    return None


@router.get("/{site_id}")
async def get_turbidity(site_id: str):
    site = next((s for s in REEF_SITES if s["id"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail="Reef site not found")

    cache_key = f"turbidity:{site_id}"
    if cached := cache.get(cache_key):
        return cached

    now = datetime.now(timezone.utc)

    # Fetch all days in parallel — much faster than sequential, and gives the user
    # a full week of history to skim even when recent days are cloud-covered.
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[
                _fetch_kd490(
                    client, site["lat"], site["lng"],
                    (now - timedelta(days=d)).strftime("%Y-%m-%dT12:00:00Z"),
                )
                for d in range(1, HISTORY_DAYS + 1)
            ],
            return_exceptions=True,
        )

    history = []
    for days_ago, kd_or_exc in enumerate(results, start=1):
        dt = now - timedelta(days=days_ago)
        kd = kd_or_exc if isinstance(kd_or_exc, float) else None
        if kd is not None:
            label, color = _clarity_label(kd)
            history.append({
                "date": dt.strftime("%Y-%m-%d"),
                "days_ago": days_ago,
                "kd490": round(kd, 4),
                "estimated_visibility_m": _secchi_m(kd),
                "label": label,
                "color": color,
            })
        else:
            history.append({
                "date": dt.strftime("%Y-%m-%d"),
                "days_ago": days_ago,
                "kd490": None,
                "estimated_visibility_m": None,
                "label": "No data",
                "color": "#d1d5db",
            })

    # Most recent non-null reading (for quick access / backward compat)
    latest = next((h for h in history if h["kd490"] is not None), None)

    result = {"site_id": site_id, "latest": latest, "history": history}
    cache.set(cache_key, result)
    return result
