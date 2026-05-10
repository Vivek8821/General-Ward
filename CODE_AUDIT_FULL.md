# General Ward — Comprehensive Code Audit Report

> **Audit date**: 2026-05-10
> **Scope**: Full codebase — `ward-backend/`, `ward-frontend/`, `nginx/`, Docker configs, CI/CD
> **Methodology**: Manual line-by-line source review of all auth, middleware, controllers, services, repositories, frontend API layer, and infrastructure

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 6 | 2 new, 4 from prior audit (unresolved) |
| MEDIUM | 8 | 3 new, 5 from prior audit |
| LOW | 5 | 2 new, 3 from prior audit |
| INFO/BUG | 3 | Code correctness / latent bugs |

**npm audit**: 0 vulnerabilities (both backend and frontend) — clean dependency tree.

---

## HIGH Severity Findings

### HIGH-1: Missing RBAC on purchase order routes (UNRESOLVED from prior audit)

**File**: `ward-backend/controllers/PharmacyController.js:241,252`
**Impact**: Any authenticated user (nurse with `READ_PHARMACY`) can list purchase orders and change their status. An attacker could approve fake purchase orders.

```js
// Line 241 — NO authorize()
router.get('/orders', authenticateToken, async (req, res) => { ... });
// Line 252 — NO authorize()
router.patch('/orders/:id/status', authenticateToken, async (req, res) => { ... });
```

**Fix**: Add `authorize(PERMISSIONS.MANAGE_PHARMACY)` to both. Use `READ_PHARMACY` for GET.

---

### HIGH-2: Missing RBAC on report routes (UNRESOLVED from prior audit)

**File**: `ward-backend/routes/reports.js:28-29`
**Impact**: Any authenticated user can generate tamper-evident clinical reports (full PDF with all patient data) and view report history — no role check.

```js
router.post('/patient/:patientId/generate', authenticateToken, ...
router.get('/patient/:patientId/history', authenticateToken, ...
```

**Fix**: Add `authorize(PERMISSIONS.READ_PATIENT)` to both. Consider `WRITE_PATIENT` for generation.

---

### HIGH-3: Postgres connection details leaked in health endpoint (UNRESOLVED from prior audit)

**File**: `ward-backend/server.js:131`
**Impact**: `GET /api/health/detail` returns raw `err.message` from Postgres failures, potentially revealing hostnames, credentials, or internal topology.

```js
res.json({ status: 'ok', postgres: { ... ok: false, error: err.message } });
```

**Fix**: Mask error in production: return `"Postgres health check failed"`.

---

### HIGH-4 [NEW]: Hardcoded fallback HMAC secret for report verification

**File**: `ward-backend/services/ReportDataService.js:74`
**Impact**: If `JWT_SECRET` is somehow undefined, report HMAC falls back to the hardcoded string `'default-secret'`. This would make all report signatures trivially forgeable. While `config.js` throws if `JWT_SECRET` is missing at startup, this defensive fallback creates a single point of catastrophic failure.

```js
const globalSecret = config.jwtSecret || 'default-secret';  // DANGER
```

**Fix**: Remove the fallback. Crash if `jwtSecret` is falsy:

```js
if (!config.jwtSecret) throw new Error('[ReportDataService] JWT_SECRET required for report signing');
const globalSecret = config.jwtSecret;
```

---

### HIGH-5 [NEW]: Secret key exposed as module export

**File**: `ward-backend/middleware/auth.js:79`
**Impact**: `JWT_SECRET` is exported as a module-level variable and imported by `AuthService.js`. While both are in the same process, module-level export of cryptographic secrets increases the attack surface — any module that accidentally imports auth.js could leak the secret through logging, error messages, or supply-chain compromise.

```js
module.exports = { authenticateToken, attachUserIfPresent, extractToken, requireRole, JWT_SECRET };
```

**Fix**: Have `AuthService.js` import `config` directly (same pattern used in `ReportDataService.js:9`):

```js
// In AuthService.js
const { jwtSecret } = require('../config');
```

---

### HIGH-6 [NEW]: `req.connection` deprecated API with potential null dereference

**File**: `ward-backend/middleware/audit.js:24`
**Impact**: Uses the deprecated `req.connection.remoteAddress`. Under HTTP/2 or certain Node.js versions, `req.connection` may be undefined, causing audit logging to silently fail with `'unknown'` IP — losing forensic trail.

```js
const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
```

**Fix**:

```js
const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
```

---

## MEDIUM Severity Findings

### MEDIUM-1: Lockout bypass on database failure (UNRESOLVED from prior audit)

