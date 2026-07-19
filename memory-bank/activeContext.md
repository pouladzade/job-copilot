# Active Context — AI Job Copilot

**Last updated:** 2026-07-19

## Current Focus

**Phase 4: Application Store** — complete. Full CRUD, URL deduplication, and LLM provider refactor.

## Recent Changes (Phase 4)

1. **Application persistence** — `generate()` now writes to `applications` table + linked `token_usage_log` with `applicationId`
2. **CRUD methods** — `findById`, `findByUrl`, `update`, `list` (ILIKE + pagination), `updateStatus` in `ApplicationService`
3. `POST /applications/:id/save` — persist user-edited draft, 404 on missing ID
4. `GET /applications` — paginated list with company (ILIKE), status, resumeUsed filters
5. `PATCH /applications/:id/status` — validated status transitions with `UpdateStatusDto`
6. **URL deduplication** — `findByUrl` check before LLM call, returns 409 with existing data

### Infrastructure fixes

- **LLM provider refactor** — renamed `deepseek/` → `llm/`, configurable `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` env vars with backward compat
- **NestJS CLI** — switched `start:dev` from `tsx` to `nest start --watch`
- **Path resolution** — centralized `DATA_DIR` and `PROMPTS_DIR` constants
- **node-fetch@2 fix** — `fetch: globalThis.fetch` on OpenAI client
- **Validator fix** — moved validation to combined draft instead of per-step
- **ESLint removed** — deleted across all packages (_eslintrc.cjs, lint scripts, devDeps, CI step, Husky hooks, _clinerules)

## Active Files

- `packages/backend/src/application/application.service.ts` — CRUD, URL dedup, generate orchestration
- `packages/backend/src/application/application.controller.ts` — health + 5 endpoints
- `packages/backend/src/llm/llm.service.ts` — provider-agnostic OpenAI-compatible client
- `packages/backend/src/application/dto/update-status.dto.ts`

## Next Steps (Phase 5: Browser Extension)

1. Verify extension build + Chrome loading
2. Build out background.ts message relay
3. Greenhouse adapter with scrape + fill
4. Normalizer (RawScrape → JobPostingDto)
5. Review UI in Preact popup