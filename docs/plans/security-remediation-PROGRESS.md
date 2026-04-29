## Security remediation progress (crash-resume friendly)

This file is the **authoritative session checkpoint**. If work stops mid-way (crash, reboot, context loss), resume from here.

### Working agreements (to prevent hallucinations / mistakes)

- Only treat an issue as “confirmed” if it was verified by opening the exact file and line(s).
- Every step must record:
  - what changed (files + intent),
  - how it was verified (tests/commands/output summary),
  - whether it is complete,
  - what the next exact action is.
- Do **one step at a time**. After each step, run the specified verification and record the result here.

### Current status

- **Phase**: Phase 1 (High severity)
- **Step**: 0.1 — Create checkpoint log (this file)
- **Status**: IN PROGRESS

---

## Phase 1 — High severity findings (fix now)

### P1.1 Harden JWT secret + environment validation (HIGH)

- **Confirmed in code**:
  - `ward-backend/middleware/auth.js`: uses hard-coded fallback secret when `JWT_SECRET` unset and `NODE_ENV !== 'production'`.
- **Goal**:
  - Ensure the insecure fallback can only be used in explicit local development/test, and cannot happen due to accidental env misconfiguration.

**Planned steps**

- [ ] **P1.1.1** Add central env/config validation module and require it at startup.
  - Verification: backend boots in dev with explicit dev flag; backend refuses to start when `JWT_SECRET` missing in any non-dev mode.
- [ ] **P1.1.2** Update `middleware/auth.js` to use validated config (no direct env reads; no weak fallback outside explicit dev).
  - Verification: backend tests pass (`ward-backend/npm test`).

### P1.2 Quarantine legacy bearer-token auth route (HIGH)

- **Confirmed in code**:
  - `ward-backend/routes/auth.js` returns `{ token, user }` JSON and does not set cookie/CSRF token.
  - `ward-backend/server.js` currently mounts `controllers/AuthController` at `/api/auth`, not this legacy route.
- **Goal**:
  - Prevent accidental mounting or use of legacy auth.

**Planned steps**

- [ ] **P1.2.1** Make legacy route un-importable by default (move to `ward-backend/legacy/` or make module throw on import).
  - Verification: grep/search confirms `server.js` does not mount legacy auth; backend boots; backend tests pass.

### P1.3 Remove prod risk of dev credentials in UI + seed (HIGH)

- **Confirmed in code**:
  - `ward-frontend/src/views/Login.jsx` pre-fills username/password with `Dr. Smith / 1234`.
  - `ward-backend/seed.js` seeds `Dr. Smith` with password `1234` (explicit “dev/demo only”).
- **Goal**:
  - Ensure production builds do not ship prefilled credentials, and the dev seed cannot be mistaken for production defaults.

**Planned steps**

- [ ] **P1.3.1** Gate UI default credentials behind `import.meta.env.DEV` (empty values otherwise).
  - Verification: `ward-frontend` build succeeds; login form is empty in production build.
- [ ] **P1.3.2** Update seed/dev docs to clearly label unsafe demo credentials and prevent accidental prod usage.
  - Verification: docs updated; `.env.example` / README mention non-prod-only seed.

---

## Phase 2 — Hardening (post-high)

### P2.1 Add explicit CSP and security headers (HIGH-hardening)

- **Confirmed in code**:
  - `ward-backend/server.js` uses `helmet()` default config; no explicit CSP configured.
- **Goal**:
  - Add CSP aligned with the SPA and validate it does not break the app.

**Planned steps**

- [ ] **P2.1.1** Configure Helmet CSP directives appropriate for Vite/React app.
  - Verification: manual UI smoke; no CSP violations for core flows.

---

## Phase 3 — Validation gates

### P3.1 Stress test gate

- **Runbook**: `docs/runbooks/stress-test-gate.md`
- [ ] Run stress test and record summary JSON.

### P3.2 Codemap update

- [ ] Regenerate `codemap/file-inventory.json` and `codemap/CODEMAP.md`.
  - Commands (from codemap docs): `node codemap/generate-codemap-index.mjs` then `node codemap/build-codemap-md.mjs`

---

## Step log (append-only)

### Step 0.1 — Create checkpoint log

- **When**: 2026-04-29
- **Change**: Added this progress file.
- **Files changed**:
  - `docs/plans/security-remediation-PROGRESS.md`
- **Verification**:
  - N/A (documentation only)
