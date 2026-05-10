# AGENTS.md — General Ward

## Two-package monorepo

- `ward-backend/` — Express 5 API (Node, CommonJS). Default SQLite, optional PostgreSQL.
- `ward-frontend/` — React 19 + Vite + TanStack Query v5 (ESM, TypeScript with `strict: false`).
- Root `package.json` is scaffolding only (`concurrently`, `codemap` scripts).

## Start the app

```bash
npm run install-all          # first time: installs both packages
npm start                    # root concurrently: backend :3001 + frontend :5173
```

**Test server** (development/demo, preserves data across restarts):

```bash
bash start-test-server.sh           # idempotent seed
bash start-test-server.sh --fresh   # wipe ward.db and reload
```

DB is at `ward-backend/ward.db`. Backend logs to `/tmp/ward-backend.log`, frontend to `/tmp/ward-frontend.log`.

## Test server credentials (not the seed.js PINs)

| Username       | Password     | Role       |
|----------------|-------------|------------|
| Admin User     | admin123    | admin      |
| Dr. Smith      | doctor123   | doctor     |
| Dr. Patel      | doctor123   | doctor     |
| Nurse Joy      | nurse123    | nurse      |
| Nurse Riya     | nurse123    | nurse      |
| PharmD Jones   | pharma123   | pharmacist |

See also `CLAUDE.md` for the full "Start the test server" protocol.

## Testing

```bash
# Backend (Jest, integration tests)
cd ward-backend && npm test
# Runs: cross-env NODE_ENV=test JWT_SECRET=dev-test-secret jest --runInBand --forceExit
# STOP the API first if it uses the same ward.db or the test DB may corrupt under concurrent access.

# Frontend (Vitest + Testing Library)
cd ward-frontend && npm test
```

- CI workflow: `.github/workflows/ci.yml` — runs backend tests, frontend lint + test + build, and `npm audit --audit-level=high` on both packages.
- Postgres CI: `.github/workflows/postgres-ci.yml` — smoke test against Postgres 16 service container.

## Lint, build, typecheck

```bash
cd ward-frontend && npm run lint   # eslint (flat config in eslint.config.js)
cd ward-frontend && npm run build  # vite build
```

No `tsc` typecheck step enforced; `tsconfig.json` has `noEmit: true, strict: false`.

## Database adapter (critical architecture)

**All repository queries must go through `db-adapter.js`** — NOT raw `db.js` calls. The adapter:
- Translates `?` placeholders to `$n` for PostgreSQL.
- Normalizes row shapes (`rows` array vs raw array).
- Exposes: `adapter.query()`, `adapter.queryOne()`, `adapter.execute()`, `adapter.withTransaction()`.

```js
const dbAdapter = require('../db-adapter');
const rows = await dbAdapter.query('SELECT * FROM Patients WHERE tenantId = ?', [tenantId]);
```

SQLite-specific `db.js` exports (`runAsync`, `getAsync`, `allAsync`, `withTransaction`) are internal — only use those inside the adapter itself or in migration scripts.

## SQLite quirks

- WAL mode + `synchronous=NORMAL` + `busy_timeout=5000` enabled automatically in `db.js`.
- `withTransaction` uses a **global sequential queue** (`transactionChain`) with `BEGIN IMMEDIATE` to prevent nested-transaction errors under concurrent writes. PostgreSQL `withTransaction` creates a dedicated client instead.
- The `ward.db`, `ward.db-shm`, `ward.db-wal` files are in `.gitignore` — never commit them.
- Backend tests auto-create `ward.db` in `:memory:` equivalent? No — they use the file-based `ward.db`. Close the dev server before running tests.

## Multi-tenant isolation

- Every DB query must scope by `tenantId` (from `req.user.tenantId` or default `tenant-default`).
- Route-level enforcement via middleware in `ward-backend/middleware/tenant.js` (e.g., `requireTenantPatient`, `requireTenantTask`, `requireTenantPharmacyStock`).
- Cross-tenant access returns 403. `tenantIsolation.test.js` validates this.

## Environment variables

### Backend (`ward-backend/.env`)

