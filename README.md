# Hawaii Coral Reef Health Dashboard

A live ocean health dashboard for Hawaiian reef sites — combining near-real-time satellite data, community diver observations, and long-term ocean chemistry records.

🌊 **Live site:** [kenethm.github.io/Hawaiian-Island-Ocean-Dashboard](https://kenethm.github.io/Hawaiian-Island-Ocean-Dashboard)
📋 **Feature audit:** [claude.ai/code/artifact/fbcd99d3-aa1d-4b6d-9fef-6e179329f7bc](https://claude.ai/code/artifact/fbcd99d3-aa1d-4b6d-9fef-6e179329f7bc)

---

## Features

- **Interactive reef map** — 11 Hawaiian sites from Midway Atoll to Poipu Beach, color-coded by bleaching risk
- **Sea surface temperature** — daily SST via Open-Meteo Marine API with 60-day history chart
- **Bleaching alerts** — NOAA Coral Reef Watch BAA/DHW/Hotspot (where available)
- **Chlorophyll-a overlay** — NASA GIBS VIIRS satellite imagery, browser-direct, no backend needed
- **Weather overlay** — Open-Meteo precipitation history + 7-day forecast across 25 grid points
- **Dark mode** — full theme toggle persisted to localStorage
- **Site comparison** — side-by-side panel for any two reef sites
- **Collapsible sidebar** — full-screen map view with one click
- **Help / cheat sheet** — `?` button explains all node colors, data sources, and affiliated orgs
- **Diver observation log** — submit bleaching %, coral cover, species notes (account required)
- **Community dashboard** — aggregated diver reports by site with trend charts, CSV export
- **Ocean pH dashboard** — 36 years of Station ALOHA HOT data (1988–2024), multi-source toggle, ML forecast with 95% CI and 24-month projection
- **User accounts** — register/login with diver profile (affiliation, cert level), JWT auth
- **Admin panel** — reef site management, alert history, audit log, pH CSV upload

---

## Data Sources

| Source | What it provides | Freshness |
|--------|-----------------|-----------|
| [Open-Meteo Marine](https://open-meteo.com/) | Sea surface temperature (current + 60-day history) | Updated every 6 h via cron |
| [NOAA Coral Reef Watch](https://coralreefwatch.noaa.gov/) | Bleaching Alert Area, Degree Heating Weeks, Hotspot | Updated every 6 h via cron |
| [NASA GIBS / VIIRS](https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) | Chlorophyll-a satellite imagery | 2-day lag, browser-direct WMS |
| [Open-Meteo Forecast](https://open-meteo.com/) | Precipitation history + 7-day forecast | Updated every 6 h via cron |
| [SOEST / HOT](https://hahana.soest.hawaii.edu/hot/) | Station ALOHA ocean pH, pCO₂, aragonite saturation (1988–present) | Admin CSV upload |
| Community divers | In-situ bleaching %, coral cover, species notes | Real-time on submit |

---

## Stack

```
frontend/   React 18 + Vite + TypeScript + Leaflet + Recharts + Tailwind CSS
backend/    Python 3.12 + FastAPI + SQLAlchemy 2.0 async + PostgreSQL
hosting     GitHub Pages (frontend) + Render (backend, free tier)
data cron   GitHub Actions — runs every 6 h, writes JSON to gh-pages/data/
```

---

## Architecture

```
GitHub Actions (every 6h)
  └── scripts/fetch_ocean_data.py
        ├── Open-Meteo Marine → SST + history
        ├── NOAA ERDDAP CRW  → bleaching data (may be blocked on cloud IPs)
        ├── Open-Meteo Forecast → weather grid
        └── writes JSON → gh-pages/data/
                ├── current-conditions.json
                ├── sst-history.json
                ├── weather.json
                └── chlorophyll.json

Browser (GitHub Pages)
  └── fetches backend API
        └── Render backend reads gh-pages/data/ as static cache
              └── serves /api/noaa/current-conditions, /api/noaa/sst/:id, etc.

Chlorophyll-a: browser hits NASA GIBS WMS directly (no backend)
```

---

## Bleaching Node Colors

| Color | Meaning |
|-------|---------|
| 🟢 Green | No Stress (BAA 0) |
| 🟠 Orange | Watch (BAA 1) |
| 🔴 Red | Warning (BAA 2) |
| 🔴 Dark red | Alert Level 1 (BAA 3) |
| 🟤 Maroon | Alert Level 2 (BAA 4) |
| 🔵 Blue | Below MMM — cooler than seasonal baseline |
| 🩵 Light blue | SST Unavailable — site has wave/tide data but no SST |

---

## Reef Sites

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

---

## Local Development

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
# → http://localhost:5173
```

**Fetch ocean data locally:**
```bash
pip install httpx
python scripts/fetch_ocean_data.py --output data/
```

---

## Admin Setup

To promote a user to admin, set the `ADMIN_BOOTSTRAP_SECRET` environment variable on Render, then call:

```js
fetch('https://hawaiian-island-ocean-dashboard.onrender.com/api/auth/bootstrap-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'your@email.com', secret: 'your-secret' })
}).then(r => r.json()).then(console.log)
```

Remove the env var after use. Sign out and back in to activate the admin badge.

---

## Ocean pH

The pH dashboard uses HOT (Hawaii Ocean Time-series) data from Station ALOHA (22.75°N, 158°W). Data is loaded via CSV upload through the admin interface. The prediction model fits a linear + annual sinusoidal regression to monthly-averaged HOT pH readings and projects 24 months ahead with a 95% confidence interval.

**To add data:** Sign in with an admin account → Ocean pH tab → Upload Data (CSV).
Required columns: `measured_at`, `ph`. Optional: `pco2`, `aragonite_sat`.

---

## Project Structure

```
├── .github/workflows/
│   ├── deploy.yml              # Build + deploy frontend to GitHub Pages
│   └── fetch-ocean-data.yml    # Cron: fetch ocean data → gh-pages/data/
├── scripts/
│   └── fetch_ocean_data.py     # Ocean data fetcher (SST, CRW, weather, Chl-a)
├── backend/
│   ├── app/
│   │   ├── api/                # FastAPI routers: noaa, diver_logs, alerts, auth, ph, admin
│   │   ├── core/               # security.py (JWT/bcrypt), cache.py (1-hr TTL)
│   │   ├── data/               # reef_sites.py — 11 sites + MMM baselines
│   │   ├── db/                 # SQLAlchemy async engine + session factory
│   │   ├── models/             # ORM: user, diver_log, ph_reading, alert_history, audit_log
│   │   ├── schemas/            # Pydantic schemas
│   │   └── main.py             # App factory + Alembic lifespan migrations
│   ├── alembic/versions/       # 9 migration files
│   └── scripts/
│       └── make_admin.py       # CLI admin promoter (for Render shell users)
└── frontend/src/
    ├── components/
    │   ├── Map/                ReefMap, HealthLegend, ChlorophyllOverlay, WeatherOverlay,
    │   │                       RecentSightingsFeed
    │   ├── Charts/             TempTrendChart, CommunityChart, BleachingHistoryChart,
    │   │                       ReportsOverTimeChart, PhChart, DhwForecastChart,
    │   │                       BleachingHistoryChart
    │   ├── DiverLog/           DiverLogForm, DiverLogList
    │   ├── Auth/               AuthModal
    │   ├── SitePanel.tsx
    │   ├── SiteComparison.tsx
    │   ├── PhDashboard.tsx
    │   ├── HelpModal.tsx
    │   └── AdminPanel.tsx
    ├── context/                AuthContext, ThemeContext
    ├── hooks/                  useCurrentConditions, useAlerts, useDiverLogs,
    │                           useSstHistory, usePhData, useWeatherData
    ├── services/               api.ts
    └── types/                  index.ts
```
