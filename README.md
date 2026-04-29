# General Ward

Locally run patient monitoring software: **Express + SQLite** API (`ward-backend/`) and **React (Vite)** SPA (`ward-frontend/`).

## Quick start

```bash
npm run install-all
npm start
```

- API: `http://localhost:3001` (health: `GET /health`)
- SPA: Vite dev server (see console; default often `http://localhost:5173`)

## Configuration

See [`ward-backend/.env.example`](ward-backend/.env.example). In **production**, `JWT_SECRET` must be set (`ward-backend/middleware/auth.js`), and **`CORS_ORIGIN`** must list the SPA origin(s) (comma-separated) or the API will refuse to start.

For the React app, optional [`ward-frontend/.env.example`](ward-frontend/.env.example): set **`VITE_API_BASE`** to the API host (default: `http://localhost:3001`). The client appends `/api` unless the value already ends with `/api`.

Optional: `AUDIT_RETENTION_DAYS` — used as default when calling `POST /api/admin/audit/purge` without `olderThanDays` (see [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md)).

## Postgres (Phase D.5)
The backend can run against PostgreSQL when `ward-backend/.env` sets `DATABASE_URL`.

### Local Postgres via Docker Compose
1. Start Postgres:
   ```bash
   docker compose -f docker-compose.postgres.yml up -d
   ```
2. Set `DATABASE_URL` in `ward-backend/.env` (or create it from `.env.example`):
   ```bash
   DATABASE_URL=postgres://ward:ward@localhost:5432/ward
   ```
3. Apply migrations:
   ```bash
   node ward-backend/migratePostgres.js
   ```
4. Verify in CI-equivalent mode (smoke test; runs only when `DATABASE_URL` is set):
   ```bash
   DATABASE_URL=postgres://ward:ward@localhost:5432/ward \
     npx jest ward-backend/tests/services/postgresSmoke.test.js --runInBand --forceExit
   ```

## Seeded users (development)

After `node ward-backend/seed.js` (stop the API first if it locks `ward.db`).

**Important**: `seed.js` is **development/demo only**. It creates weak, known PINs and should **never** be used for a production database. For any real deployment, create users via the app and enforce strong credentials.

| Name           | Role   | PIN/password (demo) |
|----------------|--------|---------------------|
| Dr. Smith      | doctor | `1234`              |
| Nurse Johnson  | nurse  | `5678`              |
| Ward Admin     | admin  | `9999`              |

All seeded users use tenant `tenant-default`.

## Audit log (admin)

Admins can open **Audit log** in the app header or go to `/admin/audit` to browse, export CSV, and run retention (dry run / purge) for **their tenant only**.

Details: [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).

## Scripts

| Location        | Command              | Purpose                    |
|-----------------|----------------------|----------------------------|
| Root            | `npm run codemap`    | Regenerate `codemap/`      |
| `ward-backend`  | `npm test`           | Jest integration tests     |
| `ward-frontend` | `npm run build`      | Production build           |

Navigation map: [`codemap/CODEMAP.md`](codemap/CODEMAP.md).

## Testing and load

- Run **`ward-backend` tests with the API stopped** if both use the same `ward.db` to avoid SQLite corruption under concurrent access.
- Optional stress harness: `ward-backend/stressEverything.js` (read file header for env vars; do not seed the DB while the server is running).

## Scope

See [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) for audit semantics, backups, and disclaimers.
