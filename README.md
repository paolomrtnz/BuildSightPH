# BuildSight PH 

BuildSight PH is a Business Intelligence platform and data warehouse designed to monitor Philippine infrastructure projects. It integrates isolated public datasets from the DPWH and PSA into a unified SQLite database to track contract values, geographic distribution, and construction material price trends.

## Current dashboard

The executive overview shows four indicators from the historical SQLite snapshot.
Regional visualization, contractor analysis, NCR price trends, and the searchable
contract ledger are planned modules.

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
contracts, about ₱6.38T in reported contract value, 65.86% average reported
progress, and 17 mapped geographic regions.

For frontend development with automatic reloads, keep the API running on
port 8000 and run `npm --prefix frontend run dev` in another terminal.

## Deploy on a server

Build the frontend before starting FastAPI. Use the same database environment
variable on the server. When a hosting platform supplies `PORT`, start with:

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
```

FastAPI serves the built React files and the API on the same origin.
Set the SQLite path to a readable file on the host's filesystem or mounted volume.

## Repository structure

- `frontend/` contains the React and TypeScript dashboard.
- `backend/` contains the FastAPI routes and read-only reporting query.

## Disclaimer
This platform is a descriptive decision-support prototype based on publicly available data. Reported contract values do not represent verified government expenditures, and calculated progress metrics do not replace official DPWH monitoring systems.

## Authors
**Team 3DSA-1:** Hannah Garin, Lucas Loreto, Paolo Martinez, Shaun Reyes, Eira Young
