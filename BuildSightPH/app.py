import sqlite3
from pathlib import Path
from flask import Flask, render_template, jsonify

# Initialize Flask
app = Flask(__name__)

# Database configuration
BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "data" / "buildsight_four_source_final.sqlite"


# Connect to SQLite database
def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


# Homepage
@app.route("/")
def home():
    return render_template("index.html")


# Dashboard statistics
@app.route("/api/dashboard-stats")
def dashboard_stats():
    connection = get_db_connection()

    try:
        stats = connection.execute("""
            SELECT
                COUNT(*) AS total_contracts,
                SUM(preferred_contract_cost_php) AS total_budget,
                AVG(preferred_progress_pct) AS average_progress,
                COUNT(DISTINCT region_id) AS geographic_coverage
            FROM canonical_contracts
        """).fetchone()

        return jsonify({
            "total_contracts": stats["total_contracts"],
            "total_budget": stats["total_budget"] or 0,
            "average_progress": stats["average_progress"] or 0,
            "geographic_coverage": stats["geographic_coverage"] or 0
        })

    except sqlite3.Error as error:
        return jsonify({"error": str(error)}), 500

    finally:
        connection.close()


# Regional data
@app.route("/api/regions")
def regional_data():
    connection = get_db_connection()

    try:
        regions = connection.execute("""
            SELECT
                r.region_name,
                COUNT(c.contract_key) AS contract_count
            FROM canonical_contracts c
            JOIN regions r
                ON c.region_id = r.region_id
            GROUP BY r.region_id, r.region_name
            ORDER BY contract_count DESC
            LIMIT 5
        """).fetchall()

        return jsonify([
            {
                "region_name": row["region_name"],
                "contract_count": row["contract_count"]
            }
            for row in regions
        ])

    except sqlite3.Error as error:
        return jsonify({"error": str(error)}), 500

    finally:
        connection.close()


# Project map data
@app.route("/api/projects/map")
def project_map_data():
    connection = get_db_connection()

    try:
        projects = connection.execute("""
            SELECT
                p.contract_key,
                p.latitude,
                p.longitude,
                p.reported_status,
                p.budget_php,
                p.parquet_description,
                p.location_raw,
                p.region_raw
            FROM parquet_contract_details p
            WHERE p.latitude BETWEEN 4.5 AND 21.5
              AND p.longitude BETWEEN 116 AND 127
            ORDER BY RANDOM()
            LIMIT 1500
        """).fetchall()

        return jsonify([
            {
                "contract_key": row["contract_key"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "status": row["reported_status"],
                "budget": row["budget_php"],
                "description": row["parquet_description"],
                "location": row["location_raw"],
                "region": row["region_raw"]
            }
            for row in projects
        ])

    except sqlite3.Error as error:
        return jsonify({"error": str(error)}), 500

    finally:
        connection.close()


# Top contractors analytics
@app.route("/api/top-contractors")
def top_contractors():
    connection = get_db_connection()

    try:
        rows = connection.execute("""
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

        return jsonify([
            {
                "contractor_name": row["contractor_name"],
                "contract_count": row["contract_count"],
                "total_budget": row["total_budget"] or 0
            }
            for row in rows
        ])

    except sqlite3.Error as error:
        return jsonify({"error": str(error)}), 500

    finally:
        connection.close()


# Monthly CRMPI analytics (ALL ITEMS)
@app.route("/api/crmpi")
def crmpi_data():
    connection = get_db_connection()

    try:
        rows = connection.execute("""
            SELECT
                m.observation_month,
                m.index_value
            FROM cmrpi_monthly_indices m
            JOIN cmrpi_material_groups g
                ON m.material_group_id = g.material_group_id
            WHERE g.name = 'ALL ITEMS'
            ORDER BY m.observation_month ASC
        """).fetchall()

        return jsonify([
            {
                "month": row["observation_month"],
                "index_value": row["index_value"]
            }
            for row in rows
        ])

    except sqlite3.Error as error:
        return jsonify({"error": str(error)}), 500

    finally:
        connection.close()


# Recent DPWH projects
@app.route("/api/recent-projects")
def recent_projects():
    connection = get_db_connection()

    try:
        rows = connection.execute("""
            SELECT
                p.contract_key,
                COALESCE(
                    p.parquet_description,
                    c.contract_description,
                    'Description unavailable'
                ) AS description,
                COALESCE(
                    p.region_raw,
                    r.region_name,
                    'Not available'
                ) AS region,
                p.budget_php,
                p.progress_pct,
                COALESCE(p.reported_status, 'Not reported') AS status
            FROM parquet_contract_details p
            LEFT JOIN canonical_contracts c
                ON p.contract_key = c.contract_key
            LEFT JOIN regions r
                ON c.region_id = r.region_id
            ORDER BY
                COALESCE(
                    p.reported_start_date,
                    p.reported_completion_date
                ) DESC,
                p.contract_key DESC
            LIMIT 10
        """).fetchall()

        return jsonify([
            {
                "contract_key": row["contract_key"],
                "description": row["description"],
                "region": row["region"],
                "budget": row["budget_php"],
                "progress": row["progress_pct"],
                "status": row["status"]
            }
            for row in rows
        ])

    except sqlite3.Error as error:
        return jsonify({"error": str(error)}), 500

    finally:
        connection.close()

# Start Flask server
if __name__ == "__main__":
    print("Starting BuildSight PH...")
    print(f"Database: {DATABASE}")
    app.run(debug=True)