---
title: "Customer Churn Prediction with AutoML"
description: "Automated ML pipeline for churn prediction using H2O.ai AutoML and Optuna-tuned LightGBM, with Boruta feature selection and business impact calculator."
category: "ML"
domain: "Telecom"
icon: "👤"
gradient: "pv-2"
technologies: ["H2O.ai", "LightGBM", "scikit-learn", "Optuna", "Boruta", "DuckDB", "Plotly"]
github: "https://github.com/KarasiewiczStephane/churn-prediction-autom"
result: "AutoML + manual model comparison"
featured: false
order: 8
screenshots:
  - src: "/screenshots/churn-prediction-autom-dashboard.png"
    alt: "Churn Prediction Autom - Dashboard"
---

## Overview
Automated ML pipeline for customer churn prediction with business impact quantification.

## Architecture
- H2O.ai AutoML for baseline model search
- Optuna-tuned LightGBM for production model
- Boruta and mutual information feature selection
- Business impact calculator translating churn to revenue-at-risk
- Click CLI for pipeline orchestration

## Key Features
- Automated model selection and tuning
- Revenue-at-risk business reporting
- Feature importance with multiple methods
- Reproducible pipeline via CLI
