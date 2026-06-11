# Hawaii Coral Reef Health Dashboard — Handoff

## Project Overview
Community science dashboard that consolidates NOAA satellite data and diver observations for Hawaiian reef sites. Built as a passion project; target users are recreational divers, marine researchers, and conservationists. Contact: ChungSungChiu (starting at NOAA) offered to help — keep warm for data partnerships.

---

## Running the Project
```bash
docker compose up --build   # first run — builds images and runs migrations
docker compose up           # subsequent runs
docker compose down -v      # wipe DB volume (only if reverting past a migration)
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
| Migrations | Alembic (auto-runs on startup) |
| HTTP client | httpx (async) |
| Auth | JWT via python-jose, bcrypt 3.x via passlib |
| ML / stats | numpy (linear + seasonal regression for pH forecast) |

---

## What's Been Built

### Backend

#### NOAA / SST Layer
- **NOAA MUR SST** — live 1km daily sea surface temps via ERDDAP (`jplMURSST41`)
- **NOAA Coral Reef Watch (CRW)** — live DHW, BAA (0–4), and Hotspot via ERDDAP (`NOAA_DHW`)
  - BAA replaces the old SST-threshold alert system
  - Falls back to SST-based alerts if CRW is unavailable
  - SST and CRW fetched concurrently per site with `asyncio.gather`
- **Caching** — 1-hour in-memory TTL cache for all NOAA data (`app/core/cache.py`)

#### Authentication
- JWT issued on register/login, stored in localStorage on the frontend
- Open registration with optional diver profile (name, affiliation, cert level)
- `require_user` dependency used to gate write endpoints

#### Diver Observation Logs
- Full CRUD + stats aggregation endpoints
- `diver_logs` table has FK to `users.id` (nullable, SET NULL on delete)

#### Ocean pH Dashboard *(added this session)*
- `ph_readings` table via migration `002_add_ph_readings.py`
- 5 API endpoints in `app/api/ph.py`:
  - `GET /api/ph/trend` — monthly averaged pH per source, last N years
  - `GET /api/ph/prediction` — linear + seasonal model fit on HOT data, 24-month forecast with 95% CI
  - `GET /api/ph/sources` — record counts + date ranges per source
  - `POST /api/ph/admin/upload` — CSV upload (auth required), expects `measured_at` + `ph` columns
  - `GET /api/ph/fetch/cmems` — stub returning 503 until CMEMS credentials are set
- HOT data loaded: **346 records, 1988–2024**, Station ALOHA (22.75°N, 158°W)
- Prediction model: intercept + linear trend + sin/cos annual sinusoid via `numpy.linalg.lstsq`, 95% CI = ±1.96σ

#### Tides, Waves & Water Clarity
- `GET /api/tides/{site_id}` — NOAA CO-OPS, hourly 48h predictions + current water level + inferred high/low events; 30-min cache
  - Each site mapped to nearest active tide gauge (Honolulu, Mokuoloe, Kahului, Kawaihae, Nawiliwili)
- `GET /api/waves/{site_id}` — NOAA NDBC buoy realtime text files; returns wave height, period, swell direction, water temp, wind; color-coded conditions label (Calm → Dangerous)
  - Site-to-buoy mapping: Waimea Bay (N Shore), Barbers Point (SE Oahu), Kaneohe Bay, Kaumalapau (Lanai), Kona, NW Hawaii
- `GET /api/turbidity/{site_id}` — NASA MODIS Aqua Kd490 via CoastWatch ERDDAP (`erdMH1kd4901day_R2022NRT`); 14-day parallel fetch, returns full history array + most recent non-null reading
  - Lower Kd490 = clearer water; estimated Secchi depth via `1.7 / Kd490`
  - Cloud-cover gaps shown as "No data" in history — 14-day window ensures something is visible even during multi-day overcast stretches
  - **Dataset gotcha:** the original `erdMH1kd4901day` dataset was retired in 2022; variable is `Kd_490` (capital K, no altitude dimension)

#### Bleaching Alert Subscriptions
- `site_subscriptions` table via migration `003_add_site_subscriptions.py`
- Subscribe/unsubscribe/list endpoints in `app/api/alerts.py`
- `app/core/email.py` — async SMTP sender, styled HTML bleaching alert template
- Background loop in `main.py` sweeps subscriptions every 6h and emails users at Watch+ sites
- 24h cooldown tracked via `last_notified_at` on each subscription row

#### Database Migrations
| File | What it creates |
|---|---|
| `001_initial_schema.py` | `users`, `diver_logs` |
| `002_add_ph_readings.py` | `ph_readings` (with indexes on source, measured_at, data_type) |
| `003_add_site_subscriptions.py` | `site_subscriptions` (user_id FK, reef_site_id, last_notified_at) |

---

### Frontend

#### Dashboard Views
- **Map view** — interactive Leaflet map, 11 reef sites color-coded by CRW BAA level; diver log pins overlaid (color-coded by bleaching severity) with click-to-popup
- **Recent sightings feed** — sidebar panel showing last 90 days of diver reports; click a row to select that site on the map
- **Site panel — Overview tab** — SST, DHW, Hotspot + live Wave Conditions + Tides chart + 14-day Water Clarity history bars; "Alert me" subscribe button in header
- **Community Data** — bleaching/coral cover trends, reports over time, reports by site, recent observations
- **Ocean pH** — raw multi-source trend chart + model/prediction toggle with CI band

#### Live Conditions (Tides / Waves / Water Clarity)
- `useOceanConditions(siteId)` hook — fetches all three in parallel via `Promise.all`, re-fetches on site change
- `TideChart.tsx` — 48h Recharts AreaChart with H/L ReferenceDot markers and a dashed "now" reference line
- Water clarity display — 14-day scrollable bar history (each bar color-coded by clarity label, grayed for no-data days); most recent reading shown as summary above the bars
- **Docker / Windows note:** Vite HMR does not reliably pick up file changes on Windows host volumes. Run `docker compose restart frontend` after edits to force a reload.

#### Ocean pH Frontend *(added this session)*
- `src/hooks/usePhData.ts` — manages mode (raw/prediction), source selection, fetch lifecycle, race condition guard via `useRef`
- `src/components/Charts/PhChart.tsx` — two chart modes:
  - `PhRawChart`: LineChart, one line per active source, Y-domain [7.7, 8.4], pre-industrial reference line at 8.1
  - `PhPredictionChart`: ComposedChart with stacked Area CI band (transparent lower + colored ci_width), trend line, dashed forecast line
- `src/components/PhDashboard.tsx` — source selector chips, source status cards, collapsible CSV upload form (auth-gated)

#### Auth
- Auth modal (tabbed Sign In / Create Account), JWT in localStorage
- `AuthContext.tsx` exposes `login`, `register`, `logout`, `user`

#### Attribution
- Data attribution footer: "Data: NOAA/JPL MUR SST · NOAA CRW · HOT · CMEMS"

---

## Key File Locations
```
backend/
  app/
    api/          noaa.py, diver_logs.py, alerts.py, auth.py, ph.py,
                  tides.py, waves.py, turbidity.py
    core/         security.py, cache.py, email.py
    models/       user.py, diver_log.py, ph_reading.py, site_subscription.py
    schemas/      user.py, diver_log.py, ph.py, subscription.py
    data/         reef_sites.py   ← 11 hardcoded Hawaiian reef sites + MMM values
    db/           database.py
  alembic/
    versions/     001_initial_schema.py, 002_add_ph_readings.py, 003_add_site_subscriptions.py
  scripts/
    import_hot.py ← HOT flat-file/CSV importer; must run inside Docker container
  alembic.ini
  .env.example    ← set JWT_SECRET in production

