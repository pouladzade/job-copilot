# Progress — AI Job Copilot

**Last updated:** 2026-07-18  
**Full roadmap:** `docs/roadmap.md`

## Phase 0: Planning & Documentation ✅ COMPLETE

- [x] Raw idea spec reviewed and analyzed
- [x] Suggestions document created (`docs/specs/suggestions.md`)
- [x] Implementation spec written (`docs/specs/implementation-spec.md`) — 15 sections
- [x] Tech stack finalized: TypeScript, NestJS, PostgreSQL 16, **TypeORM**, Docker Compose, GitHub Actions
- [x] Validation approach: class-validator + class-transformer (no Zod), @ApiProperty on all DTOs
- [x] DTO structure: `dto/` folders per module
- [x] `.clinerules` rewritten for this project (was Patec AI, now Job Hunter Agent)
- [x] Memory bank populated: all 6 files
- [x] `.husky/pre-push` fixed (removed Patec references)
- [x] `.dockerignore` branding updated
- [x] All config files reviewed and aligned

## Phase 1: Foundation ✅ COMPLETE

- [x] Monorepo with pnpm workspaces: `@job-hunter/shared`, `@job-hunter/backend`, `@job-hunter/extension`
- [x] `shared` package: 6 DTOs + constants (status enums, confidence tiers, HTTP codes, DeepSeek config)
- [x] NestJS backend: main.ts (CORS, Swagger, ValidationPipe, Helmet, port 4000), app.module.ts (6 modules)
- [x] TypeORM: Application + TokenUsageLog entities, `@nestjs/typeorm` module, DataSource for migrations
- [x] Extension scaffold: Manifest V3, Preact, adapter registry, Vite build
- [x] Docker Compose: NestJS (127.0.0.1:4000) + PostgreSQL 16
- [x] `.env.example` + `packages/backend/Dockerfile`
- [x] GitHub Actions CI: typecheck + lint + test + build on PR
- [x] ADR: TypeORM over Drizzle recorded in `memory-bank/techContext.md`
- [x] `pnpm run build` passes (0 errors across all 3 packages)

## Phase 2: DeepSeek Integration ✅ COMPLETE

- [x] `DeepSeekService` — OpenAI SDK, retry-once (linear backoff), no retry on 4xx, `estimateCost()`
- [x] `DeepSeekError` class with code + statusCode
- [x] 3 prompt templates: `tailor.v1.md`, `cover-letter.v1.md`, `screening.v1.md`
- [x] `PromptBuilderService` — loads `.md` templates, fills `{{placeholders}}`
- [x] `PiiFilterService` — regex SSN/credit card/EIN redaction
- [x] `ResponseValidatorService` — `plainToInstance` + `validate` on `ApplicationDraftDto`
- [x] `ApplicationService.generate()` — 6-step orchestrator: PII → tailor → cover letter → screening → combine → token log
- [x] `ApplicationController` — `POST /applications/generate` + `GET /applications/health`
- [x] All 4 modules wired with providers + exports (Deepseek, Prompts, Validation, Application)

## Phase 3: Resume Management ✅ COMPLETE

- [x] `ResumeLoaderService` — reads `.md` from `data/resumes/`, returns empty on missing dir
- [x] `ProfileMergeService` — shallow merge (variant wins), `{ setupRequired: true }` if no default.json
- [x] `ResumeIndexService` — keyword-overlap + stop words + threshold (2), `resume_index.json` read/write
- [x] `ResumeController` — `POST /resumes/refresh-index` via DeepSeek tag extraction
- [x] `ResumeModule` — wired with DeepseekModule, all services exported
- [x] `ApplicationService.generate()` — hardcoded stubs removed, real resume selection (hint → auto-match → fallback)
- [x] Placeholder data: `data/resumes/general.md` + `data/profiles/default.json`
- [x] URL dedup deferred to Phase 4 (TODO in `application.service.ts`)

## Phase 4: Application Store — NOT STARTED

- [ ] TypeORM CRUD repository: create, findById, findByUrl, update, list, updateStatus
- [ ] `POST /applications/:id/save` — persist edited draft
- [ ] `GET /applications` — list with filters + pagination
- [ ] `PATCH /applications/:id/status` — status transitions
- [ ] URL deduplication in `generate()` flow (409 check)
- [ ] E2E tests for all endpoints

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