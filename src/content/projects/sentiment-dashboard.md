---
title: "Sentiment Analysis Dashboard"
description: "Real-time sentiment monitoring using fine-tuned RoBERTa, BERTopic for topic modeling, entity-level sentiment with spaCy NER, and a Plotly Dash dashboard."
category: "NLP"
domain: "Social Media Analytics"
icon: "📊"
gradient: "pv-2"
technologies: ["HuggingFace Transformers", "RoBERTa", "BERTopic", "spaCy", "Plotly Dash", "FastAPI", "DuckDB"]
github: "https://github.com/KarasiewiczStephane/sentiment-dashboard"
result: "Real-time multi-model NLP pipeline"
featured: true
order: 2
screenshots:
  - src: "/screenshots/sentiment-dashboard-overview.png"
    alt: "Sentiment Dashboard - Overview, Distribution & Volume"
  - src: "/screenshots/sentiment-dashboard-trends.png"
    alt: "Sentiment Dashboard - Trends & Anomaly Detection"
  - src: "/screenshots/sentiment-dashboard-topics.png"
    alt: "Sentiment Dashboard - Topic Distribution & Evolution"
  - src: "/screenshots/sentiment-dashboard-entities.png"
    alt: "Sentiment Dashboard - Entity Mentions & Sentiment Cards"
  - src: "/screenshots/sentiment-dashboard-models.png"
    alt: "Sentiment Dashboard - Model Comparison & Agreement Heatmap"
---

## Overview
Real-time sentiment monitoring platform combining multiple NLP models for comprehensive social media analytics.

## Architecture
- Fine-tuned RoBERTa for sentiment classification
- BERTopic for dynamic topic modeling
- spaCy NER for entity-level sentiment analysis
- DuckDB for fast analytical queries
- Plotly Dash interactive dashboard with PDF report generation

## Key Features
- Multi-model ensemble sentiment scoring
- Topic trend tracking over time
- Entity-level sentiment breakdown
- Automated PDF report generation with Jinja2 templates
