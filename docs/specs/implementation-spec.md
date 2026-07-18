# AI Job Copilot — Implementation Specification

**Version:** 2.0  
**Status:** Ready for implementation  
**Automation policy:** Human-in-the-loop (HITL). No auto-submit, ever.  
**Last updated:** 2026-07-18

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Component Breakdown](#4-component-breakdown)
   - [4.1 Browser Extension](#41-browser-extension)
   - [4.2 Backend (NestJS)](#42-backend-nestjs)
   - [4.3 Database (PostgreSQL)](#43-database-postgresql)
   - [4.4 DeepSeek API Integration](#44-deepseek-api-integration)
   - [4.5 Review UI](#45-review-ui)
   - [4.6 Application Store](#46-application-store)
5. [Data Schemas](#5-data-schemas)
6. [API Specification](#6-api-specification)
7. [Resume Content Management](#7-resume-content-management)
8. [Prompt Design](#8-prompt-design)
9. [Workflow & Error Handling](#9-workflow--error-handling)
10. [Security & Privacy](#10-security--privacy)
11. [Docker Compose Setup](#11-docker-compose-setup)
12. [Project Structure](#12-project-structure)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Edge Cases](#14-edge-cases)
15. [GitHub Workflows](#15-github-workflows)

---

## 1. Purpose & Scope

A personal, local-first tool that helps a job seeker go from "found a listing" to "submitted a tailored application" faster, while keeping a human in control of every meaningful action.

**What it does:**

- Scrapes a job posting from a supported site via a browser extension
- Sends the posting + resume context to the DeepSeek API for tailoring
- Generates a professional summary, resume bullet suggestions, cover letter, and screening-question answers
- Presents everything in a Review UI for editing
- Fills web form fields only after the user explicitly approves
- Requires the user to personally click the final "Submit" button
- Persists every application to a local PostgreSQL database for later search and analysis

**Non-goals:** fully autonomous applying, mimicking human behavior to evade bot detection, bypassing site terms of service.

---

## 2. Tech Stack

| Layer                 | Technology                                                                             | Rationale                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser Extension** | TypeScript, Manifest V3, Preact (lightweight UI)                                       | Type safety across the stack; Preact is ~3KB and sufficient for the Review UI                                                                                                       |
| **Backend**           | NestJS (Node.js) + TypeScript                                                          | Opinionated, modular architecture; built-in validation (class-validator), Swagger/OpenAPI docs, excellent DI                                                                        |
| **Database**          | PostgreSQL 16                                                                          | JSONB for screening answers, rich indexing for job-memory queries, reliable migrations                                                                                              |
| **ORM**               | Drizzle ORM                                                                            | Type-safe, lightweight, SQL-like DX, good PostgreSQL support                                                                                                                        |
| **LLM Client**        | OpenAI Node.js SDK (pointed at DeepSeek base URL)                                      | DeepSeek API is OpenAI-compatible                                                                                                                                                   |
| **Validation**        | class-validator + class-transformer (NestJS-native, shared across backend & extension) | Unified validation via decorators; DTOs live in `dto/` folders per module                                                                                                           |
| **API Documentation** | @nestjs/swagger (Swagger/OpenAPI)                                                      | Auto-generated from `@ApiProperty` decorators on all DTOs; available at `/api/docs`                                                                                                 |
| **Containerization**  | Docker Compose                                                                         | One-command local dev: `docker compose up` starts NestJS + PostgreSQL                                                                                                               |
| **Version Control**   | GitHub                                                                                 | Source hosting, PR reviews, CI via GitHub Actions                                                                                                                                   |
| **CI/CD**             | GitHub Actions                                                                         | Lint (ESLint zero-warnings), type-check, test on PR; build extension zip on release tags                                                                                            |
| **Package Manager**   | pnpm                                                                                   | Fast, strict, disk-efficient; pnpm workspaces for monorepo                                                                                                                          |
| **Linting**           | ESLint + @typescript-eslint (`.eslintrc.cjs`)                                          | Strict rules: `no-explicit-any`, `strict-boolean-expressions`, `explicit-function-return-type`, complexity ≤10, max-params ≤4, no-magic-numbers, import ordering, no-default-export |
| **Formatting**        | Prettier (`.prettierrc`)                                                               | Enforced by pre-commit hook; consistent code style                                                                                                                                  |
| **Git Hooks**         | Husky + lint-staged + commitlint                                                       | Pre-commit: lint + format; commit-msg: conventional commits                                                                                                                         |

**Why NestJS over FastAPI (from the original draft):**

- Unified TypeScript across extension and backend — shared types, schemas, and validation logic in a monorepo
- NestJS modules map cleanly to the component boundaries in this architecture (Extension module, DeepSeek module, Application module, Resume module)
- Built-in OpenAPI/Swagger generation for API docs
- Strong ecosystem for PostgreSQL integration (Drizzle via `@nestjs/config`)

**Why PostgreSQL over SQLite:**

- JSONB column type for `screening_answers` — queryable, indexable, no string parsing
- Full-text search for job descriptions and cover letters (`tsvector`)
- Proper migration tooling (Drizzle Kit)
- Docker Compose makes it trivial to run locally; no "but SQLite is simpler" tradeoff needed

---

## 3. High-Level Architecture

```
┌──────────────────────────────────┐
│          BROWSER LEVEL            │
│                                    │
│  Target Job Page                   │
│  (LinkedIn, Indeed, Greenhouse,    │
│   Lever, Ashby, ZipRecruiter...)   │
│          │ DOM scrape (scoped)     │
│          ▼                         │
│  Site Adapter (per platform)       │
│          │ raw fields              │
│          ▼                         │
│  Normalizer → JobPosting          │
│  (class-validator + class-        │
│   transformer, shared DTOs)       │
│          │                         │
│  Scoped scraping: job description  │
│  container only, never full DOM    │
└────────────┬───────────────────────┘
             │ HTTP POST (localhost:3000)
             │ CORS: chrome-extension://<id>
             ▼
┌──────────────────────────────────┐
│     DOCKER COMPOSE                │
│                                    │
│  ┌────────────────────────────┐   │
│  │  NestJS Backend (Port 3000) │   │
│  │                              │   │
│  │  Swagger UI: /api/docs       │   │
│  │                              │   │
│  │  Modules (each with dto/):   │   │
│  │   ├─ ApplicationModule       │   │
│  │   │   ├─ dto/                 │   │
│  │   │   ├─ application.controller│   │
│  │   │   ├─ application.service  │   │
│  │   │   └─ services/            │   │
│  │   │     ├─ OrchestratorService│   │
│  │   │     ├─ ResumeLoaderService│   │
│  │   │     ├─ PromptBuilderSvc   │   │
│  │   │     ├─ DeepSeekClient     │   │
│  │   │     ├─ PiiFilterService   │   │
│  │   │     └─ ResponseValidator  │   │
│  │   ├─ DeepseekModule           │   │
│  │   │   └─ dto/                 │   │
│  │   └─ ResumeModule             │   │
│  │       ├─ dto/                 │   │
│  │       ├─ ResumeIndexService   │   │
│  │       └─ ProfileMergeService  │   │
│  │                              │   │
│  │  Validation: class-validator │   │
│  │  + class-transformer         │   │
│  │  All DTOs: @ApiProperty()    │   │
│  └──────────┬───────────────────┘   │
│             │ TCP :5432             │
│  ┌──────────▼───────────────────┐   │
│  │  PostgreSQL 16               │   │
│  │  - applications table        │   │
│  │  - resume_versions table     │   │
│  │  - token_usage_log table     │   │
│  │  - Drizzle migrations        │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
             │ HTTPS (api.deepseek.com)
             ▼
┌──────────────────────────────────┐
│         DeepSeek API              │
│  deepseek-chat / deepseek-reasoner│
│  JSON mode (response_format)      │
└──────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│          REVIEW UI                │
│  (Extension popup / side panel)   │
│                                    │
│  States:                           │
│   ├─ Loading (skeleton)           │
│   ├─ Error (retry / raw view)     │
│   ├─ Ready (edit + approve)       │
│   └─ Filled (undo available)      │
│                                    │
│  User clicks Submit manually       │
└────────────────────────────────────┘
```

**Core design principle:** The LLM never touches the DOM. The DOM-scraping code never touches the LLM. Everything flows through `JobPosting` and `ApplicationDraft` schemas.

**Normalization ownership:** The extension is the single source of truth for scraping and normalizing into a `JobPosting`. The backend validates the payload with Pydantic/class-validator but does not re-normalize. There is no `/jobs/normalize` endpoint — the extension POSTs a ready `JobPosting` directly to `/applications/generate`.

---

## 4. Component Breakdown

### 4.1 Browser Extension

#### 4.1.1 Responsibilities

- Detect supported job site via URL pattern matching against registered adapters
- **Scoped DOM scraping:** target only the job description container, never the full page (prevents accidental PII extraction from nav/sidebar/profile elements)
- Normalize raw fields into a validated `JobPosting` (using class-validator + class-transformer, importing shared DTOs)
- POST the `JobPosting` to the local backend (`http://localhost:3000/applications/generate`) with appropriate CORS preflight
- Receive and render the `ApplicationDraft` in the Review UI
- Fill form fields on user approval by mapping `screening_answers` to form elements
- Snapshot form state before filling for undo support
- **Never** trigger form submission — the final click belongs to the user

#### 4.1.2 Adapter Pattern

Self-registering adapters. Adding a new site does not require touching core extension logic.

```typescript
// adapters/types.ts
interface SiteAdapter {
  id: string;
  matches: (url: string) => boolean;
  scrapeJobPosting: () => RawScrape;
  scrapeFormFields: () => FormField[];
  fillField: (field: FormField, value: string) => void;
}

interface FormField {
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  selector: string;
  maxLength?: number;
}

interface RawScrape {
  title: string;
  company: string;
  location: string;
  description: string; // combined description + requirements
  sourceUrl: string;
}
```

```typescript
// adapters/registry.ts
const adapters: SiteAdapter[] = [];

export function registerAdapter(adapter: SiteAdapter): void {
  adapters.push(adapter);
}

export function findAdapter(url: string): SiteAdapter | undefined {
  return adapters.find((a) => a.matches(url));
}
```

```typescript
// adapters/greenhouse.adapter.ts
import { registerAdapter, SiteAdapter } from './registry';

registerAdapter({
  id: 'greenhouse',
  matches: (url) => url.includes('greenhouse.io'),
  scrapeJobPosting: () => {
    // scoped to job description container only
    const container = document.querySelector('#content');
    if (!container) throw new Error('Job content container not found');
    return {
      title: container.querySelector('.app-title')?.textContent ?? '',
      company: container.querySelector('.company-name')?.textContent ?? '',
      location: container.querySelector('.location')?.textContent ?? '',
      description: container.querySelector('#content')?.textContent ?? '',
      sourceUrl: window.location.href,
    };
  },
  scrapeFormFields: () => {
    // returns FormField[] from the application form
    return [];
  },
  fillField: (field, value) => {
    const el = document.querySelector(field.selector);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
});
```

**Adapter build order (by HTML stability, not popularity):**

1. Greenhouse (semantic, stable)
2. Lever (semantic, stable)
3. Ashby (semantic, stable)
4. Indeed (moderate brittleness)
5. LinkedIn (highly brittle, frequent DOM changes)

#### 4.1.3 Normalizer

The extension normalizes `RawScrape` into a `JobPosting` using the same class-validator DTOs from the `shared` package. Validation is performed with `class-validator` + `class-transformer`:

```typescript
// Shared DTO (in packages/shared/src/dto/job-posting.dto.ts)
import { IsString, IsUrl, IsOptional, MaxLength, MinLength, IsInt, Equals } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobPostingDto {
  @ApiProperty({ description: 'Schema version for migration support' })
  @IsInt()
  @Equals(1)
  readonly schemaVersion!: 1;

  @ApiProperty({ description: 'Job title', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly title!: string;

  @ApiProperty({ description: 'Company name', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  readonly company!: string;

  @ApiProperty({ description: 'Job location', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  readonly location!: string;

  @ApiProperty({ description: 'Combined job description and requirements', maxLength: 50000 })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  readonly description!: string;

  @ApiProperty({ description: 'Source URL of the job posting' })
  @IsUrl()
  @MaxLength(2048)
  readonly sourceUrl!: string;

  @ApiProperty({ description: 'Adapter ID (e.g., greenhouse, linkedin)', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  readonly sourceSite!: string;

  @ApiPropertyOptional({ description: 'Optional explicit resume filename hint', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly resumeHint?: string | null;
}

// Extension-side usage:
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JobPostingDto } from '@job-hunter/shared';

export async function normalize(raw: RawScrape): Promise<JobPostingDto> {
  const dto = plainToInstance(JobPostingDto, {
    schemaVersion: 1,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    description: raw.description,
    sourceUrl: raw.sourceUrl,
    sourceSite: adapterId,
  });
  const errors = await validate(dto);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
  }
  return dto;
}
```

#### 4.1.4 Form Fill with Undo

Before filling any field, the extension snapshots the current form state:

```typescript
function snapshotForm(fields: FormField[]): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const field of fields) {
    const el = document.querySelector(field.selector);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      snapshot.set(field.selector, el.value);
    }
  }
  return snapshot;
}
```

The Review UI provides a "Revert to original" button that restores the snapshot.

#### 4.1.5 Matching answers to form fields

Answers are mapped to form fields by fuzzy-matching the `screening_answers[].question` text against `FormField.label`. If no match is found above a similarity threshold (e.g., Levenshtein ratio > 0.6), the field is skipped and flagged in the UI. If the generated answer exceeds `FormField.maxLength`, it is truncated with an ellipsis and the field is flagged for user review.

### 4.2 Backend (NestJS)

#### 4.2.1 Module Structure

```
src/
├── main.ts                          # Bootstrap, CORS config
├── app.module.ts
├── config/
│   ├── deepseek.config.ts           # LLM_API_KEY, base URL, defaults
│   └── app.config.ts                # Port, CORS origins, size limits
├── application/
│   ├── application.module.ts
│   ├── application.controller.ts    # POST /generate, POST /save, GET /list, PATCH /status
│   ├── application.service.ts       # Main orchestrator
│   ├── application.repository.ts    # Drizzle queries
│   ├── dto/
│   │   ├── generate-request.dto.ts
│   │   ├── generate-response.dto.ts
│   │   ├── save-application.dto.ts
│   │   └── list-applications.dto.ts
│   └── schemas/
│       ├── job-posting.schema.ts    # class-validator version
│       └── application-draft.schema.ts
├── deepseek/
│   ├── deepseek.module.ts
│   ├── deepseek.service.ts          # API client with retry, timeout, token logging
│   └── deepseek.types.ts
├── resume/
│   ├── resume.module.ts
│   ├── resume-loader.service.ts     # Reads data/resumes/ from filesystem
│   ├── resume-index.service.ts      # Auto-tag generation, keyword matching
│   ├── profile-merge.service.ts     # Shared profile + variant override
│   └── dto/
│       └── resume-index.dto.ts
├── prompts/
│   ├── prompt-builder.service.ts    # Loads prompt templates, fills placeholders
│   ├── templates/                    # Prompt .md files, loaded at runtime
│   │   ├── tailor.v1.md
│   │   ├── cover-letter.v1.md
│   │   └── screening.v1.md
│   └── prompt-evaluator.service.ts  # Runs evals against saved fixtures
├── validation/
│   ├── response-validator.service.ts # Validates JSON, retries on failure
│   └── pii-filter.service.ts        # Regex-based PII redaction
└── database/
    ├── database.module.ts
    ├── drizzle.config.ts
    ├── schema.ts                    # Drizzle table definitions
    └── migrations/                   # Auto-generated by Drizzle Kit
```

#### 4.2.2 CORS Configuration

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [/^chrome-extension:\/\//], // Allow all extension IDs
    methods: ['GET', 'POST', 'PATCH'],
    maxAge: 86400,
  });
  // Request size limit
  app.use(json({ limit: '50kb' }));
  await app.listen(3000, '127.0.0.1'); // localhost only, never 0.0.0.0
}
```

#### 4.2.3 Endpoints

| Method | Path                       | Request Body                                           | Response                        | Purpose                                     |
| ------ | -------------------------- | ------------------------------------------------------ | ------------------------------- | ------------------------------------------- |
| POST   | `/applications/generate`   | `JobPosting` + optional `resumeHint`                   | `ApplicationDraft`              | Generates tailored content                  |
| POST   | `/applications/:id/save`   | Edited `ApplicationDraft` + `status`                   | `{ id, savedAt }`               | Persists user edits                         |
| GET    | `/applications`            | Query: `?company=&status=&resumeVersion=&page=&limit=` | `{ applications, total, page }` | Lists past applications                     |
| PATCH  | `/applications/:id/status` | `{ status }`                                           | `{ id, status, updatedAt }`     | Updates application status                  |
| POST   | `/resumes/refresh-index`   | —                                                      | `{ tags }`                      | Re-generates resume index tags via DeepSeek |

#### 4.2.4 Orchestrator Flow (POST /applications/generate)

```
1. Validate incoming JobPosting (class-validator)
2. Check source_url against applications table → if exists, return 409 with existing draft ID
3. Select resume:
   a. If resumeHint provided → use that
   b. Else → keyword-overlap match via resume_index.json
4. Load selected resume + merged profile (shared + variant overrides)
5. Run PII filter on resume + profile text → redact, log warning if matches
6. Build prompt from template files
7. Call DeepSeek API:
   a. Timeout: 30s
   b. Retry: once on network/timeout errors
   c. No retry on 4xx errors
8. Validate JSON response (class-validator on ApplicationDraftDto)
   a. If valid → return ApplicationDraft
   b. If invalid → retry once with stronger "return valid JSON only" instruction
   c. If still invalid → return 502 with raw response for manual salvage
9. Log token usage to token_usage_log table
10. Return ApplicationDraft with resume_used and resume_selection_reason
```

### 4.3 Database (PostgreSQL)

#### 4.3.1 Drizzle Schema

```typescript
// src/database/schema.ts
import { pgTable, serial, varchar, text, jsonb, timestamp, real, integer, index } from 'drizzle-orm/pg-core';

export const applications = pgTable(
  'applications',
  {
    id: serial('id').primaryKey(),
    schemaVersion: integer('schema_version').notNull().default(1),
    company: varchar('company', { length: 200 }).notNull(),
    role: varchar('role', { length: 300 }).notNull(),
    location: varchar('location', { length: 200 }),
    sourceUrl: varchar('source_url', { length: 2048 }).notNull().unique(),
    sourceSite: varchar('source_site', { length: 50 }).notNull(),
    resumeUsed: varchar('resume_used', { length: 100 }).notNull(),
    resumeSelectionReason: varchar('resume_selection_reason', { length: 50 }).notNull(),
    resumeSummary: text('resume_summary'),
    coverLetter: text('cover_letter'),
    screeningAnswers: jsonb('screening_answers').$type<ScreeningAnswer[]>(),
    overallConfidence: real('overall_confidence'),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    // 'draft' | 'submitted' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index('idx_applications_company').on(table.company),
    statusIdx: index('idx_applications_status').on(table.status),
    resumeUsedIdx: index('idx_applications_resume_used').on(table.resumeUsed),
    createdAtIdx: index('idx_applications_created_at').on(table.createdAt),
    // Full-text search index for description queries
    searchIdx: index('idx_applications_search').using(
      'gin',
      // Will be built via a generated tsvector column in migration
    ),
  }),
);

export const tokenUsageLog = pgTable('token_usage_log', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').references(() => applications.id),
  model: varchar('model', { length: 50 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  estimatedCostUsd: real('estimated_cost_usd').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Types
interface ScreeningAnswer {
  questionId: string; // hash of question text for stable mapping
  question: string;
  answer: string;
  confidence: number; // 0.0–1.0
  confidenceTier: 'low' | 'medium' | 'high';
}
```

#### 4.3.2 Connections & Pooling

```typescript
// src/database/database.module.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  user: process.env.DB_USER ?? 'jobhunter',
  password: process.env.DB_PASSWORD ?? 'jobhunter',
  database: process.env.DB_NAME ?? 'jobhunter',
  max: 5, // low pool size for single-user local tool
});

export const db = drizzle(pool);
```

### 4.4 DeepSeek API Integration

#### 4.4.1 Client Service

```typescript
// src/deepseek/deepseek.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeepSeekService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(DeepSeekService.name);

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('LLM_API_KEY'),
      baseURL: 'https://api.deepseek.com/v1',
      timeout: 30000,
      maxRetries: 0, // We handle retries ourselves
    });
  }

  async generateJson(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{ content: string; usage: TokenUsage }> {
    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      response_format: { type: 'json_object' },
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 1800,
    });

    const usage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
      model: 'deepseek-chat',
    };

    return {
      content: response.choices[0]?.message?.content ?? '',
      usage,
    };
  }

  async generateWithRetry(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{ content: string; usage: TokenUsage }> {
    const maxRetries = 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateJson(messages, options);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`DeepSeek API attempt ${attempt + 1} failed: ${lastError.message}`);
        // Don't retry on 4xx errors (bad request, auth, rate limit)
        if (isRateLimitOrAuthError(error)) break;
        if (attempt < maxRetries) {
          await this.delay(1000 * (attempt + 1)); // linear backoff
        }
      }
    }

    throw lastError ?? new Error('DeepSeek API call failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}
```

#### 4.4.2 Token Cost Tracking

```typescript
// DeepSeek pricing (as of 2026)
const COST_PER_1K: Record<string, { prompt: number; completion: number }> = {
  'deepseek-chat': { prompt: 0.00014, completion: 0.00028 },
  'deepseek-reasoner': { prompt: 0.00055, completion: 0.00219 },
};

function estimateCost(usage: TokenUsage): number {
  const rates = COST_PER_1K[usage.model] ?? COST_PER_1K['deepseek-chat'];
  return (usage.promptTokens / 1000) * rates.prompt + (usage.completionTokens / 1000) * rates.completion;
}
```

Every API call logs to `token_usage_log` and attaches `token_usage` to the `ApplicationDraft` response so the user sees cost per generation.

### 4.5 Review UI

#### 4.5.1 States

The Review UI has four distinct states:

| State       | Trigger                                              | UI                                                                                                                                       |
| ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading** | After scraping, waiting for `/applications/generate` | Skeleton cards with shimmer animation, "Tailoring your application..." status text. Section outline visible so user knows what's coming. |
| **Error**   | API unreachable, timeout, or bad JSON                | Retry button with countdown (30s cooldown), raw-response viewer for manual salvage, "Regenerate" option                                  |
| **Ready**   | Valid `ApplicationDraft` received                    | Full Review UI with all sections, edit buttons, confidence indicators                                                                    |
| **Filled**  | User clicked "Fill Form"                             | Confirmation banner, "Revert to original" button visible                                                                                 |

#### 4.5.2 UI Layout

```
┌─────────────────────────────────────────────┐
│  Software Engineer @ Company X              │
│  San Francisco, CA                          │
│                                              │
│  Resume: [ backend.md ▾ ]   (auto-matched)  │
│  [ open resume file ]  [ refresh index ]    │
├─────────────────────────────────────────────┤
│                                              │
│  ✅ Professional Summary        [Edit]       │
│  ┌─────────────────────────────────────────┐ │
│  │ Results-driven software engineer with   │ │
│  │ 5+ years of experience building...       │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ✅ Cover Letter                [Edit]       │
│  ┌─────────────────────────────────────────┐ │
│  │ Dear Hiring Manager,                     │ │
│  │ ...                                      │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Screening Questions                         │
│  ┌─────────────────────────────────────────┐ │
│  │ 🟢 Q: Years of Python experience         │ │
│  │    7 years                               │ │
│  │    [Edit]                                │ │
│  │                                          │ │
│  │ 🟡 Q: Why do you want to work here?       │ │
│  │    I admire Company X's mission to...    │ │
│  │    [Edit]                                │ │
│  │                                          │ │
│  │ 🔴 Q: Do you have AWS Certification?      │ │
│  │    [Missing information — please fill]   │ │
│  │    [Edit]                                │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ⚠ Missing information: AWS Certification   │
│                                              │
│  Token usage: 1,247 tokens (~$0.0003)       │
│  Generated: 2 minutes ago                   │
│                                              │
│  [ Fill Form ]  [ Cancel ]  [ Regenerate ]  │
│                                              │
│  ⚠ "Fill Form" fills fields only — it will  │
│    NOT submit. YOU must click Submit.        │
└─────────────────────────────────────────────┘
```

#### 4.5.3 Confidence Tier Display

| Tier   | Range   | Icon | Color  | Meaning                                                       |
| ------ | ------- | ---- | ------ | ------------------------------------------------------------- |
| High   | 0.7–1.0 | 🟢   | Green  | Generated, likely accurate — review recommended               |
| Medium | 0.3–0.7 | 🟡   | Yellow | Generated with some uncertainty — review strongly recommended |
| Low    | 0.0–0.3 | 🔴   | Red    | Generated with high uncertainty — must review before use      |

The underlying float is stored; the tier is computed on display.

#### 4.5.4 Progressive Rendering Strategy

By default, all content (summary + cover letter + screening answers) is generated in one API call and rendered together. If total generation time exceeds a threshold (configurable, default: 10s), Phase 7 of the roadmap introduces split generation: summary + cover letter first (fast), then screening answers (potentially slower). For v1, a single call with skeleton UI is sufficient.

### 4.6 Application Store

The Application Store is the PostgreSQL `applications` table, exposed via the NestJS API. It supports:

- **List with filters:** `GET /applications?company=X&status=interview&resumeUsed=backend.md&page=1&limit=20`
- **Status updates:** `PATCH /applications/:id/status` — transitions: draft → submitted → interview → offer → rejected
- **Structured queries (Phase 6a):** A dashboard endpoint aggregating interview rate by resume version, response rate by company, and time-to-response.
- **Natural-language queries (Phase 6b, deferred):** Feed SQL query results as context to a local LLM or another DeepSeek call.

---

## 5. Data Schemas

### 5.1 `JobPosting` (Extension → Backend)

```typescript
// Shared in a types package used by both extension and backend
interface JobPosting {
  schemaVersion: 1;
  title: string;
  company: string;
  location: string;
  description: string; // combined description + requirements
  sourceUrl: string;
  sourceSite: string; // free-form adapter.id (e.g., "greenhouse", "linkedin")
  resumeHint?: string | null; // optional explicit resume selection
}
```

**Changes from v1 spec:**

- Removed `requirements` field (redundant — description covers it)
- `sourceSite` is now a free-form string, not a hard enum
- Added `schemaVersion` for future migration support
- `resumeHint` is optional

### 5.2 `ApplicationDraft` (Backend → Extension)

```typescript
interface ApplicationDraft {
  schemaVersion: 1;
  resumeSummary: string;
  coverLetter: string;
  screeningAnswers: ScreeningAnswer[];
  missingInformation: string[]; // Questions the model couldn't answer
  overallConfidence: number; // 0.0–1.0
  overallConfidenceTier: 'low' | 'medium' | 'high';
  resumeUsed: string; // e.g., "backend.md"
  resumeSelectionReason: 'auto-matched' | 'user-selected' | 'last-used-for-company';
  generatedAt: string; // ISO 8601
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

interface ScreeningAnswer {
  questionId: string; // hash of question text (SHA-256, first 8 hex chars)
  question: string;
  answer: string;
  confidence: number; // 0.0–1.0
  confidenceTier: 'low' | 'medium' | 'high';
}
```

**Changes from v1 spec:**

- Added `schemaVersion`
- Added `questionId` to `ScreeningAnswer` for stable form-field mapping
- Added `confidenceTier` alongside raw `confidence` float
- Added `generatedAt` timestamp
- Added `tokenUsage` block
- Separated `resumeUsed` and `resumeSelectionReason` from `missingInformation`

### 5.3 Application Record (Stored in DB)

```typescript
interface ApplicationRecord {
  id: number;
  schemaVersion: number;
  company: string;
  role: string;
  location: string | null;
  sourceUrl: string;
  sourceSite: string;
  jobDescription: string; // original scraped description, stored for reference
  resumeUsed: string;
  resumeSelectionReason: string;
  resumeSummary: string | null; // user-edited final version
  coverLetter: string | null; // user-edited final version
  screeningAnswers: ScreeningAnswer[] | null;
  overallConfidence: number | null;
  status: 'draft' | 'submitted' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

The `applications` table stores the **user-edited** version (what was actually submitted), not the raw generated draft. The raw draft can be reconstructed from `jobDescription` + `resumeUsed` if needed.

---

## 6. API Specification

### 6.1 `POST /applications/generate`

**Request:**

```json
{
  "schemaVersion": 1,
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "location": "San Francisco, CA",
  "description": "We are looking for a Senior Software Engineer...",
  "sourceUrl": "https://boards.greenhouse.io/acme/jobs/12345",
  "sourceSite": "greenhouse",
  "resumeHint": null
}
```

**Success Response (201):**

```json
{
  "schemaVersion": 1,
  "resumeSummary": "Results-driven software engineer with 7 years...",
  "coverLetter": "Dear Hiring Manager,\n\n...",
  "screeningAnswers": [
    {
      "questionId": "a1b2c3d4",
      "question": "Years of Python experience?",
      "answer": "7 years",
      "confidence": 0.95,
      "confidenceTier": "high"
    }
  ],
  "missingInformation": ["AWS Certification number"],
  "overallConfidence": 0.82,
  "overallConfidenceTier": "high",
  "resumeUsed": "backend.md",
  "resumeSelectionReason": "auto-matched",
  "generatedAt": "2026-07-18T10:30:00Z",
  "tokenUsage": {
    "promptTokens": 950,
    "completionTokens": 297,
    "totalTokens": 1247,
    "estimatedCostUsd": 0.000216
  }
}
```

**Conflict Response (409 — duplicate URL):**

```json
{
  "error": "duplicate_url",
  "message": "This job URL has already been processed.",
  "existingApplicationId": 42,
  "existingDraft": { "..." }
}
```

**Error Response (502 — DeepSeek returned invalid JSON after retry):**

```json
{
  "error": "invalid_llm_response",
  "message": "DeepSeek returned malformed JSON after 2 attempts.",
  "rawResponse": "The raw text the model returned...",
  "validationErrors": ["screeningAnswers[2].confidence: expected number, got string"]
}
```

**Error Response (503 — DeepSeek unreachable):**

```json
{
  "error": "llm_unavailable",
  "message": "DeepSeek API is unreachable after retry. Check your network and API key.",
  "retryAfterSeconds": 30
}
```

### 6.2 `POST /applications/:id/save`

**Request:**

```json
{
  "status": "submitted",
  "resumeSummary": "user-edited summary...",
  "coverLetter": "user-edited cover letter...",
  "screeningAnswers": [
    /* user-edited answers */
  ],
  "notes": "Applied via referral from Jane Smith"
}
```

**Response (200):**

```json
{
  "id": 1,
  "savedAt": "2026-07-18T10:35:00Z"
}
```

### 6.3 `GET /applications`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `company` | string | — | Filter by company (ILIKE) |
| `status` | string | — | Filter by status |
| `resumeUsed` | string | — | Filter by resume version |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |

**Response (200):**

```json
{
  "applications": [
    /* ApplicationRecord[] */
  ],
  "total": 57,
  "page": 1,
  "totalPages": 3
}
```

### 6.4 `PATCH /applications/:id/status`

**Request:**

```json
{
  "status": "interview"
}
```

**Response (200):**

```json
{
  "id": 1,
  "status": "interview",
  "updatedAt": "2026-07-20T14:00:00Z"
}
```

### 6.5 `POST /resumes/refresh-index`

Re-generates `resume_index.json` tags by passing each resume through DeepSeek once. No request body.

**Response (200):**

```json
{
  "message": "Resume index refreshed for 3 resumes",
  "tags": {
    "backend.md": ["backend", "api", "python", "django", "postgres", "aws", "docker"],
    "ml.md": ["machine learning", "pytorch", "llm", "nlp", "mlops", "python"],
    "frontend.md": ["react", "frontend", "typescript", "css", "nextjs", "tailwind"]
  },
  "tokenUsage": {
    "totalTokens": 342,
    "estimatedCostUsd": 0.000048
  }
}
```

---

## 7. Resume Content Management

### 7.1 Directory Structure

```
data/
├── resumes/
│   ├── backend.md
│   ├── ml.md
│   └── frontend.md
├── profiles/
│   ├── default.json           # Shared facts across all variants
│   ├── backend.json           # Variant-specific overrides
│   └── ml.json
└── resume_index.json          # Auto-generated tags (via /resumes/refresh-index)
```

### 7.2 Profile Merge Strategy

`default.json` holds shared facts:

```json
{
  "workAuthorization": "US Citizen",
  "salaryExpectations": "$140,000 - $170,000",
  "noticePeriod": "2 weeks",
  "contactEmail": "user@example.com",
  "contactPhone": "+1-555-0123",
  "linkedin": "https://linkedin.com/in/user"
}
```

`profiles/backend.json` overrides specific fields:

```json
{
  "yearsPythonExperience": "7 years",
  "yearsDjangoExperience": "5 years"
}
```

**Merge rule:** Variant profile fields **override** default fields by key. If both define the same key, the variant wins. If neither defines a key needed by a screening question, the model adds it to `missingInformation`. This is a shallow merge at the top-level keys.

### 7.3 Resume Selection Algorithm

1. If `JobPosting.resumeHint` is provided → use that resume
2. Else if a previous application to the same company exists → use `resumeUsed` from the most recent application to that company (`resumeSelectionReason: "last-used-for-company"`)
3. Else → keyword-overlap scoring:
   - Parse `resume_index.json` for all resume tag lists
   - Tokenize `JobPosting.description` into lowercase words, remove stop words
   - Count overlapping keywords between description tokens and each resume's tags
   - Select the resume with the highest overlap count
   - `resumeSelectionReason: "auto-matched"`
4. If no resume scores above threshold (configurable, default: 2 overlapping keywords) → return all options to the Review UI for manual selection

### 7.4 Auto-Generated Tags

The `POST /resumes/refresh-index` endpoint:

1. Reads all `.md` files from `data/resumes/`
2. For each resume, calls DeepSeek with a lightweight prompt: "Extract 8–12 keyword tags from this resume. Return as a JSON array."
3. Writes the aggregated result to `resume_index.json`
4. Caches the result; no need to re-run unless the user explicitly triggers it

This prevents manual tag drift — if a user updates `backend.md` and forgets to update tags, running `/resumes/refresh-index` fixes it.

---

## 8. Prompt Design

### 8.1 Template Files

Prompts are versioned as `.md` files under `src/prompts/templates/` and loaded at runtime. Changing a prompt means swapping the filename — no code changes.

Template placeholder syntax: `{{placeholderName}}`

```
src/prompts/templates/
├── tailor.v1.md
├── cover-letter.v1.md
└── screening.v1.md
```

Example `screening.v1.md`:

```markdown
## System

You are an expert job application assistant. You have access to:

- A job description
- The candidate's resume
- The candidate's profile (preferences, work authorization, salary expectations)

You are answering screening questions for a job application.

## Rules

1. Return ONLY valid JSON matching the exact schema below. No markdown fences, no extra text.
2. NEVER invent facts not present in the resume or profile. If you don't know, set confidence to 0.0 and add the question to `missingInformation`.
3. Keep answers professional, specific to the job description, and concise (1-3 sentences unless the question demands more).
4. Flag any question that asks for information not in the provided context — do NOT fabricate.

## Schema

{
"screeningAnswers": [
{
"questionId": "hash of question",
"question": "the original question text",
"answer": "your generated answer or empty string if unknown",
"confidence": 0.0-1.0
}
],
"missingInformation": ["list of questions you couldn't answer"],
"overallConfidence": 0.0-1.0
}

## Job Description

{{jobDescription}}

## Resume

{{resumeContent}}

## Profile

{{profileContent}}

## Screening Questions

{{screeningQuestionsJson}}
```

### 8.2 Prompt Evaluation Framework

A lightweight evaluation system provides guardrails for prompt changes:

```
evals/
├── fixtures/
│   ├── greenhouse-swe-1.json     # Saved JobPosting
│   ├── greenhouse-swe-1.output.v1.json  # Output from tailor.v1
│   └── ...
├── ratings/
│   └── v1-vs-v2.md               # Manual comparison notes
└── run-eval.ts                   # Script: given a prompt version, runs all fixtures
```

**Eval script (`run-eval.ts`):**

1. Loads all fixtures from `evals/fixtures/`
2. Runs the current prompt version against each fixture
3. Saves output as `fixture-name.output.{promptVersion}.json`
4. Generates a diff report comparing new outputs vs previous version outputs
5. Does NOT auto-score — human reviews the diff for relevance, specificity, hallucination

This is a manual process by design. Automation can come later if needed.

---

## 9. Workflow & Error Handling

### 9.1 Happy Path

```
User navigates to job page
  → Extension detects supported site (adapter match)
  → User clicks "Scrape & Tailor"
  → Extension scrapes job description (scoped to container)
  → Extension normalizes into JobPosting (class-validator via shared DTO)
  → Extension POSTs to localhost:3000/applications/generate
  → Backend validates JobPostingDto (class-validator, NestJS ValidationPipe)
  → Backend checks for duplicate URL → 409 if exists
  → Backend selects resume (auto-match or hint)
  → Backend loads resume + merges profile
  → Backend runs PII filter → warns if patterns detected
  → Backend builds prompt from template
  → Backend calls DeepSeek (with retry & timeout)
  → Backend validates JSON response (class-validator on ApplicationDraftDto)
  → Backend returns ApplicationDraft
  → Extension renders Review UI (Ready state)
  → User reviews, edits any section
  → User clicks "Fill Form"
  → Extension snapshots current form state
  → Extension fills fields (never submits)
  → User reviews filled form on the job page
  → User clicks Submit on the job site
  → Extension detects submission (optional) or user manually marks as submitted
  → Extension calls POST /applications/:id/save with status "submitted"
  → Backend persists to PostgreSQL
```

### 9.2 Error States

| Scenario                                 | Detection                                               | UI Response                                                                  | Recovery                                      |
| ---------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| Unsupported site                         | Adapter registry finds no match                         | Gray extension icon, "Site not supported" tooltip                            | None — manual copy-paste                      |
| Scrape failure (DOM changed)             | Adapter throws                                          | "Could not read job posting. The site may have changed."                     | Retry button; if persistent, file adapter bug |
| Backend unreachable                      | fetch() fails (ECONNREFUSED)                            | "Backend not running. Start with: docker compose up"                         | Retry after user starts backend               |
| Backend returns 409 (duplicate URL)      | HTTP 409                                                | "You've already processed this job. View existing draft?"                    | Show existing draft or regenerate             |
| DeepSeek timeout (30s)                   | Axios timeout                                           | "DeepSeek is taking too long."                                               | Retry button with countdown                   |
| DeepSeek rate limited (429)              | HTTP 429                                                | "Rate limited. Please wait 60 seconds."                                      | Auto-retry after Retry-After header           |
| Invalid JSON from DeepSeek (after retry) | class-validator validation fails on ApplicationDraftDto | "The AI returned an invalid response." Show raw response + validation errors | Manual edit raw response, or regenerate       |
| DeepSeek auth failure (401)              | HTTP 401                                                | "Invalid API key. Check your .env file."                                     | User must fix LLM_API_KEY                     |
| Form field not found during fill         | Selector returns null                                   | Field flagged in UI with ⚠ icon                                              | User fills manually                           |
| Answer exceeds field maxLength           | Generated answer > FormField.maxLength                  | Truncated with "…" in field, flagged in UI                                   | User edits manually                           |
| User wants to undo fill                  | Manual trigger                                          | "Revert to original" button shown after fill                                 | Restores snapshot                             |

### 9.3 Deduplication Check

Before calling DeepSeek, the backend checks:

```sql
SELECT id, status, resume_summary, cover_letter, screening_answers
FROM applications
WHERE source_url = $1
ORDER BY created_at DESC
LIMIT 1;
```

If a record exists, return 409 with the existing application data. The Review UI offers two options:

- "View existing draft" — loads the saved draft into the Review UI
- "Regenerate" — creates a fresh generation (still saves as a new record; old record is preserved)

---

## 10. Security & Privacy

### 10.1 PII Filter

A server-side filter runs on all text before it reaches DeepSeek:

```typescript
// src/validation/pii-filter.service.ts
const PII_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: 'SSN (US)', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED-SSN]' },
  { name: 'Credit Card', regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[REDACTED-CC]' },
  { name: 'EIN', regex: /\b\d{2}-\d{7}\b/g, replacement: '[REDACTED-EIN]' },
];

@Injectable()
export class PiiFilterService {
  filter(text: string): { clean: string; warnings: string[] } {
    const warnings: string[] = [];
    let clean = text;
    for (const pattern of PII_PATTERNS) {
      if (pattern.regex.test(clean)) {
        warnings.push(`PII pattern detected: ${pattern.name}. Redacted before sending to API.`);
        clean = clean.replace(pattern.regex, pattern.replacement);
      }
    }
    return { clean, warnings };
  }
}
```

If warnings are generated, they are logged server-side and the `ApplicationDraft.missingInformation` includes a note: "PII was redacted from this submission — review the generated content for any gaps."

### 10.2 Request Validation & Size Limits

- `express.json({ limit: "50kb" })` — rejects oversized payloads with 413
- All DTOs use `class-validator` decorators with strict constraints
- `sourceUrl` validated as a proper URL format
- String fields have explicit `@MaxLength()` constraints matching the schema

### 10.3 Extension Security

- `LLM_API_KEY` is NEVER bundled with the extension or sent to the browser
- The extension communicates only with `http://localhost:3000` and `https://api.deepseek.com` (the latter indirectly via the backend)
- Content Security Policy in `manifest.json` restricts extension connections
- Adapter scrapers are scoped to job description DOM containers, never `document.body`

### 10.4 API Key Management

```
.env (gitignored, at repo root)
├── LLM_API_KEY=sk-...
├── DB_PASSWORD=jobhunter        # local dev only
└── DB_USER=jobhunter
```

The `.env` file is loaded by Docker Compose into the NestJS container. Never committed.

---

## 11. Docker Compose Setup

### 11.1 `docker-compose.yml`

```yaml
version: '3.9'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - '127.0.0.1:3000:3000' # localhost only
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=jobhunter
      - DB_PASSWORD=jobhunter
      - DB_NAME=jobhunter
    env_file:
      - .env # LLM_API_KEY loaded here
    volumes:
      - ./backend/src:/app/src # Hot reload in dev
      - ./data:/app/data # Resumes, profiles, resume_index.json
      - ./prompts:/app/prompts # Prompt templates
    depends_on:
      postgres:
        condition: service_healthy
    command: pnpm run start:dev

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=jobhunter
      - POSTGRES_PASSWORD=jobhunter
      - POSTGRES_DB=jobhunter
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U jobhunter']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### 11.2 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

EXPOSE 3000

CMD ["pnpm", "run", "start:dev"]
```

### 11.3 Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd job-hunter-agent

# Create .env with your API key
echo "LLM_API_KEY=sk-your-key-here" > .env

# Start everything
docker compose up -d

# Run database migrations
docker compose exec backend pnpm drizzle-kit migrate

# Load the extension in Chrome:
# chrome://extensions → "Load unpacked" → select ./extension/dist
```

---

## 12. Project Structure

```
job-hunter-agent/
├── docker-compose.yml
├── .env                          # gitignored
├── .env.example                  # template, committed
├── .gitignore
├── .github/
│   └── workflows/
│       ├── ci.yml                # Lint, type-check, test on PR
│       └── release.yml           # Build extension zip on tags
├── README.md
├── docs/
│   ├── idea/
│   │   └── raw-idea.md
│   └── specs/
│       ├── suggestions.md
│       └── implementation-spec.md  # This file
│
├── backend/                      # NestJS application
│   ├── Dockerfile
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── drizzle.config.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   ├── application/
│   │   ├── deepseek/
│   │   ├── resume/
│   │   ├── prompts/
│   │   ├── validation/
│   │   └── database/
│   └── test/
│       ├── application.e2e-spec.ts
│       ├── deepseek.service.spec.ts
│       └── fixtures/             # Saved HTML/JSON test fixtures
│
├── extension/                    # Browser extension
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── tsconfig.json
│   ├── manifest.json             # Manifest V3
│   ├── vite.config.ts            # Build with Vite
│   ├── src/
│   │   ├── background.ts
│   │   ├── content.ts            # Injected content script
│   │   ├── popup/                # Preact Review UI
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── adapters/
│   │   │   ├── registry.ts
│   │   │   ├── types.ts
│   │   │   ├── greenhouse.adapter.ts
│   │   │   ├── lever.adapter.ts
│   │   │   ├── ashby.adapter.ts
│   │   │   ├── indeed.adapter.ts
│   │   │   └── linkedin.adapter.ts
│   │   ├── utils/
│   │       ├── normalizer.ts     # Uses shared DTOs (class-validator)
│   │       └── form-snapshot.ts
│   └── dist/                     # Built extension (loaded by Chrome)
│
├── shared/                       # Shared DTOs & types (class-validator + @ApiProperty)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Barrel exports
│       ├── dto/
│       │   ├── job-posting.dto.ts
│       │   ├── application-draft.dto.ts
│       │   ├── generate-request.dto.ts
│       │   ├── generate-response.dto.ts
│       │   ├── save-application.dto.ts
│       │   └── list-applications.dto.ts
│       └── constants/
│           └── index.ts          # Status enums, confidence tiers, config defaults
│
├── data/                         # User data (gitignored or committed as examples?)
│   ├── resumes/
│   │   ├── .gitkeep
│   │   └── example-backend.md    # Example template
│   ├── profiles/
│   │   ├── .gitkeep
│   │   ├── default.example.json
│   │   └── backend.example.json
│   └── resume_index.json
│
├── prompts/                      # Prompt templates (versioned)
│   ├── tailor.v1.md
│   ├── cover-letter.v1.md
│   └── screening.v1.md
│
└── evals/                        # Prompt evaluation fixtures
    ├── fixtures/
    │   └── .gitkeep
    └── run-eval.ts
```

### 12.1 Monorepo Tooling

Using **pnpm workspaces**:

```yaml
# pnpm-workspace.yaml (root)
packages:
  - 'backend'
  - 'extension'
  - 'shared'
```

`shared` is a local package consumed by both `backend` and `extension` for type definitions.

Root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "docker compose up",
    "dev:backend": "pnpm --filter backend run start:dev",
    "dev:extension": "pnpm --filter extension run dev",
    "build": "pnpm --filter shared run build && pnpm --filter backend run build && pnpm --filter extension run build",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck",
    "test": "pnpm -r run test",
    "db:migrate": "pnpm --filter backend run drizzle-kit migrate",
    "db:generate": "pnpm --filter backend run drizzle-kit generate"
  }
}
```

---

## 13. Implementation Roadmap

### Phase 1: Foundation (Week 1–2)

- [ ] Initialize monorepo with pnpm workspaces (`backend`, `extension`, `shared`)
- [ ] Set up NestJS backend with basic module structure
- [ ] Set up Docker Compose (NestJS + PostgreSQL)
- [ ] Drizzle ORM setup: schema, migrations, seed
- [ ] `shared` package: DTOs with class-validator + @ApiProperty decorators (`JobPostingDto`, `ApplicationDraftDto`, API contracts)
- [ ] Swagger module setup in NestJS (`@nestjs/swagger`), available at `/api/docs`
- [ ] Backend health-check endpoint: `GET /health`
- [ ] GitHub Actions CI: lint, typecheck, test on PR

### Phase 2: DeepSeek Integration (Week 2–3)

- [ ] DeepSeekService with retry logic, timeout, error classification
- [ ] PromptBuilderService: load templates, fill placeholders
- [ ] ResponseValidator: class-validator validation of JSON, retry on malformed JSON
- [ ] PiiFilterService
- [ ] Token usage logging to `token_usage_log` table
- [ ] `POST /applications/generate` — end-to-end with a hardcoded test `JobPosting`
- [ ] Unit tests for DeepSeekService with mocked HTTP
- [ ] E2E test: real DeepSeek call against a saved fixture, validate output

### Phase 3: Resume Management (Week 3–4)

- [ ] ResumeLoaderService: read from `data/resumes/`
- [ ] ProfileMergeService: shallow merge with variant override
- [ ] ResumeIndexService: keyword-overlap matching
- [ ] `POST /resumes/refresh-index` — auto-tag generation via DeepSeek
- [ ] Resume selection in generate flow (auto-match + hint + last-used)
- [ ] `resume_index.json` read/write

### Phase 4: Application Store (Week 4–5)

- [ ] ApplicationRepository: Drizzle queries for CRUD
- [ ] `POST /applications/:id/save` — persist edited draft
- [ ] `GET /applications` — list with filters, pagination
- [ ] `PATCH /applications/:id/status` — status transitions
- [ ] URL deduplication check in generate flow (409 response)
- [ ] Database indexes for common queries

### Phase 5: Browser Extension — Greenhouse Adapter (Week 5–6)

- [ ] Extension scaffold: Manifest V3, Vite build
- [ ] Adapter registry + types
- [ ] Greenhouse adapter: scrape, normalize, form fields
- [ ] Normalizer: RawScrape → class-validator validated JobPostingDto (from shared package)
- [ ] Content script communication with popup
- [ ] Basic Review UI (Preact): loading skeleton, ready state, error state
- [ ] End-to-end: scrape Greenhouse job → generate → display in popup

### Phase 6: Form Filling (Week 6–7)

- [ ] `scrapeFormFields()` for Greenhouse
- [ ] `fillField()` with input event dispatch
- [ ] Form snapshot before fill → "Revert to original" button
- [ ] Fuzzy label matching: `screening_answers[].question` ↔ `FormField.label`
- [ ] MaxLength truncation with UI flag
- [ ] "Fill Form" button wired up in Review UI
- [ ] Confirmation dialog before fill: "This will fill fields but NOT submit"

### Phase 7: More Adapters (Week 7–9)

- [ ] Lever adapter
- [ ] Ashby adapter
- [ ] Indeed adapter
- [ ] LinkedIn adapter
- [ ] Adapter test harness: run against saved HTML fixtures, verify field extraction
- [ ] Adapter health monitoring: smoke test on a schedule (can be manual)

### Phase 8: Polish & Dashboard (Week 9–10)

- [ ] Confidence tier display in Review UI (colors + icons)
- [ ] Progressive rendering research (defer to phase if needed)
- [ ] Dashboard endpoint: interview rate by resume version, response rate by company
- [ ] Dashboard UI in extension popup (simple stats cards)
- [ ] Prompt evaluation runner (`evals/run-eval.ts`)
- [ ] Cost tracking display (cumulative tokens/cost in Review UI)
- [ ] README with setup instructions, architecture diagram
- [ ] GitHub Actions release workflow: build extension zip on tag

### Deferred (Phase 9+)

- [ ] Natural-language job memory queries (Phase 6b from original)
- [ ] Multi-step form support (Greenhouse multi-page applications)
- [ ] Non-English job posting detection and handling
- [ ] Proper prompt evaluation automation (beyond manual diff review)

---

## 14. Edge Cases

| Scenario                                                 | Handling                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Non-English job posting**                              | Detect language via simple heuristic (common non-English char sets / `lang` attribute). Flag in UI: "This posting may not be in English — review generated content carefully." |
| **Image-only job posting**                               | Adapter detects empty/inadequate text content. Shows "No text content found — cannot scrape this posting."                                                                     |
| **Job posting removed between scrape and submission**    | Form fill may fail on missing fields. User fills manually — no special handling needed.                                                                                        |
| **Form field `maxlength` shorter than generated answer** | Truncate with "…" and flag field in UI. User must review.                                                                                                                      |
| **Multiple form pages (multi-step application)**         | Deferred to Phase 9. In v1, user fills subsequent pages manually.                                                                                                              |
| **Form field label changed between scrape and fill**     | Fuzzy matching fails → field skipped and flagged in UI.                                                                                                                        |
| **User closes extension popup mid-generation**           | Backend continues processing. On re-open, popup polls or re-fetches. If completed, loads from in-memory state or re-requests (URL dedup returns 409 with existing draft).      |
| **Docker not running**                                   | Extension shows "Backend not reachable. Start Docker and try again."                                                                                                           |
| **First-time setup (no `profile.json`)**                 | Backend detects missing config. Returns a `setup_required: true` flag. Review UI shows onboarding: "Set up your profile to get started."                                       |
| **DeepSeek returns valid JSON but nonsensical content**  | No automated detection. Confidence tier catches low confidence. User is expected to review.                                                                                    |
| **Multiple resumes tie in keyword overlap**              | Return both options to the UI, let user pick.                                                                                                                                  |
| **Very long job description (>50KB)**                    | Truncated by backend request size limit with 413. Extension should warn on scrape if content exceeds threshold.                                                                |

---

## 15. GitHub Workflows

### 15.1 `ci.yml` — Pull Request Checks

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm run lint
      - run: pnpm run test -- --coverage
      - name: Check coverage threshold
        run: |
          # Enforce 80% coverage threshold
          pnpm run test:coverage-threshold

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - name: Verify extension dist
        run: test -d extension/dist && test -f extension/dist/manifest.json
```

### 15.2 `release.yml` — Extension Release

```yaml
name: Release Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - name: Package extension
        run: cd extension/dist && zip -r ../../extension-${{ github.ref_name }}.zip .
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: extension-${{ github.ref_name }}.zip
          generate_release_notes: true
```

### 15.3 Branch Protection & Workflow

- **Main branch:** protected, requires PR with passing CI and at least 1 review
- **Feature branches:** `feature/<phase>-<description>` (e.g., `feature/phase-2-deepseek-integration`)
- **Commit style:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- **PR template:** includes checklist for tests, manual QA steps, and updated docs

---

## Appendix A: Development Quickstart

```bash
# Prerequisites
# - Docker & Docker Compose
# - Node.js 22
# - pnpm 9 (npm i -g pnpm)
# - Chrome/Chromium for extension loading

# Clone
git clone <repo-url>
cd job-hunter-agent

# Install dependencies
pnpm install

# Copy and fill environment
cp .env.example .env
# Edit .env: add LLM_API_KEY=sk-...

# Start backend + database
docker compose up -d

# Run migrations
docker compose exec backend pnpm drizzle-kit migrate

# Start extension development
pnpm --filter extension run dev

# Load extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select ./extension/dist

# Run tests
pnpm run test

# Run lint + typecheck
pnpm run lint
pnpm run typecheck
```
