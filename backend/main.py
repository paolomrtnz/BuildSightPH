import logging
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import overview

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


frontend_build = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if (frontend_build / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=frontend_build / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/projects", include_in_schema=False)
    def dashboard():
        return FileResponse(frontend_build / "index.html")
