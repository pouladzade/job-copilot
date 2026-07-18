# AI Job Copilot — Implementation Roadmap

**Version:** 1.1  
**Last updated:** 2026-07-18  
**Source spec:** `docs/specs/implementation-spec.md`  
**ADR:** TypeORM (see `memory-bank/techContext.md`)  
**Backend port:** 4000

---

## Overview

8 implementation phases over ~10 weeks, plus deferred items. Each phase is independently testable — you can verify completion before moving to the next.

**Automation policy:** Human-in-the-loop (HITL) only. No auto-submit, ever.

---

## Phase 0: Planning & Documentation ✅ **COMPLETE**

**Goal:** Define what we're building, how, and with what.

- [x] Raw idea spec reviewed and analyzed (`docs/idea/raw-idea.md`)
- [x] Suggestions document created (`docs/specs/suggestions.md`) — 10 sections of architectural feedback
- [x] Implementation spec written (`docs/specs/implementation-spec.md`) — 15 sections, full system design
- [x] Tech stack finalized: TypeScript, NestJS, PostgreSQL 16, TypeORM, Docker Compose, GitHub Actions, Preact
- [x] Validation approach: class-validator + class-transformer, @ApiProperty on all DTOs, dto/ folders per module
- [x] `.clinerules` rewritten for this project (removed Patec AI references)
- [x] Memory bank populated: all 6 files
- [x] Config files aligned: ESLint, Prettier, EditorConfig, commitlint, Husky, dockerignore

**Deliverables:** `docs/specs/implementation-spec.md`, `docs/specs/suggestions.md`, `docs/roadmap.md`, populated `memory-bank/`

---

## Phase 1: Foundation ✅ **COMPLETE**

**Goal:** Scaffold the monorepo with all three packages, working Docker Compose, and CI pipeline.

### 1.1 Monorepo Setup ✅

- [x] Initialize root `package.json` with pnpm workspaces config
- [x] Create `pnpm-workspace.yaml`: `packages: ["packages/*"]`
- [x] Set up `tsconfig.base.json` (verified existing)
- [x] Create `.env.example` template

### 1.2 `shared` Package ✅

- [x] Create `packages/shared/package.json` with name `@job-hunter/shared`
- [x] Create `packages/shared/tsconfig.json` extending base
- [x] Create `packages/shared/src/index.ts` barrel export
- [x] Create `packages/shared/src/dto/job-posting.dto.ts` — `JobPostingDto` with class-validator + @ApiProperty
- [x] Create `packages/shared/src/dto/application-draft.dto.ts` — `ApplicationDraftDto`, `ScreeningAnswerDto`, `TokenUsageDto`
- [x] Create `packages/shared/src/dto/generate-request.dto.ts`
- [x] Create `packages/shared/src/dto/generate-response.dto.ts`
- [x] Create `packages/shared/src/dto/save-application.dto.ts`
- [x] Create `packages/shared/src/dto/list-applications.dto.ts`
- [x] Create `packages/shared/src/constants/index.ts` — status enums, confidence tiers, HTTP codes, DeepSeek config, config defaults

### 1.3 `backend` Package ✅

- [x] Create NestJS app with pnpm workspace structure
- [x] Install dependencies: `@nestjs/config`, `@nestjs/swagger`, `@nestjs/typeorm`, `class-validator`, `class-transformer`, `typeorm`, `pg`, `openai`, `helmet`
- [x] Create `src/database/entities/application.entity.ts` — TypeORM entity with all columns + indexes
- [x] Create `src/database/entities/token-usage-log.entity.ts` — TypeORM entity with `@ManyToOne` to Application
- [x] Create `src/database/data-source.ts` — TypeORM DataSource for CLI migrations
- [x] Create `src/database/database.module.ts` — `TypeOrmModule.forRoot()` + `forFeature()`
- [x] Create `src/application/application.module.ts` + controller + service
- [x] Create `src/deepseek/deepseek.module.ts` (stub — filled in Phase 2)
- [x] Create `src/resume/resume.module.ts` (stub — filled in Phase 3)
- [x] Create `src/validation/` module (stub — filled in Phase 2)
- [x] Create `src/prompts/` module (stub — filled in Phase 2)
- [x] Wire everything in `app.module.ts` (6 modules)
- [x] Configure `main.ts`: CORS for `chrome-extension://`, 50KB limit, 127.0.0.1:4000 binding, Swagger at `/api/docs`
- [x] Migration workflow: `pnpm migration:generate` → `pnpm migration:run` (TypeORM CLI), `synchronize: true` in dev

