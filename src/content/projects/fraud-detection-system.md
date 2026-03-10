---
title: "Real-time Fraud Detection System"
description: "Production-grade ML pipeline for credit card fraud detection with real-time streaming inference, SHAP explainability, A/B testing, and a Streamlit monitoring dashboard."
category: "ML"
domain: "Finance"
icon: "🔍"
gradient: "pv-1"
technologies: ["scikit-learn", "XGBoost", "SHAP", "FastAPI", "Streamlit", "SQLite"]
github: "https://github.com/KarasiewiczStephane/fraud-detection-system"
result: "Multi-page real-time dashboard"
featured: true
order: 4
screenshots:
  - src: "/screenshots/fraud-detection-system-realtime.png"
    alt: "Fraud Detection System - Real-time Prediction Feed"
  - src: "/screenshots/fraud-detection-system-performance.png"
    alt: "Fraud Detection System - Model Performance"
  - src: "/screenshots/fraud-detection-system-features.png"
    alt: "Fraud Detection System - Feature Importance (SHAP)"
---

## Overview
Production-grade, end-to-end ML pipeline for credit card fraud detection with streaming data processing, real-time feature engineering, and model inference.

## Architecture
- Streaming transaction processing with async queues
- Real-time feature engineering pipeline
- XGBoost model with SMOTE for class imbalance
- SHAP-based explainability for every prediction
- FastAPI serving + Streamlit multi-page dashboard

## Key Features
- Real-time fraud scoring with sub-100ms latency
- A/B testing framework for model comparison
- Performance monitoring dashboard with drift detection
- Feature importance visualization with SHAP
