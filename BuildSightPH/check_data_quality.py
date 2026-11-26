
import sqlite3

DB = "data/buildsight_four_source_final.sqlite"

conn = sqlite3.connect(DB)
cur = conn.cursor()

print("\n========== BUILDSIGHT PH DATA QUALITY ==========\n")

# 1. Geographic coverage
cur.execute("""
SELECT
    COUNT(*) AS total,
    SUM(latitude IS NOT NULL AND longitude IS NOT NULL),
    SUM(latitude IS NULL OR longitude IS NULL),
    SUM(
        latitude BETWEEN 4.5 AND 21.5
        AND longitude BETWEEN 116 AND 127
    )
FROM parquet_contract_details;
""")

print("GEOGRAPHIC COVERAGE:")
print("Total, complete coordinates, missing coordinates, approximate PH coordinates:")
print(cur.fetchone())

# 2. Preferred contract cost and progress
cur.execute("""
SELECT
    COUNT(*),
    SUM(preferred_contract_cost_php IS NULL),
    SUM(preferred_progress_pct IS NULL),
    SUM(preferred_contract_cost_php < 0),
    SUM(preferred_progress_pct < 0 OR preferred_progress_pct > 100),
    SUM(cost_disagreement_flag = 1),
    SUM(progress_disagreement_flag = 1),
    SUM(different_end_date_flag = 1)
FROM canonical_contracts;
""")

print("\nCONTRACT DATA QUALITY:")
print(cur.fetchone())

# 3. Project statuses
cur.execute("""
SELECT csv_status, COUNT(*)
FROM canonical_contracts
GROUP BY csv_status
ORDER BY COUNT(*) DESC;
""")

print("\nPROJECT STATUSES:")
for row in cur.fetchall():
    print(row)

# 4. Regional distribution
cur.execute("""
SELECT r.region_name, COUNT(*)
FROM canonical_contracts c
LEFT JOIN regions r ON c.region_id = r.region_id
GROUP BY r.region_name
ORDER BY COUNT(*) DESC;
""")

print("\nREGIONAL DISTRIBUTION:")
for row in cur.fetchall():
    print(row)

# 5. Contractor relationship coverage
cur.execute("""
SELECT
    COUNT(DISTINCT observation_id),
    COUNT(DISTINCT contractor_key)
FROM contract_contractors;
""")

print("\nCONTRACTOR RELATIONSHIPS:")
print("Observations linked to contractors, distinct contractors:")
print(cur.fetchone())

# 6. Project category distribution
cur.execute("""
SELECT pc.category_name, COUNT(*)
FROM parquet_contract_details p
LEFT JOIN project_categories pc
    ON p.category_id = pc.category_id
GROUP BY pc.category_name
ORDER BY COUNT(*) DESC
LIMIT 15;
""")

print("\nTOP PROJECT CATEGORIES:")
for row in cur.fetchall():
    print(row)

conn.close()

print("\n========== CHECK COMPLETE ==========")
