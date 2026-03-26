# Enterprise hardening — PROGRESS

**Master steps:** [enterprise-hardening-detailed.md](./enterprise-hardening-detailed.md)

## Status

| Field | Value |
|--------|--------|
| Last completed step | **SYNC.4.0** (Two-device validation runbook prepared) |
| Interrupted at | *(none)* |
| Branch / commit | *(local)* |

## Blockers

- **SYNC.4.1 live execution pending:** final two-device acceptance requires deployed shared Postgres environment and two active client sessions.

## Follow-ups (optional / not blocking)

- **CSRF (C.0):** Design choice was Cookie + double-submit CSRF. HttpOnly session cookie and credentialed CORS are implemented (C.1–C.4); **CSRF tokens for state-changing requests are not implemented** in this codebase yet — add when threat model requires it.

## Session checkpoint template (crash recovery)

Use this block before and after every numbered sync step:

- `Step ID`:
- `Intent`:
- `Files to touch`:
- `Commands to run`:
- `Verifier expected`:
- `Stress check`:
- `Rollback pointer`:
- `Interrupted at` (if any):
- `Next action`:

## Log

| Date | Step | Outcome | Verifier | Notes |
|------|------|---------|----------|-------|
| 2026-03-20 | A.0 | Snapshot recorded | — | Pre-change api.js used literal `API_BASE = 'http://localhost:3001/api'`; server.js `app.use(cors())` |
| 2026-03-20 | A.1 | Done | lint+build | `ward-frontend/src/utils/api.js` uses `VITE_API_BASE` + normalization |
| 2026-03-20 | A.2 | Done | npm test | `ward-backend/server.js` CORS: prod requires `CORS_ORIGIN` |
| 2026-03-20 | A.3 | Done | — | `.env.example` files + READMEs updated; `ward-frontend/.env.example` added |
| 2026-03-20 | E0.1 | Done | lint+build | PatientDetail: toast + escalate modal (`escalateModalOpen`); no `prompt`/`alert` |
| 2026-03-20 | E0.2 | Done | lint+build | VitalsTab: validation uses `toast.error` |
| 2026-03-20 | B.1–B.4 | Done | npm test (44) | `ClinicalChangeLog` table; repository + `ClinicalAuditService`; `PatientController` PUT hook; `GET /api/admin/clinical-changes`; COMPLIANCE.md |
| 2026-03-20 | C.0 | Done | design choice | Selected Cookie+CSRF double-submit for Phase C (see PROGRESS notes). |
| 2026-03-20 | C.1 | Done | lint+build + npm test | Backend: `POST /api/auth/login` sets `ward_token` HttpOnly cookie; `POST /api/auth/logout` clears it. Frontend `AuthContext.logout()` now calls `/auth/logout` best-effort. |
| 2026-03-20 | C.2 | Done | npm test | Backend `authenticateToken` parses `req.headers.cookie` for `ward_token` when Authorization bearer token is absent. Added `tests/integration/authCookie.test.js`. |
| 2026-03-20 | C.3 | Done | lint+build + npm test | Backend CORS allows credentials; frontend `api.js` sends `credentials: include`; `AuthContext` login no longer stores `ward_token` and bootstraps via `/auth/me`; `AdminAudit` export/purge uses cookie auth (no localStorage token). |
| 2026-03-20 | C.4 | Done | api.js + server.js | `server.js` CORS now allows credentials for cookie auth; localStorage contains no JWT; 401 handling remains redirect-to-`/login`. |
| 2026-03-20 | D.0 | Done | lint+build + npm test | Phase D decisions recorded: enable Postgres only when `DATABASE_URL` is set; keep SQLite as default for tests until adapter work (Phase D.3). |
| 2026-03-20 | D.2 | Done | npm test + lint/build | Added Postgres migration runner (`migratePostgres.js`), migration planning module, and initial tracking migration under `ward-backend/postgres-migrations/`. Added unit test for migration planning (dry-run safe). |
| 2026-03-20 | D.1 | Done | lint+build + npm test | Installed `pg`; added `ward-backend/postgres.js` pool + `checkPostgresConnectivity`; extended `/health` to include Postgres status when `DATABASE_URL` is set. Updated `ward-backend/.env.example`. |
| 2026-03-20 | D.3 | Done | npm test + lint/build | Added `ward-backend/dbAdapter/*` and refactored `ward-backend/repositories/PatientRepository.js` to use adapter methods (SQLite default). |
| 2026-03-20 | D.3.1 | Done | npm test | Ported `ward-backend/repositories/EscalationRepository.js` to use adapter (`dbAdapter`). SQL + return contracts preserved. |
| 2026-03-20 | D.3.2 | Done | backend tests + lint/build | Ported `ward-backend/repositories/TaskRepository.js` to use adapter (`dbAdapter`), preserving SQL and method contracts. |
| 2026-03-20 | D.3.3 | Done | backend tests + lint/build | Ported `ward-backend/repositories/HandoverNotesRepository.js` to use adapter (`dbAdapter`), preserving SQL and method contracts. |
| 2026-03-20 | D.4 | Done | docs added + migration dry-run | Added `docs/runbooks/postgres-cutover.md` (includes required full-schema migration step based on `ward-backend/db.js`). |
| 2026-03-20 | D.5 | Done | CI workflow + smoke test + local compose docs | Added GitHub Actions Postgres workflow, `docker-compose.postgres.yml`, and `postgresSmoke.test.js` plus README documentation. |
| 2026-03-20 | E.2.1 | Done | tsc+build | Added `ward-frontend/tsconfig.json`, `src/vite-env.d.ts`, installed `typescript`, and converted `src/utils/patientDisplay.js` → `patientDisplay.ts`. |
| 2026-03-20 | E.2.2 | Done | tsc+build | Migrated `ward-frontend/src/utils/api.js` → `api.ts` with typed env support; frontend build passed. |
| 2026-03-20 | E.2.3 | Done | useQuery pilot + build | Installed `@tanstack/react-query`, wrapped app with `QueryClientProvider`, and converted `Dashboard.jsx` patient roster fetch to `useQuery` (doctor polling now calls `refetchPatients`). |
| 2026-03-26 | E.2.3.1 | Done | lint+build | `Tasks.jsx`: `useQuery` for `GET /tasks/my?limit=50` (`queryKey` includes role); `completeTask`/`refetchTasks` after successful complete; removed redundant `useEffect` fetch. |
| 2026-03-26 | SYNC.0.1 | Done | codepath audit | Verified shared-sync prerequisites in codebase: credentialed CORS in `ward-backend/server.js`; cookie token fallback in `ward-backend/middleware/auth.js`; Postgres migration/adapter path in backend + README; TanStack Query active in `Dashboard.jsx` and `Tasks.jsx`. |
| 2026-03-26 | SYNC.1.1 | Done | frontend lint+build; backend npm test | Verified deployment/env contract is present in code and docs: `CORS_ORIGIN` enforced in prod, `DATABASE_URL` Postgres path, `VITE_API_BASE` in frontend env example. Stress gate passed (frontend build, backend tests). |
| 2026-03-26 | SYNC.1.2 | Done | migrate dry-run + backend npm test | Added `002_create_application_schema.sql` with full app tables/indexes/default-tenant triggers + backfills; updated `tests/services/postgresSmoke.test.js` to assert required table presence (when `DATABASE_URL` is set). Dry-run lists both migrations; backend tests pass. |
| 2026-03-26 | SYNC.1.3 | Done | backend npm test + runbook update | Added `ward-backend/scripts/compareSqlitePostgresCounts.js` and `npm run verify:migration-counts` for deterministic SQLite->Postgres row-count validation across core tables; updated `docs/runbooks/postgres-cutover.md` with post-import verification procedure. |
| 2026-03-26 | SYNC.2.1 | Done | frontend lint+build | Added shared query keys in `ward-frontend/src/utils/queryKeys.ts`; `Dashboard.jsx` now uses `queryKeys.patients(viewMode)` and invalidates via `queryClient.invalidateQueries`; `Tasks.jsx` now uses role+limit query key and invalidates that key after complete. |
| 2026-03-26 | SYNC.2.2 | Done | frontend lint+build | Added polling intervals for cross-device freshness: `Tasks.jsx` now polls every 15s; `Dashboard.jsx` patient query now polls every 15s in active view; removed duplicate patient refetch from escalation toast polling loop. |
| 2026-03-26 | SYNC.3.1 | Done | docs update | Added structured crash-recovery checkpoint template in PROGRESS (`Step ID`, intent, files, commands, verifier, stress, rollback, interrupted-at, next action) to make mid-step recovery deterministic. |
| 2026-03-26 | SYNC.3.2 | Done | runbook update | Added `Common failure modes and mitigations` section in `docs/runbooks/postgres-cutover.md` for CORS/cookie failures, partial migrations, data mismatches, tenant default regressions, and stale cross-device polling. |
| 2026-03-26 | SYNC.4.0 | Done | runbook added | Added `docs/runbooks/multi-device-sync-validation.md` with two-device matrix, stress loop, pass criteria, and failure logging template for repeatable acceptance execution. |

## Rollback / snapshots

**A.0 (pre–Phase A):**

- `api.js`: `const API_BASE = 'http://localhost:3001/api';`
- `server.js`: `app.use(cors());`

To revert Phase A: restore those two snippets and remove `ward-frontend/.env.example` if desired.
