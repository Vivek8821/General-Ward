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

## Project overview

Patient management software for hospitals, deployed on-premise on client servers.

- **Backend**: Node.js + Express 5, SQLite (dev/test) / PostgreSQL (prod)
- **Frontend**: React 18 + Vite + TanStack Query v5
- **Auth**: JWT in httpOnly cookie, CSRF double-submit, bcrypt
- **Multi-tenant**: every DB query scoped by `tenantId` from JWT claim
- **Deployment**: `docker compose up` from the repo root (see `docker-compose.yml`)

## Architecture

```
ward-backend/
  controllers/   HTTP layer (AuthController, PatientController, …)
  services/      Business logic (AuthService, ScoringService, …)
  repositories/  DB access (AuthRepository, PatientRepository, …)
  middleware/    auth.js, rbac.js, csrf.js, tenant.js, audit.js
  db/schema.js   SQLite schema + migrations
  db-postgres.js PostgreSQL pool + Postgres migrations

ward-frontend/
  src/features/  Feature slices (dashboard, pharmacy, …)
  src/views/     Page-level components
  src/utils/api.ts  All API calls, CSRF token handling
```

## Key behaviours to know

- `JWT_SECRET` must be set in production or the server refuses to start
- `CORS_ORIGIN` must be set in production or the server refuses to start
- Rate limiter is in-memory (intentional for single-process deployment)
- `DB_DIALECT=postgres` switches the adapter; `DB_DIALECT=sqlite` (default) uses SQLite
- `PG_POOL_MAX` defaults to 20 — tuned for ~50 concurrent users

# CLAUDE.md — System-Level Operational Directives

## ⚠️ CRITICAL CONSTRAINTS (ANTI-Error PROTOCOL)
1. **NO PLACEHOLDERS OR ELIPSES**: You are strictly prohibited from writing code containing comments like `// TODO: Implement later`, `/* ... existing code ... */`, or `// logic goes here`. You must write out every single line of production-ready code. No shortcuts, no omissions.
2. **NO ASSUMPTIONS**: If a variable, file path, dependency, or architectural convention is ambiguous, stop and ask the developer for clarification before writing code.
3. **LAYERED TRACEABILITY**: Every script, route, or service you write must completely follow the project's existing architectural boundaries (e.g., Controller -> Service -> Repository -> Data Access Layer). Never bypass layers for convenience.

## 🏛️ ARCHITECTURAL OVERSIGHT (CODEX 5.5)
You have strict operational oversight of **Codex 5.5** across this entire system. Codex 5.5 governs the database layer, schema design, type-safety schemas, multi-tenant isolation, and data mutation integrity.

When operating under Codex 5.5, you must strictly enforce:
* **The Migration Invariant**: Database schemas must never be modified inline or retroactively. All modifications require explicit, incremental, and idempotent migrations.
* **The Isolation Shield**: Every read, write, update, and delete query must explicitly pass and validate a scoping identifier (e.g., `tenantId`, `organizationId`, or `userId`) at the repository layer.
* **Transaction Grouping**: Multi-entity modifications must be bundled into a single unit of work/transaction wrapper. Partial failures must cause a clean rollback.
* **Zero Raw Injections**: All queries must utilize parameterized abstractions or an ORM/query builder ecosystem. Raw string concatenations with external inputs are a fatal violation.

## 🛠️ CODE WRITING RESOLUTION PROTOCOL
* **Review Before Build**: Locate and read the structural map of the codebase (e.g., `CODEMAP.md` or file lists) before modifying any files.
* **Component Splitting Constraint**: If a file or component you are editing approaches or exceeds a clean readability threshold (e.g., 500 lines), you must stop and propose refactoring it into isolated sub-modules rather than expanding it line-by-line.
* **Error Hygiene**: Every external I/O call, database query, and third-party integration must include local, granular try-catch handling. Errors must be sanitized before being surfaced to consumers, and rich stack traces must be logged internally.
