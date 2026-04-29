# Security logging guidance (PHI/PII safe)

This project may handle sensitive healthcare data. Logging must be treated as a potential data exfiltration channel.

## Rules

- **Never log request bodies** (`req.body`) or derived clinical note text.
  - This includes passwords/PINs, handover notes, diagnosis free text, allergies, etc.
- **Never log authorization secrets**:
  - JWTs, `Authorization` headers, cookies (`ward_token`), CSRF tokens.
- **Avoid logging query strings** (`?foo=bar`):
  - Query parameters can unintentionally carry identifiers or sensitive content.
  - Backend request/audit logs should store the **path without query**.
- **Prefer structured logs** with minimal fields:
  - method, path, status, duration, tenantId/userId (if needed), requestId.

## Code pointers

- Request logs: `ward-backend/middleware/requestLogger.js`
- Audit trail rows: `ward-backend/middleware/audit.js`
- Compliance posture: `docs/COMPLIANCE.md`

