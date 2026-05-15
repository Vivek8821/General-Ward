# General Ward — Project Instructions

## Trigger: "Start the test server"

When the user says **"Start the test server"** (any capitalisation, with or without punctuation), execute this protocol immediately — no confirmation needed:

1. Run the startup script:
   ```bash
   bash /home/vn/Documents/General-Ward/start-test-server.sh
   ```
2. The script will:
   - Kill anything on ports 3001 and 5173
   - **Preserve existing patient data** (idempotent seed — skips if already loaded)
   - Start the backend at `http://localhost:3001`
   - Start the Vite frontend at `http://localhost:5173`
3. After the servers are up, display this summary to the user:

   ```
   Server is running. Patient data preserved.

   Frontend  → http://localhost:5173
   API       → http://localhost:3001

   Credentials:
     Admin User    / admin123   (admin — audit + user management)
     Dr. Smith     / doctor123  (doctor — clinical + discharge)
     Dr. Patel     / doctor123  (doctor — clinical + discharge)
     Nurse Joy     / nurse123   (nurse — vitals + tasks)
     Nurse Riya    / nurse123   (nurse — vitals + tasks)
     PharmD Jones  / pharma123  (pharmacist — pharmacy only)

   To reset all patient data: bash start-test-server.sh --fresh
   Stop both servers: Ctrl+C in the terminal running the script.
   ```

4. Do NOT start Postgres — the server uses SQLite only.
5. Do NOT run `npm test` — that is the automated test suite, not the app server.
6. Do NOT wipe `ward.db` — patient data is persistent by design. Only `--fresh` resets it.

---

## Project Overview

Patient management software for hospitals, deployed on-premise on client servers.

- **Backend**: Node.js + Express 5, SQLite (dev/test) / PostgreSQL (prod)
- **Frontend**: React 18 + Vite + TanStack Query v5
- **Auth**: JWT in httpOnly cookie, CSRF double-submit, bcrypt
- **Multi-tenant**: every DB query scoped by `tenantId` from JWT claim
- **Deployment**: `docker compose up` from the repo root (see `docker-compose.yml`)

## Architecture

```
ward-backend/
  controllers/      HTTP layer (AuthController, BillingController, Hl7StatusController, …)
  services/         Business logic (AuthService, ScoringService, billing/, hl7/, …)
  repositories/     DB access (PatientRepository, billing/, Hl7OrphanRepository, …)
  middleware/       auth.js, rbac.js, csrf.js, tenant.js, protect.js, audit.js
  db/schema.js      SQLite schema + all migrations (source of truth)
  db-adapter.js     Dialect abstraction — ONLY permitted DB access layer
  db-postgres.js    PostgreSQL pool + file-based migration runner

ward-frontend/
  src/features/     Feature slices (dashboard, pharmacy, statistics, …)
  src/components/   Shared components (billing/BillingTab, stats/*, …)
  src/views/        Page-level components
  src/utils/api.ts  All API calls, CSRF token handling
```

## Key Behaviours to Know

- `JWT_SECRET` must be set in production or the server refuses to start
- `CORS_ORIGIN` must be set in production or the server refuses to start
- `DB_DIALECT=postgres` switches the adapter; `DB_DIALECT=sqlite` (default) uses SQLite
- `PG_POOL_MAX` defaults to 20 — tuned for ~50 concurrent users
- Rate limiter is in-memory (intentional for single-process deployment)
- **All DB access must go through `db-adapter.js`** — never call `db.js` directly from repos
- **Every query must include `tenantId`** — cross-tenant access is a security violation
- `HL7_ENABLED=true` starts the MLLP TCP listener (port 2575); requires `HL7_TENANT_ID`
- Dates in clinical tables are stored as **DD-MM-YYYY** strings
- Billing accrual is idempotent — the partial unique index on `InvoiceLines.sourceRef` is the hard guard

---

## Behavioral Guidelines

> These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them. Don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it. Don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
[Step] → verify: [check]
[Step] → verify: [check]
[Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

*These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.*
