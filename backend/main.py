import logging
import os
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from .overview import read_overview

app = FastAPI(title="BuildSight PH API")
logger = logging.getLogger(__name__)


@app.get("/api/overview")
def overview() -> dict:
    database_path = os.environ.get("BUILDSIGHT_DB_PATH")
    if not database_path:
        raise HTTPException(status_code=503, detail="Dashboard database is not configured.")

    try:
        return read_overview(Path(database_path))
    except sqlite3.Error as error:
        logger.exception("Unable to read the BuildSight PH database")
        raise HTTPException(status_code=503, detail="Dashboard database is unavailable.") from error


frontend_build = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if (frontend_build / "index.html").is_file():
    app.mount("/", StaticFiles(directory=frontend_build, html=True), name="dashboard")
