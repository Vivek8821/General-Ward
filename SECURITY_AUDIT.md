# General Ward — Cybersecurity Audit Report

> **Audit date**: 2026-05-10  
> **Scope**: Full codebase (`ward-backend/`, `ward-frontend/`, `nginx/`, root configs)  
> **Methodology**: Manual source review of all auth, middleware, controllers, services, repositories, frontend API layer, and infrastructure configs.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| HIGH | 3 | Missing authorization checks, information disclosure |
| MEDIUM | 4 | Weak defaults, missing validation, trust boundary issues |
| LOW | 3 | Defense-in-depth gaps, documentation improvements |
| INFO | 2 | Observations worth noting |

---

## Findings

### HIGH-1: Missing RBAC authorization on purchase order endpoints

**File**: `ward-backend/controllers/PharmacyController.js:241,252`  
**Impact**: Any authenticated user (including nurses with only `READ_PHARMACY`) can list all purchase orders and change their status.

```js
// Line 241 — GET /api/pharmacy/orders — NO authorize()
router.get('/orders', authenticateToken, async (req, res) => { ... });

// Line 252 — PATCH /api/pharmacy/orders/:id/status — NO authorize()
router.patch('/orders/:id/status', authenticateToken, async (req, res) => { ... });
```

**Fix**: Add `authorize(PERMISSIONS.MANAGE_PHARMACY)` (or `READ_PHARMACY` for GET) to both route handlers.

---

### HIGH-2: Missing RBAC authorization on report routes

**File**: `ward-backend/routes/reports.js:28-29`  
**Impact**: Any authenticated user can generate tamper-evident clinical reports (PDF with patient data) and view report history — no role check.

```js
router.post('/patient/:patientId/generate', authenticateToken, requireTenantPatient('patientId'), reportLimiter, ...);
router.get('/patient/:patientId/history', authenticateToken, requireTenantPatient('patientId'), ...);
```

**Fix**: Add `authorize(PERMISSIONS.READ_PATIENT)` to both routes. Consider a more restrictive permission like `WRITE_PATIENT` for generation.

---

### HIGH-3: Postgres connection details leaked through health endpoint

**File**: `ward-backend/server.js:122-136`  
**Impact**: `GET /api/health/detail` returns `err.message` from Postgres connection failures to *authenticated* users, potentially revealing hostnames, credentials, or internal network topology.

```js
res.json({ status: 'ok', postgres: { enabled: true, ok: false, error: err.message } });
```

**Fix**: Return a generic message in production (`config.isProdLike`): `"Postgres health check failed"`.

---

### MEDIUM-1: Lockout bypass when database is unavailable

**File**: `ward-backend/controllers/AuthController.js:52-55`  
**Impact**: If `authLockoutRepository.tryAttempt()` throws (DB down, timeout), the login flow falls back to `reservation = { locked: false }`, bypassing lockout entirely. An attacker could deliberately trigger DB errors to brute-force credentials.

```js
try {
  reservation = await authLockoutRepository.tryAttempt(username, ipAddress);
} catch (_) {
  reservation = { locked: false };   // <-- bypass on any DB error
}
```

**Fix**: Reject login when lockout check fails: `return res.status(503).json({ error: 'Authentication temporarily unavailable' })`.

---

### MEDIUM-2: Development error handler exposes internal errors

**File**: `ward-backend/middleware/error.js:27-29`  
**Impact**: In `NODE_ENV=development`, full `err.message` is sent to the client. While this is useful for debugging, the test server script runs with `NODE_ENV=development`. If the test server were accidentally exposed to a network, internal errors would leak.

```js
if (process.env.NODE_ENV === 'development' || isOperational) {
  response.error = err.message;  // leaks internal details
}
```

**Fix**: The test server is local-only, so risk is low. However, consider using a separate flag (`SHOW_INTERNAL_ERRORS=true`) instead of `NODE_ENV=development` to prevent accidental exposure.

---

### MEDIUM-3: CSRF default-allow for unauthenticated requests

**File**: `ward-backend/middleware/csrf.js:24-26`  
**Impact**: Mutating endpoints that lack `authenticateToken` middleware will skip CSRF entirely (`if (!req.user) return next()`). If any mutation endpoint is accidentally added without auth, it would have no CSRF protection.

```js
if (!req.user) {
  return next();  // mutating request with no auth → CSRF skipped
}
```

**Fix**: Consider logging a warning when a mutation arrives without `req.user` (outside of the allowlist). This is a defense-in-depth concern — all mutating routes do require `authenticateToken`, so current risk is low.

---

### MEDIUM-4: No validation on PDF report input data

**File**: `ward-backend/services/PDFReportService.js`  
**Impact**: Patient name, MRN, diagnosis, medication names, notes, and other user-supplied data are rendered directly into a PDF via `pdfkit` without sanitization. While `pdfkit` does not execute code, certain control characters or extremely long strings could corrupt PDF output or cause resource exhaustion.

