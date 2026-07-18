# Active Context — AI Job Copilot

**Last updated:** 2026-07-18

## Current Focus

**Phase 3: Resume Management** — complete. Real resume loading + auto-matching replaces Phase 2 hardcoded stubs. Ready for Phase 4 (Application Store).

## Recent Changes (Phase 3)

1. **ADR recorded** — TypeORM is canonical. Drizzle removed from techContext. Migration workflow: `pnpm migration:generate` → `pnpm migration:run` via TypeORM CLI.
2. **ResumeLoaderService** — reads `.md` from `data/resumes/`, returns empty list on missing directory
3. **ProfileMergeService** — shallow merge default.json + variant.json, variant wins, returns `{ setupRequired: true }` if no default.json
4. **ResumeIndexService** — keyword-overlap scoring with stop-word filtering, `resume_index.json` read/write, threshold: 2 overlapping keywords
5. **ResumeController** — `POST /resumes/refresh-index` — calls DeepSeek per resume for tag extraction, writes `resume_index.json`, returns tags + token usage
6. **ResumeModule** — wired with DeepseekModule import, all services exported
7. **ApplicationService.generate()** — replaced hardcoded resume with real selection: `resumeHint` → auto-match → fallback to first resume. URL dedup deferred to Phase 4 (TODO comment in code).
8. **Placeholder data** — `data/resumes/general.md` (~800 words placeholder resume) + `data/profiles/default.json`

## Next Steps (Phase 4: Application Store)

1. Implement ApplicationRepository with TypeORM queries (CRUD)
2. `POST /applications/:id/save` — persist edited draft
3. `GET /applications` — list with filters + pagination
4. `PATCH /applications/:id/status` — status transitions
5. URL deduplication in `generate()` flow (409 check)
6. E2E tests for all endpoints

## Active Files

- `packages/backend/src/application/application.service.ts` — orchestrator with real resume selection
- `packages/backend/src/resume/` — 3 services + controller + DTO
- `data/resumes/general.md` — placeholder resume (user should replace)
- `data/profiles/default.json` — shared profile facts