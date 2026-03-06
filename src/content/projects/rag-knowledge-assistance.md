---
title: "RAG Knowledge Assistant"
description: "Retrieval-augmented generation chatbot ingesting PDF/DOCX/Markdown, embedding into ChromaDB, answering with citations using LangChain and Claude/OpenAI APIs."
category: "LLM/AI"
domain: "Enterprise Knowledge"
icon: "📚"
gradient: "pv-6"
technologies: ["LangChain", "ChromaDB", "sentence-transformers", "Anthropic API", "OpenAI API", "Streamlit"]
github: "https://github.com/KarasiewiczStephane/rag-knowledge-assistance"
result: "Multi-format document Q&A system"
featured: true
order: 6
screenshots:
  - src: "/screenshots/rag-knowledge-assistance-chat.png"
    alt: "RAG Knowledge Assistant - Chat Interface & Document Ingestion"
---

## Overview
Enterprise knowledge assistant using retrieval-augmented generation for accurate, citation-backed question answering.

## Architecture
- Multi-format document ingestion (PDF, DOCX, Markdown)
- Sentence-transformer embeddings into ChromaDB
- LangChain orchestration with Claude/OpenAI LLMs
- RAGAS evaluation framework for quality metrics
- Streamlit chat interface

## Key Features
- Source citation for every answer
- Multi-document cross-referencing
- Configurable chunking strategies
- Quality evaluation with RAGAS metrics
