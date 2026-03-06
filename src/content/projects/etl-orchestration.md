---
title: "ETL Orchestration Pipeline"
description: "Airflow-based ETL pipeline with multi-source extraction, dbt transformations on DuckDB warehouse, SCD Type 2 snapshots, data quality checks, and lineage tracking."
category: "Data Engineering"
domain: "Data Warehousing"
icon: "🔄"
gradient: "pv-2"
technologies: ["Apache Airflow", "dbt-duckdb", "DuckDB", "Docker Compose"]
github: "https://github.com/KarasiewiczStephane/etl-orchestration"
result: "Automated ETL with data quality"
featured: false
order: 20
screenshots:
  - src: "/screenshots/etl-orchestration-dashboard.png"
    alt: "Etl Orchestration - Dashboard"
---

## Overview
Production ETL pipeline with orchestration, transformation, and data quality monitoring.

## Architecture
- Apache Airflow for DAG orchestration
- Multi-source extraction (CSV, REST API, SQLite)
- dbt transformations on DuckDB
- SCD Type 2 slowly changing dimensions
- Data quality checks and lineage tracking

## Key Features
- Automated pipeline scheduling
- Data quality validation gates
- Lineage tracking and documentation
- SCD Type 2 historical snapshots
