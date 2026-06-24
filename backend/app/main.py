import os
import asyncio
import logging
import pathlib
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    task = asyncio.create_task(_notification_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Coral Reef Health Dashboard API",
    description="Live NOAA ocean data + diver observation logs for Hawaiian reef sites.",
    version="1.1.0",
    lifespan=lifespan,
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

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
