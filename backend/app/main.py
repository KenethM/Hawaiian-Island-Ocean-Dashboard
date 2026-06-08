import os
import pathlib
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from alembic.config import Config
from alembic import command

from app.api import noaa, diver_logs, alerts
from app.api import auth
from app.api import ph


def _run_migrations() -> None:
    ini_path = pathlib.Path(__file__).parent.parent / "alembic.ini"
    cfg = Config(str(ini_path))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    yield


app = FastAPI(
    title="Coral Reef Health Dashboard API",
    description="Live NOAA ocean data + diver observation logs for Hawaiian reef sites.",
    version="1.0.0",
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


@app.get("/health")
async def health():
    return {"status": "ok"}
