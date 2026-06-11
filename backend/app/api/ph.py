"""Ocean pH API — aggregated from HOT, CMEMS, IPACOA, and DAR/Reef Check sources."""

import asyncio
import io
import csv
import math
import os
import tempfile
from datetime import datetime, timedelta, timezone
import numpy as np

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.ph_reading import PhReading
from app.schemas.ph import PhTrendPoint, PhPrediction, PhPredictionPoint
from app.api.auth import require_user
from app.models.user import User

router = APIRouter(prefix="/ph", tags=["ph"])

VALID_SOURCES = {"hot", "cmems", "ipacoa", "dar_reef_check"}
VALID_DATA_TYPES = {"observed", "modeled"}


@router.get("/trend", response_model=list[PhTrendPoint])
async def get_ph_trend(
    sources: list[str] = Query(default=["hot", "cmems", "ipacoa", "dar_reef_check"]),
    data_type: str | None = None,
    years: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Monthly averaged pH per source over the last N years."""
    start_dt = datetime.now(timezone.utc) - timedelta(days=years * 365)

    month_trunc = func.date_trunc(text("'month'"), PhReading.measured_at)

    stmt = (
        select(
            month_trunc.label("month"),
            PhReading.source,
            func.avg(PhReading.ph).label("avg_ph"),
            func.count().label("count"),
        )
        .where(PhReading.ph.is_not(None))
        .where(PhReading.source.in_(sources))
        .where(PhReading.measured_at >= start_dt)
    )
    if data_type:
        stmt = stmt.where(PhReading.data_type == data_type)

    stmt = stmt.group_by(month_trunc, PhReading.source).order_by(month_trunc, PhReading.source)

    rows = (await db.execute(stmt)).all()
    return [
        PhTrendPoint(
            date=row.month.strftime("%Y-%m"),
            source=row.source,
            avg_ph=round(float(row.avg_ph), 4),
            count=int(row.count),
        )
        for row in rows
    ]


@router.get("/prediction", response_model=PhPrediction)
async def get_ph_prediction(db: AsyncSession = Depends(get_db)):
    """Linear + seasonal trend fitted to HOT Station ALOHA data, plus 24-month forecast."""

    stmt = (
        select(PhReading.measured_at, PhReading.ph)
        .where(PhReading.source == "hot")
        .where(PhReading.ph.is_not(None))
        .order_by(PhReading.measured_at)
    )
    rows = (await db.execute(stmt)).all()

    # Aggregate to monthly averages first, then check we have enough distinct months
    monthly: dict[str, list[float]] = {}
    for dt, ph in rows:
        key = dt.strftime("%Y-%m")
        monthly.setdefault(key, []).append(ph)

    sorted_keys = sorted(monthly.keys())

    if len(sorted_keys) < 12:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough HOT data for prediction (need ≥12 months, have {len(sorted_keys)}). Import HOT data first.",
        )
    avg_ph = np.array([sum(monthly[k]) / len(monthly[k]) for k in sorted_keys])
    n = len(avg_ph)
    t = np.arange(n, dtype=float)

    # Design matrix: intercept + linear trend + annual sinusoid
    X = np.column_stack([
        np.ones(n),
        t,
        np.sin(2 * np.pi * t / 12),
        np.cos(2 * np.pi * t / 12),
    ])
    coeffs, _, _, _ = np.linalg.lstsq(X, avg_ph, rcond=None)
    y_pred = X @ coeffs
    sigma = float(np.std(avg_ph - y_pred))

    ss_res = float(np.sum((avg_ph - y_pred) ** 2))
    ss_tot = float(np.sum((avg_ph - avg_ph.mean()) ** 2))
    r_sq = round(1 - ss_res / ss_tot, 4) if ss_tot > 0 else None

    trend = [
        PhPredictionPoint(
            date=sorted_keys[i],
            ph=round(float(y_pred[i]), 4),
            lower=round(float(y_pred[i]) - 1.96 * sigma, 4),
            upper=round(float(y_pred[i]) + 1.96 * sigma, 4),
            is_forecast=False,
        )
        for i in range(n)
    ]

    # Forecast 24 months ahead
    last_year, last_month = map(int, sorted_keys[-1].split("-"))
    forecast = []
    for i in range(1, 25):
        fi = float(n + i - 1)
        t_f = np.array([1.0, fi, np.sin(2 * np.pi * fi / 12), np.cos(2 * np.pi * fi / 12)])
        ph_f = float(coeffs @ t_f)
        m = last_month + i
        y_f = last_year + (m - 1) // 12
        m_f = ((m - 1) % 12) + 1
        forecast.append(
            PhPredictionPoint(
                date=f"{y_f}-{m_f:02d}",
                ph=round(ph_f, 4),
                lower=round(ph_f - 1.96 * sigma, 4),
                upper=round(ph_f + 1.96 * sigma, 4),
                is_forecast=True,
            )
        )

    return PhPrediction(trend=trend, forecast=forecast, r_squared=r_sq)


@router.post("/admin/upload")
async def upload_ph_csv(
    source: str = Form(...),
    data_type: str = Form(...),
    location_name: str = Form(default=""),
    lat: float | None = Form(default=None),
    lng: float | None = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_user),
):
    """
    Upload a CSV file with pH readings. Requires authentication.

    Form fields:
      source:        hot | cmems | ipacoa | dar_reef_check
      data_type:     observed | modeled
      location_name: human-readable name (e.g. "Station ALOHA")
      lat, lng:      decimal degrees (optional)

    CSV columns (header row required):
      measured_at   — ISO 8601 datetime or YYYY-MM-DD
      ph            — float (e.g. 8.05)
      pco2          — float, optional
      aragonite_sat — float, optional
    """
    if source not in VALID_SOURCES:
        raise HTTPException(status_code=422, detail=f"Unknown source '{source}'. Use: {VALID_SOURCES}")
    if data_type not in VALID_DATA_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown data_type '{data_type}'. Use: {VALID_DATA_TYPES}")

    content = await file.read()
    text_content = content.decode("utf-8-sig")  # strip BOM if present

    reader = csv.DictReader(io.StringIO(text_content))
    fields = set(reader.fieldnames or [])
    if "measured_at" not in fields or "ph" not in fields:
        raise HTTPException(
            status_code=422,
            detail=f"CSV must have 'measured_at' and 'ph' columns. Found: {sorted(fields)}",
        )

    inserted = 0
    skipped = 0
    for row in reader:
        try:
            raw_dt = row["measured_at"].strip()
            if "T" in raw_dt or " " in raw_dt:
                dt = datetime.fromisoformat(raw_dt.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(raw_dt + "T00:00:00+00:00")

            ph_val = float(row["ph"]) if row.get("ph", "").strip() else None
            pco2_val = float(row["pco2"]) if row.get("pco2", "").strip() else None
            arag_val = float(row["aragonite_sat"]) if row.get("aragonite_sat", "").strip() else None

            db.add(
                PhReading(
                    source=source,
                    location_name=location_name or None,
                    lat=lat,
                    lng=lng,
                    measured_at=dt,
                    ph=ph_val,
                    pco2=pco2_val,
                    aragonite_sat=arag_val,
                    data_type=data_type,
                )
            )
            inserted += 1
        except (ValueError, KeyError):
            skipped += 1

    await db.commit()
    return {"inserted": inserted, "skipped": skipped}


@router.get("/sources")
async def get_ph_sources(db: AsyncSession = Depends(get_db)):
    """Return which sources have data and their record counts."""
    stmt = (
        select(
            PhReading.source,
            PhReading.data_type,
            func.count().label("count"),
            func.min(PhReading.measured_at).label("earliest"),
            func.max(PhReading.measured_at).label("latest"),
        )
        .group_by(PhReading.source, PhReading.data_type)
        .order_by(PhReading.source)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "source": r.source,
            "data_type": r.data_type,
            "count": r.count,
            "earliest": r.earliest.date().isoformat() if r.earliest else None,
            "latest": r.latest.date().isoformat() if r.latest else None,
        }
        for r in rows
    ]


@router.get("/fetch/cmems")
async def fetch_cmems_ph(
    start_date: str = "2015-01-01",
    end_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_user),
):
    """
    Fetch modeled pH from CMEMS (Copernicus Marine Service) for the Hawaiian region
    and insert into ph_readings as source='cmems', data_type='modeled'.

    Requires env vars: CMEMS_USER and CMEMS_PASSWORD
    Free account: https://data.marine.copernicus.eu/

    Dataset: cmems_mod_glo_bgc_my_0.083deg_P1M-m (Global Biogeochemistry Monthly)
    Variable: ph · Region: lat 18–23°N, lon -161–-154°W
    """
    try:
        import copernicusmarine
        import xarray as xr
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="copernicusmarine / xarray not installed — rebuild the Docker image.",
        )

    cmems_user = os.getenv("CMEMS_USER")
    cmems_pass = os.getenv("CMEMS_PASSWORD")
    if not cmems_user or not cmems_pass:
        raise HTTPException(
            status_code=503,
            detail=(
                "CMEMS credentials not configured. "
                "Set CMEMS_USER and CMEMS_PASSWORD environment variables. "
                "Free account: https://data.marine.copernicus.eu/"
            ),
        )

    end_dt = end_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _download_nc(tmp_path: str) -> None:
        copernicusmarine.subset(
            dataset_id="cmems_mod_glo_bgc_my_0.083deg_P1M-m",
            variables=["ph"],
            minimum_latitude=18.0,
            maximum_latitude=23.0,
            minimum_longitude=-161.0,
            maximum_longitude=-154.0,
            start_datetime=f"{start_date}T00:00:00",
            end_datetime=f"{end_dt}T23:59:59",
            output_filename=tmp_path,
            username=cmems_user,
            password=cmems_pass,
            force_download=True,
            disable_progress_bar=True,
        )

    with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as f:
        tmp_path = f.name

    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _download_nc, tmp_path)

        ds = xr.open_dataset(tmp_path)
        ph_var = ds["ph"]

        # Average over lat/lon → one monthly value per time step for Hawaii region
        # isel(depth=0) selects surface layer; fall back if no depth dimension
        ph_surface = ph_var.isel(depth=0) if "depth" in ph_var.dims else ph_var
        ph_mean = ph_surface.mean(dim=["latitude", "longitude"])

        inserted = 0
        skipped = 0
        for t_val, ph_val in zip(ph_mean.time.values, ph_mean.values):
            if ph_val is None or math.isnan(float(ph_val)):
                skipped += 1
                continue

            # numpy datetime64[ns] → Python datetime
            ts_s = int(np.datetime64(t_val, "s").astype(np.int64))
            ts = datetime.utcfromtimestamp(ts_s).replace(tzinfo=timezone.utc)

            # Upsert-style: skip if already present for this month
            existing = await db.execute(
                select(PhReading).where(
                    PhReading.source == "cmems",
                    PhReading.measured_at == ts,
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            db.add(
                PhReading(
                    source="cmems",
                    location_name="Hawaii Region (18–23°N, 161–154°W)",
                    lat=20.5,
                    lng=-157.5,
                    measured_at=ts,
                    ph=round(float(ph_val), 4),
                    data_type="modeled",
                )
            )
            inserted += 1

        await db.commit()
        ds.close()

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return {
        "inserted": inserted,
        "skipped": skipped,
        "start_date": start_date,
        "end_date": end_dt,
    }
