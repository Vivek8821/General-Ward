# General Ward — Project Instructions

## Trigger: "Start the test server"

When the user says **"Start the test server"** (any capitalisation, with or without punctuation), execute this protocol immediately — no confirmation needed:

1. Run the startup script:
   ```bash
   bash /home/vn/Documents/General-Ward/start-test-server.sh
   ```
2. The script will:
   - Kill anything on ports 3001 and 5173
   - Wipe and re-seed the SQLite database (`ward-backend/ward.db`) via `scripts/seed-test.js`
   - Start the backend at `http://localhost:3001`
   - Start the Vite frontend at `http://localhost:5173`
   - Print test credentials in the terminal
3. After the servers are up, display this summary to the user:

   ```
   Test server is running.

   Frontend  → http://localhost:5173
   API       → http://localhost:3001

   Login credentials:
     Admin User   / admin123   (full access + audit log)
     Dr. Smith    / doctor123  (clinical access)
     Nurse Joy    / nurse123   (bedside access)

   Full feature checklist: TEST_PROTOCOL.md
   Stop both servers: Ctrl+C in the terminal running the script.
   ```

4. Do NOT start Postgres — the test server uses SQLite only.
5. Do NOT run `npm test` — that is the automated test suite, not the test server.

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
