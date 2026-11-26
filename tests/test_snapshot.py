"""Integration checks against the team's full, read-only SQLite snapshot."""
import json
import os
import sqlite3
import unittest
from pathlib import Path
from statistics import quantiles

from pydantic import ValidationError

from backend import analytics, explorer, overview


class SnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = os.environ.get("BUILDSIGHT_DB_PATH")
        if not path:
            raise unittest.SkipTest("Set BUILDSIGHT_DB_PATH to run snapshot integration tests.")
        cls.path = Path(path).resolve()
        cls.modified = cls.path.stat().st_mtime_ns
        cls.db = sqlite3.connect(cls.path.as_uri() + "?mode=ro", uri=True)
        cls.db.row_factory = sqlite3.Row

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        if cls.path.stat().st_mtime_ns != cls.modified:
            raise AssertionError("The source snapshot changed during verification.")

    def test_source_is_read_only(self):
        with self.assertRaisesRegex(sqlite3.OperationalError, "readonly"):
            self.db.execute("CREATE TABLE test_writes_are_rejected (id int)")

    def test_overview_and_geography(self):
        national = overview.read_overview(self.db, None)
        self.assertEqual(national["total_contracts"], 248220)
        self.assertEqual(national["total_reported_contract_value_php"], 6379173272392.51)
        self.assertAlmostEqual(national["average_reported_ongoing_progress_pct"], 65.86, places=2)
        self.assertAlmostEqual(national["low_progress_ongoing_rate_pct"], 30.27, places=2)
        rows = overview.regional_comparison(self.db)
        self.assertEqual(len(rows), 17)
        self.assertEqual(sum(row["contract_count"] for row in rows), 247923)
        all_value = sum(row["reported_value_php"] for row in rows)
        region_three = next(row for row in rows if row["region_name"] == "Region III")
        self.assertAlmostEqual(100 * region_three["reported_value_php"] / all_value, 10.72, places=2)
        boundaries = json.loads((Path(__file__).resolve().parents[1] / "frontend/public/maps/philippines-regions.json").read_text())
        psgc = {item["properties"]["adm1_psgc"] for item in boundaries["features"]}
        self.assertEqual(psgc - {int(row["psgc_code"]) for row in rows}, {1900000000})
        for row in [None, *rows]:
            region_id = row["region_id"] if row else None
            summary = overview.read_overview(self.db, region_id)
            buckets = overview.progress_distribution(self.db, region_id)
            self.assertEqual(sum(bucket["contract_count"] for bucket in buckets), summary["valid_ongoing_contracts"])
            self.assertEqual(sum(bucket["contract_count"] for bucket in buckets[:2]), summary["low_progress_contracts"])

    def test_project_filters_sorting_pagination_and_detail(self):
        first = explorer.projects(self.db, explorer.ProjectFilters(page_size=10))
        second = explorer.projects(self.db, explorer.ProjectFilters(page_size=10, page=2))
        self.assertEqual(first["total"], 248220)
        self.assertEqual(second["total"], first["total"])
        self.assertTrue({row["contract_id"] for row in first["items"]}.isdisjoint(
            row["contract_id"] for row in second["items"]
        ))
        filters = explorer.ProjectFilters(q="bridge", region_id=7, status="Completed",
            min_progress=50, max_progress=100, min_value=1000, sort="value", direction="desc")
        result = explorer.projects(self.db, filters)
        self.assertGreater(result["total"], 0)
        rows = result["items"]
        values = [row["reported_value_php"] for row in rows]
        self.assertEqual(values, sorted(values, reverse=True))
        for row in rows:
            self.assertEqual(row["region_name"], "Region III")
            self.assertEqual(row["reported_status"], "Completed")
            self.assertIn("bridge", (row["contract_description"] or row["contract_id"]).lower())
            self.assertGreaterEqual(row["reported_progress_pct"], 50)
        detail = explorer.project_detail(self.db, rows[0]["contract_id"])
        self.assertEqual(detail["preferred_contract_cost_php"], rows[0]["reported_value_php"])
        category = detail["category_name"]
        category_id = next(item["category_id"] for item in explorer.project_options(self.db)["categories"]
                           if item["category_name"] == category)
        selected = explorer.projects(self.db, explorer.ProjectFilters(category_id=category_id, max_value=1_000_000))
        self.assertGreater(selected["total"], 0)
        self.assertTrue(all(row["category_name"] == category and row["reported_value_php"] <= 1_000_000
                            for row in selected["items"]))
        self.assertIsNone(explorer.project_detail(self.db, "__missing_contract__"))
        empty = explorer.projects(self.db, explorer.ProjectFilters(q="__missing_contract__%"))
        self.assertEqual(empty["total"], 0)
        with self.assertRaises(ValidationError):
            explorer.ProjectFilters(min_progress=70, max_progress=20)

    def test_contractor_rankings_and_linked_projects(self):
        portfolio = analytics.contractor_portfolios(self.db, analytics.ContractorFilters(page_size=5))
        self.assertEqual(portfolio["total"], 6788)
        leader = portfolio["items"][0]
        self.assertEqual(leader["contract_count"], 808)
        search = analytics.contractor_portfolios(self.db, analytics.ContractorFilters(
            q=leader["contractor_name"], page_size=5, sort="value"))
        self.assertIn(leader["contractor_key"], [row["contractor_key"] for row in search["items"]])
        for scope in [None, 7]:
            summary = analytics.contractor_detail(self.db, leader["contractor_key"], scope)
            records = explorer.projects(self.db, explorer.ProjectFilters(
                contractor_id=leader["contractor_key"], region_id=scope))
            self.assertEqual(summary["contract_count"], records["total"])
        self.assertIsNone(analytics.contractor_detail(self.db, 9999999, None))

    def test_after_filter_yoy_and_coverage(self):
        groups = analytics.price_metadata(self.db)["groups"]
        self.assertEqual(len(groups), 8)
        series = analytics.prices(self.db, 1, None, None)["observations"]
        self.assertEqual(len(series), 177)
        self.assertIsNone(series[0]["yoy_pct"])
        observations = analytics.prices(self.db, 1, "2026-09", "2026-09")["observations"]
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0]["index_value"], 129.8)
        self.assertEqual(round(observations[0]["yoy_pct"], 2), 2.04)
        changes = [row["yoy_pct"] for row in series if row["yoy_pct"] is not None]
        self.assertEqual(round(quantiles(changes, n=4, method="inclusive")[2], 2), 2.40)
        self.assertEqual(analytics.prices(self.db, 2, "2030-01", None)["observations"], [])
        coverage = analytics.coverage(self.db)
        self.assertEqual(coverage["central_office"], 297)
        self.assertEqual(coverage["linked_contracts"], 167416)
        self.assertEqual((coverage["flagged_progress"], coverage["comparable_progress"]), (4902, 169129))


if __name__ == "__main__":
    unittest.main()
