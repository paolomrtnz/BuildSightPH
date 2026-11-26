# BuildSight PH 

BuildSight PH is a Business Intelligence platform and data warehouse designed to monitor Philippine infrastructure projects. It integrates isolated public datasets from the DPWH and PSA into a unified SQLite database to track contract values, geographic distribution, and construction material price trends.

## Current dashboard

The Overview shows four KPIs, a national comparison of the 17 mapped regions,
an ongoing progress distribution, and a searchable preview of up to eight
recorded contracts. The full Project Explorer is a development placeholder.
Dedicated Regions, Contractors, and Material Prices pages are planned.

## Data Sources
The ETL pipeline processes data from four public endpoints:
1. **DPWH Infrastructure Contracts** (Historical CSV, 2016–2025)
2. **DPWH Transparency Dataset** (BetterGov PH Parquet)
3. **PSA Standard Geographic Code (PSGC)** (Q3 2026)
4. **PSA Construction Materials Retail Price Index** (2012–2026)

## Run the dashboard

Install Python 3.10+ and Node.js 22+. Obtain the team's verified
`buildsight_four_source_final.sqlite` snapshot from the
[project data folder](https://drive.google.com/drive/folders/1WBPtnasvE-GjOSbZ9HzeI3wOuqEmVKsv).
The database is supplied separately and opened read-only.

From the repository root on macOS or Linux:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
export BUILDSIGHT_DB_PATH=/absolute/path/to/buildsight_four_source_final.sqlite
python -m uvicorn backend.main:app
```

On Windows PowerShell, use `.venv\Scripts\Activate.ps1` to activate the
environment and set the variable with
`$env:BUILDSIGHT_DB_PATH = 'C:\path\to\buildsight_four_source_final.sqlite'`.

Open http://127.0.0.1:8000/ for the dashboard and
http://127.0.0.1:8000/docs for the API. The overview should show 248,220
contracts, about ₱6.38T in reported contract value, 65.86% average ongoing
progress, and a 30.27% low-progress ongoing rate.

For frontend development with automatic reloads, keep the API running on
port 8000 and run `npm --prefix frontend run dev` in another terminal.

## Overview API and definitions

| Endpoint | Query parameters | Result |
| --- | --- | --- |
| `/api/overview` | `region_id` | Four KPIs and eligible progress counts |
| `/api/regions` | | Available PSGC-mapped regions |
| `/api/overview/regional-comparison` | | National comparison by reported value and contract count |
| `/api/overview/progress-distribution` | `region_id` | Five valid-progress buckets |
| `/api/overview/contracts` | `region_id`, `q` | Up to eight contract records ordered by canonical key |

Omit `region_id` for All Records, including Central Office. The comparison
chart always uses the 17 geographic regions in `dpwh_psgc_region_map`. Counts
use one row per canonical contract key, which maps to a unique normalized
contract ID. Value totals sum `preferred_contract_cost_php`.
Progress statistics are restricted to `parquet_status = 'On-Going'` with
`preferred_progress_pct` in the inclusive 0–100 range. Less than 50% is a study
screening rule. The API returns null for averages and rates with no qualifying
records. The preview uses `v_contracts_for_reporting` and matches literal
substrings of contract IDs and project descriptions.

## Prepare a public deployment

Recommended for a capstone demo is one small Linux VM with Docker and a TLS
reverse proxy. The supplied SQLite file is approximately 288 MiB. Store it
outside the image and repository on persistent disk with read access for
container UID 10001. Plan room for the snapshot, updates, and image storage.
A managed Docker web service with a persistent disk is another option. Check
the host's current compute and disk prices, storage limits, and free-tier
restrictions before selecting it. Ephemeral storage and static-only hosting
cannot supply the persistent SQLite file and FastAPI runtime.

From the repository root:

```bash
docker build -t buildsight-ph .
docker run --rm --name buildsight-ph -p 127.0.0.1:8000:8000 \
  --mount "type=bind,source=/absolute/path/to/buildsight_four_source_final.sqlite,target=/data/buildsight.sqlite,readonly" \
  -e BUILDSIGHT_DB_PATH=/data/buildsight.sqlite buildsight-ph
```

If your build network uses a private certificate authority, pass its trusted
CA bundle using `docker build --secret id=build_ca,src=/path/to/ca-bundle.pem -t buildsight-ph .`.

Point the host's HTTPS reverse proxy or managed ingress at the container's
`PORT` (default 8000). FastAPI serves both the built React app and relative
`/api/` URLs on that same origin, so cross-origin access is unnecessary.
It serves `/` and `/projects` directly, including on refresh. Ensure a new
host can reach `/api/regions` and test both pages over public HTTPS before
sharing the link. Review the snapshot for publication with the team and mount
only the verified copy. The Git and Docker ignore rules exclude SQLite files.

For non-container Linux deployment, use the local build steps and start
`python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"`.

## Repository structure

- `frontend/` contains the React and TypeScript dashboard.
- `backend/` contains the FastAPI routes and read-only reporting query.

## Disclaimer
This platform is a descriptive decision-support prototype based on publicly available data. Reported contract values do not represent verified government expenditures, and calculated progress metrics do not replace official DPWH monitoring systems.

## Authors
**Team 3DSA-1:** Hannah Garin, Lucas Loreto, Paolo Martinez, Shaun Reyes, Eira Young
