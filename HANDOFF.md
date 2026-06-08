# Hawaii Coral Reef Health Dashboard — Handoff

## Project Overview
Community science dashboard that consolidates NOAA satellite data and diver observations for Hawaiian reef sites. Built as a passion project; target users are recreational divers, marine researchers, and conservationists. Contact: ChungSungChiu (starting at NOAA) offered to help — keep warm for data partnerships.

---

## Running the Project
```bash
docker compose up        # starts PostgreSQL, FastAPI backend (8000), React frontend (5173)
docker compose down -v   # wipe DB volume (needed if schema changed without a migration)
```
Alembic runs `upgrade head` automatically on backend startup — no manual migration step needed.

---

## Tech Stack
| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Mapping | Leaflet / React-Leaflet |
| Charts | Recharts |
| Backend | FastAPI (Python 3.12) + SQLAlchemy 2.0 async |
| Database | PostgreSQL 15 (Docker) |
| Migrations | Alembic |
| HTTP client | httpx (async) |
| Auth | JWT via python-jose, bcrypt via passlib |

---

## What's Been Built

### Backend
- **NOAA MUR SST** — live 1km daily sea surface temps via ERDDAP (`jplMURSST41`)
- **NOAA Coral Reef Watch (CRW)** — live DHW, BAA (0–4), and Hotspot via ERDDAP (`NOAA_DHW`)
  - BAA replaces the old SST-threshold alert system
  - Falls back to SST-based alerts if CRW is unavailable
  - SST and CRW fetched concurrently per site with `asyncio.gather`
- **Diver observation logs** — full CRUD + stats aggregation endpoints
- **Authentication** — JWT, open registration, user profiles (name, affiliation, cert level)
- **Caching** — 1-hour in-memory TTL cache for all NOAA data (`app/core/cache.py`)
- **Alembic migrations** — `alembic/versions/001_initial_schema.py` covers users + diver_logs

### Frontend
- **Dashboard** — interactive Leaflet map, 11 reef sites color-coded by CRW BAA level
- **Site panel** — Overview (SST, DHW, Hotspot), Temperature chart (60-day SST), Log Dive, Reports tabs
- **Community Data** — bleaching/coral cover trends, reports over time, reports by site, recent observations
- **Log a Dive** — form gated behind auth; pre-fills diver name from profile
- **Auth modal** — Sign In / Create Account (tabbed), JWT stored in localStorage
- **Alert banner** — red banner when any site is at Watch or above; shows SST + DHW

### Alert Level Scale (CRW BAA)
| Level | Label | Color |
|---|---|---|
| 0 | No Stress | `#22c55e` |
| 1 | Watch | `#f97316` |
| 2 | Warning | `#ef4444` |
| 3 | Alert Level 1 | `#dc2626` |
| 4 | Alert Level 2 | `#7f1d1d` |
| -1 | Below MMM | `#3b82f6` |
| -99 | No Data | `#6b7280` |

---

## Key File Locations
```
backend/
  app/
    api/          noaa.py, diver_logs.py, alerts.py, auth.py
    core/         security.py, cache.py
    models/       user.py, diver_log.py
    schemas/      user.py, diver_log.py
    data/         reef_sites.py   ← 11 hardcoded Hawaiian reef sites
    db/           database.py
  alembic/
    versions/     001_initial_schema.py
  alembic.ini
  .env.example    ← add JWT_SECRET in production

frontend/
  src/
    components/
      Map/        ReefMap.tsx, HealthLegend.tsx
      Charts/     TempTrendChart, CommunityChart, BleachingHistoryChart, ReportsOverTimeChart
      DiverLog/   DiverLogForm.tsx, DiverLogList.tsx
      Auth/       AuthModal.tsx
    context/      AuthContext.tsx
    hooks/        useCurrentConditions.ts, useAlerts.ts, useSstHistory.ts
    services/     api.ts
    types/        index.ts
```

---

## Next Feature: Ocean pH Dashboard

### Concept
Aggregated pH display from multiple sources with two toggle modes:
- **Raw Data View** — plain pH readings from each source (live or archived), no modeling
- **Model / Prediction View** — trend + forecast algorithm built from historical data

### Data Sources (planned)
| Source | Access | Type | Status |
|---|---|---|---|
| SOEST / HOT | CSV download from hahana.soest.hawaii.edu/hot/ | Observed, historical back to 1988 | Ready to import |
| CMEMS | REST API (free, requires auth token) | Modeled, near-daily | API integration needed |
| IPACOA | Portal downloads, no confirmed API | Observed, patchy Hawaii coverage | Manual CSV import for now |
| Hawaii DAR / Reef Check | No API, direct contact or file uploads | Survey snapshots | Manual CSV import for now |

### Database Schema (to add via new Alembic migration)
```sql
ph_readings (
  id            SERIAL PRIMARY KEY,
  source        VARCHAR(50)    -- 'hot', 'cmems', 'ipacoa', 'dar_reef_check'
  location_name VARCHAR(200),
  lat           FLOAT,
  lng           FLOAT,
  measured_at   TIMESTAMPTZ,
  ph            FLOAT,
  pco2          FLOAT,         -- optional
  aragonite_sat FLOAT,         -- optional
  data_type     VARCHAR(20),   -- 'observed' or 'modeled'
  submitted_at  TIMESTAMPTZ DEFAULT now()
)
```

### Model / Prediction Layer
- Use HOT data (1988–present) as the training series
- Seasonal decomposition + linear regression → trend line + forecast
- buildable with scipy/scikit-learn in the backend
- Add `scipy` and `scikit-learn` to `requirements.txt`

### Build Order
1. Add `ph_readings` migration
2. SOEST/HOT CSV importer (one-time historical load)
3. CMEMS API integration (near-daily modeled pH)
4. pH chart UI with source selector toggle
5. Admin CSV upload endpoint for IPACOA / DAR data
6. Model/prediction layer on HOT data

---

## Remaining Roadmap (after pH)
- **Hosting** — nothing deployed yet; local Docker only
  - Options: Railway, Render, Fly.io (all support Docker Compose-style deploys)
  - Need: SSL cert, CDN for frontend, DB backup strategy, `JWT_SECRET` env var set properly

---

## Known Notes
- NOAA_DHW longitude format: confirmed -180 to 180 (negative for Hawaii). A `NOAA_DHW_Lon0360` variant exists for 0-360 format — do NOT use that one for Hawaii sites.
- DB volume must be wiped (`docker compose down -v`) if running an old schema without migrations. After that, Alembic handles all future changes.
- Cache is in-memory — clears on restart. Fine for single-process dev; would need Redis if running multiple backend instances in production.
- `diver_name` on DiverLog is still a free-text field for display; `user_id` FK links to the accounts table.
