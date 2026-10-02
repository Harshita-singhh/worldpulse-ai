# WorldPulse AI

WorldPulse AI is a global event discovery dashboard built with React, FastAPI,
SQLAlchemy, PostgreSQL, APScheduler, and React Leaflet. It brings together
USGS earthquakes, Open-Meteo weather, NASA FIRMS wildfire detections, and
selected news RSS feeds. Event records retain source attribution; dashboard
briefs and activity analytics are deterministic summaries of stored data,
not predictions.

## Features

- Scheduled and on-demand USGS, NASA FIRMS, and RSS ingestion from BBC News,
  NPR, The Guardian, BBC Sport, India Today, The Indian Express, The Indian
  Express Entertainment, The Hindu Movies, TechCrunch, ScienceDaily, and BBC
  Business
- Source-aware event deduplication in the shared `events` table
- Current weather and weather signals from Open-Meteo
- Wildfire activity analysis grouped into deterministic geographic cells
- News feed summaries with source links and transparent keyword-based topics
- Activity trends, recent-event timeline, searchable map, and severity/category
  filters
- Five-minute dashboard refresh that preserves the last successful data on
  partial API failures

The news topic tag is rule-based, not AI-generated. No LLM service or key is
required. WorldPulse does not generate predictive risk scores.

## Requirements

- Python 3.10+
- Node.js 20.19+ or 22.12+
- PostgreSQL

## Local setup

### Database and backend

Create a PostgreSQL database named `worldpulse`. Copy `backend/.env.example` to
the repository root as `.env` and set a real `DATABASE_URL`. `NASA_FIRMS_MAP_KEY`
is required only for NASA FIRMS ingestion; an unset key does not prevent the API
from starting.

Initialize a fresh database by applying the baseline schema followed by the
additive migration. The baseline uses `CREATE TABLE IF NOT EXISTS`, so this
sequence also preserves an existing `events` table and its data:

```sh
psql "$DATABASE_URL" -f backend/migrations/000_baseline.sql
psql "$DATABASE_URL" -f backend/migrations/001_final_build.sql
```

Install and run the API from the `backend` directory:

```sh
python -m pip install -r app/requirements.txt
python -m uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`. Scheduler jobs are registered at
startup: USGS and bounded FIRMS ingestion run every 15 minutes, and RSS ingestion
runs every 30 minutes. Job errors are logged and do not terminate FastAPI.
Run a single API instance when using the in-process scheduler; multiple API
replicas would each schedule ingestion jobs.
Manual ingestion routes are:

- `POST /ingest/usgs`
- `POST /ingest/wildfires`
- `POST /ingest/news`

News is available at `GET /news`; event filtering is available at
`GET /events?category=wildfire`. Deterministic analytics are available at
`GET /intelligence/analytics`.

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local`, setting
`VITE_API_BASE_URL` if the API is not at the local development default. Then:

```sh
cd frontend
npm install
npm run dev
```

`npm run build` creates the static production site. `VITE_API_BASE_URL` is
embedded at build time. Set it to the deployed API origin when frontend and
backend use separate domains; if omitted in production, API requests use the
same origin.

## Deployment

Deploy the Python API and Vite static site separately, with a managed PostgreSQL
database. On the API service, install dependencies from
`backend/app/requirements.txt`, apply both migrations above in filename order,
and start with:

```sh
python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Configure the backend environment variables in the hosting provider's secret
manager. Set `CORS_ORIGINS` to the exact comma-separated frontend origins, for
example `https://worldpulse.example.com`; do not use `*` with credentials. Set
the frontend build variable `VITE_API_BASE_URL` to the backend's HTTPS origin.

### Environment variables

| Variable | Used by | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Backend | Yes | PostgreSQL connection string |
| `CORS_ORIGINS` | Backend | Production | Comma-separated allowed frontend origins |
| `NASA_FIRMS_MAP_KEY` | Backend | For wildfire ingestion | NASA FIRMS API key |
| `VITE_API_BASE_URL` | Frontend build | For separate production domains | Backend API origin |

Never commit `.env` files, database connection strings, or provider keys. No LLM
credentials are used.

## Validation

Backend checks:

```sh
cd backend
python -m pip install -r requirements-dev.txt
python -m compileall -q app
pytest
```

Frontend checks:

```sh
cd frontend
npm run lint
npm run build
```