### 1.4 Docker Compose ✅

- [x] Create `docker-compose.yml`: backend (port 127.0.0.1:4000) + postgres (16-alpine, port 5432)
- [x] Create `backend/Dockerfile` — Node 22 Alpine, pnpm, start:dev
- [x] Healthcheck on postgres: `pg_isready`
- [x] Volume mounts: `./packages/backend/src` (hot reload), `./data`, `./prompts`

### 1.5 `extension` Package ✅

- [x] Create `packages/extension/package.json` — depends on `@job-hunter/shared`, Preact, Vite
- [x] Create `packages/extension/tsconfig.json` — JSX with preact
- [x] Create `packages/extension/public/manifest.json` — Manifest V3, permissions, CSP (localhost:4000)
- [x] Create `packages/extension/vite.config.ts` — multi-entry: popup, background, content
- [x] Create `packages/extension/src/background.ts` — Chrome runtime message relay
- [x] Create `packages/extension/src/content.ts` — content script stub
- [x] Create `packages/extension/src/popup/App.tsx` — Preact shell
- [x] Create `packages/extension/src/adapters/types.ts` — `SiteAdapter`, `FormField`, `RawScrape` interfaces
- [x] Create `packages/extension/src/adapters/registry.ts` — `registerAdapter()`, `findAdapter()`

### 1.6 CI/CD ✅

- [x] Create `.github/workflows/ci.yml` — install → typecheck → lint → test → build
- [x] Verify: `pnpm run build` passes locally (0 errors across all 3 packages)

**Deliverables:** `pnpm run build` passes, `GET /applications/health` endpoint, Docker Compose + CI configured.

---

## Phase 2: DeepSeek Integration ✅ **COMPLETE**

**Goal:** The backend can receive a JobPosting, call DeepSeek, and return a validated ApplicationDraft.

### 2.1 DeepSeek Client ✅

- [x] Implement `DeepSeekService.generateJson()` — OpenAI SDK, deepseek-chat, JSON mode
- [x] Implement `DeepSeekService.generateWithRetry()` — retry once, linear backoff, no retry on 4xx
- [x] Implement `isRateLimitOrAuthError()` helper — classify 401/429/insufficient_quota
- [x] Implement `estimateCost()` — token-based cost calculation from `DEEPSEEK_COST_PER_1K`
- [x] Create `DeepSeekError` class with code + statusCode

### 2.2 Prompt Builder ✅

- [x] Create `prompts/tailor.v1.md` — professional summary template with `{{placeholders}}`
- [x] Create `prompts/cover-letter.v1.md` — cover letter template
- [x] Create `prompts/screening.v1.md` — screening question template
- [x] Implement `PromptBuilderService` — loads `.md` templates, `buildTailorPrompt()`, `buildCoverLetterPrompt()`, `buildScreeningPrompt()`

### 2.3 Response Validator ✅

- [x] Implement `ResponseValidatorService.validate()` — `plainToInstance` + `validate` on `ApplicationDraftDto`
- [x] Return structured errors on invalid JSON

### 2.4 PII Filter ✅

- [x] Define PII regex patterns: SSN, credit card, EIN
- [x] Implement `PiiFilterService.filter()` — returns `{ clean, warnings }`

