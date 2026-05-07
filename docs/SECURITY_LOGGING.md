# Security Logging (PHI/PII Safe)

This project handles sensitive healthcare data. Logging is a potential data exfiltration channel and must follow these rules without exception.

## Rules

- **Never log request bodies** (`req.body`) or derived clinical text — passwords, handover notes, diagnosis free text, allergies, medication details.
- **Never log auth secrets** — JWTs, `Authorization` headers, cookies (`ward_token`), CSRF tokens.
- **Strip query strings** from all log entries — they can carry identifiers or sensitive content. Use `req.originalUrl.split('?')[0]` (already done in both middleware files below).
- **No patient identifiers in stdout logs** — patientId, MRN, name, DOB must not appear in the structured request log. They belong only in the DB audit trail, which is access-controlled.

## What IS logged

### Stdout (structured JSON via `utils/logger.js`)

Buffered, flushed every 2 s or at 50 entries. Written to stdout for ingestion by the host's log collector.

Fields per request line:

| Field | Source | Notes |
|---|---|---|
| `timestamp` | `new Date().toISOString()` | |
| `level` | `'info'` / `'warn'` / `'error'` | |
| `requestId` | `x-request-id` header or random UUID | Echoed back in response header |
| `method` | `req.method` | |
| `resource` | `req.originalUrl` with query stripped | |
| `statusCode` | `res.statusCode` | |
| `durationMs` | finish − start | |
| `userId` | `req.user?.id` | null for unauthenticated requests |
| `userRole` | `req.user?.role` | null for unauthenticated requests |

### DB Audit Trail (`AuditLogs` table via `middleware/audit.js`)

Persisted for every authenticated request except `GET /health`. Tenant-scoped.

Columns: `id`, `userId`, `userRole`, `tenantId`, `action` (HTTP method), `resource` (path, no query), `ipAddress`, `statusCode`, `success`.

Clinical events (observations, discharges, escalations) write additional rows via `ClinicalAuditService` with richer context — see `services/ClinicalAuditService.js`.

## Code pointers

- Stdout logger: `ward-backend/utils/logger.js`
- Request log middleware: `ward-backend/middleware/audit.js` (the `requestLogger` function)
- DB audit middleware: `ward-backend/middleware/audit.js` (the `auditLog` function)
- Clinical audit: `ward-backend/services/ClinicalAuditService.js`
- Compliance posture: `docs/COMPLIANCE.md`

## Adding new log calls

Use `logger.info/warn/error(message, context)` from `utils/logger.js`. Never pass `req.body`, `req.headers`, or any patient/user PII into the context object. If you need to log an error from a caught exception, log `err.message` only — not the full stack in production.