**Fix**: Truncate long strings to reasonable limits (e.g., 500 chars for notes) and strip control characters (`[\x00-\x1F]`) from PDF-bound text fields.

---

### LOW-1: CORS permissive in development/auto mode

**File**: `ward-backend/server.js:53-60`  
**Impact**: When `CORS_ORIGIN` is not set (default dev mode), the server reflects *any* origin with `credentials: true`. This is standard for local dev but should be clearly documented.

```js
return cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, false);
    return cb(null, origin);  // reflects any origin
  },
  credentials: true,
});
```

**Fix**: None required — this is intentional for dev. The config enforces explicit origins in production.

---

### LOW-2: No Content Security Policy in development mode

**File**: `ward-backend/server.js:68-88`  
**Impact**: `helmet({ contentSecurityPolicy: config.isProdLike ? { ... } : false })` disables CSP in non-production. Since the test server runs in development mode, there's no CSP protection during local testing.

**Fix**: Low priority — local dev only. Production CSP is properly configured.

---

### LOW-3: Error details returned from controller catch blocks

**File**: Multiple controllers  
**Impact**: Controllers often return `err.message` directly in 400/500 responses:

```js
// PatientController.js
catch (error) {
  res.status(400).json({ error: error.message }); // may leak DB errors
}
```

**Fix**: Wrap unknown errors with a generic message in production: `res.status(500).json({ error: 'Internal server error' })`.

---

### INFO-1: Rate limiting strategy is adequate

The rate limiting is well-implemented:
- **Login**: Express `rateLimit` (10 req / 15 min) + nginx (5 req / minute with burst=3) + DB-backed lockout (5 failed attempts → 15 min lockout)
- **Signup**: Express (5 req / hour) + nginx (2 req / minute)
- **Ingest**: Express (30 req / minute)
- **Reports**: Express (2 req / minute)
- **General API**: nginx (60 req / second with burst=20)
- All limiters use `standardHeaders: true`.

---

### INFO-2: Authentication and session hardening — strong

- JWT with HS256 algorithm only (no `none` algorithm risk) — `algorithms: ['HS256']`
- bcrypt cost factor 12 (adequate for current hardware)
- Token version (`tv`) check on every authenticated request prevents reuse of revoked tokens (logout, password change)
- `httpOnly` cookie prevents JS access
- `secure: true` in production
- `sameSite: 'lax'` in dev, `'none'` in prod
- CSRF double-submit with allowlist for login/signup
- DB-backed login lockout with atomic attempt reservation (increments counter *before* bcrypt to prevent race conditions)

---

## What's Strong

| Area | Assessment |
|-------|------------|
| Multi-tenant isolation | Every DB query scoped by `tenantId`. Enforced at route level by `tenant.js` middleware. Cross-tenant returns 403. |
| SQL injection prevention | All queries use parameterized statements (`?` placeholders via `dbAdapter`). No string concatenation found. |
| Dependency secrets | `JWT_SECRET` never hardcoded — checked at startup, server refuses to start without it. |
| CI security scanning | `npm audit --audit-level=high` runs in CI on both packages. |
| Helmet security headers | CSP, X-Frame-Options, X-Content-Type-Options active in production. |
| Proxy trust | `trust proxy` defaults to 0 — must be explicitly enabled to prevent IP spoofing. |
| XSS prevention | React's JSX auto-escapes output. No `dangerouslySetInnerHTML` or `innerHTML` found in frontend source. |
| Request body limit | `express.json({ limit: '512kb' })` prevents large-payload DoS. |
| Audit logging | Every mutating action logged to `AuditLogs` with userId, tenantId, IP, statusCode. |
| Immutable archives | `HospitalArchives` stores tamper-evident snapshots at discharge. Reports use HMAC-SHA256 with per-tenant derived keys. |
| CSRF token source | Stored in `sessionStorage` (not `localStorage`), transmitted as custom header for mutations. |

---

## Recommended Actions (Priority Order)

1. **Fix HIGH-1**: Add `authorize()` to pharmacy order endpoints — `PharmacyController.js:241,252`
2. **Fix HIGH-2**: Add `authorize()` to report endpoints — `routes/reports.js:28-29`
3. **Fix HIGH-3**: Mask Postgres errors in health endpoint — `server.js:131`
4. **Fix MEDIUM-1**: Reject login on lockout check failure — `AuthController.js:52-55`
5. **Fix MEDIUM-2**: Consider prod-safe error masking toggle — `error.js:27`
6. **Fix MEDIUM-4**: Add string sanitization for PDF-bound patient data — `PDFReportService.js`
7. **Fix LOW-3**: Wrap controller error responses with generic messages in production