frontend/
  src/
    components/
      Map/        ReefMap.tsx, HealthLegend.tsx, RecentSightingsFeed.tsx
      Charts/     TempTrendChart, CommunityChart, BleachingHistoryChart,
                  ReportsOverTimeChart, PhChart.tsx, TideChart.tsx
      DiverLog/   DiverLogForm.tsx, DiverLogList.tsx
      Auth/       AuthModal.tsx
      PhDashboard.tsx, SitePanel.tsx
    context/      AuthContext.tsx
    hooks/        useCurrentConditions.ts, useAlerts.ts, useSstHistory.ts, usePhData.ts,
                  useDiverLogs.ts, useOceanConditions.ts
    services/     api.ts
    types/        index.ts
```

---

## Bug Fixes Applied This Session

### 1. Backend crash — missing `email-validator`
**Root cause:** `requirements.txt` had both `pydantic>=2.4.0` and `pydantic[email]>=2.4.0`. pip resolved the base package first and skipped the email extras.
**Fix:** Removed the plain `pydantic>=2.4.0` line; kept only `pydantic[email]>=2.4.0`.

### 2. Backend crash — passlib/bcrypt incompatibility
**Root cause:** `bcrypt 5.0.0` (latest) enforces a strict 72-byte password limit. `passlib 1.7.4`'s internal `detect_wrap_bug()` test hashes a >72 byte string during backend initialization, which throws `ValueError` and crashes every request.
**Fix:** Pinned `bcrypt>=3.0.0,<4.0.0` in `requirements.txt`. bcrypt 3.x is fully compatible with passlib 1.7.4.

### 3. pH trend endpoint 500 — PostgreSQL GROUP BY parameterization
**Root cause:** `func.date_trunc("month", col)` causes SQLAlchemy to bind `"month"` as separate parameters (`$1`, `$3`, `$4`) in the SELECT, GROUP BY, and ORDER BY clauses. PostgreSQL treats these as different expressions and rejects the query with a `GroupingError`.
**Fix:** Assigned `month_trunc = func.date_trunc(text("'month'"), PhReading.measured_at)` once and reused the same Python object in all three clauses. `text("'month'")` embeds the string as a SQL literal instead of a bind parameter.

### 4. Prediction check on raw row count instead of month count
**Root cause:** The "not enough data" guard checked `len(rows) < 12` (raw DB rows), so 100 readings from a single month would incorrectly pass. The regression needs 12 distinct monthly averages.
**Fix:** Moved aggregation to a dict keyed by `YYYY-MM` before the guard, then checked `len(sorted_keys) < 12`.

### 5. Race condition in pH prediction fetching
**Root cause:** If the user toggled Raw → Prediction rapidly, `fetchPrediction` could fire twice before the first response returned, causing duplicate state updates.
**Fix:** Added `predictionFetchingRef = useRef(false)` as an in-flight guard — returns early if a fetch is already active.

### 6. React `FormEvent` import missing in `AuthModal.tsx`
**Root cause:** Handler typed as `React.FormEvent` without importing React.
**Fix:** Changed to `import { useState, useRef, type FormEvent }` and updated the handler signature.

---

## Known Notes & Gotchas

- **NOAA_DHW longitude format:** confirmed -180 to 180 (negative for Hawaii). A `NOAA_DHW_Lon0360` variant exists for 0–360 format — do NOT use that one.
- **MODIS Kd490 dataset:** use `erdMH1kd4901day_R2022NRT` (variable `Kd_490`, no altitude dim). The original `erdMH1kd4901day` was retired July 2022 — variable there was `k490`, which is different.
- **Turbidity cloud gaps:** Hawaii can have 10+ consecutive cloudy days over nearshore sites. The 14-day fetch window handles most stretches; if all 14 days are null, the bar chart shows all gray — that's real cloud cover, not a bug.
- **NDBC buoy reliability:** buoys occasionally go offline for maintenance. The waves endpoint silently returns `data: null` when a buoy file is unavailable — the UI shows "No buoy data" gracefully.
- **Tide times are UTC:** CO-OPS data is returned in GMT. Hawaii is UTC−10 (no DST), so subtract 10h for local time. Adding a timezone conversion to the display is a good future improvement.
- **Docker + Windows HMR:** Vite file-watch events don't reliably propagate from a Windows host into the container. After editing frontend files, run `docker compose restart frontend` to pick up changes instead of relying on hot reload.
- **Cache is in-memory** — clears on restart. Fine for single-process dev; would need Redis if running multiple backend instances.
- **`diver_name`** on DiverLog is still free-text for display; `user_id` FK links to the accounts table.
- **HOT importer script** (`scripts/import_hot.py`) must run **inside the Docker container** — it uses psycopg2 which is only installed there. Use the UI CSV upload at `POST /api/ph/admin/upload` for new data files instead.
- **CMEMS** — free account required at https://data.marine.copernicus.eu/ — set `CMEMS_USER` and `CMEMS_PASSWORD` env vars to activate the fetch endpoint.
- **DB volume** — if rolling back past a migration, run `docker compose down -v` to wipe the volume, then `docker compose up` to rebuild from scratch.

---

## Roadmap

### Interactive reef map layer enhancements
- Diver log pins overlaid on the Leaflet map — click opens a `Popup` with full report details (`ReefMap.tsx`)
- Pins color-coded by bleaching severity (green → dark red) via `diverPinIcon()` SVG
- `RecentSightingsFeed` sidebar (last 90 days) + `useDiverLogs` hook wired into `App.tsx`

### Bleaching alert notifications
- Full subscribe/unsubscribe/list API in `alerts.py` — `POST /api/alerts/subscriptions`, `DELETE`, `GET`
- `SiteSubscription` model + migration `003_add_site_subscriptions.py`
- SMTP email module (`app/core/email.py`) — styled HTML template, gracefully skips if env vars missing
- Background notification loop in `main.py` — runs every 6h (override with `ALERT_CHECK_INTERVAL_HOURS`)
- "Alert me" toggle button in `SitePanel.tsx` — auth-gated, 24h cooldown per user/site
- **To activate:** set `SMTP_USER`, `SMTP_PASSWORD` (and optionally `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`) env vars

### Tides, waves & water clarity
- Live tides (NOAA CO-OPS) with 48h prediction chart and rising/falling state
- Live wave conditions (NOAA NDBC buoys) with height, period, swell direction, and color-coded label
- 14-day water clarity history (NASA MODIS Kd490 via ERDDAP) with scrollable bar view in Site Panel

### CMEMS pH integration
- Endpoint stub exists at `GET /api/ph/fetch/cmems` — currently returns 503
- Needs: httpx OPeNDAP fetch, NetCDF parsing, insert as `source='cmems', data_type='modeled'`
- Product: `cmems_mod_glo_bgc_my_0.083deg_P1M-m`, variable `ph`, Hawaii region
- Free account required at https://data.marine.copernicus.eu/ — set `CMEMS_USER` and `CMEMS_PASSWORD`

### Hosting
- Nothing deployed yet — local Docker only
- Recommended: Railway ($5/mo) for backend + Postgres, Vercel (free) for frontend
- Also viable: Render, Fly.io (both support Docker)
- Pre-deploy checklist: set `JWT_SECRET`, set `CORS_ORIGINS` to prod domain, SSL cert, DB backup strategy
