# Hawaii Coral Reef Health Dashboard

A unified ocean health dashboard for Hawaiian reef sites — combining live NOAA satellite data with community diver observations.

## Features

- **Live NOAA SST** — daily sea surface temperature from NOAA/JPL MUR SST Analysis (1 km resolution)
- **Bleaching alerts** — color-coded risk levels per site based on MMM thresholds (NOAA CRW methodology)
- **Interactive Leaflet map** — 11 Hawaiian reef sites from Midway Atoll to Poipu Beach, click any site for detail
- **Temperature trend chart** — 60-day SST history with Watch/Warning reference lines
- **Diver observation log** — submit bleaching %, coral cover, species notes, water temp
- **Community dashboard** — aggregated diver reports by site with trend charts
- **Alert banner** — surfaces all sites currently at Watch or Warning across the top of the dashboard

## Data Sources

| Source | What it provides |
|--------|-----------------|
| [NOAA/JPL MUR SST](https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.html) | Daily 1 km sea surface temperature via ERDDAP |
| [NOAA Coral Reef Watch](https://coralreefwatch.noaa.gov/) | Bleaching alert thresholds, MMM baselines |
| Community divers | In-situ bleaching %, coral cover, species notes |

## Stack

```
frontend/   React 18 + Vite + TypeScript + Leaflet + Recharts + Tailwind CSS
backend/    Python 3.12 + FastAPI + SQLAlchemy 2.0 async + httpx
database    PostgreSQL 15
```

## Quick Start (Docker)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs

## Local Development (no Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
# Set DATABASE_URL in your environment
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Bleaching Alert Levels

| Level | Trigger | Color |
|-------|---------|-------|
| Normal | SST < MMM + 1°C | Green |
| Watch | SST ≥ MMM + 1°C | Orange |
| Warning | SST ≥ MMM + 2°C | Red |

MMM = Maximum Monthly Mean SST for each reef zone, sourced from NOAA CRW baselines.

## Reef Sites Covered

| Site | Island | MMM (°C) |
|------|--------|----------|
| Hanauma Bay | Oahu | 27.9 |
| Kaneohe Bay | Oahu | 27.6 |
| Shark's Cove | Oahu | 27.4 |
| Molokini Crater | Maui | 28.1 |
| Honolua Bay | Maui | 27.8 |
| Kealakekua Bay | Big Island | 27.5 |
| Kona Coast | Big Island | 27.7 |
| Tunnels Reef | Kauai | 27.2 |
| Poipu Beach | Kauai | 27.3 |
| French Frigate Shoals | NW Hawaii | 28.3 |
| Midway Atoll | NW Hawaii | 26.5 |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routers (noaa, diver_logs, alerts)
│   │   ├── data/          # Static reef site definitions + MMM values
│   │   ├── db/            # SQLAlchemy async engine + session
│   │   ├── models/        # ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   └── main.py        # App factory + lifespan
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/    # Map, Charts, DiverLog, AlertBanner, SitePanel
│       ├── hooks/         # useCurrentConditions, useSstHistory, useAlerts
│       ├── services/      # Axios API client
│       └── types/         # Shared TypeScript types
└── docker-compose.yml
```
