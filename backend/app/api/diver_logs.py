import csv
import io
import json
import os
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.diver_log import DiverLog
from app.models.diver_log_photo import DiverLogPhoto
from app.models.species_sighting import SpeciesSighting
from app.models.user import User
from app.schemas.diver_log import DiverLogCreate, DiverLogRead
from app.api.auth import require_user
from app.data.reef_sites import REEF_SITES

_VALID_SITE_IDS = {s["id"] for s in REEF_SITES}

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

router = APIRouter(prefix="/diver-logs", tags=["diver-logs"])


@router.post("/", response_model=DiverLogRead, status_code=201)
async def create_log(
    payload: DiverLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    if payload.reef_site_id not in _VALID_SITE_IDS:
        raise HTTPException(status_code=422, detail=f"Unknown reef_site_id '{payload.reef_site_id}'.")
    data = payload.model_dump(exclude={"species_sightings"})
    data["user_id"] = user.id
    if not data.get("diver_name") and user.full_name:
        data["diver_name"] = user.full_name
    log = DiverLog(**data)
    db.add(log)
    await db.flush()

    # Insert species sightings if provided
    for s in (payload.species_sightings or []):
        db.add(SpeciesSighting(
            diver_log_id=log.id,
            species_name=s["species_name"],
            count=s.get("count"),
            notes=s.get("notes"),
        ))

    await db.commit()
    await db.refresh(log)
    return log


@router.get("/export")
async def export_logs_csv(
    site_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
):
    """Download all diver logs as a CSV file."""
    q = select(DiverLog).order_by(DiverLog.dive_date.desc())
    if site_id:
        q = q.where(DiverLog.reef_site_id == site_id)
    if start_date:
        q = q.where(DiverLog.dive_date >= start_date)
    if end_date:
        q = q.where(DiverLog.dive_date <= end_date)

    result = await db.execute(q)
    logs = result.scalars().all()

    site_names = {s["id"]: s["name"] for s in REEF_SITES}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "site_id", "site_name", "diver_name", "dive_date",
        "depth_m", "coral_cover_pct", "bleaching_pct", "bleaching_severity",
        "water_temp_c", "visibility_m", "species_notes", "general_notes", "submitted_at"
    ])
    for log in logs:
        writer.writerow([
            log.id, log.reef_site_id, site_names.get(log.reef_site_id, log.reef_site_id),
            log.diver_name, log.dive_date, log.depth_m, log.coral_cover_pct,
            log.bleaching_pct, log.bleaching_severity, log.water_temp_c,
            log.visibility_m, log.species_notes, log.general_notes, log.submitted_at,
        ])

    output.seek(0)
    filename = f"diver_logs_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/", response_model=list[DiverLogRead])
async def list_logs(
    site_id: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    days: Optional[int] = Query(default=None, description="Only return logs from the last N days"),
    db: AsyncSession = Depends(get_db),
):
    q = select(DiverLog).order_by(DiverLog.dive_date.desc()).limit(limit)
    if site_id:
        q = q.where(DiverLog.reef_site_id == site_id)
    if days is not None:
        cutoff = date.today() - timedelta(days=days)
        q = q.where(DiverLog.dive_date >= cutoff)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{log_id}", response_model=DiverLogRead)
async def get_log(log_id: int, db: AsyncSession = Depends(get_db)):
    log = await db.get(DiverLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


# ── Species sightings ─────────────────────────────────────────────────────────

@router.get("/{log_id}/species")
async def list_species(log_id: int, db: AsyncSession = Depends(get_db)):
    """List species sightings for a diver log."""
    result = await db.execute(
        select(SpeciesSighting).where(SpeciesSighting.diver_log_id == log_id)
        .order_by(SpeciesSighting.species_name)
    )
    rows = result.scalars().all()
    return [
        {"id": r.id, "species_name": r.species_name, "count": r.count, "notes": r.notes}
        for r in rows
    ]


@router.post("/{log_id}/species", status_code=201)
async def add_species(
    log_id: int,
    species_name: str,
    count: Optional[int] = None,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Add a species sighting to an existing diver log."""
    log = await db.get(DiverLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    if log.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not your log")
    sighting = SpeciesSighting(diver_log_id=log_id, species_name=species_name, count=count, notes=notes)
    db.add(sighting)
    await db.commit()
    await db.refresh(sighting)
    return {"id": sighting.id, "species_name": sighting.species_name, "count": sighting.count, "notes": sighting.notes}


# ── Photo upload ──────────────────────────────────────────────────────────────

@router.post("/{log_id}/photos", status_code=201)
async def upload_photo(
    log_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Upload a photo for a diver log."""
    log = await db.get(DiverLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    if log.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not your log")
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported image type: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo exceeds 10 MB limit")

    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    dest = UPLOADS_DIR / unique_name
    dest.write_bytes(data)

    photo = DiverLogPhoto(
        diver_log_id=log_id,
        filename=unique_name,
        original_name=file.filename or unique_name,
        content_type=file.content_type,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return {"id": photo.id, "filename": photo.filename, "original_name": photo.original_name, "url": f"/api/uploads/{unique_name}"}


@router.get("/{log_id}/photos")
async def list_photos(log_id: int, db: AsyncSession = Depends(get_db)):
    """List photos for a diver log."""
    result = await db.execute(
        select(DiverLogPhoto).where(DiverLogPhoto.diver_log_id == log_id)
        .order_by(DiverLogPhoto.uploaded_at)
    )
    photos = result.scalars().all()
    return [
        {"id": p.id, "filename": p.filename, "original_name": p.original_name,
         "url": f"/api/uploads/{p.filename}", "uploaded_at": p.uploaded_at.isoformat()}
        for p in photos
    ]


@router.delete("/{log_id}/photos/{photo_id}", status_code=204)
async def delete_photo(
    log_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    log = await db.get(DiverLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    if log.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not your log")

    photo = await db.get(DiverLogPhoto, photo_id)
    if not photo or photo.diver_log_id != log_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    dest = UPLOADS_DIR / photo.filename
    if dest.exists():
        dest.unlink()

    await db.delete(photo)
    await db.commit()


# ── Stats ─────────────────────────────────────────────────────────────────────

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