### 2.5 Generate Endpoint ✅

- [x] Implement `ApplicationController.generate()` — `POST /applications/generate` with Swagger docs
- [x] Implement `ApplicationService.generate()` — 6-step orchestrator:
  - Step 1: PII filter on resume + profile
  - Step 2: Generate summary (DeepSeek)
  - Step 3: Generate cover letter (DeepSeek)
  - Step 4: Generate screening answers (DeepSeek)
  - Step 5: Combine results + compute confidence tiers
  - Step 6: Log token usage to `token_usage_log` table
- [x] Token usage and cost returned in response
- [x] 502 response for invalid JSON, 503 for API unavailable

**Deliverables:** `POST /applications/generate` returns validated `ApplicationDraft` with real DeepSeek content. Token usage logged.

---

## Phase 3: Resume Management ✅ **COMPLETE**

**Goal:** Multi-resume support with auto-matching and profile merging.

### 3.1 Resume Loader ✅

- [x] Implement `ResumeLoaderService.listResumes()` — reads `.md` files from `data/resumes/`
- [x] Implement `ResumeLoaderService.loadResume(filename)` — reads single file
- [x] Handle missing directory gracefully — return empty list, log warning
- [x] Created placeholder resume: `data/resumes/general.md` (~800 words)

### 3.2 Profile Merger ✅

- [x] Implement `ProfileMergeService.merge(variantName?)` — shallow merge, variant wins
- [x] Handle missing `default.json` → return `{ setupRequired: true }`
- [x] Handle missing variant profile → use default only + log warning
- [x] Created placeholder profile: `data/profiles/default.json`

### 3.3 Resume Index Service ✅

- [x] Implement `ResumeIndexService.loadIndex()` — reads `data/resume_index.json`
- [x] Implement `ResumeIndexService.match(description)` — keyword-overlap scoring
- [x] Stop-word filtering (~100 common English words)
- [x] `getBestMatch(description)` — returns match if score ≥ threshold (default: 2)
- [x] `saveIndex(index)` — writes `resume_index.json`

### 3.4 Refresh Index Endpoint ✅

- [x] Create `resume/dto/resume-index.dto.ts`
- [x] Implement `ResumeController.refreshIndex()` — `POST /resumes/refresh-index`
- [x] For each resume, calls DeepSeek with tag extraction prompt
- [x] Returns tags + token usage in response
- [x] `resume_index.json` written to `data/`

### 3.5 Integrate into Generate Flow ✅

- [x] Update `ApplicationService.generate()` — replaced hardcoded resume with real selection:
  - `resumeHint` → "user-selected"
  - Auto-match via `ResumeIndexService.getBestMatch()` → "auto-matched"
  - Fallback to first available resume → "auto-matched"
  - No resumes → 500 error
- [x] Load resume via `ResumeLoaderService`, merge profile via `ProfileMergeService`
- [x] URL dedup deferred to Phase 4 (TODO comment in code — requires ApplicationRepository)

**Deliverables:** Resume auto-matching works. `/resumes/refresh-index` endpoint functional. Profile merging works.

---

## Phase 4: Application Store (Week 4–5)

**Goal:** Persist every application with full CRUD and URL deduplication.

### 4.1 Repository

- [ ] Implement TypeORM queries for CRUD via `@InjectRepository()`:
  - `create(draft)` — INSERT into applications
  - `findById(id)` — SELECT by ID
  - `findByUrl(url)` — SELECT by source_url (for dedup)
  - `update(id, draft)` — UPDATE with user edits
  - `list(filters)` — SELECT with ILIKE on company, status, resumeUsed, pagination
  - `updateStatus(id, status)` — UPDATE status only
- [ ] **Unit tests:** Each query against a test DB (Postgres test container)

### 4.2 Save Endpoint