- **Result**: DONE
- **Next step**: **P1.1** Harden JWT secret + env validation.

### Step 1.1 — Centralize env config + harden JWT secret usage (P1.1)

- **When**: 2026-04-29
- **Change**:
  - Added centralized backend config validation (`NODE_ENV` normalization + prod/staging safety).
  - Made JWT secret sourcing come only from validated config (no direct env fallback logic in `middleware/auth.js`).
  - Updated CORS env handling and cookie secure/samesite behavior to use the centralized config (prod-like = production or staging).
- **Files changed**:
  - `ward-backend/config.js` (new)
  - `ward-backend/middleware/auth.js`
  - `ward-backend/server.js`
  - `ward-backend/controllers/AuthController.js`
- **Verification**:
  - `cd ward-backend && npm test`
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: **P1.2** quarantine legacy auth route at `ward-backend/routes/auth.js`.

### Step 1.2 — Quarantine legacy auth route (P1.2)

- **When**: 2026-04-29
- **Change**:
  - Removed legacy route implementation at `ward-backend/routes/auth.js` (prevent accidental mounting).
  - Added `ward-backend/legacy/` with a fail-loud stub at `ward-backend/legacy/routes/auth.js`.
  - Updated backend navigation docs to point auth entry to `controllers/AuthController.js`.
- **Files changed**:
  - Deleted: `ward-backend/routes/auth.js`
  - Added: `ward-backend/legacy/README.md`
  - Added: `ward-backend/legacy/routes/auth.js`
  - Updated: `ward-backend/CODENAV.md`
- **Verification**:
  - `cd ward-backend && npm test` (executed from backend directory)
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: **P1.3.1** gate frontend default login credentials behind `import.meta.env.DEV`.

### Step 1.3 — Gate frontend dev login defaults (P1.3.1)

- **When**: 2026-04-29
- **Change**:
  - Made the login form’s default credentials apply only in dev builds (`import.meta.env.DEV`).
  - Production builds now default username/password to empty strings.
- **Files changed**:
  - `ward-frontend/src/views/Login.jsx`
- **Verification**:
  - `cd ward-frontend && npm run build`
  - Result: **PASS** (Vite production build succeeded)
- **Result**: DONE
- **Next step**: **P1.3.2** update seed/dev documentation to prevent demo credentials from being treated as production defaults.

### Step 1.4 — Document demo credentials as non-production (P1.3.2)

- **When**: 2026-04-29
- **Change**:
  - Added explicit warnings that `ward-backend/seed.js` is development/demo only and must never be used for production.
  - Added a matching warning inline inside `seed.js`.
- **Files changed**:
  - `README.md`
  - `ward-backend/seed.js`
- **Verification**:
  - Manual review: warnings present in README and seed script header comment.
- **Result**: DONE
- **Next step**: **P2.1** add explicit CSP/security headers via Helmet and validate against the SPA.

### Step 2.1 — Add explicit CSP/security headers (P2.1)

- **When**: 2026-04-29
- **Change**:
  - Configured Helmet with an explicit **strict CSP** for prod/staging (API serves JSON; CSP is defensive if any HTML endpoints are added later).
  - Left CSP disabled in dev/test to avoid friction during local development.
- **Files changed**:
  - `ward-backend/server.js`
- **Verification**:
  - `cd ward-backend && npm test`
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: **P3.1** run `ward-backend/stressEverything.js` and record output summary.

### Step 3.1 — Stress-test gate (P3.1)

- **When**: 2026-04-29
- **Runbook followed**: `docs/runbooks/stress-test-gate.md`
- **Procedure**:
  - Seeded DB: `node ward-backend/seed.js` (API stopped)
  - Started API: `node ward-backend/server.js`
  - Ran stress: `cd ward-backend && node stressEverything.js`
  - Stopped API after run
- **Result summary**:
  - `durationSec=20`, `concurrency=10`
  - `totalRequests=9432`
  - `server5xx=0`, `timeouts=0`, `fetchErrors=0`
  - `latencyP95Ms=41`
  - `statusHistogram`: 200=7940, 201=932, 429=560
- **Notes**:
  - `429` responses are expected due to rate-limiting on some endpoints.
- **Result**: DONE
- **Next step**: **P3.2** regenerate codemap (`codemap/file-inventory.json` and `codemap/CODEMAP.md`).

### Step 3.2 — Codemap update (P3.2)

