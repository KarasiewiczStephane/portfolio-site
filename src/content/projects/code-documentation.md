---
title: "Automated Code Documentation"
description: "LLM-powered tool parsing Python and JS/TS codebases via AST/tree-sitter, generating documentation (docstrings, READMEs, module docs) using Claude API with complexity analysis."
category: "LLM/AI"
domain: "Developer Tools"
icon: "💻"
gradient: "pv-6"
technologies: ["Anthropic API", "ast", "tree-sitter", "Click", "Jinja2", "MkDocs"]
github: "https://github.com/KarasiewiczStephane/code-documentation"
result: "Auto-generated project documentation"
featured: false
order: 30
screenshots:
  - src: "/screenshots/code-documentation-dashboard.png"
    alt: "Code Documentation - Dashboard"
---

## Overview
Automated documentation generator using LLMs to create comprehensive project documentation from source code.

## Architecture
- AST parsing for Python code analysis
- tree-sitter for JS/TS support
- Claude API for documentation generation
- Complexity analysis with radon
- MkDocs output with custom templates

## Key Features
- Multi-language code parsing
- Incremental documentation mode
- Complexity-aware documentation depth
- MkDocs-ready output format
