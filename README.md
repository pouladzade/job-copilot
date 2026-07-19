# Job Hunter Agent

[![CI](https://github.com/pouladzade/job-hunter-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/pouladzade/job-hunter-agent/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-orange)](https://pnpm.io/)
[![NestJS](https://img.shields.io/badge/NestJS-11-ea2845)](https://nestjs.com/)
[![License](https://img.shields.io/badge/license-Private-red)](./LICENSE)

A personal, local-first tool that helps you go from "found a job listing" to "submitted a tailored application" faster — with a human always in control of every meaningful action.

## Overview

1. **Scrape** job postings from supported sites via a browser extension
2. **Tailor** applications using an OpenAI-compatible API — generates professional summaries, cover letters, and screening-question answers
3. **Review** everything in a UI with confidence indicators and inline editing
4. **Fill** web form fields only after explicit user approval
5. **Persist** every application to a local database for search and analysis

**Non-goals:** fully autonomous applying, multi-tenancy, external network exposure. Everything runs on localhost.

## Architecture

```
┌───────────────────────────────────────────────────────── ┐
│                      Browser Extension                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐    │
│  │  Popup   │  │ Content  │  │      Adapters        │    │
│  │ (Preact) │  │  Script  │  │  (greenhouse, lever, │    │
│  │          │  │          │  │   ashby, indeed, ...)│    │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘    │
│       │             │                    │               │
└───────┼─────────────┼────────────────────┼───────────────┘
        │             │                    │
        ▼             ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                  NestJS Backend (localhost:4001)        │
│  ┌───────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │Application│  │ LLM      │  │     Resume         │    │
│  │ Controller│  │ Service  │  │    Management      │    │
│  └─────┬─────┘  └────┬─────┘  └─────────┬──────────┘    │
│        │              │                  │              │
│  ┌─────┴──────────────┴──────────────────┴─────────-─┐  │
│  │              ApplicationService                   │  │
│  │     (orchestrator: PII → generate → validate)     │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              TypeORM + local database             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer            | Technology                             |
| ---------------- | -------------------------------------- |
| Backend          | NestJS (TypeScript), TypeORM           |
| Database         | Local (via TypeORM)                    |
| Extension        | TypeScript, Preact, Vite (Manifest V3) |
| AI               | OpenAI-compatible API (via OpenAI SDK) |
| Validation       | class-validator, class-transformer     |
| Package manager  | pnpm (workspaces)                      |
| Containerization | Docker Compose                         |

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- **Docker** and **Docker Compose** (for the database)
- An **API key** for an OpenAI-compatible provider (e.g., [DeepSeek](https://platform.deepseek.com), [OpenAI](https://platform.openai.com))

## Quick Start

### 1. Clone and install

```bash
git clone git@github.com:pouladzade/job-hunter-agent.git
cd job-hunter-agent
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
LLM_API_KEY=sk-your-key-here
DB_HOST=localhost
DB_PORT=5433
DB_USER=jobhunter
DB_PASSWORD=jobhunter
DB_NAME=jobhunter
```

### 3. Start the database

```bash
docker compose up -d
```

### 4. Start the backend

```bash
pnpm dev:backend
```

The backend starts at `http://127.0.0.1:4001`. Swagger docs at `http://127.0.0.1:4001/api/docs`.

### 5. Verify it works

```bash
curl http://127.0.0.1:4001/applications/health
# → {"status":"ok"}
```

### 6. Load the extension (Phase 5+)

1. Build: `pnpm --filter @job-hunter/extension run build`
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → select `packages/extension/dist`

## Project Structure

```
job-hunter-agent/
├── packages/
│   ├── backend/          # NestJS API server
│   │   └── src/
│   │       ├── application/   # CRUD + generate orchestration
│   │       ├── llm/           # OpenAI-compatible API client
│   │       ├── database/      # TypeORM entities + migrations
│   │       ├── prompts/       # Prompt template builder
│   │       ├── resume/        # Resume loader, merger, indexer
│   │       └── validation/    # PII filter + response validator
│   ├── extension/        # Chrome Extension (Manifest V3)
│   │   └── src/
│   │       ├── adapters/      # Per-site scrapers
│   │       ├── popup/         # Preact review UI
│   │       └── background.ts  # Message relay
│   └── shared/           # Shared DTOs, constants, types
├── data/
│   ├── profiles/         # JSON profile variants
│   └── resumes/          # Markdown resume variants
├── prompts/              # LLM prompt templates (.md)
├── docs/                 # Specs and roadmap
├── memory-bank/          # Project context and progress tracking
└── docker-compose.yml    # Database + backend containers
```

## API Endpoints

| Method  | Path                       | Description                         |
| ------- | -------------------------- | ----------------------------------- |
| `GET`   | `/applications/health`     | Health check                        |
| `POST`  | `/applications/generate`   | Generate tailored application draft |
| `POST`  | `/applications/:id/save`   | Save user-edited draft              |
| `GET`   | `/applications`            | List with filters + pagination      |
| `PATCH` | `/applications/:id/status` | Update application status           |
| `POST`  | `/resumes/refresh-index`   | Regenerate resume keyword index     |

## Development

### Running tests

```bash
# All tests
pnpm test

# With coverage
pnpm test -- --coverage

# E2E tests
pnpm --filter @job-hunter/backend run test:e2e
```

### Database migrations

```bash
# Generate a migration from entity changes
pnpm migration:generate

# Apply migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert
```

### Code quality

```bash
# TypeScript type checking
pnpm typecheck

# Lint all packages
pnpm lint

# Build all packages
pnpm build
```

## Environment Variables

| Variable           | Default           | Description                                       |
| ------------------ | ----------------- | ------------------------------------------------- |
| `LLM_API_KEY`      | —                                                    | API key for OpenAI-compatible provider (required) |
| `LLM_BASE_URL`     | `https://api.deepseek.com/v1`                        | Base URL for the OpenAI-compatible API            |
| `LLM_MODEL`        | `deepseek-chat`                                      | Model name to use for generation                  |
| `DB_HOST`          | `localhost`       | Database host                                     |
| `DB_PORT`          | `5433`            | Database port                                     |
| `DB_USER`          | `jobhunter`       | Database user                                     |
| `DB_PASSWORD`      | `jobhunter`       | Database password                                 |
| `DB_NAME`          | `jobhunter`       | Database name                                     |
| `DATA_DIR`         | _(auto-resolved)_ | Override path to `data/`                          |
| `PROMPTS_DIR`      | _(auto-resolved)_ | Override path to `prompts/`                       |

## Design Principles

- **Human-in-the-loop (HITL):** No auto-submit, ever. The user always clicks the final Submit button.
- **LLM never touches the DOM:** Scraping and LLM code are completely separated by `JobPosting` and `ApplicationDraft` schemas.
- **Extension owns normalization:** Adapters scrape and normalize; the backend validates but never re-normalizes.
- **Local-first:** All data stays on your machine. Only job descriptions and resume content go to the LLM API.
- **PII protection:** Server-side PII filter runs before any data reaches the LLM API.

## License

Private. Personal use tool.
