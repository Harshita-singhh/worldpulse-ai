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

## Oracle Cloud Always Free deployment

The simplest single-VM setup uses Ubuntu ARM64 on an OCI Ampere A1 Always Free
VM, with PostgreSQL and FastAPI on loopback and Nginx serving the Vite build and
proxying API paths. The application does not require Docker or a production
Node.js server. Keep one FastAPI process: its in-process APScheduler runs the
USGS, bounded NASA FIRMS, and RSS jobs. Running multiple API processes or VMs
would duplicate scheduled ingestion.

OCI's published Always Free A1 allowance for Always Free tenancies is up to
2 OCPUs and 12 GB RAM total, with 200 GB of block volume storage across eligible
volumes. Availability depends on the home region and capacity; Always Free
compute instances may be reclaimed when they meet OCI's idle-instance criteria.
Check the current [Always Free resource limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
before provisioning.

### VM setup

1. In the OCI Console, create an Always Free A1 Flex VM in the tenancy's home
   region, using Ubuntu LTS ARM64. A single 2 OCPU / 12 GB VM is within the
   published Always Free allowance. Use an appropriately sized boot volume
   within the shared storage allowance.
2. Assign a public IPv4 address and add an SSH public key. Restrict ingress SSH
   (TCP 22) to your own public IP. Permit public TCP 80 and 443 for web traffic.
   Do not expose PostgreSQL (5432) or FastAPI (8000) publicly.
3. SSH into the VM, install PostgreSQL, Nginx, Python, and Node.js (Node is only
   needed to build the static frontend if you build it on the VM). Create a
   dedicated `worldpulse` Linux service account and application directory at
   `/opt/worldpulse-ai`.
4. Check out branch `agents/pasted-text-processing` at the reviewed release
   commit. Create a Python virtual environment at
   `/opt/worldpulse-ai/.venv` and install
   `backend/app/requirements.txt`.
5. Create a local PostgreSQL database and role. Keep PostgreSQL listening only
   on localhost. Apply `backend/migrations/000_baseline.sql`, then
   `backend/migrations/001_final_build.sql`. These migrations do not drop or
   delete existing data.
6. Create `/etc/worldpulse/worldpulse.env`, readable only by root and the
   `worldpulse` service group, with `DATABASE_URL`, `NASA_FIRMS_MAP_KEY`, and
   `CORS_ORIGINS`. Use `https://your-domain` for `CORS_ORIGINS` when using a
   domain; if initially using the VM's public IP over HTTP, use its exact
   `http://<public-ip>` origin until HTTPS is configured. Do not put secrets in
   Git.
7. Build the frontend from `frontend/` with `VITE_API_BASE_URL` set to an empty
   value, then copy the contents of `frontend/dist/` to `/var/www/worldpulse`.
   For example, on Ubuntu run `VITE_API_BASE_URL= npm run build`. The browser
   will use same-origin API paths.
8. Inspect existing Nginx and systemd configuration before installing
   `deploy/systemd/worldpulse-api.service` as
   `/etc/systemd/system/worldpulse-api.service` and
   `deploy/nginx/worldpulse.conf` as an Nginx site. Do not overwrite an
   existing unrelated site or service. Enable PostgreSQL, the WorldPulse
   systemd unit, and the Nginx site, then reload their services. The service
   template binds Uvicorn to `127.0.0.1:8000`.
9. Verify `/health` through Nginx, review service logs with
   `journalctl -u worldpulse-api`, and confirm scheduler startup.
10. For HTTPS, point a domain's DNS A record to the VM's public IP, ensure
    inbound ports 80/443 are allowed, and use Certbot with the Nginx plugin to
    obtain and renew a certificate. Rebuild only if the frontend API origin
    changes from same-origin routing.

The Nginx template serves the SPA and proxies `/events`, `/news`, `/weather`,
`/intelligence`, `/ingest`, and `/health` to FastAPI. Both services use
localhost-only backend access; CORS is configured from `CORS_ORIGINS` for the
public frontend origin.

### Environment variables

| Variable | Used by | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Backend | Yes | PostgreSQL connection string |
| `CORS_ORIGINS` | Backend | Production | Comma-separated allowed frontend origins |
| `NASA_FIRMS_MAP_KEY` | Backend | For wildfire ingestion | NASA FIRMS API key |
| `VITE_API_BASE_URL` | Frontend build | No for same-origin Nginx setup | Backend API origin; leave empty for same-origin API proxying |

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