- **When**: 2026-04-29
- **Command**: `npm run codemap`
- **Output**:
  - `codemap/file-inventory.json` regenerated
  - `codemap/CODEMAP.md` regenerated
- **Result**: DONE
- **Next step**: Review changes and optionally commit as a single “security hardening” changeset.

### Step 3.3 — Stop tracking SQLite artifacts + re-run tests

- **When**: 2026-04-29
- **Change**:
  - Added repo `.gitignore` entries for SQLite runtime artifacts.
  - Removed `ward-backend/ward.db*` from git tracking (kept locally).
- **Files changed**:
  - Added: `.gitignore`
  - Untracked (git-index removal): `ward-backend/ward.db`, `ward-backend/ward.db-shm`, `ward-backend/ward.db-wal`
- **Verification**:
  - `cd ward-backend && npm test`
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: If desired, create a commit (excluding any local DB artifacts).

---

## Phase 4 — Medium severity findings

### Step 4.1 — Quarantine legacy patients route (MEDIUM)

- **When**: 2026-04-29
- **Confirmed before change**:
  - `ward-backend/routes/patients.js` contains non-tenant-scoped queries (e.g. `SELECT * FROM Patients`).
  - No imports/mounts referenced it (`grep` found no usage), but keeping it in-tree is a future footgun.
- **Change**:
  - Deleted legacy patients route.
  - Added a fail-loud stub under `ward-backend/legacy/routes/patients.js` pointing to `controllers/PatientController.js`.
- **Files changed**:
  - Deleted: `ward-backend/routes/patients.js`
  - Added: `ward-backend/legacy/routes/patients.js`
- **Verification**:
  - `cd ward-backend && npm test`
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: **Step 4.2** tighten CSRF rules for mutations (explicit allowlist; avoid silent bypass when `req.user` exists but `csrf` claim is missing).

### Step 4.2 — Tighten CSRF enforcement for cookie-authenticated mutations (MEDIUM)

- **When**: 2026-04-29
- **Confirmed before change**:
  - `ward-backend/middleware/csrf.js` skipped CSRF when `req.user.csrf` missing, even for authenticated mutation requests.
- **Change**:
  - Tagged authentication source in `ward-backend/middleware/auth.js` (`req.authSource = 'cookie' | 'header'`).
  - Updated CSRF middleware to enforce CSRF **only** for `cookie`-authenticated mutation requests:
    - `/api/auth/login` remains allowlisted.
    - Header-auth clients (e.g. stress harness) are not required to send CSRF.
    - Cookie-auth mutations missing a `csrf` claim now fail with 403.
- **Files changed**:
  - `ward-backend/middleware/auth.js`
  - `ward-backend/middleware/csrf.js`
- **Verification**:
  - `cd ward-backend && npm test`
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: **Step 4.3** add PHI-safe logging guardrails (prevent accidental logging of `req.body` / notes).

### Step 4.3 — PHI-safe logging guardrails (MEDIUM)

- **When**: 2026-04-29
- **Change**:
  - Ensured both request logs and audit logs store **path without query string** (reduces risk of leaking sensitive info via query params).
  - Added explicit logging guidance document banning `req.body`/secrets logging.
- **Files changed**:
  - `ward-backend/middleware/requestLogger.js`
  - `ward-backend/middleware/audit.js`
  - `docs/SECURITY_LOGGING.md` (new)
- **Verification**:
  - `cd ward-backend && npm test`
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: **Step 4.4** harden SQLite migration ALTER TABLE handling and remove duplicate ALTERs in `ward-backend/db.js`.

### Step 4.4 — SQLite migration robustness (MEDIUM)

- **When**: 2026-04-29
- **Confirmed before change**:
  - `ward-backend/db.js` had duplicate `ALTER TABLE ... ADD COLUMN status` for `Medications`, and many ALTERs ignored errors broadly.
- **Change**:
  - Added a helper `runIgnoreDuplicateColumn()` that only swallows the specific SQLite error `duplicate column name`.
  - Removed the duplicate `Medications.status` ALTER.
  - Converted relevant ALTER calls to use the helper (so unexpected migration errors are no longer silently ignored).
- **Files changed**:
  - `ward-backend/db.js`
- **Verification**:
  - `cd ward-backend && npm test`
  - Result: **PASS** (16 passed, 1 skipped; 47 passed tests)
- **Result**: DONE
- **Next step**: Update codemap + assessment canvas to reflect medium remediation changes, then proceed to the remaining medium items (frontend tests, CI security checks, RBAC centralization).