**File**: `ward-backend/controllers/AuthController.js:52-55`
**Impact**: If `authLockoutRepository.tryAttempt()` throws (DB down), reservation falls back to `{ locked: false }`, bypassing brute-force protection. An attacker who can trigger DB errors can brute-force credentials.

```js
try { reservation = await authLockoutRepository.tryAttempt(username, ipAddress); }
catch (_) { reservation = { locked: false }; }  // BYPASS
```

**Fix**: Return `503` on lockout check failure.

---

### MEDIUM-2: Development error handler exposes internal errors (UNRESOLVED)

**File**: `ward-backend/middleware/error.js:27-29`
**Impact**: In `development` mode, full `err.message` is sent to clients. The test server runs as `development`.

**Fix**: Use a separate environment variable (`SHOW_INTERNAL_ERRORS=true`) decoupled from NODE_ENV.

---

### MEDIUM-3: CSRF skipped for unauthenticated mutation requests (UNRESOLVED)

**File**: `ward-backend/middleware/csrf.js:24-26`
**Impact**: If a mutation route is ever added without `authenticateToken`, CSRF is silently skipped.

**Fix**: Log a warning when a mutation arrives without `req.user` outside the allowlist.

---

### MEDIUM-4: No sanitization on PDF-bound user data (UNRESOLVED)

**File**: `ward-backend/services/PDFReportService.js`
**Impact**: User-supplied strings (patient name, MRN, notes, medication names) are rendered directly into PDFs. Control characters or excessive lengths could corrupt PDFs or cause resource exhaustion. Currently, `express.json({ limit: '512kb' })` caps total request body, but individual string fields have no per-field length limits.

**Fix**: Truncate long strings (500 chars for notes, 200 for names) and strip control characters `[\x00-\x1F]` from PDF fields.

---

### MEDIUM-5 [NEW]: `tx.runAsync()` alias maps to wrong function in PostgreSQL adapter

**File**: `ward-backend/db-adapter.js:85`
**Impact**: In the PostgreSQL transaction wrapper, `wrappedClient.runAsync` is aliased to `wrappedClient.query` (returns `rows[]`) instead of `wrappedClient.execute` (returns `{ changes, lastID }`). Code in `BatchService.js:37` calls `tx.runAsync()` on INSERTs/UPDATEs but does not check the return value — so this currently works by accident. If any future code relies on `result.changes`, it would break silently in PostgreSQL mode.

```js
// db-adapter.js:85 — BUG
wrappedClient.runAsync = wrappedClient.query;  // Should be wrappedClient.execute
```

**Fix**:

```js
wrappedClient.runAsync = wrappedClient.execute;
```

---

### MEDIUM-6 [NEW]: No input validation on `limit` parameter for observation queries

**File**: `ward-backend/services/ObservationService.js:41`
**Impact**: The `limit` parameter is passed directly as `Number(limit)` with no upper bound. An attacker could request millions of observations, causing memory exhaustion on the server. The `dashboard.js` has proper `parseLimit()` (max 100), but observation queries have no cap.

```js
const rows = await observationRepository.findAllByPatientId(patientId, tenantId, {
  type,
  limit: limit ? Number(limit) : 200,  // No max enforced
  ...
});
```

**Fix**: Add a maximum limit (e.g., 1000):

```js
limit: Math.min(limit ? Number(limit) : 200, 1000),
```

---

### MEDIUM-7 [NEW]: Error details expose internal info in controller catch blocks

**File**: Multiple controllers (preexisting `LOW-3`, escalated)
**Impact**: Across all controllers, `err.message` is returned directly. Database error messages (SQLITE_CONSTRAINT, UNIQUE constraint violations) can leak table structure and field names. In `ObservationService.js:197`, even thrown errors are propagated raw. This is more severe than the prior LOW-3 rating because it includes database-layer error information leaks.

**Key locations**:
- `PatientController.js:33`: `res.status(400).json({ error: error.message })`
- `MedicationController.js:63`: `res.status(500).json({ error: err.message })`
- `tenant.js:24`: `res.status(500).json({ error: err.message })` — all 7 tenant middleware functions
- `ObservationService.js:197`: throws raw `err` with DB details

**Fix**: In production, mask non-operational errors:

```js
catch (err) {
  const msg = config.isProdLike && !err.isOperational
    ? 'Internal server error'
    : err.message;
  res.status(500).json({ error: msg });
}
```

---

### MEDIUM-8 [NEW]: Token fallback stores sensitive auth data in localStorage

