# Enterprise hardening — detailed execution plan (Phases A → E)

**Authoritative copy** for crash recovery: keep this file and [`enterprise-hardening-PROGRESS.md`](./enterprise-hardening-PROGRESS.md) in sync after **every** numbered step.

**Codemap / navigation (before each phase):**

- [codemap/CODEMAP.md](../../codemap/CODEMAP.md) — architecture, feature workflows, data model pointer
- [docs/COMPLIANCE.md](../../docs/COMPLIANCE.md) — what audit logs today, disclaimers
- [ward-frontend/CODENAV.md](../../ward-frontend/CODENAV.md) — routes, `ward_token`, API usage
- [ward-backend/CODENAV.md](../../ward-backend/CODENAV.md) — API surface
- [README.md](../../README.md) — SQLite / test runner constraints

---

## 1. Verified baseline (accuracy checklist)

| Item | Location | Notes |
|------|----------|--------|
| API base URL hardcoded | [ward-frontend/src/utils/api.js](../../ward-frontend/src/utils/api.js) | `API_BASE = 'http://localhost:3001/api'` |
| JWT read from localStorage | `ward_token` in [api.js](../../ward-frontend/src/utils/api.js), [AuthContext.jsx](../../ward-frontend/src/context/AuthContext.jsx) | Admin audit also reads token in [AdminAudit.jsx](../../ward-frontend/src/views/AdminAudit.jsx) |
| CORS | [ward-backend/server.js](../../ward-backend/server.js) | `app.use(cors())` — permissive default |
| HTTP audit middleware | [ward-backend/middleware/audit.js](../../ward-backend/middleware/audit.js) | On `res.finish`; skips if `!req.user`; path only (not body) |
| SQLite schema tables | [ward-backend/db.js](../../ward-backend/db.js) | See §7 inventory |
| `alert` / `prompt` | [PatientDetail.jsx](../../ward-frontend/src/views/PatientDetail.jsx), [VitalsTab.jsx](../../ward-frontend/src/components/stats/VitalsTab.jsx) | Grep before/after Phase E-light |
| History persistence | [ward-backend/routes/history.js](../../ward-backend/routes/history.js) | Uses `DailyStats` with `type = 'symptom'` + JSON payload (documented in file) |

---

## 2. PROGRESS file (mandatory)

Create/update [enterprise-hardening-PROGRESS.md](./enterprise-hardening-PROGRESS.md) with:

- **Last completed step:** e.g. `A.2`
- **Interrupted at:** file list + partial intent if crash mid-step
- **Blockers:** errors, failed tests, decisions needed
- **Log table:** date | step | outcome | verifier | notes
- **Rollback:** env values, git ref, or SQL dump pointer

---

## 3. Execution protocol

1. **One step only** per session slice; commit or PROGRESS entry before the next.
2. **Confirm** each step: all checkboxes in that step’s “Acceptance” section.
3. **Stress** after each step (minimum):
   - **Frontend touch:** `cd ward-frontend && npm run lint && npm run build`
   - **Backend touch:** stop API if it holds `ward.db`, then `cd ward-backend && npm test` ([README.md](../../README.md))
   - **Manual smoke:** login; one read + one write on the touched workflow
4. **No hallucinated paths:** if a file is not listed in codemap, open it and update this doc.

---

## 4. Stress test matrix (copy per phase)

| Check | Command / action | Pass | Date |
|-------|------------------|------|------|
| Lint | `ward-frontend npm run lint` | ☐ | |
| Build | `ward-frontend npm run build` | ☐ | |
| Backend tests | `ward-backend npm test` | ☐ | |
| Login | Browser: doctor seed user | ☐ | |
| Patient write | Escalation / vitals / patient edit per phase | ☐ | |

---

## 5. Phase A — Deploy & configuration

**Goal:** Environment-driven API URL for SPA; CORS safe for production; docs accurate.

### A.0 Snapshot (read-only)

- Copy exact `API_BASE` line from [api.js](../../ward-frontend/src/utils/api.js) into PROGRESS.
- Note `server.js` imports `cors` with no options.

