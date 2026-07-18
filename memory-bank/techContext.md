# Tech Context — AI Job Copilot

## Technologies

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Package Manager | pnpm | 9.x | Workspaces for monorepo |
| Node.js | Node | 22.x | Alpine in Docker |
| Backend Framework | NestJS | Latest | TypeScript, class-validator, Swagger |
| ORM | TypeORM | ^0.3.21 | NestJS-native (`@nestjs/typeorm`), decorator-based entities |
| Database | PostgreSQL | 16 | Alpine image in Docker Compose |
| LLM API | DeepSeek | deepseek-chat | OpenAI-compatible, JSON mode |
| LLM Client | OpenAI SDK (Node) | Latest | Pointed at api.deepseek.com/v1 |
| Extension Runtime | Manifest V3 | — | Chrome/Chromium |
| Extension UI | Preact | Latest | ~3KB, sufficient for popup |
| Extension Build | Vite | Latest | Fast HMR for extension dev |
| Containerization | Docker Compose | — | NestJS + PostgreSQL |
| Linting | ESLint | Latest | @typescript-eslint, strict rules |
| Formatting | Prettier | Latest | 120 char width, single quotes |
| Git Hooks | Husky + lint-staged | Latest | Pre-commit lint, commit-msg lint |
| Commit Convention | Commitlint | Latest | Conventional commits |
| CI/CD | GitHub Actions | — | Lint, typecheck, test, build |
| Testing | Jest + supertest | Latest | Unit + E2E, 95% coverage threshold |

## Dev Environment Setup

```bash
# Prerequisites
# - Docker & Docker Compose
# - Node.js 22
# - pnpm 9
# - Chrome/Chromium

# Start everything
pnpm install
cp .env.example .env  # Add DEEPSEEK_API_KEY
docker compose up -d
docker compose exec backend pnpm migration:run
pnpm --filter extension run dev
# Load extension: chrome://extensions → "Load unpacked" → ./extension/dist
```

## Constraints

- **localhost only** — backend binds to `127.0.0.1:4000`, never `0.0.0.0`
- **CORS:** only `chrome-extension://` origins allowed
- **Request size limit:** 50KB (express.json)
- **No auth** — single-user local tool, no guards needed
- **DEEPSEEK_API_KEY** in `.env` only — never committed, never sent to browser
- **TypeScript strict mode** with `noUncheckedIndexedAccess`, `noImplicitReturns`
- **ESLint zero-warnings** — `--max-warnings 0` enforced
- **Coverage threshold: 95%** (all metrics)
- **Branch-first Git workflow** — never commit to main directly

## ADR: TypeORM over Drizzle

**Decision date:** 2026-07-18 (Phase 1)
**Status:** Accepted

Originally specified as Drizzle ORM in `docs/specs/implementation-spec.md`. Switched to TypeORM during Phase 1 implementation because:
- `@nestjs/typeorm` provides first-class NestJS integration (entity auto-discovery, `@InjectRepository()`, lifecycle hooks)
- Entity decorators follow the same pattern as class-validator/Swagger decorators used everywhere else
- `synchronize: true` in dev eliminates manual migration steps during rapid iteration
- Drizzle is no longer in use; all future DB code targets TypeORM

Migration workflow: `pnpm migration:generate` → `pnpm migration:run` (TypeORM CLI)

## Key Config Files

| File | Purpose |
|------|---------|
| `tsconfig.base.json` | Shared TypeScript config (ES2022, strict, bundler resolution) |
| `.eslintrc.cjs` | ESLint rules (no-explicit-any, strict-boolean-expressions, complexity ≤10, etc.) |
| `.prettierrc` | 120 char width, single quotes, trailing commas, LF line endings |
| `.editorconfig` | 2-space indent, LF, UTF-8 |
| `.commitlintrc.cjs` | Conventional commits: feat, fix, chore, docs, refactor, test |
| `.husky/pre-commit` | Runs lint-staged |
| `.husky/commit-msg` | Runs commitlint |
| `.husky/pre-push` | Runs typecheck + backend tests |
| `.dockerignore` | Excludes node_modules, dist, .git, docs from build context |
| `.gitignore` | Excludes node_modules, dist, .env, coverage |