| Variable        | Required? | Default / Notes |
|-----------------|-----------|-----------------|
| `JWT_SECRET`    | **always** | Server refuses to start if missing/empty |
| `CORS_ORIGIN`   | **production** | Comma-separated origins; in dev, auto-allows any origin |
| `NODE_ENV`      | no        | `development` default; allowed: development, test, production, staging |
| `PORT`          | no        | `3001` |
| `DATABASE_URL`  | no        | Full Postgres connection string (e.g., `postgres://user:pass@host:5432/db`). If unset, SQLite is used. |
| `DB_DIALECT`    | no        | `sqlite` default; set to `postgres` for PostgreSQL |
| `PG_HOST/PORT/DATABASE/USER/PASSWORD` | when using Postgres via individual vars | `PG_PASSWORD` is mandatory for Postgres |
| `PG_POOL_MAX`   | no        | `20` |
| `TRUST_PROXY`   | no        | `0`; set to `1` behind nginx/ELB |
| `AUDIT_RETENTION_DAYS` | no  | Default retention for audit purge |
| `STARTUP_MODE`  | no        | `full` (runs migrations); `perf` skips migrations |

### Frontend (`ward-frontend/.env`)

- `VITE_API_BASE` — API origin (default: `http://localhost:3001`). The client appends `/api` unless the value already ends with `/api`.

### Docker Compose root (`.env`)

- `PG_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN` are all required in production.
- Run `bash setup-prod.sh` to generate an `.env` from `.env.example` with random secrets.

## PostgreSQL

Local dev Postgres (standalone, port 5433):

```bash
docker compose -f docker-compose.postgres.yml up -d
node ward-backend/migratePostgres.js
```

Or set `DB_DIALECT=postgres` + PG vars in `ward-backend/.env` (see `ward-backend/.env.postgres.example`). Migrations run automatically at startup via `initPostgresDb()`.

Smoke test:
```bash
DATABASE_URL=postgres://ward:ward@localhost:5432/ward \
  npx jest ward-backend/tests/services/postgresSmoke.test.js --runInBand --forceExit
```

## Auth flow

- JWT (8h) in `ward_token` httpOnly cookie, with `Authorization: Bearer <token>` header fallback.
- CSRF: double-submit. Server sets `ward_csrf` cookie; client reads it from `document.cookie` and sends as `X-CSRF-Token` header on mutations (`POST`/`PUT`/`DELETE`).
- RBAC middleware at `ward-backend/middleware/rbac.js`. Roles: admin, doctor, nurse, pharmacist.
- DB-backed login lockout via `AuthLoginAttempts` table (keyed by username + client IP).
- Frontend `src/utils/api.ts` handles API calls, CSRF token management, and tenant-scope 403 toast + redirect.

## Frontend conventions

- **Tailwind CSS 4** via `@tailwindcss/vite` Vite plugin (not PostCSS). Custom tokens in `src/index.css`.
- **TanStack Query** for server state. Query keys defined in `src/utils/queryKeys.ts`.
- Feature-sliced under `src/features/`, page-level views in `src/views/`.
- Icons: `lucide-react`.
- Component auto-cleanup via `src/test/setup.js` (Vitest + Testing Library).

## Reusable workflows

- `npm run codemap` — regenerates `codemap/` index and Markdown from repo scan.
- `node ward-backend/seed.js` — seeds dev users (PIN-based: Dr. Smith/1234, Nurse Johnson/5678, Ward Admin/9999). **Stop the API first** (SQLite lock). Never use for production.
- Stress harness: `node ward-backend/stressEverything.js`. Read file header for env vars. Don't run DB seeding while server is live.

## Important constraints

- `JWT_SECRET` and `CORS_ORIGIN` are required in production — server crashes on startup if missing.
- Never commit `ward.db*`, `cookies.txt`, or any `*_cookies.txt` files.
- Auth cookies/tokens in `*.txt` files are `.gitignore`'d.
- The `node_modules/` in both `ward-backend/` and `ward-frontend/` are committed (repo includes them). Run `npm install --prefix` only when adding dependencies or fresh checkout.
- Frontend `engines.node >= 24.0.0`.
- `TRUST_PROXY` must be `0` (default) unless behind a controlled reverse proxy; prevents IP spoofing of rate limits.
