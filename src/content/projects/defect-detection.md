---
title: "Manufacturing Defect Detection"
description: "Computer vision pipeline using ResNet-50 with transfer learning for product defect detection, Grad-CAM localization, active learning, and ONNX Runtime export."
category: "Computer Vision"
domain: "Manufacturing"
icon: "🔎"
gradient: "pv-6"
technologies: ["PyTorch", "torchvision", "OpenCV", "ONNX Runtime", "FastAPI"]
github: "https://github.com/KarasiewiczStephane/defect-detection"
result: "Edge-deployable ONNX model"
featured: false
order: 12
screenshots:
  - src: "/screenshots/defect-detection-dashboard.png"
    alt: "Defect Detection - Dashboard"
---

## Overview
Computer vision pipeline for automated product quality inspection with edge deployment support.

## Architecture
- ResNet-50 with transfer learning for defect classification
- Grad-CAM for defect localization
- Active learning with uncertainty sampling
- ONNX Runtime export for edge deployment
- FastAPI inference endpoint

## Key Features
- Defect localization with heatmap visualization
- Active learning to minimize labeling costs
- Edge-optimized ONNX model export
- Configurable detection thresholds
