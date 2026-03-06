---
title: "Face Recognition Attendance System"
description: "Real-time attendance tracking using FaceNet embeddings and MTCNN detection with anti-spoofing liveness detection, privacy controls, and report generation."
category: "Computer Vision"
domain: "HR / Security"
icon: "👁️"
gradient: "pv-2"
technologies: ["facenet-pytorch", "MTCNN", "OpenCV", "FastAPI", "SQLite", "Streamlit"]
github: "https://github.com/KarasiewiczStephane/face-attendance"
result: "Privacy-compliant face recognition"
featured: false
order: 14
screenshots:
  - src: "/screenshots/face-attendance-daily-chart.png"
    alt: "Face Attendance - Daily Attendance Chart"
  - src: "/screenshots/face-attendance-weekly-report.png"
    alt: "Face Attendance - Weekly Summary Report"
  - src: "/screenshots/face-attendance-gallery.png"
    alt: "Face Attendance - Face Database Gallery"
  - src: "/screenshots/face-attendance-rates.png"
    alt: "Face Attendance - Attendance Rates"
---

## Overview
Real-time face recognition attendance system with privacy-first design and anti-spoofing measures.

## Architecture
- MTCNN for face detection
- FaceNet embeddings for face recognition
- Liveness detection for anti-spoofing
- GDPR-compliant data management
- FastAPI backend with SQLite storage

## Key Features
- Real-time face recognition with low latency
- Anti-spoofing liveness detection
- GDPR-style privacy controls and data deletion
- Automated daily/weekly attendance reports
