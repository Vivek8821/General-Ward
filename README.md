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

See [`ward-backend/.env.example`](ward-backend/.env.example). In **production**, `JWT_SECRET` must be set (`ward-backend/middleware/auth.js`).

Optional: `AUDIT_RETENTION_DAYS` — used as default when calling `POST /api/admin/audit/purge` without `olderThanDays` (see [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md)).

## Seeded users (development)

After `node ward-backend/seed.js` (stop the API first if it locks `ward.db`):

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
