---
title: "Document Intelligence OCR System"
description: "End-to-end document processing combining Tesseract OCR, OpenCV preprocessing, and transformer-based extraction to extract structured data from invoices and receipts."
category: "Computer Vision"
domain: "Document Processing"
icon: "📑"
gradient: "pv-1"
technologies: ["Tesseract", "OpenCV", "HuggingFace Transformers", "LayoutLM", "FastAPI"]
github: "https://github.com/KarasiewiczStephane/document-oc"
result: "Structured data from unstructured docs"
featured: false
order: 13
screenshots:
  - src: "/screenshots/document-oc-dashboard.png"
    alt: "Document OCR - Dashboard"
  - src: "/screenshots/document-oc-fields.png"
    alt: "Document OCR - Extracted Fields"
  - src: "/screenshots/document-oc-bounding-box.png"
    alt: "Document OCR - Bounding Box Visualization"
---

## Overview
Intelligent document processing pipeline for automated data extraction from invoices and receipts.

## Architecture
- OpenCV preprocessing for image enhancement
- Tesseract OCR for text extraction
- LayoutLM/Donut for structured field extraction
- Validation rules and confidence scoring
- FastAPI serving endpoint

## Key Features
- Multi-format document support (PDF, images)
- Field-level confidence scoring
- Custom validation rules per document type
- Batch processing capability
