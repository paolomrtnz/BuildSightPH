import sqlite3
from typing import Literal

from pydantic import Field

from .explorer import Page
from .overview import literal_pattern


class ContractorFilters(Page):
    region_id: int | None = Field(None, ge=1)
    sort: Literal["count", "value", "name"] = "count"
    direction: Literal["asc", "desc"] = "desc"


def contractor_portfolios(db: sqlite3.Connection, filters: ContractorFilters, contractor_id=None) -> dict:
    predicates = []
    params = {}
    if filters.region_id is not None:
        predicates.append("c.region_id = :region")
        params["region"] = filters.region_id
    if filters.q.strip():
        predicates.append("t.contractor_name LIKE :pattern ESCAPE '!'")
        params["pattern"] = literal_pattern(filters.q.strip())
    if contractor_id is not None:
        predicates.append("t.contractor_key = :contractor")
        params["contractor"] = contractor_id
    where = "WHERE " + " AND ".join(predicates) if predicates else ""
    sort = {"count": "contract_count", "value": "linked_value_php", "name": "contractor_name COLLATE NOCASE"}[filters.sort]
    cte = f"""
        WITH links AS (
            SELECT DISTINCT v.contractor_key, v.contract_key, c.preferred_contract_cost_php
            FROM v_canonical_contract_contractors AS v
            JOIN canonical_contracts AS c USING (contract_key)
            JOIN contractors AS t USING (contractor_key)
            {where}
        ), portfolios AS (
            SELECT t.contractor_key, t.contractor_name, COUNT(*) AS contract_count,
                   ROUND(SUM(links.preferred_contract_cost_php), 2) AS linked_value_php
            FROM links JOIN contractors AS t USING (contractor_key)
            GROUP BY t.contractor_key
        )
    """
    rows = db.execute(cte + f"""
        SELECT totals.total, page.*
        FROM (SELECT COUNT(*) AS total FROM portfolios) AS totals
        LEFT JOIN (
            SELECT * FROM portfolios ORDER BY {sort} {filters.direction} NULLS LAST, contractor_key
            LIMIT :limit OFFSET :offset
        ) AS page ON 1 = 1
        ORDER BY {sort} {filters.direction} NULLS LAST, contractor_key
    """, {**params, "limit": filters.page_size, "offset": (filters.page - 1) * filters.page_size}).fetchall()
    items = [{key: row[key] for key in row.keys() if key != "total"}
             for row in rows if row["contractor_key"] is not None]
    return {"total": rows[0]["total"], "page": filters.page, "page_size": filters.page_size, "items": items}


def contractor_detail(db: sqlite3.Connection, contractor_id: int, region_id: int | None) -> dict | None:
    row = db.execute("SELECT contractor_key, contractor_name FROM contractors WHERE contractor_key = ?", (contractor_id,)).fetchone()
    if row is None:
        return None
    portfolios = contractor_portfolios(db, ContractorFilters(region_id=region_id), contractor_id)["items"]
    return {**dict(row), "contract_count": 0, "linked_value_php": None, **(portfolios[0] if portfolios else {})}


def price_metadata(db: sqlite3.Connection) -> dict:
    series = db.execute("SELECT * FROM cmrpi_series_metadata").fetchone()
    groups = db.execute("""
        SELECT g.material_group_id, g.name, MIN(i.observation_month) AS first_month,
               MAX(i.observation_month) AS last_month
        FROM cmrpi_material_groups AS g JOIN cmrpi_monthly_indices AS i USING (material_group_id)
        GROUP BY g.material_group_id ORDER BY g.material_group_id
    """)
    return {"series": dict(series) if series else None, "groups": [dict(row) for row in groups]}


def prices(db: sqlite3.Connection, group_id: int, start: str | None, end: str | None) -> dict | None:
    group = db.execute("SELECT name FROM cmrpi_material_groups WHERE material_group_id = ?", (group_id,)).fetchone()
    if group is None:
        return None
    rows = db.execute("""
        SELECT i.observation_month AS month, i.index_value,
               100.0 * (i.index_value - prior.index_value) / prior.index_value AS yoy_pct
        FROM cmrpi_monthly_indices AS i
        LEFT JOIN cmrpi_monthly_indices AS prior
             ON i.material_group_id = prior.material_group_id
            AND prior.observation_month = date(i.observation_month, '-1 year')
        WHERE i.material_group_id = :group
          AND (:start IS NULL OR i.observation_month >= :start || '-01')
          AND (:end IS NULL OR i.observation_month <= :end || '-01')
        ORDER BY i.observation_month
    """, {"group": group_id, "start": start, "end": end})
    return {"name": group["name"], "observations": [dict(row) for row in rows]}


def coverage(db: sqlite3.Connection) -> dict:
    return dict(db.execute("""
        SELECT (SELECT COUNT(*) FROM canonical_contracts) AS contracts,
               (SELECT COUNT(*) FROM canonical_contracts AS c JOIN regions AS r USING(region_id)
                WHERE r.region_name = 'Central Office') AS central_office,
               (SELECT COUNT(*) FROM dpwh_psgc_region_map) AS geographic_regions,
               (SELECT COUNT(DISTINCT contract_key) FROM v_canonical_contract_contractors) AS linked_contracts,
               (SELECT COUNT(*) FROM canonical_contracts WHERE csv_accomplishment_pct IS NOT NULL
                   AND parquet_progress_pct IS NOT NULL) AS comparable_progress,
               (SELECT COUNT(*) FROM canonical_contracts WHERE csv_accomplishment_pct IS NOT NULL
                   AND parquet_progress_pct IS NOT NULL AND progress_disagreement_flag = 1) AS flagged_progress
    """).fetchone())
