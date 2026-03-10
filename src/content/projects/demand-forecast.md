---
title: "Time Series Demand Forecasting"
description: "Multi-model forecasting combining Prophet, LSTM, and XGBoost for retail demand prediction with seasonality detection, anomaly handling, and ensemble forecasts."
category: "ML"
domain: "Retail / Supply Chain"
icon: "📈"
gradient: "pv-1"
technologies: ["Prophet", "PyTorch", "XGBoost", "Streamlit", "Plotly", "DuckDB"]
github: "https://github.com/KarasiewiczStephane/demand-forecast"
result: "Ensemble forecast with backtesting"
featured: true
order: 2
screenshots:
  - src: "/screenshots/demand-forecast-forecast.png"
    alt: "Demand Forecast - Forecast View"
  - src: "/screenshots/demand-forecast-comparison.png"
    alt: "Demand Forecast - Model Comparison"
  - src: "/screenshots/demand-forecast-seasonality.png"
    alt: "Demand Forecast - Seasonality Patterns"
  - src: "/screenshots/demand-forecast-backtesting.png"
    alt: "Demand Forecast - Backtesting Results"
---

## Overview
Multi-model demand forecasting system for retail supply chain optimization.

## Architecture
- Prophet for trend and seasonality decomposition
- LSTM (PyTorch) for sequential pattern learning
- XGBoost for feature-rich regression
- Ensemble combiner with dynamic weighting
- Rolling-window backtesting framework

## Key Features
- Automatic seasonality detection
- Anomaly-aware training pipeline
- Interactive forecast visualization
- Model comparison dashboard
