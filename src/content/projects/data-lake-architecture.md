---
title: "Data Lake Architecture"
description: "Serverless data lake simulation using MinIO (local S3), DuckDB, and medallion architecture with data cataloging, schema evolution, and Terraform templates."
category: "Data Engineering"
domain: "Cloud Architecture"
icon: "🏗️"
gradient: "pv-3"
technologies: ["MinIO", "DuckDB", "Terraform", "boto3", "Click", "Docker Compose"]
github: "https://github.com/KarasiewiczStephane/data-lake-architecture"
result: "Medallion architecture data lake"
featured: false
order: 21
screenshots:
  - src: "/screenshots/data-lake-architecture-dashboard.png"
    alt: "Data Lake Architecture - Dashboard"
---

## Overview
Local simulation of a serverless data lake with medallion architecture and infrastructure-as-code.

## Architecture
- MinIO for S3-compatible object storage
- Medallion architecture (bronze/silver/gold)
- DuckDB for analytical queries
- Data catalog with schema evolution
- Terraform reference templates for AWS

## Key Features
- Bronze/silver/gold data layers
- Schema evolution and versioning
- Data cataloging and discovery
- AWS cost estimation calculator
