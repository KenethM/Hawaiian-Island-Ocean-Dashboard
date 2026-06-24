"""
Alert endpoints — active NOAA bleaching alerts + per-site email subscriptions.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.noaa import get_current_conditions
from app.api.auth import require_user
from app.db.database import get_db
from app.models.user import User
from app.models.site_subscription import SiteSubscription
from app.models.alert_history import AlertHistory
from app.schemas.subscription import SubscriptionCreate, SubscriptionRead
from app.core.email import send_bleaching_alert

log = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])

# Minimum hours between repeat notifications for the same (user, site)
_NOTIFY_COOLDOWN_HOURS = 24


@router.get("/active")
async def get_active_alerts():
    """Return reef sites currently at bleaching Watch (level≥1) or above."""
    conditions = await get_current_conditions()
    alerts = [c for c in conditions if c["alert"]["level"] >= 1]
    return {
        "count": len(alerts),
        "alerts": sorted(alerts, key=lambda x: x["alert"]["level"], reverse=True),
    }


# ── Subscriptions ─────────────────────────────────────────────────────────────

@router.get("/subscriptions", response_model=list[SubscriptionRead])
async def list_subscriptions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Return the current user's site subscriptions."""
    result = await db.execute(
        select(SiteSubscription).where(SiteSubscription.user_id == user.id)
    )
    return result.scalars().all()


@router.post("/subscriptions", response_model=SubscriptionRead, status_code=201)
async def subscribe(
    payload: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Subscribe the current user to bleaching alerts for a reef site."""
    existing = await db.execute(
        select(SiteSubscription).where(
            SiteSubscription.user_id == user.id,
            SiteSubscription.reef_site_id == payload.reef_site_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already subscribed to this site")

    sub = SiteSubscription(user_id=user.id, reef_site_id=payload.reef_site_id)
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.delete("/subscriptions/{reef_site_id}", status_code=204)
async def unsubscribe(
    reef_site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Remove a subscription for the current user."""
    result = await db.execute(
        delete(SiteSubscription).where(
            SiteSubscription.user_id == user.id,
            SiteSubscription.reef_site_id == reef_site_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.commit()


# ── Background notification logic (called from main.py lifespan task) ─────────

async def run_notification_check(db: AsyncSession) -> int:
    """
    Check active alerts and email subscribed users who haven't been notified recently.
    Returns the number of notifications sent.
    """
    try:
        conditions = await get_current_conditions()
    except Exception as exc:
        log.warning("Notification check: failed to fetch NOAA conditions: %s", exc)
        return 0

    # Build a dict of reef_site_id → condition for sites at Watch+
    alerting: dict[str, dict] = {
        c["id"]: c for c in conditions if c["alert"]["level"] >= 1
    }
    if not alerting:
        return 0

    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(hours=_NOTIFY_COOLDOWN_HOURS)

    # Fetch subscriptions for alerting sites where cooldown has expired
    result = await db.execute(
        select(SiteSubscription, User)
        .join(User, SiteSubscription.user_id == User.id)
        .where(SiteSubscription.reef_site_id.in_(alerting.keys()))
        .where(
            (SiteSubscription.last_notified_at == None)  # noqa: E711
            | (SiteSubscription.last_notified_at < cooldown_cutoff)
        )
    )
    rows = result.all()

    sent = 0
    for sub, user in rows:
        site = alerting[sub.reef_site_id]
        ok = await send_bleaching_alert(
            to_email=user.email,
            site_name=site["name"],
            island=site.get("island", ""),
            alert_level=site["alert"]["level"],
            dhw=site.get("dhw"),
            hotspot=site.get("hotspot"),
        )
        if ok:
            sub.last_notified_at = datetime.now(timezone.utc)
            sent += 1

    if sent:
        await db.commit()

    # Record a snapshot of alert levels for all alerting sites
    for site in alerting.values():
        history_entry = AlertHistory(
            reef_site_id=site["id"],
            alert_level=site["alert"]["level"],
            alert_label=site["alert"]["label"],
            sst_c=site.get("sst_c"),
            dhw=site.get("dhw"),
            hotspot=site.get("hotspot"),
        )
        db.add(history_entry)
    if alerting:
        await db.commit()

    log.info("Notification check complete — %d emails sent", sent)
    return sent


@router.get("/history")
async def get_alert_history_public(site_id: str | None = None, days: int = 90):
    """Public endpoint: recent alert history without requiring admin."""
    from datetime import timedelta
    from sqlalchemy import desc as sa_desc
    # Return summary without DB — pull from cache or return empty
    # Full history requires admin via /admin/alert-history
    return {"message": "Use /api/admin/alert-history for full history (admin required)", "days": days}
