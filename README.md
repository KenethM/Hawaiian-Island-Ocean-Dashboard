# Hawaii Coral Reef Health Dashboard

A unified ocean health dashboard for Hawaiian reef sites — combining live NOAA satellite data, community diver observations, and long-term ocean chemistry records.

## Features

- **Live NOAA SST** — daily sea surface temperature from NOAA/JPL MUR SST Analysis (1 km resolution)
- **Bleaching alerts** — color-coded risk levels per site based on CRW Bleaching Alert Area (BAA 0–4 scale)
- **Interactive Leaflet map** — 11 Hawaiian reef sites from Midway Atoll to Poipu Beach, click any site for detail
- **Temperature trend chart** — 60-day SST history with Watch/Warning reference lines
- **Diver observation log** — submit bleaching %, coral cover, species notes, water temp (auth required)
- **Community dashboard** — aggregated diver reports by site with trend charts
- **Alert banner** — surfaces all sites currently at Watch or Warning across the top of the dashboard
- **Ocean pH dashboard** — 36 years of Station ALOHA HOT data (1988–2024), multi-source toggle, linear + seasonal ML forecast with 95% CI band and 24-month projection
- **User accounts** — register/login with diver profile (affiliation, cert level), JWT auth

## Data Sources

| Source | What it provides |
|--------|-----------------|
| [NOAA/JPL MUR SST](https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.html) | Daily 1 km sea surface temperature via ERDDAP |
| [NOAA Coral Reef Watch](https://coralreefwatch.noaa.gov/) | Bleaching Alert Area (BAA), Degree Heating Weeks, Hotspot values |
| [SOEST / HOT](https://hahana.soest.hawaii.edu/hot/) | Station ALOHA ocean pH, pCO₂, aragonite saturation (1988–present) |
| Community divers | In-situ bleaching %, coral cover, species notes |

## Stack

```
frontend/   React 18 + Vite + TypeScript + Leaflet + Recharts + Tailwind CSS
backend/    Python 3.12 + FastAPI + SQLAlchemy 2.0 async + httpx + numpy
database    PostgreSQL 15
infra       Docker Compose (db + backend + frontend)
```

## Quick Start (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Alembic migrations run automatically on backend startup — no manual step needed.

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

## Bleaching Alert Levels (NOAA CRW BAA)

| BAA | Label | Color |
|-----|-------|-------|
| -1 | Below MMM | Blue |
| 0 | No Stress | Green |
| 1 | Watch | Orange |
| 2 | Warning | Red |
| 3 | Alert Level 1 | Dark red |
| 4 | Alert Level 2 | Maroon |

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

## Ocean pH

The pH dashboard uses HOT (Hawaii Ocean Time-series) data from Station ALOHA (22.75°N, 158°W). Data is loaded via CSV upload through the admin interface. The prediction model fits a linear + annual sinusoidal regression to monthly-averaged HOT pH readings and projects 24 months ahead with a 95% confidence interval.

To add your own pH data: Sign in → Ocean pH tab → Upload Data (CSV). Required columns: `measured_at`, `ph`. Optional: `pco2`, `aragonite_sat`.

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routers: noaa, diver_logs, alerts, auth, ph
│   │   ├── core/          # security.py (JWT/bcrypt), cache.py (1-hr TTL)
│   │   ├── data/          # reef_sites.py — 11 hardcoded Hawaiian reef sites + MMM
│   │   ├── db/            # SQLAlchemy async engine + session factory
│   │   ├── models/        # ORM: user.py, diver_log.py, ph_reading.py
│   │   ├── schemas/       # Pydantic: user.py, diver_log.py, ph.py
│   │   └── main.py        # App factory + Alembic lifespan
│   ├── alembic/
│   │   └── versions/
│   │       ├── 001_initial_schema.py   # users + diver_logs
│   │       └── 002_add_ph_readings.py  # ph_readings
│   ├── scripts/
│   │   └── import_hot.py  # HOT flat-file / CSV importer (run inside Docker)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Map/        ReefMap.tsx, HealthLegend.tsx
│       │   ├── Charts/     TempTrendChart, CommunityChart, BleachingHistoryChart,
│       │   │               ReportsOverTimeChart, PhChart.tsx
│       │   ├── DiverLog/   DiverLogForm.tsx, DiverLogList.tsx
│       │   ├── Auth/       AuthModal.tsx
│       │   └── PhDashboard.tsx
│       ├── context/        AuthContext.tsx
│       ├── hooks/          useCurrentConditions.ts, useAlerts.ts,
│       │                   useSstHistory.ts, usePhData.ts
│       ├── services/       api.ts
│       └── types/          index.ts
└── docker-compose.yml
```