**Acceptance:** PROGRESS rollback section filled.

### A.1 Frontend `VITE_API_BASE`

**Files:** [ward-frontend/src/utils/api.js](../../ward-frontend/src/utils/api.js), [ward-frontend/vite.config.js](../../ward-frontend/vite.config.js) (only if proxy added), root or [ward-frontend/README.md](../../ward-frontend/README.md)

**Implementation:**

1. Define `const RAW = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001'` (or equivalent).
2. **Normalize:** ensure single trailing rule — e.g. strip trailing `/`, append `/api` once so callers cannot produce `//api` or `undefined/api`.
3. Export or use internally as `API_BASE` replacing the literal.

**Edge cases:**

- Empty string env → treat as missing; use dev default.
- Production build must document **required** env in hosting (Netlify/Vercel/etc.).

**Acceptance:**

- `npm run build` succeeds with no `.env` (falls back to localhost string).
- Optional: `VITE_API_BASE=http://127.0.0.1:3001` in `ward-frontend/.env.local` verified manually.

### A.2 Backend `CORS_ORIGIN`

**Files:** [ward-backend/server.js](../../ward-backend/server.js)

**Implementation (suggested shape — exact code is step work):**

- Parse `process.env.CORS_ORIGIN`: `undefined` → keep developer-friendly behavior **only** when `NODE_ENV !== 'production'`.
- In production, if unset, **exit on startup** with clear error (same pattern as missing `JWT_SECRET` in [auth.js](../../ward-backend/middleware/auth.js)).
- Support comma-separated origins; pass to `cors({ origin: [...] })`.

**Edge cases:**

- Phase C will need `credentials: true` — origins must **not** be `*` when cookies used; document in PROGRESS when enabling.

**Acceptance:**

- `npm test` still passes.
- Manual: `curl -i -X OPTIONS -H "Origin: …" -H "Access-Control-Request-Method: POST" http://localhost:3001/api/auth/login` reflects allowlist in prod config tests OR manual doc for dev.

### A.3 Environment documentation

**Files:** [ward-backend/.env.example](../../ward-backend/.env.example), [README.md](../../README.md) or [ward-frontend/README.md](../../ward-frontend/README.md)

- Document `CORS_ORIGIN`, `VITE_API_BASE` (frontend env lives in `ward-frontend/`, not backend).

**Acceptance:** Example values match real dev setup; no secrets committed.

### A.4 (Optional) Vite dev proxy

If you want **same-origin** dev (simpler cookies later): proxy `/api` from Vite to `3001`. Record decision in PROGRESS — not required for A.1–A.3.

---

## 6. Phase E (light) — Non-blocking UX

**Goal:** No `alert`/`prompt` in targeted flows; failures use toast or in-UI patterns. **Package already present:** `react-hot-toast` ([ward-frontend/package.json](../../ward-frontend/package.json)).

### E0.0 Inventory (grep)

```bash
rg "alert\\(|prompt\\(" ward-frontend/src
```

Record output in PROGRESS before edits.

### E0.1 PatientDetail

**File:** [ward-frontend/src/views/PatientDetail.jsx](../../ward-frontend/src/views/PatientDetail.jsx)

| Current UX | Replacement guidance |
|------------|----------------------|
| `prompt` escalation reason | Small modal with `<textarea>` + Confirm / Cancel; on cancel, no API call |
| Success/error `alert` (escalate, review, save patient, discharge, task) | `toast.success` / `toast.error`; message must handle missing `err.message` |
| Task failure alert | `toast.error` with fallback string |

**Edge cases:**

- `readOnly` / discharged: escalation controls hidden — no change needed to modal logic beyond existing guards.
- Accessibility: focus trap in modal; ESC closes; primary button to submit.

**Acceptance:** Grep shows no `alert`/`prompt` in this file; doctor + nurse flows manually verified.

### E0.2 VitalsTab

**File:** [ward-frontend/src/components/stats/VitalsTab.jsx](../../ward-frontend/src/components/stats/VitalsTab.jsx)

- Replace validation `alert` with inline error text under fields **or** `toast.error`.

