"""
Admin endpoints: site management, alert history, audit log.
All routes require admin access.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_admin
from app.db.database import get_db
from app.models.alert_history import AlertHistory
from app.models.audit_log import AuditLog
from app.models.reef_site_db import ReefSiteDB
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def record_audit(
    db: AsyncSession,
    user: User,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict | None = None,
) -> None:
    entry = AuditLog(
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps(details) if details else None,
    )
    db.add(entry)


# ── Alert history ─────────────────────────────────────────────────────────────

@router.get("/alert-history")
async def get_alert_history(
    site_id: Optional[str] = None,
    days: int = Query(default=90, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Return historical bleaching alert levels for all or a specific site."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    q = (
        select(AlertHistory)
        .where(AlertHistory.recorded_at >= cutoff)
        .order_by(desc(AlertHistory.recorded_at))
        .limit(500)
    )
    if site_id:
        q = q.where(AlertHistory.reef_site_id == site_id)

    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "reef_site_id": r.reef_site_id,
            "alert_level": r.alert_level,
            "alert_label": r.alert_label,
            "sst_c": r.sst_c,
            "dhw": r.dhw,
            "hotspot": r.hotspot,
            "recorded_at": r.recorded_at.isoformat(),
        }
        for r in rows
    ]


# ── Reef site management ──────────────────────────────────────────────────────

class SiteCreate(BaseModel):
    id: str = Field(..., pattern=r"^[a-z0-9_]+$", max_length=100)
    name: str = Field(..., max_length=200)
    island: str = Field(..., max_length=100)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    depth_m: float = Field(..., ge=0, le=500)
    mmm_c: float = Field(..., ge=15, le=35)
    description: str | None = None


class SiteUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    island: str | None = Field(None, max_length=100)
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    depth_m: float | None = Field(None, ge=0, le=500)
    mmm_c: float | None = Field(None, ge=15, le=35)
    description: str | None = None
    is_active: bool | None = None


def _site_to_dict(s: ReefSiteDB) -> dict:
    return {
        "id": s.id, "name": s.name, "island": s.island,
        "lat": s.lat, "lng": s.lng, "depth_m": s.depth_m,
        "mmm_c": s.mmm_c, "description": s.description,
        "is_active": s.is_active, "created_at": s.created_at.isoformat(),
    }


@router.get("/sites")
async def list_sites(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(ReefSiteDB).order_by(ReefSiteDB.island, ReefSiteDB.name))
    return [_site_to_dict(s) for s in result.scalars().all()]


@router.post("/sites", status_code=201)
async def create_site(
    payload: SiteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    existing = await db.get(ReefSiteDB, payload.id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Site '{payload.id}' already exists")

    site = ReefSiteDB(**payload.model_dump())
    db.add(site)
    await record_audit(db, user, "site_create", "reef_site", payload.id, payload.model_dump())
    await db.commit()
    await db.refresh(site)
    return _site_to_dict(site)


@router.patch("/sites/{site_id}")
async def update_site(
    site_id: str,
    payload: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    site = await db.get(ReefSiteDB, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    updates = payload.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(site, k, v)

    await record_audit(db, user, "site_update", "reef_site", site_id, updates)
    await db.commit()
    await db.refresh(site)
    return _site_to_dict(site)


@router.delete("/sites/{site_id}", status_code=204)
async def delete_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    site = await db.get(ReefSiteDB, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    await record_audit(db, user, "site_delete", "reef_site", site_id)
    await db.delete(site)
    await db.commit()


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    action: Optional[str] = None,
    days: int = Query(default=30, le=365),
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Return recent admin audit log entries."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    q = (
        select(AuditLog)
        .where(AuditLog.created_at >= cutoff)
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    if action:
        q = q.where(AuditLog.action == action)

    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "user_email": r.user_email,
            "action": r.action,
            "resource_type": r.resource_type,
            "resource_id": r.resource_id,
            "details": json.loads(r.details) if r.details else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
