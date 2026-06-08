from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.diver_log import DiverLog
from app.models.user import User
from app.schemas.diver_log import DiverLogCreate, DiverLogRead
from app.api.auth import require_user

router = APIRouter(prefix="/diver-logs", tags=["diver-logs"])


@router.post("/", response_model=DiverLogRead, status_code=201)
async def create_log(
    payload: DiverLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    data = payload.model_dump()
    data["user_id"] = user.id
    if not data.get("diver_name") and user.full_name:
        data["diver_name"] = user.full_name
    log = DiverLog(**data)
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/", response_model=list[DiverLogRead])
async def list_logs(site_id: str | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)):
    q = select(DiverLog).order_by(DiverLog.dive_date.desc()).limit(limit)
    if site_id:
        q = q.where(DiverLog.reef_site_id == site_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{log_id}", response_model=DiverLogRead)
async def get_log(log_id: int, db: AsyncSession = Depends(get_db)):
    log = await db.get(DiverLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@router.get("/stats/over-time")
async def stats_over_time(days: int = 180, db: AsyncSession = Depends(get_db)):
    """Daily aggregates of report count, avg bleaching %, and avg coral cover % over the last N days."""
    cutoff = date.today() - timedelta(days=days)
    result = await db.execute(
        select(
            DiverLog.dive_date,
            func.count().label("count"),
            func.avg(DiverLog.bleaching_pct).label("avg_bleaching_pct"),
            func.avg(DiverLog.coral_cover_pct).label("avg_coral_cover_pct"),
        )
        .where(DiverLog.dive_date >= cutoff)
        .group_by(DiverLog.dive_date)
        .order_by(DiverLog.dive_date)
    )
    rows = result.all()
    return [
        {
            "date": str(r.dive_date),
            "count": r.count,
            "avg_bleaching_pct": round(r.avg_bleaching_pct, 1) if r.avg_bleaching_pct is not None else None,
            "avg_coral_cover_pct": round(r.avg_coral_cover_pct, 1) if r.avg_coral_cover_pct is not None else None,
        }
        for r in rows
    ]


@router.get("/stats/by-site")
async def stats_by_site(db: AsyncSession = Depends(get_db)):
    """Aggregate diver log counts, avg bleaching %, and avg coral cover per site."""
    result = await db.execute(
        select(
            DiverLog.reef_site_id,
            func.count().label("count"),
            func.avg(DiverLog.bleaching_pct).label("avg_bleaching_pct"),
            func.avg(DiverLog.coral_cover_pct).label("avg_coral_cover_pct"),
            func.max(DiverLog.dive_date).label("last_dive"),
        ).group_by(DiverLog.reef_site_id)
    )
    rows = result.all()
    return [
        {
            "reef_site_id": r.reef_site_id,
            "count": r.count,
            "avg_bleaching_pct": round(r.avg_bleaching_pct, 1) if r.avg_bleaching_pct else None,
            "avg_coral_cover_pct": round(r.avg_coral_cover_pct, 1) if r.avg_coral_cover_pct else None,
            "last_dive": str(r.last_dive),
        }
        for r in rows
    ]