**Acceptance:** Submit invalid form shows non-blocking feedback; valid submit unchanged functionally.

---

## 7. Phase B — Domain change audit (“who changed what”)

**Goal:** Complement HTTP [audit.js](../../ward-backend/middleware/audit.js) with **entity-level** events. **Compliance:** logging field-level data may store PHI — update [COMPLIANCE.md](../../docs/COMPLIANCE.md) with what is stored, retention, and admin access.

### B.0 Design checkpoint (PROGRESS, before code)

Decide and document:

- Table name (e.g. `ClinicalChangeLog`)
- Columns: `id`, `timestamp`, `tenantId`, `userId`, `userRole`, `entityType`, `entityId`, `action` (`insert|update|delete`), `summary` TEXT or JSON, optional `details` (size-capped)
- Whether to store full before/after or hashed/truncated diffs

### B.1 Schema

**File:** [ward-backend/db.js](../../ward-backend/db.js)

- `CREATE TABLE IF NOT EXISTS` + indexes `(tenantId, timestamp)` and `(entityType, entityId)`.
- Follow existing migration style (`ALTER` guards) for existing DBs.

**Acceptance:** New clone + old DB upgraded without error; `npm test` if schema touched by tests.

### B.2 Repository + recorder

**New file (suggested):** `ward-backend/repositories/ClinicalChangeLogRepository.js` (or under `services/` — match repo conventions)

- `insertChange({ tenantId, userId, userRole, entityType, entityId, action, summary, details })`

**Acceptance:** Unit test with mocked `db` **or** integration test insert + select.

### B.3 Wire to write paths (incremental)

**Priority 1 (high risk):**

- Patient update — trace from [PatientController.js](../../ward-backend/controllers/PatientController.js) / [PatientService.js](../../ward-backend/services/PatientService.js)
- Medication create/update/status — [ward-backend/routes/medications.js](../../ward-backend/routes/medications.js) / service layer

**Priority 2:**

- Handover note create — [HandoverNotesService.js](../../ward-backend/services/HandoverNotesService.js) (confirm path via codemap)
- Discharge POST — patient discharge in controller/service

**Rules:**

- Call recorder **only after** successful commit (or inside same transaction if you introduce transactions).
- On failure, **no** audit row.

### B.4 Admin read

**Pattern:** [ward-backend/routes/adminAudit.js](../../ward-backend/routes/adminAudit.js) — tenant-scoped, admin-only.

- New routes e.g. `GET /api/admin/clinical-changes` with pagination (`limit`, `cursor`), filters `entityType`, date range.
- Extend [AdminAudit.jsx](../../ward-frontend/src/views/AdminAudit.jsx) or new tab — optional UI step; API alone can be Phase B MVP.

**Acceptance:** Cross-tenant query impossible with normal JWT; integration test with two tenants if available.

---

## 8. Phase C — Cookie sessions & CSRF

**Goal:** Stop relying on `localStorage` for `ward_token`. **Prerequisite:** Phase A CORS with explicit origins; **breaking** change for all clients.

### C.0 Architecture note in PROGRESS

Choose one:

- **A)** HttpOnly cookie (JWT or opaque session id) + **double-submit CSRF** token (non-HttpOnly cookie + header)
- **B)** Backend-for-frontend (same-origin proxy) — smaller CORS surface

### C.1 Backend login / logout

**Files (verify in tree):** [ward-backend/controllers/AuthController.js](../../ward-backend/controllers/AuthController.js), [ward-backend/routes/auth.js](../../ward-backend/routes/auth.js) if split, [auth.js](../../ward-backend/middleware/auth.js)

- On successful login: `Set-Cookie` with `HttpOnly`, `Secure` in production, `SameSite` appropriate (often `lax` dev / `strict` or `none`+Secure cross-site).
- Logout clears cookie.

### C.2 `authenticateToken`

- Read `Authorization` **or** cookie (migration window: support both until PROGRESS marks deprecation complete).

### C.3 Frontend

**Files:** [AuthContext.jsx](../../ward-frontend/src/context/AuthContext.jsx), [api.js](../../ward-frontend/src/utils/api.js), [AdminAudit.jsx](../../ward-frontend/src/views/AdminAudit.jsx)

