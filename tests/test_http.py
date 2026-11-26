"""Production HTTP smoke tests using a temporary, synthetic SQLite fixture."""
import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


class ProductionHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        directory = tempfile.TemporaryDirectory(prefix="BuildSight fixture ")
        cls.addClassCleanup(directory.cleanup)
        cls.database = Path(directory.name) / "snapshot #test.sqlite"
        with sqlite3.connect(cls.database) as db:
            db.executescript("""
                CREATE TABLE canonical_contracts (
                    contract_key INTEGER PRIMARY KEY, region_id INTEGER, preferred_contract_cost_php REAL,
                    parquet_status TEXT, preferred_progress_pct REAL
                );
                INSERT INTO canonical_contracts VALUES
                    (1, 1, 100, 'On-Going', 25), (2, 1, 300, 'On-Going', 75),
                    (3, 2, 500, 'Completed', 100), (4, 2, 100, 'On-Going', NULL);
                CREATE TABLE regions (region_id INTEGER PRIMARY KEY, region_name TEXT);
                INSERT INTO regions VALUES (1, 'Test region'), (2, 'Central Office');
                CREATE TABLE dpwh_psgc_region_map (region_id INTEGER PRIMARY KEY, psgc_code TEXT);
                INSERT INTO dpwh_psgc_region_map VALUES (1, '0100000000');
                CREATE TABLE cmrpi_material_groups (material_group_id INTEGER PRIMARY KEY, name TEXT);
                INSERT INTO cmrpi_material_groups VALUES (1, 'ALL ITEMS');
                CREATE TABLE cmrpi_monthly_indices (
                    material_group_id INTEGER, observation_month TEXT, index_value REAL
                );
                INSERT INTO cmrpi_monthly_indices VALUES (1, '2025-09-01', 100), (1, '2026-09-01', 104);
            """)
        db.close()
        cls.base = cls.start_server(directory.name, cls.database)

    @classmethod
    def start_server(cls, directory, database):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        log = tempfile.TemporaryFile(dir=directory)
        cls.addClassCleanup(log.close)
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
            env={**os.environ, "BUILDSIGHT_DB_PATH": str(database)},
        )
        cls.addClassCleanup(cls.stop_server, server)
        for _ in range(60):
            if server.poll() is not None:
                break
            try:
                with urlopen(base + "/healthz", timeout=1):
                    return base
            except URLError:
                time.sleep(0.1)
        log.seek(0)
        raise RuntimeError(log.read().decode(errors="replace"))

    @staticmethod
    def stop_server(server):
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()

    def test_overview_uses_configured_snapshot(self):
        with urlopen(self.base + "/api/overview", timeout=3) as response:
            overview = json.load(response)
        self.assertEqual(overview["total_contracts"], 4)
        self.assertEqual(overview["total_reported_contract_value_php"], 1000)
        self.assertEqual(overview["average_reported_ongoing_progress_pct"], 50)
        self.assertEqual(overview["low_progress_ongoing_rate_pct"], 50)
        with urlopen(self.base + "/api/overview?region_id=1", timeout=3) as response:
            region = json.load(response)
        self.assertEqual(region["total_contracts"], 2)
        self.assertEqual(region["total_reported_contract_value_php"], 400)
        with self.assertRaises(HTTPError) as error:
            urlopen(self.base + "/api/overview?region_id=2", timeout=3)
        self.assertEqual(error.exception.code, 404)

    def test_yoy_uses_prior_year_outside_filter(self):
        with urlopen(self.base + "/api/material-prices?start=2026-09&end=2026-09", timeout=3) as response:
            observations = json.load(response)["observations"]
        self.assertEqual(observations, [{"month": "2026-09-01", "index_value": 104, "yoy_pct": 4}])

    def test_six_pages_and_static_assets(self):
        pages = ("/", "/projects", "/regions", "/contractors", "/material-prices", "/about",
                 "/projects/example", "/contractors/1")
        for page in pages:
            with self.subTest(page=page), urlopen(self.base + page, timeout=3) as response:
                html = response.read().decode()
                self.assertIn('<div id="root">', html)
        assets = re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)
        self.assertTrue(assets, "Build frontend assets before running this test.")
        for asset in assets:
            with urlopen(self.base + asset, timeout=3) as response:
                self.assertTrue(response.read())
        with urlopen(self.base + "/maps/philippines-regions.json", timeout=3) as response:
            self.assertEqual(json.load(response)["type"], "FeatureCollection")

    def test_missing_snapshot_does_not_get_created(self):
        missing = self.database.parent / "missing.sqlite"
        base = self.start_server(self.database.parent, missing)
        with self.assertRaises(HTTPError) as error:
            urlopen(base + "/api/overview", timeout=3)
        self.assertEqual(error.exception.code, 503)
        self.assertFalse(missing.exists())
