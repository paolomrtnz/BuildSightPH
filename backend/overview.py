import sqlite3

VALID_PROGRESS = "parquet_status = 'On-Going' AND preferred_progress_pct BETWEEN 0 AND 100"

REGIONS = """
    SELECT r.region_id, r.region_name, m.psgc_code
    FROM dpwh_psgc_region_map AS m JOIN regions AS r USING (region_id)
"""


def region_scope(region_id: int | None) -> tuple[str, dict]:
    if region_id is None:
        return "", {}
    return "WHERE region_id = :region", {"region": region_id}


def read_overview(db: sqlite3.Connection, region_id: int | None) -> dict:
    where, params = region_scope(region_id)
    return dict(db.execute(f"""
        WITH scope AS (
            SELECT preferred_contract_cost_php,
                   CASE WHEN {VALID_PROGRESS} THEN preferred_progress_pct END AS progress
            FROM canonical_contracts {where}
        )
        SELECT COUNT(*) AS total_contracts,
               ROUND(SUM(preferred_contract_cost_php), 2) AS total_reported_contract_value_php,
               AVG(progress) AS average_reported_ongoing_progress_pct,
               COUNT(progress) AS valid_ongoing_contracts,
               COUNT(CASE WHEN progress < 50 THEN 1 END) AS low_progress_contracts,
               100.0 * COUNT(CASE WHEN progress < 50 THEN 1 END)
                   / NULLIF(COUNT(progress), 0) AS low_progress_ongoing_rate_pct
        FROM scope
    """, params).fetchone())


def regions(db: sqlite3.Connection) -> list[dict]:
    return [dict(row) for row in db.execute(REGIONS + " ORDER BY r.region_name")]


def regional_comparison(db: sqlite3.Connection) -> list[dict]:
    return [dict(row) for row in db.execute(f"""
        WITH geographic AS ({REGIONS})
        SELECT g.region_id, g.region_name, g.psgc_code, COUNT(c.contract_key) AS contract_count,
               ROUND(SUM(c.preferred_contract_cost_php), 2) AS reported_value_php
        FROM geographic AS g
        LEFT JOIN canonical_contracts AS c USING (region_id)
        GROUP BY g.region_id, g.region_name, g.psgc_code
        ORDER BY reported_value_php DESC, g.region_name
    """)]


def progress_distribution(db: sqlite3.Connection, region_id: int | None) -> list[dict]:
    where, params = region_scope(region_id)
    rows = db.execute(f"""
        WITH scope AS (
            SELECT preferred_progress_pct AS progress
            FROM canonical_contracts {where}
            {'AND' if where else 'WHERE'} {VALID_PROGRESS}
        )
        SELECT COUNT(CASE WHEN progress < 25 THEN 1 END),
               COUNT(CASE WHEN progress >= 25 AND progress < 50 THEN 1 END),
               COUNT(CASE WHEN progress >= 50 AND progress < 75 THEN 1 END),
               COUNT(CASE WHEN progress >= 75 AND progress < 100 THEN 1 END),
               COUNT(CASE WHEN progress = 100 THEN 1 END)
        FROM scope
    """, params).fetchone()
    labels = ("0% to <25%", "25% to <50%", "50% to <75%", "75% to <100%", "Exactly 100%")
    return [dict(label=label, contract_count=count) for label, count in zip(labels, rows)]


def literal_pattern(value: str) -> str:
    escaped = value.replace("!", "!!").replace("%", "!%").replace("_", "!_")
    return f"%{escaped}%"


def contract_preview(db: sqlite3.Connection, region_id: int | None, search: str) -> list[dict]:
    where, params = region_scope(region_id)
    if search:
        where += " AND " if where else "WHERE "
        where += "(contract_id LIKE :search ESCAPE '!' OR contract_description LIKE :search ESCAPE '!')"
        params["search"] = literal_pattern(search)
    return [dict(row) for row in db.execute(f"""
        SELECT contract_id, contract_description,
               preferred_contract_cost_php AS reported_value_php, region_name,
               COALESCE(parquet_status, csv_status) AS reported_status,
               CASE WHEN preferred_progress_pct BETWEEN 0 AND 100
                   THEN preferred_progress_pct END AS reported_progress_pct
        FROM v_contracts_for_reporting {where}
        ORDER BY contract_key LIMIT 8
    """, params)]
