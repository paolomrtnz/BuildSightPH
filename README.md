# BuildSight PH 

BuildSight PH is a Business Intelligence platform and data warehouse designed to monitor Philippine infrastructure projects. It integrates isolated public datasets from the DPWH and PSA into a unified SQLite database to track contract values, geographic distribution, and construction material price trends.

## Features
* **Unified Data Warehouse:** Consolidates over 248,000 unique contract records from conflicting DPWH CSV and Parquet sources.
* **Geospatial Tracking:** Maps contract value distribution across 17 Philippine regions using official PSGC codes.
* **Contractor Portfolio Analytics:** Identifies high-volume contractors and tracks historical project exposure.
* **Economic Trend Context:** Overlays NCR construction material price indices (CMRPI) alongside project data.
* **Interactive Dashboard UI:** Figma-prototyped interface featuring KPI modules, public ledgers, and AI telemetry assistants.

## Data Sources
The ETL pipeline processes data from four public endpoints:
1. **DPWH Infrastructure Contracts** (Historical CSV, 2016–2025)
2. **DPWH Transparency Dataset** (BetterGov PH Parquet)
3. **PSA Standard Geographic Code (PSGC)** (Q3 2026)
4. **PSA Construction Materials Retail Price Index** (2012–2026)

## Tech Stack
* **Database:** SQLite (23 normalized relational tables)
* **Design/Prototyping:** Figma

## Repository Structure
* `/data` - Raw and processed datasets
* `/database` - SQL schema, ERD, and the compiled `buildsight_four_source_final.sqlite`
* `/docs` - Full academic methodology, KPI formulas, and data dictionary
* `/ui` - Figma prototype links and UI assets

## Disclaimer
This platform is a descriptive decision-support prototype based on publicly available data. Reported contract values do not represent verified government expenditures, and calculated progress metrics do not replace official DPWH monitoring systems.

## Authors
**Team 3DSA-1:** Hannah Garin, Lucas Loreto, Paolo Martinez, Shaun Reyes, Eira Young