# Project Brief — AI Job Copilot

## Overview

A personal, local-first tool that helps a job seeker go from "found a listing" to "submitted a tailored application" faster, while keeping a human in control of every meaningful action.

## Core Capabilities

1. **Scrape** job postings from supported sites via a browser extension
2. **Tailor** applications using the DeepSeek API — generates professional summaries, cover letters, and screening-question answers
3. **Review** everything in a UI with confidence indicators and inline editing
4. **Fill** web form fields only after explicit user approval
5. **Persist** every application to a local PostgreSQL database for search and analysis

## Non-Goals

- Fully autonomous applying
- Mimicking human typing/mouse patterns to evade bot detection
- Bypassing site terms of service
- Multi-tenancy or user authentication (single-user local tool)
- External network exposure — everything runs on localhost

## Key Design Principles

- **Human-in-the-loop (HITL):** No auto-submit, ever. The user always clicks the final Submit button.
- **LLM never touches the DOM:** The DOM-scraping code and LLM code are completely separated by `JobPosting` and `ApplicationDraft` schemas.
- **Extension owns normalization:** Adapters scrape and normalize; the backend validates but never re-normalizes.
- **Local-first:** All data stays on the user's machine. Only job descriptions and resume content go to DeepSeek's API.
- **PII protection:** Server-side PII filter runs before any data reaches DeepSeek.

## Target Users

A single job seeker managing multiple resume variants (backend, ML, frontend) and applying through various job boards.