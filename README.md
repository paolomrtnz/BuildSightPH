# BuildSight PH

BuildSight PH is a Business Intelligence platform and data warehouse designed to monitor Philippine infrastructure projects. It integrates isolated public datasets from the DPWH and PSA into a unified SQLite database to track contract values, geographic distribution, and construction material price trends.

## Website pages

- **Overview** shows the four validated cards, national regional comparison,
  progress distribution, and search with a contract preview.
- **Projects** supports server-side search, region/status/category/value/progress
  filters, sortable pagination, and detail pages with source comparisons.
- **Regions** shows clickable geographic boundaries, 17 mapped regions, national
  rankings, and regional summaries and contract previews.
- **Contractors** ranks deduplicated canonical portfolios and links to their
  project records. Joint contracts can appear in more than one portfolio.
- **Material Prices** charts the historical NCR CMRPI across eight series, with
  month-range filters and same-month prior-year changes.
- **About** documents the data, six study KPIs, and coverage limitations.

## Data Sources
The ETL pipeline processes data from four public endpoints:
1. **DPWH Infrastructure Contracts** (Historical CSV, 2016–2025)
2. **DPWH Transparency Dataset** (BetterGov PH Parquet)
3. **PSA Standard Geographic Code (PSGC)** (Q3 2026)
4. **PSA Construction Materials Retail Price Index** (2012–2026)

## Run the dashboard

Install Python 3.10+ and Node.js 22+. Download the
[approved SQLite snapshot (`buildsight_four_source_final.sqlite`)](https://drive.google.com/file/d/1wUXoaTf_Pm_NVd-xlNzSgChEOQyEAfea/view).
Keep the file outside Git. Before using it, compute its SHA-256 and compare
it with the expected digest supplied by the capstone team through a trusted
channel. See [snapshot transfer and verification](DEPLOYMENT.md#obtain-and-verify-the-sqlite-snapshot).

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

On Windows, install [VS Code](https://code.visualstudio.com/download),
[Python 3.12 with the launcher](https://www.python.org/downloads/windows/),
and [Node.js 22 LTS](https://nodejs.org/en/download). Download the
[main branch ZIP](https://github.com/paolomrtnz/BuildSightPH/archive/refs/heads/main.zip)
or run `git switch main` and `git pull --ff-only origin main` if you already have a checkout. Open the extracted
project root in VS Code and place the SQLite snapshot at
`data\buildsight_four_source_final.sqlite`. Run in the integrated PowerShell terminal:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
$env:BUILDSIGHT_DB_PATH = (Resolve-Path -LiteralPath '.\data\buildsight_four_source_final.sqlite' -ErrorAction Stop).Path
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/ for the dashboard and
http://127.0.0.1:8000/docs for the API. The overview should show 248,220
contracts, about ₱6.38T in reported contract value, 65.86% average ongoing
progress, and a 30.27% low-progress ongoing rate.

For frontend development with automatic reloads, keep the API running on
port 8000 and run `npm --prefix frontend run dev` in another terminal.

## API and definitions

| Endpoint | Query parameters | Result |
| --- | --- | --- |
| `/api/overview` | `region_id` | Four KPIs and eligible progress counts |
| `/api/regions` | | Available PSGC-mapped regions |
| `/api/overview/regional-comparison` | | National comparison by reported value and contract count |
| `/api/overview/progress-distribution` | `region_id` | Five valid-progress buckets |
| `/api/overview/contracts` | `region_id`, `q` | Up to eight contract records ordered by canonical key |
| `/api/projects` | Page, size, search, region, contractor, category, status, value/progress bounds, and sort | Canonical records and total matches |
| `/api/projects/options`, `/api/projects/{contract_id}` | | Available filters and a contract's linked details and source comparison |
| `/api/contractors`, `/api/contractors/{contractor_id}` | Search, region, pagination, and sorting on the collection | Deduplicated portfolios and individual summaries |
| `/api/material-prices/groups`, `/api/material-prices` | `group_id`, `start`, `end` on the series | NCR groups, observations, and year-over-year rates |
| `/api/methodology/coverage` | | Contract, contractor linkage, and progress disagreement totals |

Omit `region_id` for All Records, including Central Office. The comparison
chart always uses the 17 geographic regions in `dpwh_psgc_region_map`. Counts
use one row per canonical contract key, which maps to a unique normalized
contract ID. Value totals sum `preferred_contract_cost_php`.
Progress statistics are restricted to `parquet_status = 'On-Going'` with
`preferred_progress_pct` in the inclusive 0–100 range. Less than 50% is a study
screening rule. The API returns null for averages and rates with no qualifying
records. The preview uses `v_contracts_for_reporting` and matches literal
substrings of contract IDs and project descriptions.

Projects may include Central Office as an administrative filter. The Regions
map displays 3Q 2026 boundaries from [philippines-json-maps](https://github.com/faeldon/philippines-json-maps/tree/680e32e62baeccbcd8845d3b1387bc67c1baf78a),
with underlying NAMRIA/PSA geometry distributed through
[OCHA COD-AB](https://data.humdata.org/dataset/cod-ab-phl) under CC BY-IGO.
BARMM is shown as a reference boundary without mapped records. The map uses
bundled geometry and needs no tile service. The source coordinates are not
shown as project sites because their meaning and accuracy are unverified.

Run the snapshot integration checks after setting `BUILDSIGHT_DB_PATH`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

On macOS/Linux, use `python -m unittest discover -s tests -v` with the
virtual environment active.

## Build, test, and deploy

FastAPI serves the built React and TypeScript application, map boundaries, and
the API from one origin. SQLite opens the supplied snapshot read-only.
`BUILDSIGHT_DB_PATH` selects the database file. For Docker, `PORT` controls the
HTTP listener and defaults to 8000. Native Uvicorn uses the port specified by
`--port`.

GitHub Actions builds the frontend and runs production HTTP smoke tests with a
temporary synthetic SQLite fixture. To run the same checks locally, build the
frontend and run `python -m unittest discover -s tests -p test_http.py -v`.
Set `BUILDSIGHT_DB_PATH` to the approved snapshot and run the complete test
suite to verify the validated figures against the real database.

`main` is the approved deployment branch. See [DEPLOYMENT.md](DEPLOYMENT.md)
for verified snapshot transfer, Docker, native Linux, optional Render, and
rollbacks. The [deployment checklist](DEPLOYMENT_CHECKLIST.md) is for the
professor or hosting administrator. [.env.example](.env.example) contains
example values for the container.

## Repository structure

- `frontend/` contains the React and TypeScript dashboard.
- `backend/` contains FastAPI routes and read-only snapshot queries.

## Disclaimer
This platform is a descriptive decision-support prototype based on publicly available data. Reported contract values do not represent verified government expenditures, and calculated progress metrics do not replace official DPWH monitoring systems.

## Authors
**Team 3DSA-1:** Hannah Garin, Lucas Loreto, Paolo Martinez, Shaun Reyes, Eira Young
