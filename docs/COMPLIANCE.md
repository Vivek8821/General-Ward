# Compliance and audit posture (General Ward)

This document describes **what the application does today** in this repository. It is **not** legal or clinical compliance advice. Tune disclaimers for your jurisdiction and deployment.

## Audit trail

### What is logged

For **authenticated** HTTP API requests, after the response completes, a row may be inserted into the SQLite table `AuditLogs` (see `ward-backend/middleware/audit.js`).

Recorded fields include (when present): HTTP method (`action`), request path (`resource`), user id and role from the JWT, `tenantId`, client IP, HTTP status code, a success flag (2xx–3xx vs other), and timestamp.

### What is not logged

- **Unauthenticated** requests do not produce audit rows (the middleware skips when `req.user` is missing).
- **Request bodies** (e.g. clinical note text, passwords) are **not** stored in `AuditLogs`.
- The **`/health`** endpoint is excluded from audit logging.

## Export

Users with the **`admin`** role can list and export audit rows **for their tenant only** via:

- `GET /api/admin/audit-logs` (JSON, paginated)
- `GET /api/admin/audit-logs/export.csv` (CSV download)

See `ward-backend/routes/adminAudit.js` for query parameters (`limit`, `cursor`, `success`, `from`, `to`).

## Retention

Purging old audit rows is **tenant-scoped** and **admin-only**:

- `POST /api/admin/audit/purge` with JSON body `{ "dryRun": true|false, "olderThanDays": <n> }`  
  If `olderThanDays` is omitted, the server may use `AUDIT_RETENTION_DAYS` from the environment (when set to a positive integer). Otherwise the API returns an error for non–dry-run purges.

Use **dry run** first to see how many rows would be deleted.

## Backup and recovery (SQLite)

Operational recovery is primarily **file-based**:

- Main database file: `ward-backend/ward.db`
- With WAL mode enabled, also copy **`-wal`** and **`-shm`** files if they exist **while the app is stopped** (or use a SQLite backup API) for a consistent snapshot.

There is **no** built-in multi-site replication in this repo.

## Availability / SLA

In the default configuration (local Node + SQLite), **no uptime or recovery SLA is implied**. Production SLAs require your own hosting, monitoring, backups, and incident processes.

## Regulatory / product disclaimer

This software is a **demonstration / internal tooling** stack unless you validate it for your intended use. It is **not** presented as a certified medical device, a substitute for clinical judgment, or a guaranteed HIPAA/PHI/GDPR-compliant deployment out of the box. Perform your own risk analysis, agreements, and technical controls before handling real patient data.
