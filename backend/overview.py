import sqlite3
from contextlib import closing
from pathlib import Path


def read_overview(database_path: Path) -> dict:
    database_uri = database_path.resolve().as_uri() + "?mode=ro"
    with closing(sqlite3.connect(database_uri, uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute("""
            SELECT
                COUNT(*) AS total_contracts,
                ROUND(SUM(c.preferred_contract_cost_php), 2) AS total_reported_contract_value_php,
                COUNT(DISTINCT m.psgc_code) AS geographic_regions,
                COUNT(CASE WHEN c.parquet_status = 'On-Going'
                    AND c.preferred_progress_pct BETWEEN 0 AND 100 THEN 1 END)
                    AS valid_ongoing_contracts,
                AVG(CASE WHEN c.parquet_status = 'On-Going'
                    AND c.preferred_progress_pct BETWEEN 0 AND 100
                    THEN c.preferred_progress_pct END) AS average_reported_ongoing_progress_pct
            FROM canonical_contracts AS c
            LEFT JOIN dpwh_psgc_region_map AS m ON c.region_id = m.region_id
        """).fetchone()
    return dict(row)
