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

On Windows, install [VS Code](https://code.visualstudio.com/download),
[Python 3.12 with the launcher](https://www.python.org/downloads/windows/),
and [Node.js 22 LTS](https://nodejs.org/en/download). Download the
[feature branch ZIP](https://github.com/paolomrtnz/BuildSightPH/archive/refs/heads/buildsight-connected-overview.zip)
or use `git pull --ff-only` if already on that branch. Open the extracted
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

## Professor deployment handoff

Give the professor the chosen Git revision, the reviewed SQLite snapshot
separately, and its SHA-256 checksum. Run the existing Docker image with the
snapshot on persistent storage, `BUILDSIGHT_DB_PATH` pointing to the file,
and the host's `PORT` set if required. FastAPI serves all six React routes
and the API on one origin. Verify the HTTPS site, direct page links, and
`/api/overview` before attaching the team's domain through the professor's
hosting account. The domain name alone does not identify the hosting service.
The Render and VM instructions below are options for the professor.

## Deploy on Render

The repository's `render.yaml` describes one Docker web service in Singapore,
with a Starter instance and a 1 GB persistent disk mounted at `/var/data`.
At the published rates checked on November 27, 2026, this is about **US$7.25 per
month** before tax or usage charges ($7 compute plus $0.25 disk). Confirm prices
in the dashboard before creating the service. Render's Free web service has
ephemeral storage, no persistent disk or SSH, and spins down after 15 minutes
idle. It is unsuitable for this persistent SQLite setup. A disk-backed
service also uses a single instance. See
[Render pricing](https://render.com/pricing) and
[Persistent Disks](https://render.com/docs/disks).

1. Sign in at [Render](https://dashboard.render.com/) and authorize access to
   `paolomrtnz/BuildSightPH`. Choose **New → Blueprint**, select the
   `buildsight-connected-overview` branch and `render.yaml`, and review the
   billable Starter instance and disk before deploying. If using **New → Web
   Service** instead, choose the same branch, **Docker**, **Singapore**, and
   **Starter**. Add a 1 GB disk at `/var/data`, set
   `BUILDSIGHT_DB_PATH=/var/data/buildsight.sqlite`, and set the health check
   path to `/healthz`. Leave `PORT` at Render's assigned value (default
   `10000`). The Docker command binds to that port on `0.0.0.0`.
2. After the first deploy, add your **public** SSH key to your Render account
   and copy the service's SSH destination from **Connect → SSH**. Keep the
   private key on your computer. Open an SSH shell and check that the disk is
   writable with `test -w /var/data && echo writable`. If it fails, check
   that the disk is mounted and work with the service owner to grant the
   container account (UID 10001) access before uploading. The server health
   check succeeds before the upload so the SSH session can be opened. The
   dashboard data endpoints return 503 until the snapshot is installed.
3. From your computer, use SSH/SCP to copy the reviewed snapshot. Replace
   the sample file path and SSH target with your own. Compare the printed
   SHA-256 digests, then rename the file on the same disk. The application
   picks up the snapshot on the next request.

   ```bash
   DB=/absolute/path/to/buildsight_four_source_final.sqlite
   TARGET=YOUR_SERVICE@ssh.YOUR_REGION.render.com
   sha256sum "$DB"  # On macOS: shasum -a 256 "$DB"
   scp -s "$DB" "$TARGET:/var/data/.buildsight.sqlite.upload"
   ssh "$TARGET" 'sha256sum /var/data/.buildsight.sqlite.upload'
   # Only run this after confirming both digests match.
   ssh "$TARGET" 'chmod 600 /var/data/.buildsight.sqlite.upload && mv /var/data/.buildsight.sqlite.upload /var/data/buildsight.sqlite'
   ```

4. Copy the HTTPS URL shown on the service page. Open `/`, `/projects`,
   and `/api/overview` at that URL. Confirm all four cards match the
   local baseline, change the region, and try a contract search before
   sharing the URL. The Blueprint leaves automatic deploys off. Use
   **Manual Deploy** for reviewed updates to the feature branch.

FastAPI serves the built React files and relative `/api/` requests on the
same origin, including direct visits to regional, contractor, and project pages. The SQLite connection
is read-only. The 288 MiB file stays off GitHub and out of the container image.
Use the team's approved snapshot and keep the original separately. See
[Render SSH setup](https://render.com/docs/ssh) and
[secure file transfer](https://render.com/docs/disks#transferring-files).

## Deploy to a Linux VM with Docker

A VM is an alternative if the team already has access to one. Place the
snapshot on persistent storage and make the file readable by UID 10001.

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
It serves all six routes directly, including on refresh. Ensure a new
host can reach `/api/regions` and test both pages over public HTTPS before
sharing the link. Review the snapshot for publication with the team and mount
only the verified copy. The Git and Docker ignore rules exclude SQLite files.

For non-container Linux deployment, use the local build steps and start
`python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"`.

## Repository structure

- `frontend/` contains the React and TypeScript dashboard.
- `backend/` contains FastAPI routes and read-only snapshot queries.

## Disclaimer
This platform is a descriptive decision-support prototype based on publicly available data. Reported contract values do not represent verified government expenditures, and calculated progress metrics do not replace official DPWH monitoring systems.

## Authors
**Team 3DSA-1:** Hannah Garin, Lucas Loreto, Paolo Martinez, Shaun Reyes, Eira Young