**File**: `ward-frontend/src/context/AuthContext.jsx:62,76` and `ward-frontend/src/utils/api.ts:92-93`
**Impact**: User object and JWT are stored in `localStorage` (`ward_user`, `ward_token`). Any XSS vulnerability would expose the user's session identity (name, role, tenantId) to attackers. While the actual JWT is in an httpOnly cookie, the `localStorage` copy creates a secondary persistence that could be read by malicious scripts. The `ward_token` localStorage key at `api.ts:92` appears to be a legacy fallback that is cleared on 401.

```js
localStorage.setItem('ward_user', JSON.stringify(data.user));  // AuthContext.jsx:62
localStorage.removeItem('ward_token');  // api.ts:92 — legacy fallback
```

**Fix**: Use only the httpOnly cookie for session persistence. Remove localStorage `ward_user` completely, or scope it to `sessionStorage` (cleared on tab close). Remove the `ward_token` localStorage key entirely (it shouldn't exist — the token is cookie-based).

---

## LOW Severity Findings

### LOW-1: CORS permissive in development (ACKNOWLEDGED)

**File**: `ward-backend/server.js:53-60`
The `auto` CORS mode reflects any origin with `credentials: true`. Intentional for dev; enforced to `explicit` in production.

---

### LOW-2: No CSP in development (ACKNOWLEDGED)

**File**: `ward-backend/server.js:86`
CSP disabled in non-production. Production CSP is correctly configured.

---

### LOW-3 [NEW]: Unvalidated `from`/`to` date parameters in breach report

**File**: `ward-backend/routes/adminAudit.js:253-254`
**Impact**: While dates are validated for parseability, the SQL is constructed using string replacement of `T`/`Z` characters, not parameterized for the timestamp format conversion. An attacker could inject unexpected characters into the SQL string before parameterization.

```js
const sqlFrom = from.replace('T', ' ').replace('Z', '').slice(0, 19);
```

The values are then used as `?` parameters, so SQL injection is not possible. However, if the format is wrong, the query could return unexpected results or be exploited for data exfiltration through crafted date ranges.

**Fix**: Use proper date parsing and formatting:

```js
const sqlFrom = new Date(from).toISOString().replace('T', ' ').slice(0, 19);
```

---

### LOW-4 [NEW]: `.gitignore` incomplete — environment and database artifacts

**File**: `.gitignore`
**Impact**: The following are NOT in `.gitignore`:
- `ward-backend/.env` and `ward-backend/.env.test` (server env files)
- `*.env` (any environment files)
- `node_modules/` directories (these are covered by `npm ci` in CI but accidental commits are possible)
- `.DS_Store` (macOS artifacts)

**Fix**:

```
# Environment files
.env
*.env
!.env.example

# macOS
.DS_Store
```

Note: `node_modules/` is typically in a monorepo `.gitignore`, but should be verified.

---

### LOW-5 [NEW]: `logBuffer` shared mutable state with no concurrency control

**File**: `ward-backend/utils/logger.js:9`
**Impact**: The `logBuffer` array is a module-level mutable variable. Under concurrent requests, multiple `push()` operations interleave. While JavaScript is single-threaded for synchronous code, the `flush()` function runs on a timer and reads `logBuffer` while async operations may be pushing to it. This could cause log entries to be lost during the flush window.

**Fix**: Use a swap-then-flush pattern or a proper async queue.

---

## Code Correctness Issues (Bugs)

### BUG-1: PostgreSQL `runAsync` alias maps to wrong function
**File**: `ward-backend/db-adapter.js:85` | See MEDIUM-5 above.

### BUG-2: PDF page-range computation after PDFKit `end()`
**File**: `ward-backend/services/PDFReportService.js:236`
`doc.bufferedPageRange()` is called before `doc.end()` (called on line 73 after `_drawGlobalFooters` on line 71). With PDFKit, `bufferedPageRange()` called before `end()` may return inaccurate page counts. This does not affect security but causes incorrect "Page X of Y" numbering.

**Fix**: Call `_drawGlobalFooters` inside a `doc.on('end', ...)` listener, or use a different approach to count pages.

### BUG-3: `collectFullPatientSnapshot` accesses unaliased `db` functions
**File**: `ward-backend/repositories/PatientRepository.js:15-30`
The internal function `collectFullPatientSnapshot` takes a `db` parameter that is expected to have `.get()`, `.all()` methods. This is called from `discharge()` with `const db = { run, get, all }` (line 239), but `all` is a compatibility alias. In PostgreSQL mode, the wrapped `db.all` maps to `wrappedClient.all` which maps to `wrappedClient.query`. This should work correctly.

---

## Architecture & Design Observations

### What's Strong

| Area | Assessment |
|------|------------|
| **Multi-tenant isolation** | Every DB query scoped by `tenantId`. 7 middleware functions enforce tenant boundaries. Cross-tenant returns 403. |
| **SQL injection prevention** | 100% parameterized queries via `?` placeholders. No string concatenation in any repository. |
| **JWT security** | Algorithm locked to `HS256`. Token version (`tv`) checked on every request prevents replay of revoked tokens. |
| **Password hashing** | bcrypt cost factor 12. Atomic attempt reservation pattern prevents race conditions in brute-force counter. |
| **CSRF protection** | Double-submit cookie pattern. Stored in `sessionStorage`. Exempt list for login/signup. |
| **Rate limiting** | 3-layer defense: Express in-memory + nginx + DB-backed lockout. Login: 10/15min (Express) + 5/min (nginx) + 5 attempts → 15min lockout (DB). |
| **Helmet + CSP** | Production CSP with strict directives. `trust proxy` defaults to 0 to prevent IP spoofing. |
| **Audit trail** | HTTP-level (`AuditLogs`) + domain-level (`ClinicalChangeLog`). Immutable `HospitalArchives` at discharge. |
| **HMAC report signing** | Per-tenant derived keys for report signatures. Canonical JSON serialization. |
| **Pharmacy integrity** | Immutable transaction ledger. FEFO dispensing. 2-step witness waste workflow. |
| **Docker security** | Backend runs as non-root `ward` user. Multi-stage builds. Alpine-based minimal images. |
| **CI/CD** | Backend Jest + Frontend ESLint/Vitest/build + `npm audit --audit-level=high` on both. |
| **No XSS** | React JSX auto-escaping. No `dangerouslySetInnerHTML` found. |
| **Request size limits** | `express.json({ limit: '512kb' })`. nginx `client_max_body_size 1m`. |

### Architecture Concerns

1. **SQLite WAL mode in production-adjacent code**: `db.js:10` sets WAL mode. If `ward.db` exists on disk when switching to PostgreSQL, the SQLite code path still initializes. The `db-adapter.js` correctly routes based on `DB_DIALECT`, but the SQLite `db.js` module is always loaded (line 1), potentially creating an empty `ward.db` file even when PostgreSQL is configured.

2. **No PostgreSQL connection pool health monitoring**: `db-postgres.js` has `pool.on('error')` for unexpected errors, but no proactive health check or reconnection logic. If a pooled connection becomes stale, queries will fail until the pool times out the connection.

3. **Single global transaction queue for SQLite** (`db.js:23-68`): Serializes ALL transactions. While correct for SQLite's single-writer limitation, a long-running transaction (e.g., bulk import) blocks all other writes.

4. **No SSR/CSR fallback for initial load**: The frontend SPA relies on client-side rendering. A brief loading state is shown while `AuthContext` validates the session via `GET /api/auth/me`. If the API is slow, users see a blank screen.

---

## Recommendations Summary (Priority Order)

1. **Fix HIGH-4**: Remove hardcoded HMAC fallback — `ReportDataService.js:74`
2. **Fix HIGH-5**: Stop exporting `JWT_SECRET` — `auth.js:79`
3. **Fix HIGH-1**: Add RBAC to purchase order routes — `PharmacyController.js:241,252`
4. **Fix HIGH-2**: Add RBAC to report routes — `routes/reports.js:28-29`
5. **Fix HIGH-3**: Mask Postgres errors in health endpoint — `server.js:131`
6. **Fix HIGH-6**: Update deprecated `req.connection` — `audit.js:24`
7. **Fix MEDIUM-5**: Fix PostgreSQL `runAsync` alias — `db-adapter.js:85`
8. **Fix MEDIUM-6**: Cap observation query limit — `ObservationService.js:41`
9. **Fix MEDIUM-1**: Reject login on lockout check failure — `AuthController.js:52-55`
10. **Fix MEDIUM-7**: Mask internal errors in production across all controllers
11. **Fix MEDIUM-4**: Sanitize PDF-bound strings — `PDFReportService.js`
12. **Fix MEDIUM-8**: Remove localStorage session data — `AuthContext.jsx` + `api.ts`
13. **Fix BUG-2**: Correct PDF page numbering — `PDFReportService.js:236`
14. **Fix LOW-4**: Complete `.gitignore` entries
15. **Fix LOW-5**: Make logger thread-safe — `logger.js:9`