- [ ] Implement `ApplicationController.save(id, body)` — `POST /applications/:id/save`
- [ ] Implement `ApplicationService.save(id, body)` — updates record, returns `{ id, savedAt }`
- [ ] DTO: `save-application.dto.ts` (already exists in shared package)
- [ ] **E2E test:** Save edited draft → verify persisted
- [ ] **E2E test:** Save non-existent ID → 404

### 4.3 List Endpoint

- [ ] Implement `ApplicationController.list(query)` — `GET /applications`
- [ ] Implement `ApplicationService.list(query)` — delegates to repository
- [ ] Return `{ applications, total, page, totalPages }`
- [ ] **E2E test:** List all → returns paginated
- [ ] **E2E test:** Filter by company ILIKE → partial match works
- [ ] **E2E test:** Filter by status → correct subset
- [ ] **E2E test:** Filter by resumeUsed → correct subset

### 4.4 Status Endpoint

- [ ] Implement `ApplicationController.updateStatus(id, body)` — `PATCH /applications/:id/status`
- [ ] Implement `ApplicationService.updateStatus(id, status)` — updates status only
- [ ] Validate status is one of the allowed values (class-validator `@IsIn`)
- [ ] **E2E test:** Transition draft → submitted → interview → offer
- [ ] **E2E test:** Invalid status value → 400

### 4.5 URL Deduplication

- [ ] In `ApplicationService.generate()`, check `source_url` BEFORE calling DeepSeek
- [ ] If exists → return 409 with `existingApplicationId` + existing draft data
- [ ] Remove TODO comment from `application.service.ts`
- [ ] **E2E test:** POST same URL twice → second returns 409
- [ ] **E2E test:** Different URLs → no conflict

### 4.6 Database Indexes

- [ ] Verify TypeORM entity indexes (company, status, resumeUsed, createdAt — already defined in decorators)
- [ ] Run migration for any missing indexes
- [ ] Optional: full-text search index (GIN) on job description — Phase 8

**Deliverables:** Full CRUD on applications. URL dedup prevents duplicate API calls. All endpoints tested.

---

## Phase 5: Browser Extension — Greenhouse Adapter (Week 5–6)

**Goal:** First end-to-end flow — scrape a Greenhouse job, generate tailored content, display in popup.

### 5.1 Extension Scaffold

- [ ] Manifest V3 and Vite build already set up (Phase 1). Verify in Chrome.
- [ ] Build out `background.ts` with full scrape → generate → fillForm message routing
- [ ] Build out `content.ts` with adapter lookup, scrape, normalize, POST to backend
- [ ] Verify: load unpacked extension in Chrome, icon appears, popup opens

### 5.2 Adapter Registry

- [ ] Types and registry already set up (Phase 1). `registerAdapter()`, `findAdapter()` ready.
- [ ] **Unit tests:** Register adapter, find by URL match, find by URL non-match

### 5.3 Greenhouse Adapter

- [ ] Create `packages/extension/src/adapters/greenhouse.adapter.ts`
- [ ] Implement `matches(url)` — `url.includes("greenhouse.io")`
- [ ] Implement `scrapeJobPosting()` — querySelector on Greenhouse-specific selectors
  - **Scoped to `#content` container only** — never `document.body`
  - Extract: title, company, location, description, source URL
  - Handle missing elements gracefully (return empty strings, not nulls)
- [ ] Save a Greenhouse job page HTML as a test fixture
- [ ] **Unit test:** Scrape against saved fixture, verify extracted fields

### 5.4 Normalizer

- [ ] Create `packages/extension/src/utils/normalizer.ts`
- [ ] Implement `normalize(raw: RawScrape, adapterId: string): JobPostingDto`
  - Uses `plainToInstance` + `validate` from class-validator
  - Imports `JobPostingDto` from `@job-hunter/shared`
  - Throws with validation errors on failure
- [ ] **Unit test:** Valid RawScrape → valid JobPostingDto
- [ ] **Unit test:** Missing required field → throws with validation errors

