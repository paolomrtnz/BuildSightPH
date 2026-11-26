import sqlite3
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .overview import literal_pattern

STATUS = "COALESCE(c.parquet_status, c.csv_status)"
PROGRESS = "CASE WHEN c.preferred_progress_pct BETWEEN 0 AND 100 THEN c.preferred_progress_pct END"
PROJECTS = """
    FROM canonical_contracts AS c
    JOIN contracts AS i USING (contract_key)
    LEFT JOIN regions AS r USING (region_id)
    LEFT JOIN parquet_contract_details AS p USING (contract_key)
    LEFT JOIN project_categories AS k USING (category_id)
"""


class Page(BaseModel):
    page: int = Field(1, ge=1, le=100000)
    page_size: int = Field(25, ge=1, le=100)
    q: str = Field("", max_length=120)


class ProjectFilters(Page):
    region_id: int | None = Field(None, ge=1)
    contractor_id: int | None = Field(None, ge=1)
    category_id: int | None = Field(None, ge=1)
    status: str | None = Field(None, max_length=80)
    min_value: float | None = Field(None, allow_inf_nan=False, ge=0)
    max_value: float | None = Field(None, allow_inf_nan=False, ge=0)
    min_progress: float | None = Field(None, ge=0, le=100)
    max_progress: float | None = Field(None, ge=0, le=100)
    sort: Literal["id", "value", "progress", "status"] = "id"
    direction: Literal["asc", "desc"] = "asc"

    @model_validator(mode="after")
    def check_ranges(self):
        for lower, upper in [(self.min_value, self.max_value), (self.min_progress, self.max_progress)]:
            if lower is not None and upper is not None and lower > upper:
                raise ValueError("Minimum must be less than or equal to maximum.")
        return self


def project_options(db: sqlite3.Connection) -> dict:
    return {
        "statuses": [row[0] for row in db.execute(f"""
            SELECT DISTINCT {STATUS} AS status FROM canonical_contracts AS c
            WHERE status IS NOT NULL ORDER BY status
        """)],
        "categories": [dict(row) for row in db.execute("""
            SELECT category_id, category_name FROM project_categories ORDER BY category_name
        """)],
        "regions": [dict(row) for row in db.execute("""
            SELECT region_id, region_name FROM regions ORDER BY region_name
        """)],
    }


def projects(db: sqlite3.Connection, filters: ProjectFilters) -> dict:
    predicates = []
    params = {}
    conditions = {
        "region_id": "c.region_id = :region_id",
        "category_id": "p.category_id = :category_id",
        "status": f"{STATUS} = :status",
        "min_value": "c.preferred_contract_cost_php >= :min_value",
        "max_value": "c.preferred_contract_cost_php <= :max_value",
        "min_progress": f"({PROGRESS}) >= :min_progress",
        "max_progress": f"({PROGRESS}) <= :max_progress",
        "contractor_id": """c.contract_key IN (
            SELECT contract_key FROM v_canonical_contract_contractors
            WHERE contractor_key = :contractor_id
        )""",
    }
    for field, predicate in conditions.items():
        value = getattr(filters, field)
        if value is not None:
            predicates.append(predicate)
            params[field] = value
    if filters.q.strip():
        predicates.append("(i.contract_id LIKE :pattern ESCAPE '!' OR c.contract_description LIKE :pattern ESCAPE '!')")
        params["pattern"] = literal_pattern(filters.q.strip())
    where = "WHERE " + " AND ".join(predicates) if predicates else ""
    # The count only needs joins referenced by its filters.
    count_from = "FROM canonical_contracts AS c"
    if "pattern" in params:
        count_from += " JOIN contracts AS i USING (contract_key)"
    if "category_id" in params:
        count_from += " JOIN parquet_contract_details AS p USING (contract_key)"
    total = db.execute(f"SELECT COUNT(*) {count_from} {where}", params).fetchone()[0]
    sort = {"id": "i.contract_id", "value": "reported_value_php",
            "progress": "reported_progress_pct", "status": "reported_status"}[filters.sort]
    rows = db.execute(f"""
        SELECT i.contract_id, c.contract_description, r.region_name, k.category_name,
               c.preferred_contract_cost_php AS reported_value_php,
               {STATUS} AS reported_status, {PROGRESS} AS reported_progress_pct
        {PROJECTS} {where}
        ORDER BY {sort} {filters.direction} NULLS LAST, c.contract_key
        LIMIT :limit OFFSET :offset
    """, {**params, "limit": filters.page_size, "offset": (filters.page - 1) * filters.page_size})
    return {"total": total, "page": filters.page, "page_size": filters.page_size, "items": [dict(row) for row in rows]}


def project_detail(db: sqlite3.Connection, contract_id: str) -> dict | None:
    row = db.execute(f"""
        SELECT c.*, i.contract_id, r.region_name, k.category_name, p.location_raw, p.province_raw,
               p.reported_contractor, p.infrastructure_year, pr.program_name,
               o.office_name, f.funding_name, p.funding_source_raw,
               {STATUS} AS reported_status, {PROGRESS} AS valid_reported_progress_pct
        {PROJECTS}
        LEFT JOIN infrastructure_programs AS pr ON p.program_id = pr.program_id
        LEFT JOIN contract_observations AS obs ON c.selected_csv_observation_id = obs.observation_id
        LEFT JOIN implementing_offices AS o ON obs.office_id = o.office_id
        LEFT JOIN funding_sources AS f ON obs.funding_id = f.funding_id
        WHERE i.contract_id = ?
    """, (contract_id,)).fetchone()
    if row is None:
        return None
    contractors = db.execute("""
        SELECT DISTINCT t.contractor_key, t.contractor_name
        FROM v_canonical_contract_contractors AS v JOIN contractors AS t USING (contractor_key)
        WHERE v.contract_key = ? ORDER BY t.contractor_name, t.contractor_key
    """, (row["contract_key"],))
    return {**dict(row), "contractors": [dict(item) for item in contractors]}