- All `fetch` from `api.js`: `credentials: 'include'`.
- Remove `ward_token` localStorage writes on success path once cookie-only; keep theme/user prefs as today unless you move user bootstrap to `/auth/me` only.
- **Admin CSV export** if it builds URLs with token — refactor to cookie session or short-lived download token.

### C.4 CORS + credentials

**File:** [server.js](../../ward-backend/server.js)

- `cors({ origin: allowedList, credentials: true })` — must align with Phase A.2.

**Acceptance:**

- Application tab: no long-lived JWT in localStorage (after cutover).
- 401 still redirects to `/login` via [api.js](../../ward-frontend/src/utils/api.js).

---

## 9. Phase D — PostgreSQL

**Goal:** Replace SQLite for multi-instance deployment. **Largest phase** — treat substeps as separate PRs.

### D.0 Inventory (tables to migrate)

From [db.js](../../ward-backend/db.js):

`Users`, `Tenants`, `Patients`, `DailyStats`, `Medications`, `MedicationAdministrations`, `Escalations`, `DischargeSummaries`, `Tasks`, `HandoverNotes`, `AuditLogs`, `IdempotencyKeys`, `AuthLoginAttempts`, plus any post-Phase-B table.

### D.1 Driver & pool

- Add `pg`, env `DATABASE_URL` or host/user/pass/db.
- Health check: `/health` or `/api/version` extended to verify DB connectivity (optional).

### D.2 Migrations

- Introduce numbered SQL or migration tool; **no** schema-only in `db.js` bootstrap long-term — keep bootstrap only for SQLite test path **or** drop SQLite in tests (decision in PROGRESS).

### D.3 Data access layer

- Option 1: rewrite [repositories/*](../../ward-backend/repositories/) to async `pg`.
- Option 2: introduce adapter interface implemented by SQLite (tests) and PG (prod) — more work, smoother transition.

**Risk:** [db.js](../../ward-backend/db.js) uses synchronous `sqlite3` callbacks widely — port is cross-cutting.

### D.4 Cutover runbook

**File (new):** e.g. `docs/runbooks/postgres-cutover.md`

- Export SQLite; transform types; import; validation queries; rollback plan.

### D.5 Tests

- CI: PostgreSQL service container; tests point at `DATABASE_URL`.
- Document local docker-compose in README.

---

## 10. Phase E (heavy) — TypeScript & TanStack Query

**Goal:** Safer client and clearer server-state. **Repo is JS** today per codemap.

### E2.1 Tooling

- Add `typescript`, `@types/react`, [Vite TS support](https://vitejs.dev/guide/features.html#typescript).
- Start with `allowJs: true` + rename one file to verify pipeline.

### E2.2 Typed API client

- Migrate [api.js](../../ward-frontend/src/utils/api.js) → `api.ts` with env typing `ImportMetaEnv`.

### E2.3 TanStack Query pilot

- Install `@tanstack/react-query`; wrap app in `QueryClientProvider` in [main.jsx](../../ward-frontend/src/main.jsx).
- Pilot: [Dashboard.jsx](../../ward-frontend/src/views/Dashboard.jsx) patient list — `useQuery` for `GET /patients`, keep mutations as `useMutation` or existing until follow-up.

**Acceptance:** No duplicate fetches on navigation; loading/error UI explicit.

---

## 11. Out of scope (explicit)

Per product choice unless a new phase is opened:

- HL7 / FHIR / IHE
- SSO / SAML (not in current auth stack)
- MPI / patient matching
- Full EMR (orders, results, billing)

---

## 12. Final regression sweep

After all executed phases:

- Walk [codemap/CODEMAP.md](../../codemap/CODEMAP.md) workflows: login, dashboard, patient chart (tabs), meds, history, handover, tasks, escalations, discharge, admin audit.
- Re-read [COMPLIANCE.md](../../docs/COMPLIANCE.md); update for clinical audit content and session storage.

---

*Plan depth version: 2 — aligned with repo paths as of plan authoring; re-validate paths if refactors occur.*
