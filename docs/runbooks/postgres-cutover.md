# Postgres Cutover Runbook (Phase D.4)

## Goal
Replace the current SQLite-backed runtime with PostgreSQL using the existing DB adapter cutover points:
`ward-backend/dbAdapter/index.js` selects the adapter based on `DATABASE_URL`, and
`ward-backend/migratePostgres.js` applies numbered SQL migrations in `ward-backend/postgres-migrations/migrations/`.

## Current state (what is implemented today)
1. DB adapter switch is implemented.
   - If `DATABASE_URL` is set and non-empty, the backend uses `ward-backend/dbAdapter/postgresAdapter.js`.
   - Otherwise, it uses `ward-backend/dbAdapter/sqliteAdapter.js`.
2. Postgres migration runner is implemented.
   - `node ward-backend/migratePostgres.js` reads `*.sql` files from `ward-backend/postgres-migrations/migrations/`.
   - It also creates a `SchemaMigrations` tracking table in Postgres.
3. Migration coverage caveat (important).
   - The current migrations folder includes only the `SchemaMigrations` tracking table creation migration (`001_create_schema_migrations.sql`).
   - The *full* application schema (all tables, tenant defaulting triggers, and indexes) is defined for SQLite in `ward-backend/db.js`, but it is not yet represented as Postgres migration files.

This runbook therefore includes a required step: create the real schema migrations for Postgres based on the SQLite schema.

## Prerequisites
1. PostgreSQL access (or a running Postgres instance).
2. A `DATABASE_URL` for the backend, e.g.:
   - `postgres://USER:PASSWORD@HOST:5432/DBNAME`
3. Backup of the SQLite DB file:
   - `ward-backend/ward.db`
4. Environment alignment:
   - Ensure `CORS_ORIGIN` is set to the frontend origin (required for cookie handling).
   - Ensure `VITE_API_BASE` matches the backend base URL.

## Cutover steps

### 1. Freeze application writes (operational guardrail)
1. Put the system into a “read-only” operational mode if your deployment allows it.
2. Stop all non-essential clients (prevents new writes during the bulk import).

### 2. Back up SQLite (rollback anchor)
1. Copy `ward-backend/ward.db` to a timestamped backup location.
2. Record the backup filename in the change ticket.

### 3. Provision PostgreSQL
1. Create/restore a Postgres database.
2. Set the backend environment variable `DATABASE_URL` to point at that database.

### 4. Create Postgres schema migrations (required)
You must create migration files that create the full schema, because the existing migrations folder only tracks applied migration names.

Recommended approach (minimize drift):
1. Use `ward-backend/db.js` as the source of truth for table definitions.
2. For each `CREATE TABLE IF NOT EXISTS ...` block in `ward-backend/db.js`, create a matching Postgres `CREATE TABLE` statement in one or more `NNN_*.sql` migration files.
3. Translate SQLite specifics carefully:
   - `DATETIME DEFAULT CURRENT_TIMESTAMP` -> `TIMESTAMPTZ DEFAULT NOW()`
   - SQLite’s `INTEGER CHECK(...)` constraints can be ported as `CHECK(...)`.
   - Foreign key constraints should be declared in Postgres (`FOREIGN KEY ... REFERENCES ...`).
4. Tenant defaulting behavior:
   - SQLite uses triggers to backfill `tenantId` when it is inserted/updated as `NULL`.
   - Implement equivalent Postgres triggers (or an equivalent approach that also covers explicit `NULL` inserts).
5. Indexes:
   - Mirror the production indexes from the bottom of `ward-backend/db.js` (the `CREATE INDEX IF NOT EXISTS ...` statements).

Acceptance criteria for this step:
- Applying the migrations from an empty database results in:
  - All tables from `ward-backend/db.js`
  - Equivalent indexes
  - Equivalent tenant defaulting behavior for legacy rows where `tenantId` can be `NULL`

### 5. Dry-run the migration runner (sanity check)
From repo root:
1. `node ward-backend/migratePostgres.js --dry-run`

This must list the migration files you expect (including your new schema migrations).

### 6. Apply Postgres migrations
From repo root:
1. `node ward-backend/migratePostgres.js`

Acceptance criteria:
- Migration runner completes without errors.
- `SchemaMigrations` contains the applied migration names.

### 7. Import data from SQLite -> Postgres
Choose one import strategy and stick to it for the cutover window:

Option A (recommended for repeatability): per-table export/import
1. Export each table from SQLite to CSV/JSON.
2. Import into Postgres using `COPY` or batched inserts.
3. Verify row counts per table.

Option B: application-level rehydration
1. If you have an idempotent ingestion/export pipeline, re-run writes via the API.
2. This is slower but can preserve invariants enforced by service-layer logic.

Acceptance criteria:
- For every core table, row counts match (or differ only for acceptable deltas).
- Foreign key references reconcile (no orphaned rows beyond what the schema allows).

### 8. Switch runtime to PostgreSQL
1. Deploy backend with `DATABASE_URL` set.
2. Ensure frontend calls still use cookie auth:
   - Backend must have `cors({ origin, credentials: true })`.
   - Frontend `fetch` must use `credentials: 'include'` (already handled in `ward-frontend/src/utils/api.js`).

### 9. Validate the system (must pass before “resume full traffic”)
Run these validations:

1. Health checks
   - `GET /health` should indicate API is up.
   - When `DATABASE_URL` is set, `/health` should also include Postgres connectivity.

2. Tenant-scoped data sanity
   - Pick a known tenant and confirm key entities exist:
     - `Users`
     - `Patients`
     - `DailyStats`
     - `Medications`
     - `Tasks`
     - `HandoverNotes`
     - `AuditLogs`
     - `ClinicalChangeLog` (if present in your environment)

3. Tenant defaulting regression
   - Confirm that any legacy rows with `tenantId = NULL` now behave as if they belong to the default tenant.

Acceptance criteria:
- No 500s from schema-related errors.
- Core patient flows work (read at minimum): dashboard roster, patient detail tabs, vitals/history rendering.

## Rollback plan
Rollback means: stop using Postgres and restore SQLite state.

1. Stop the backend service that points to Postgres (`DATABASE_URL` set).
2. Restore SQLite DB from the backup created in Step 2.
3. Deploy backend with `DATABASE_URL` unset (or empty), forcing sqlite adapter.
4. Validate:
   - `GET /health` again shows SQLite is healthy.
   - UI flows render without data inconsistencies.

Operational note:
- Because this cutover is schema + data migration, a “partial” rollback (migrating only some steps) is not safe. Either complete the schema migrations + import, or do full restore + restart.

## Reference: why these steps match the code
- Adapter selection:
  - `ward-backend/dbAdapter/index.js` chooses Postgres adapter when `DATABASE_URL` is present.
- Migration runner:
  - `ward-backend/migratePostgres.js` applies `ward-backend/postgres-migrations/migrations/*.sql` in order, tracking applied names in `SchemaMigrations`.
- SQLite source of truth:
  - `ward-backend/db.js` defines all SQLite tables, tenant backfill triggers, and production indexes.

