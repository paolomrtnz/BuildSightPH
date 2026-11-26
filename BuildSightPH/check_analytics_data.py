
import sqlite3
from pathlib import Path

database = Path(__file__).resolve().parent / "data" / "buildsight_four_source_final.sqlite"
connection = sqlite3.connect(database)
cursor = connection.cursor()

print("\n========== TOP CONTRACTORS ==========")

rows = cursor.execute("""
    WITH contractor_contracts AS (
        SELECT DISTINCT
            cc.contractor_key,
            o.contract_key
        FROM contract_contractors cc
        JOIN contract_observations o
            ON cc.observation_id = o.observation_id
        WHERE o.contract_key IS NOT NULL
    )
    SELECT
        ct.contractor_name,
        COUNT(*) AS contract_count,
        ROUND(SUM(c.preferred_contract_cost_php), 2) AS total_budget
    FROM contractor_contracts x
    JOIN contractors ct
        ON x.contractor_key = ct.contractor_key
    JOIN canonical_contracts c
        ON x.contract_key = c.contract_key
    GROUP BY ct.contractor_key, ct.contractor_name
    ORDER BY contract_count DESC
    LIMIT 10
""").fetchall()

for row in rows:
    print(row)

print("\n========== CRMPI MATERIAL GROUPS ==========")

for row in cursor.execute("""
    SELECT material_group_id, name
    FROM cmrpi_material_groups
""").fetchall():
    print(row)

print("\n========== CRMPI MONTHLY DATA ==========")

for row in cursor.execute("""
    SELECT
        g.name,
        COUNT(*) AS months_available,
        MIN(m.observation_month),
        MAX(m.observation_month)
    FROM cmrpi_monthly_indices m
    JOIN cmrpi_material_groups g
        ON m.material_group_id = g.material_group_id
    GROUP BY g.material_group_id, g.name
""").fetchall():
    print(row)

print("\n========== CRMPI SAMPLE RECORDS ==========")

for row in cursor.execute("""
    SELECT
        g.name,
        m.observation_month,
        m.index_value
    FROM cmrpi_monthly_indices m
    JOIN cmrpi_material_groups g
        ON m.material_group_id = g.material_group_id
    ORDER BY m.observation_month DESC
    LIMIT 10
""").fetchall():
    print(row)

print("\n========== CRMPI SERIES METADATA ==========")

for row in cursor.execute("""
    SELECT *
    FROM cmrpi_series_metadata
    LIMIT 10
""").fetchall():
    print(row)

connection.close()
