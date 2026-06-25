import os
import asyncio
import logging
import pathlib
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from alembic.config import Config
from alembic import command

from app.api import noaa, diver_logs, alerts
from app.api import auth
from app.api import ph
from app.api import tides, waves, turbidity
from app.api import weather
from app.api import admin
from app.api.alerts import run_notification_check
from app.db.database import AsyncSessionLocal

# Ensure all models are imported so Alembic autogenerate picks them up
import app.models.user            # noqa: F401
import app.models.diver_log       # noqa: F401
import app.models.ph_reading      # noqa: F401
import app.models.site_subscription  # noqa: F401
import app.models.species_sighting   # noqa: F401
import app.models.diver_log_photo    # noqa: F401
import app.models.alert_history      # noqa: F401
import app.models.audit_log          # noqa: F401
import app.models.reef_site_db       # noqa: F401

log = logging.getLogger(__name__)

_CHECK_INTERVAL_HOURS = float(os.getenv("ALERT_CHECK_INTERVAL_HOURS", "6"))

UPLOADS_DIR = pathlib.Path(os.getenv("UPLOADS_DIR", "/app/uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _run_migrations() -> None:
    ini_path = pathlib.Path(__file__).parent.parent / "alembic.ini"
    cfg = Config(str(ini_path))
    command.upgrade(cfg, "head")


async def _warm_cache() -> None:
    """Pre-fetch high-latency endpoints so first user requests hit cache."""
    try:
        from app.api.noaa import get_current_conditions
        from app.api.weather import get_weather_grid
        await asyncio.gather(
            get_current_conditions(),
            get_weather_grid(),
            return_exceptions=True,
        )
        log.info("Cache warm complete.")
    except Exception as exc:
        log.warning("Cache warm failed (non-fatal): %s", exc)


async def _notification_loop() -> None:
    await asyncio.sleep(60)
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await run_notification_check(db)
        except Exception as exc:
            log.error("Unhandled error in notification loop: %s", exc)
        await asyncio.sleep(_CHECK_INTERVAL_HOURS * 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    notif_task = asyncio.create_task(_notification_loop())
    asyncio.create_task(_warm_cache())
    yield
    notif_task.cancel()
    try:
        await notif_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Coral Reef Health Dashboard API",
    description="Live NOAA ocean data + diver observation logs for Hawaiian reef sites.",
    version="1.1.0",
    lifespan=lifespan,
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(noaa.router, prefix="/api")
app.include_router(diver_logs.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(ph.router, prefix="/api")
app.include_router(tides.router, prefix="/api")
app.include_router(waves.router, prefix="/api")
app.include_router(turbidity.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# Serve uploaded diver log photos
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/debug/connectivity")
async def debug_connectivity():
    """Temporary diagnostic endpoint — tests outbound HTTPS from Render."""
    import httpx
    results = {}

    async def probe(label: str, url: str, **kwargs):
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(url, timeout=20.0, **kwargs)
            results[label] = {"status": r.status_code, "preview": r.text[:300]}
        except Exception as exc:
            results[label] = {"error": type(exc).__name__, "detail": str(exc)[:300]}

    await probe(
        "open_meteo",
        "https://api.open-meteo.com/v1/forecast",
        params={"latitude": 21.27, "longitude": -157.82,
                "daily": "precipitation_sum", "timezone": "Pacific/Honolulu",
                "forecast_days": 1},
    )
    await probe(
        "erddap_sst",
        "https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json"
        "?analysed_sst[(2026-06-23T09:00:00Z):1:(2026-06-23T09:00:00Z)]"
        "[(21.27):1:(21.27)][(-157.82):1:(-157.82)]",
    )
    await probe(
        "erddap_crw",
        "https://coastwatch.pfeg.noaa.gov/erddap/griddap/NOAA_DHW.json"
        "?CRW_BAA[(2026-06-23T12:00:00Z):1:(2026-06-23T12:00:00Z)]"
        "[(21.27):1:(21.27)][(-157.82):1:(-157.82)]",
    )
    await probe(
        "viirs_chla",
        "https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdVHNchla1day.json"
        "?chla[(last):1:(last)][(0.0):1:(0.0)][(18.5):1:(22.5)][(-161.0):1:(-154.0)]",
    )
    # Test alternative ERDDAP servers
    await probe(
        "ncei_erddap_oisst",
        "https://www.ncei.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180.json"
        "?sst[(2026-06-23):1:(2026-06-23)][(0):1:(0)][(21.27):1:(21.27)][(-157.82):1:(-157.82)]",
    )
    await probe(
        "polarwatch_erddap",
        "https://polarwatch.noaa.gov/erddap/griddap/jplMURSST41.json"
        "?analysed_sst[(2026-06-23T09:00:00Z):1:(2026-06-23T09:00:00Z)]"
        "[(21.27):1:(21.27)][(-157.82):1:(-157.82)]",
    )
    return results
