---
title: "Credit Risk Scoring Model"
description: "Interpretable ML model for loan approval using LightGBM with SHAP/LIME explainability, Fairlearn bias testing, traditional WoE/IV scorecard, and regulatory compliance."
category: "ML"
domain: "Finance"
icon: "💳"
gradient: "pv-5"
technologies: ["LightGBM", "scikit-learn", "SHAP", "LIME", "Fairlearn", "Optuna", "FastAPI"]
github: "https://github.com/KarasiewiczStephane/credit-risk-scoring"
result: "Fairness-audited production model"
featured: false
order: 5
screenshots:
  - src: "/screenshots/credit-risk-scoring-dashboard.png"
    alt: "Credit Risk Scoring - Dashboard"
---

## Overview
Interpretable credit risk scoring system with built-in fairness testing and regulatory compliance reporting.

## Architecture
- LightGBM with Optuna hyperparameter optimization
- SHAP and LIME for model interpretability
- Fairlearn for bias detection and mitigation
- Traditional WoE/IV scorecard for comparison
- FastAPI serving endpoint

## Key Features
- Dual-model approach: ML + traditional scorecard
- Automated fairness auditing across protected groups
- Regulatory compliance report generation
- Feature contribution explanations per prediction
