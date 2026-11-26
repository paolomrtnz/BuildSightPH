import logging
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import analytics, explorer, overview

app = FastAPI(title="BuildSight PH API")
logger = logging.getLogger(__name__)


def read(operation, *args):
    database_path = os.environ.get("BUILDSIGHT_DB_PATH")
    if not database_path:
        raise HTTPException(status_code=503, detail="Dashboard database is not configured.")
    try:
        uri = Path(database_path).resolve().as_uri() + "?mode=ro"
        with closing(sqlite3.connect(uri, uri=True)) as connection:
            connection.row_factory = sqlite3.Row
            return operation(connection, *args)
    except sqlite3.Error as error:
        logger.exception("Unable to read the BuildSight PH database")
        raise HTTPException(status_code=503, detail="Dashboard database is unavailable.") from error


def geographic_region(region_id: Annotated[int | None, Query(ge=1)] = None) -> int | None:
    if region_id is not None and not any(
        row["region_id"] == region_id for row in read(overview.regions)
    ):
        raise HTTPException(status_code=404, detail="Geographic region not found.")
    return region_id


Region = Annotated[int | None, Depends(geographic_region)]


@app.get("/healthz", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/overview")
def summary(region_id: Region) -> dict:
    return read(overview.read_overview, region_id)


@app.get("/api/regions")
def available_regions() -> list[dict]:
    return read(overview.regions)


@app.get("/api/overview/regional-comparison")
def regional_comparison() -> list[dict]:
    return read(overview.regional_comparison)


@app.get("/api/overview/progress-distribution")
def progress_distribution(region_id: Region) -> list[dict]:
    return read(overview.progress_distribution, region_id)


@app.get("/api/overview/contracts")
def contract_preview(region_id: Region, q: Annotated[str, Query(max_length=120)] = "") -> list[dict]:
    return read(overview.contract_preview, region_id, q.strip())


@app.get("/api/projects/options")
def project_options() -> dict:
    return read(explorer.project_options)


@app.get("/api/projects")
def projects(filters: Annotated[explorer.ProjectFilters, Query()]) -> dict:
    return read(explorer.projects, filters)


@app.get("/api/projects/{contract_id}")
def project_detail(contract_id: str) -> dict:
    result = read(explorer.project_detail, contract_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Contract not found.")
    return result


@app.get("/api/contractors")
def contractors(filters: Annotated[analytics.ContractorFilters, Query()]) -> dict:
    return read(analytics.contractor_portfolios, filters)


@app.get("/api/contractors/{contractor_id}")
def contractor_detail(contractor_id: int, region_id: Region) -> dict:
    result = read(analytics.contractor_detail, contractor_id, region_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Contractor not found.")
    return result


@app.get("/api/material-prices/groups")
def material_groups() -> dict:
    return read(analytics.price_metadata)


Month = Annotated[str | None, Query(pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")]


@app.get("/api/material-prices")
def material_prices(group_id: int = 1, start: Month = None, end: Month = None) -> dict:
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="Start month must be before or equal to end month.")
    result = read(analytics.prices, group_id, start, end)
    if result is None:
        raise HTTPException(status_code=404, detail="Material group not found.")
    return result


@app.get("/api/methodology/coverage")
def coverage() -> dict:
    return read(analytics.coverage)


frontend_build = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if (frontend_build / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=frontend_build / "assets"), name="assets")

    if (frontend_build / "maps").is_dir():
        app.mount("/maps", StaticFiles(directory=frontend_build / "maps"), name="maps")

    @app.get("/", include_in_schema=False)
    @app.get("/projects", include_in_schema=False)
    @app.get("/projects/{contract_id}", include_in_schema=False)
    @app.get("/regions", include_in_schema=False)
    @app.get("/contractors", include_in_schema=False)
    @app.get("/contractors/{contractor_id}", include_in_schema=False)
    @app.get("/material-prices", include_in_schema=False)
    @app.get("/about", include_in_schema=False)
    def dashboard():
        return FileResponse(frontend_build / "index.html")