### 5.5 Content Script Communication

- [ ] Content script: on scrape request, find adapter, scrape, normalize, POST to backend
- [ ] Content script: handle loading state, send progress to popup via messages
- [ ] Content script: handle fetch errors (backend down, timeout) → send error to popup
- [ ] Background script: relay messages between content script and popup
- [ ] Popup script: send "scrape" command, receive results

### 5.6 Review UI (Preact)

- [ ] Update `packages/extension/src/popup/App.tsx` with state machine
- [ ] **Loading state:** Skeleton cards, shimmer animation, "Tailoring your application..." text
- [ ] **Error state:** Error message with retry button, raw response viewer for 502
- [ ] **Ready state:** Display resumeSummary, coverLetter, screeningAnswers with confidence tier colors
  - 🟢 High confidence (0.7–1.0)
  - 🟡 Medium confidence (0.3–0.7)
  - 🔴 Low confidence (0.0–0.3)
- [ ] "Regenerate" button → re-POST to generate endpoint
- [ ] Token usage display: "1,247 tokens (~$0.0003)"
- [ ] Resume dropdown + "Refresh Index" button

### 5.7 End-to-End Test

- [ ] Manual test: Navigate to real Greenhouse job → click extension icon → click "Scrape & Tailor"
- [ ] Verify: loading skeleton appears
- [ ] Verify: generated content appears with correct confidence colors
- [ ] Verify: token usage displayed
- [ ] Verify: resume selection shows "auto-matched" or "user-selected"
- [ ] Verify: error state works (stop backend, try again → error message)

**Deliverables:** Full flow working for Greenhouse jobs. Content generated and displayed in extension popup.

---

## Phase 6: Form Filling (Week 6–7)

**Goal:** Fill web form fields with one click. Never submit. Undo support.

### 6.1 Form Field Scraping

- [ ] Implement `scrapeFormFields()` for Greenhouse adapter
  - Returns `FormField[]` with label, type, selector, maxLength
  - Identify input types: text, textarea, select, radio, checkbox
- [ ] Handles dynamic forms (fields loaded via JS after page load)
- [ ] **Unit test:** Scrape form fields against saved Greenhouse application page fixture

### 6.2 Field Filling

- [ ] Implement `fillField(field: FormField, value: string)` for Greenhouse adapter
  - `input[type=text]` → set value, dispatch input event
  - `textarea` → set value, dispatch input event
  - `select` → set selectedIndex, dispatch change event
  - `input[type=radio]` → click matching option
  - `input[type=checkbox]` → click if value matches
- [ ] Dispatch proper DOM events so React/Angular forms detect changes
- [ ] **Unit test:** Fill fields on saved fixture, verify values set

### 6.3 Answer-to-Field Mapping

- [ ] Implement fuzzy matching: `screening_answers[].question` ↔ `FormField.label`
  - Use Levenshtein distance or similar algorithm
  - Match threshold: ratio > 0.6
  - Prefer exact matches, fall back to fuzzy
  - Use `questionId` for disambiguation when labels are similar
- [ ] Skip fields with no match → flag in UI with ⚠ icon
- [ ] **Unit test:** Exact match, fuzzy match, no match, multiple close matches

### 6.4 MaxLength Handling

- [ ] Before filling, check `FormField.maxLength` against generated answer length
- [ ] If answer exceeds maxLength: truncate + "…", flag field in UI
- [ ] Show warning in Review UI: "3 fields truncated due to length limits — please review"
- [ ] **Unit test:** Answer fits, answer too long, no maxLength attribute

### 6.5 Form Snapshot & Undo

- [ ] Implement `snapshotForm(fields: FormField[]): Map<string, string>` — save current form state
- [ ] Implement `restoreForm(snapshot: Map<string, string>, fields: FormField[])` — revert to snapshot
- [ ] Show "Revert to original" button in Review UI after fill
- [ ] Confirmation dialog before revert
- [ ] **Unit test:** Snapshot, modify, restore → original values

