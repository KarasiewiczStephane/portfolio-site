---
title: "Hybrid Recommendation Engine"
description: "Production-ready recommendation system combining collaborative filtering (Surprise) and content-based filtering with cold-start handling, Redis caching, and A/B testing."
category: "ML"
domain: "E-commerce"
icon: "👍"
gradient: "pv-3"
technologies: ["scikit-learn", "Surprise", "FastAPI", "Redis", "SQLite", "Docker"]
github: "https://github.com/KarasiewiczStephane/recommendation-engine"
result: "Hybrid model with cold-start support"
featured: false
order: 9
screenshots:
  - src: "/screenshots/recommendation-engine-dashboard.png"
    alt: "Recommendation Engine - Dashboard"
  - src: "/screenshots/recommendation-engine-metrics.png"
    alt: "Recommendation Engine - Accuracy, A/B Test & Coverage Analysis"
---

## Overview
Production recommendation system combining multiple filtering approaches with A/B testing infrastructure.

## Architecture
- Matrix factorization via Surprise library
- TF-IDF content-based filtering
- Hybrid combiner with configurable weights
- Redis caching for low-latency serving
- FastAPI with A/B testing endpoint

## Key Features
- Cold-start handling for new users/items
- Redis-backed response caching
- A/B testing for model comparison
- Real-time recommendation updates
