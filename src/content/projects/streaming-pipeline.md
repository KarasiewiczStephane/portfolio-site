---
title: "Real-Time Streaming Pipeline"
description: "Scalable streaming architecture using Kafka, PySpark Structured Streaming, and Delta Lake for e-commerce clickstream processing with exactly-once semantics."
category: "Data Engineering"
domain: "Real-time Processing"
icon: "⚡"
gradient: "pv-4"
technologies: ["Apache Kafka", "PySpark", "Delta Lake", "Streamlit", "Docker Compose"]
github: "https://github.com/KarasiewiczStephane/streaming-pipeline"
result: "Exactly-once streaming pipeline"
featured: false
order: 22
screenshots:
  - src: "/screenshots/streaming-pipeline-overview.png"
    alt: "Streaming Pipeline - Pipeline Overview"
  - src: "/screenshots/streaming-pipeline-throughput.png"
    alt: "Streaming Pipeline - Throughput Metrics"
  - src: "/screenshots/streaming-pipeline-quality.png"
    alt: "Streaming Pipeline - Data Quality Scores & Trends"
  - src: "/screenshots/streaming-pipeline-business.png"
    alt: "Streaming Pipeline - Business Metrics & Revenue"
---

## Overview
Production streaming pipeline for real-time e-commerce clickstream processing and analytics.

## Architecture
- Apache Kafka for event streaming
- PySpark Structured Streaming for processing
- Delta Lake for ACID-compliant storage
- Medallion architecture for data layers
- Dead letter queue for error handling

## Key Features
- Exactly-once processing semantics
- Change data capture (CDC) support
- Dead letter queue for failed events
- Real-time analytics dashboard
