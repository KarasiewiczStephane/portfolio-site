---
title: "Medical Image Segmentation Tool"
description: "U-Net architecture in TensorFlow for medical image segmentation with data augmentation, MC Dropout uncertainty, DICOM handling, and Grad-CAM visualization."
category: "Computer Vision"
domain: "Healthcare"
icon: "🏥"
gradient: "pv-3"
technologies: ["TensorFlow", "Keras", "OpenCV", "albumentations", "pydicom", "Streamlit"]
github: "https://github.com/KarasiewiczStephane/medical-image-segmantation"
result: "ONNX-exported production model"
featured: true
order: 3
screenshots:
  - src: "/screenshots/medical-image-segmantation-segmentation.png"
    alt: "Medical Image Segmentation - Segmentation Result"
  - src: "/screenshots/medical-image-segmantation-uncertainty.png"
    alt: "Medical Image Segmentation - Uncertainty Analysis"
  - src: "/screenshots/medical-image-segmantation-gradcam.jpg"
    alt: "Medical Image Segmentation - Grad-CAM Visualization"
---

## Overview
Deep learning pipeline for medical image segmentation using U-Net architecture with production deployment via ONNX export.

## Architecture
- U-Net encoder-decoder with skip connections
- MC Dropout for uncertainty quantification
- DICOM preprocessing and augmentation pipeline
- Grad-CAM visualization for model interpretability
- ONNX export for deployment

## Key Features
- Multi-class segmentation with confidence maps
- Active learning with uncertainty sampling
- DICOM/NIfTI format support
- Interactive Streamlit visualization tool
