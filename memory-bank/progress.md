# Progress — AI Job Copilot

**Last updated:** 2026-07-19
**Full roadmap:** `docs/roadmap.md`
**Remote:** [github.com/pouladzade/job-hunter-agent](https://github.com/pouladzade/job-hunter-agent)
**Open PR:** [#2 — feat/phase4-application-store → main](https://github.com/pouladzade/job-hunter-agent/pull/2)

---

## Phase 0: Planning & Documentation ✅ COMPLETE

- [x] Raw idea spec reviewed and analyzed
- [x] Suggestions document created (`docs/specs/suggestions.md`)
- [x] Implementation spec written (`docs/specs/implementation-spec.md`) — 15 sections
- [x] Tech stack finalized: TypeScript, NestJS, PostgreSQL 16, **TypeORM**, Docker Compose, GitHub Actions
- [x] Validation approach: class-validator + class-transformer, @ApiProperty on all DTOs
- [x] DTO structure: `dto/` folders per module
- [x] `.clinerules` rewritten for this project
- [x] Memory bank populated: all 6 files
- [x] All config files reviewed and aligned

## Phase 1: Foundation ✅ COMPLETE

- [x] Monorepo with pnpm workspaces: `@job-hunter/shared`, `@job-hunter/backend`, `@job-hunter/extension`
- [x] `shared` package: 7 DTOs + constants (status enums, confidence tiers, HTTP codes, LLM config)
- [x] NestJS backend: main.ts (CORS, Swagger, ValidationPipe, Helmet, port 4001), app.module.ts (6 modules)
- [x] TypeORM: Application + TokenUsageLog entities with indexes (company, status, resumeUsed, createdAt)
- [x] Extension scaffold: Manifest V3, Preact, adapter registry (site adapter interface), Vite build
- [x] Docker Compose: PostgreSQL 16 (port 5433)
- [x] `.env.example` + `packages/backend/Dockerfile`
- [x] GitHub Actions CI: typecheck + test + build
- [x] ADR: TypeORM over Drizzle recorded in `memory-bank/techContext.md`
- [x] `pnpm run build` passes (0 errors across all 3 packages)

## Phase 2: LLM Integration ✅ COMPLETE

- [x] `LlmService` (formerly `DeepSeekService`) — OpenAI SDK, retry-once (linear backoff), no retry on 4xx
- [x] `LlmError` class with code + statusCode
- [x] Provider-agnostic: configurable `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (backward-compat with `DEEPSEEK_*`)
- [x] Native fetch fix: `fetch: globalThis.fetch` bypasses node-fetch@2 gunzip bug
- [x] 3 prompt templates: `tailor.v1.md`, `cover-letter.v1.md`, `screening.v1.md`
- [x] `PromptBuilderService` — loads `.md` templates from `PROMPTS_DIR`, fills `{{placeholders}}`
- [x] `PiiFilterService` — regex SSN/credit card/EIN redaction
- [x] `ResponseValidatorService` — `plainToInstance` + `validate` on `ApplicationDraftDto`
- [x] `ApplicationService.generate()` — 9-step orchestrator: dedup → resume → PII → tailor → cover letter → screening → combine → validate → persist
- [x] `ApplicationController` — `POST /applications/generate` + `GET /applications/health`

## Phase 3: Resume Management ✅ COMPLETE

- [x] `ResumeLoaderService` — reads `.md` from `data/resumes/` (resolved via centralized `DATA_DIR`)
- [x] `ProfileMergeService` — shallow merge (variant wins), `{ setupRequired: true }` if no default.json
- [x] `ResumeIndexService` — keyword-overlap + stop words + threshold (2), `resume_index.json` read/write
- [x] `ResumeController` — `POST /resumes/refresh-index` via LLM tag extraction (12 tags, ~666 tokens/call)
- [x] `ResumeModule` — wired with LlmModule, all services exported
- [x] `ApplicationService.generate()` — real resume selection (hint → auto-match via index → fallback to first)
- [x] Placeholder data: `data/resumes/general.md` + `data/profiles/default.json`

## Phase 4: Application Store ✅ COMPLETE

- [x] **CRUD methods in ApplicationService**: `findById`, `findByUrl`, `update`, `list` (ILIKE + pagination), `updateStatus`
- [x] `POST /applications/:id/save` — persist user-edited draft, returns `{ id, savedAt }`, 404 on missing
- [x] `GET /applications` — paginated list with company (ILIKE), status, resumeUsed filters
- [x] `PATCH /applications/:id/status` — validated status transitions (UpdateStatusDto with @IsIn)
- [x] **URL deduplication** — `findByUrl` check before any LLM call, returns 409 with existing application data
- [x] **Application persistence** — generate() writes to `applications` table + linked `token_usage_log`
- [x] Database indexes confirmed on entity (company, status, resumeUsed, createdAt)

### End-to-End Verification (all passing)

| Step | Result |
|------|--------|
| 1. Generate | ✅ Real content + token tracking (3053 tokens, $0.00049) |
| 2. Save edit | ✅ `{"id":5, "savedAt":"2026-07-19T02:20:30.698Z"}` |
| 3. List by company | ✅ ILIKE filter returns 5 matching records for "TechCorp" |
| 4. Status transitions | ✅ draft → submitted → interview → offer all succeed |
| 5. URL dedup (409) | ✅ Second generate returns 409 with existing data, no API spend |

### Infrastructure Fixes (delivered during Phase 2-4)

| Fix | Description |
|-----|-------------|
| NestJS CLI | Switched `start:dev` from `tsx` to `nest start --watch` |
| Path resolution | Centralized `DATA_DIR` and `PROMPTS_DIR` in `config/constants.ts` |
| node-fetch@2 bug | `fetch: globalThis.fetch` on OpenAI client |
| Validator mismatch | Moved validation to combined draft (not per-step) |
| Shared build | Fixed via `tsc -p tsconfig.build.json` |
| ESLint | Removed from entire project (config, scripts, deps, CI, hooks, .clinerules) |
| Provider agnostic | `deepseek/` → `llm/`, configurable base URL + API key + model |
| Hardcoded model | Replaced with `tailorResult.usage.model` from env vars |
| README badges | CI, TypeScript, Node.js, pnpm, NestJS, License |

## Phase 5: Browser Extension — NOT STARTED

- [ ] Content script communication (scrape → POST → display)
- [ ] Greenhouse adapter: `scrapeJobPosting()`, `scrapeFormFields()`
- [ ] Normalizer: `RawScrape` → class-validator validated `JobPostingDto`
- [ ] Review UI (Preact): loading/error/ready/filled states, confidence colors, resume dropdown
- [ ] End-to-end: Greenhouse job → generate → popup

## Phase 6: Form Filling — NOT STARTED

- [ ] `fillField()` for Greenhouse (all input types)
- [ ] Fuzzy label matching + maxLength truncation
- [ ] Form snapshot + "Revert to original" button
- [ ] "Fill Form" button with confirmation dialog

## Phase 7: More Adapters — NOT STARTED

- [ ] Lever, Ashby, Indeed, LinkedIn adapters
- [ ] Adapter test harness (HTML fixtures)

## Phase 8: Polish & Dashboard — NOT STARTED

- [ ] Confidence tier UI polish
- [ ] Dashboard endpoint + UI
- [ ] Prompt eval runner + README + release workflow

---

## Timeline Summary

| Phase | Status | Key Milestone |
|-------|--------|---------------|
| 0 | ✅ Done | Planning complete |
| 1 | ✅ Done | Monorepo + Docker + CI + 3 packages building |
| 2 | ✅ Done | `POST /applications/generate` with live LLM |
| 3 | ✅ Done | Resume auto-matching + profile merging |
| 4 | ✅ Done | Full CRUD + URL dedup + LLM provider refactor |
| 5 | ⬜ Not started | End-to-end: Greenhouse job → popup |
| 6 | ⬜ Not started | Form fill with undo |
| 7 | ⬜ Not started | 5 job boards supported |
| 8 | ⬜ Not started | Dashboard + polish + release |

**Completed: Phases 0–4 (50%). Remaining: Phases 5–8.**

## Key Architecture Decisions

- **TypeORM** over Drizzle (ADR recorded)
- **No ESLint** — removed due to version/config conflicts (ESLint v9 flat config vs legacy .eslintrc)
- **LLM provider agnostic** — OpenAI-compatible `LLM_BASE_URL` pattern with backwards compat for `DEEPSEEK_*` env vars
- **Database port 5433** — avoids conflicts with other local Postgres instances
- **Backend port 4001** — set in `@job-hunter/shared` constants
- **Ports on Postgres CI container** mapped 5433:5432 to match local dev