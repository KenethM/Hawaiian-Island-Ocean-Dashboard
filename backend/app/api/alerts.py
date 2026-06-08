"""
Alert endpoints — wraps current NOAA conditions and surfaces only sites at Watch or above.
"""

from fastapi import APIRouter
from app.api.noaa import get_current_conditions

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/active")
async def get_active_alerts():
    """Return reef sites currently at bleaching Watch (level≥1) or above."""
    conditions = await get_current_conditions()
    alerts = [c for c in conditions if c["alert"]["level"] >= 1]
    return {
        "count": len(alerts),
        "alerts": sorted(alerts, key=lambda x: x["alert"]["level"], reverse=True),
    }
