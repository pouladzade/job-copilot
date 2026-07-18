# System Patterns — AI Job Copilot

## Architecture Pattern

**Monorepo with pnpm workspaces** — three packages: `backend` (NestJS), `extension` (Manifest V3), `shared` (DTOs & types).

```
packages/
├── backend/     # NestJS + Drizzle + PostgreSQL
├── extension/   # TypeScript + Manifest V3 + Preact
└── shared/      # class-validator DTOs, constants, API types
```

## Key Design Patterns

### 1. Adapter Pattern (Extension)

Self-registering adapters for each job board. Adding a new site never touches core extension logic.

```
Adapter Registry → findAdapter(url) → scrape() → normalize() → POST to backend
```

Each adapter implements `SiteAdapter` interface with `matches()`, `scrapeJobPosting()`, `scrapeFormFields()`, `fillField()`.

### 2. Module Pattern (Backend)

One NestJS module per domain. Each module has its own `dto/` folder.

```
application.module.ts
├── application.controller.ts    # REST endpoints
├── application.service.ts       # Orchestrator
├── dto/                         # Request/response DTOs (class-validator + @ApiProperty)
└── services/                    # Sub-services (DeepSeek client, PII filter, etc.)

deepseek.module.ts               # API client wrapper
resume.module.ts                 # Resume loading & matching
prompts/                         # Prompt template loading & evaluation
validation/                      # Response validator, PII filter
database/                        # Drizzle ORM schema & migrations
```

### 3. Normalization Ownership

**Extension owns normalization** — the backend validates but never re-normalizes. No `/jobs/normalize` endpoint. The extension POSTs a ready `JobPosting` directly to `/applications/generate`.

### 4. Separation of Concerns

**LLM never touches the DOM. DOM-scraping code never touches the LLM.** Everything flows through typed schemas:

```
RawScrape → Normalizer → JobPosting → Backend → DeepSeek → ApplicationDraft → Review UI → Form Fill
```

### 5. PII Filter Pipeline

Server-side filter runs BEFORE any data reaches DeepSeek:

```
Resume text + Profile → PiiFilterService → Redacted text → DeepSeek API
```

Regex patterns for SSN, credit card, EIN. Warnings logged server-side.

### 6. Prompt Versioning

Prompts are `.md` files loaded at runtime, not inline strings. Changing a prompt means creating a new file (e.g., `screening.v2.md`) — no code changes.

### 7. Form Fill with Undo

Before filling any field, the extension snapshots the current form state. The Review UI provides a "Revert to original" button.

### 8. Confidence Tiers

Raw floats (0.0–1.0) are stored. The UI maps them to actionable tiers:

| Raw | Tier | Display |
|-----|------|---------|
| 0.7–1.0 | High | 🟢 Green — review recommended |
| 0.3–0.7 | Medium | 🟡 Yellow — review strongly recommended |
| 0.0–0.3 | Low | 🔴 Red — must review before use |

## Database Conventions

- **Drizzle ORM** as single source of truth for schema
- **SERIAL primary keys** (single-user local tool, no UUID overhead)
- **JSONB** for `screening_answers` (queryable, indexable)
- **snake_case** column names, **camelCase** in TypeScript
- **source_url UNIQUE** constraint for deduplication
- Migrations via `pnpm db:generate` → `pnpm db:migrate`

## API Conventions

- RESTful: `/applications` (plural nouns, no verbs)
- Status codes: 201 created, 200 OK, 409 conflict, 502/503 for DeepSeek failures
- Error envelope: `{ error: string, message: string }`
- CORS: `chrome-extension://` origins only
- Request size limit: 50KB
- NestJS ValidationPipe auto-applied to all endpoints

## Tech Decisions

| Decision | Rationale |
|----------|-----------|
| NestJS over FastAPI | Unified TypeScript across full stack; shared DTOs in monorepo |
| PostgreSQL over SQLite | JSONB, full-text search, proper migrations; Docker makes it trivial |
| Drizzle over Prisma | Lighter weight, SQL-like DX, better PostgreSQL-specific features |
| Preact over React | ~3KB, sufficient for extension popup; no framework bloat needed |
| class-validator (no Zod) | NestJS native, works with ValidationPipe and Swagger auto-docs |
| SERIAL over UUID | Single-user tool, no distributed system concerns |
| pnpm workspaces over Turborepo | Simple monorepo; no complex build orchestration needed |