---
title: "Multilingual Support Classifier"
description: "Zero-shot classification for customer support ticket routing across 20+ languages using XLM-RoBERTa, with language detection, urgency scoring, and response templates."
category: "NLP"
domain: "Customer Support"
icon: "🌐"
gradient: "pv-3"
technologies: ["HuggingFace Transformers", "XLM-RoBERTa", "langdetect", "FastAPI", "SQLite"]
github: "https://github.com/KarasiewiczStephane/multilingual-classifier"
result: "20+ language zero-shot classification"
featured: false
order: 15
screenshots:
  - src: "/screenshots/multilingual-classifier-demo.png"
    alt: "Multilingual Classifier - Classification Demo"
  - src: "/screenshots/multilingual-classifier-results.png"
    alt: "Multilingual Classifier - Prediction Results & Accuracy Heatmap"
---

## Overview
Multilingual customer support classifier enabling automated ticket routing across 20+ languages.

## Architecture
- XLM-RoBERTa for zero-shot classification
- Language detection with langdetect/fasttext
- Urgency scoring model
- Response template engine per language
- FastAPI serving with per-language metrics

## Key Features
- Zero-shot classification without per-language training
- Automatic language detection and routing
- Urgency-based priority scoring
- Per-language performance tracking