### 6.6 Fill Form Button

- [ ] Add "Fill Form" button to Review UI (Ready state)
- [ ] Show confirmation dialog: "This will fill form fields but NOT submit. Continue?"
- [ ] On confirm: snapshot → fill all mapped fields → show "Filled" state
- [ ] "Filled" state: success banner + "Revert to original" button
- [ ] Warning banner: "⚠ YOU must click the Submit button on the job site"
- [ ] Track which fields were skipped in "Filled" state
- [ ] **Manual test:** Fill Greenhouse form, verify all fields populated, verify revert works

**Deliverables:** One-click form fill with undo. Fields skipped on mismatch, truncated on overflow. User always clicks Submit.

---

## Phase 7: More Adapters (Week 7–9)

**Goal:** Expand from 1 site to 5, with a test harness to catch breakage.

### 7.1 Lever Adapter

- [ ] Implement `lever.adapter.ts` — `scrapeJobPosting()`, `scrapeFormFields()`, `fillField()`
- [ ] Save Lever job page HTML as test fixture
- [ ] Unit test scrape against fixture
- [ ] Manual end-to-end test: Lever job → scrape → generate → fill

### 7.2 Ashby Adapter

- [ ] Implement `ashby.adapter.ts`
- [ ] Save Ashby fixture
- [ ] Unit test scrape
- [ ] Manual end-to-end test

### 7.3 Indeed Adapter

- [ ] Implement `indeed.adapter.ts`
- [ ] Save Indeed fixture
- [ ] Unit test scrape
- [ ] Note: Indeed has more dynamic loading — may need MutationObserver for form fields
- [ ] Manual end-to-end test

### 7.4 LinkedIn Adapter

- [ ] Implement `linkedin.adapter.ts`
- [ ] Save LinkedIn fixture
- [ ] Unit test scrape
- [ ] Note: LinkedIn is the most brittle — frequent DOM changes, aggressive bot detection
- [ ] Accept that this adapter may break often and need frequent updates
- [ ] Manual end-to-end test

### 7.5 Adapter Test Harness

- [ ] Create `extension/test/adapters/` directory with saved HTML fixtures
- [ ] Create test runner: for each adapter, load its fixture, run `scrapeJobPosting()`, verify output shape
- [ ] Add to CI: run adapter tests on PR (can use JSDOM)
- [ ] Create adapter health check script: loads live page (if available), warns if scrape fails
- [ ] Document adapter maintenance: when to update fixtures, how to diagnose selector breakage

**Deliverables:** 5 supported job boards. Adapter tests run in CI. Known brittleness documented (LinkedIn).

---

## Phase 8: Polish & Dashboard (Week 9–10)

**Goal:** UI refinement, analytics, cost tracking, documentation.

### 8.1 Confidence Tier Display

- [ ] Review UI: ensure all screening answers show correct tier colors (🟢🟡🔴)
- [ ] Review UI: `missingInformation` items shown prominently at top of screening section
- [ ] Review UI: overall confidence shown as progress bar or gauge
- [ ] Confidence tooltips: hover over tier icon shows "Review recommended" / "Must review"

### 8.2 Dashboard Endpoint

- [ ] Create `GET /applications/dashboard` endpoint
- [ ] Aggregate queries:
  - Interview rate by resume version (`GROUP BY resume_used, status`)
  - Response rate by company
  - Applications per week (time series)
  - Average confidence by source site
  - Total token usage and cost
- [ ] Return as structured JSON for the UI to render
- [ ] **E2E test:** Seed test data, verify aggregations correct

### 8.3 Dashboard UI

- [ ] Add "Dashboard" tab to extension popup
- [ ] Stats cards: total applications, interview rate, total cost, top responding companies
- [ ] Bar chart: applications per week
- [ ] Table: resume version vs interview rate
- [ ] Keep it simple — Preact with no heavy chart library (simple CSS bar charts)

### 8.4 Cost Tracking

- [ ] Backend: aggregate total tokens and cost from `token_usage_log`
- [ ] Display in Dashboard: "Total spent: $0.42 across 127 generations"
- [ ] Display per-generation in Review UI (already done in Phase 5)
- [ ] Consider adding cost limit in config (optional alert when exceeded)

### 8.5 Prompt Evaluation Runner

- [ ] Create `evals/` directory with saved fixtures (real JobPostings)
- [ ] Create `evals/run-eval.ts` script
- [ ] Script: for each fixture, run current prompt version, save output, diff against previous version
- [ ] Does not auto-score — human reviews diff for quality
- [ ] Document eval process in README

### 8.6 Documentation

- [ ] Write comprehensive README.md:
  - Project overview
  - Architecture diagram (ASCII or Mermaid)
  - Prerequisites
  - Setup instructions (clone, .env, docker compose up, load extension)
  - Usage guide (scrape → review → fill → submit)
  - Adding new adapters
  - Prompt versioning and evaluation
  - Troubleshooting (common errors)
- [ ] Document all environment variables in `.env.example`
- [ ] Add architecture diagram

### 8.7 Release Workflow

- [ ] Verify `.github/workflows/release.yml` (create if not yet done — not in Phase 1)
- [ ] Test: push a `v0.1.0` tag → extension zip created as release asset
- [ ] Document release process in README

**Deliverables:** Polished UI, analytics dashboard, cost tracking, README, release workflow.

---

## Deferred (Phase 9+)

Items that are valuable but not blocking the initial working tool.

### Natural-Language Job Memory Queries

- [ ] Integrate a local LLM or additional DeepSeek calls
- [ ] User asks: "Which resume version gets the most interview requests?"
- [ ] System translates to SQL, runs query, returns natural-language answer
- [ ] Requires: SQL schema understanding, safe query generation

### Multi-Step Form Support

- [ ] Handle Greenhouse multi-page applications
- [ ] Adapter tracks current step
- [ ] Fill fields incrementally per page
- [ ] User clicks "Next" on each page manually

### Non-English Job Posting Handling

- [ ] Detect language (simple heuristic or `lang` attribute)
- [ ] Flag in UI: "This posting may not be in English"
- [ ] Option to translate or skip
- [ ] Consider DeepSeek's multilingual capabilities

### Prompt Evaluation Automation

- [ ] Add automated scoring (relevance, specificity, hallucination rate)
- [ ] Run evals on PR when prompt files change
- [ ] Block merge if significant quality regression

### More Job Boards

- [ ] ZipRecruiter, Glassdoor, Monster, company-specific career pages

### Accessibility

- [ ] Ensure Review UI meets WCAG 2.1 AA
- [ ] Keyboard navigation for all interactions
- [ ] Screen reader support for confidence indicators

---

## Timeline Summary

| Phase | Duration | Status | Key Milestone |
|-------|----------|--------|---------------|
| 0 | — | ✅ Done | Planning complete |
| 1 | 2 weeks | ✅ Done | Monorepo + Docker + CI + 3 packages building |
| 2 | 1 week | ✅ Done | `POST /applications/generate` with DeepSeek |
| 3 | 1 week | ✅ Done | Resume auto-matching + profile merging |
| 4 | 1 week | ⬜ Not started | Full CRUD + URL dedup |
| 5 | 1 week | ⬜ Not started | End-to-end: Greenhouse job → popup |
| 6 | 1 week | ⬜ Not started | Form fill with undo |
| 7 | 2 weeks | ⬜ Not started | 5 job boards supported |
| 8 | 1 week | ⬜ Not started | Dashboard + polish + release |

**Completed: Phases 0–3. Remaining: Phases 4–8 (est. ~6 weeks).**