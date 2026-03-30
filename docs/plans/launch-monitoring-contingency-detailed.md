# Launch monitoring & contingency — detailed execution plan (Phases M → C)

**Authoritative copy** for crash recovery: keep this file and [`launch-monitoring-contingency-PROGRESS.md`](./launch-monitoring-contingency-PROGRESS.md) in sync after **every** numbered step.

**Codemap / navigation (before each phase):**

- [codemap/CODEMAP.md](../../codemap/CODEMAP.md) — architecture, feature workflows, data model pointer
- [ward-backend/CODENAV.md](../../ward-backend/CODENAV.md) — API surface, route nesting
- [ward-frontend/CODENAV.md](../../ward-frontend/CODENAV.md) — routes, auth context, api.ts
- [docs/COMPLIANCE.md](../../docs/COMPLIANCE.md) — audit logs, disclaimers
- [docs/runbooks/stress-test-gate.md](../../docs/runbooks/stress-test-gate.md) — stress procedure
- [docs/plans/enterprise-hardening-PROGRESS.md](./enterprise-hardening-PROGRESS.md) — prior hardening context

---

## 0. Verified baseline (accuracy checklist — no hallucinations)

Every statement below was verified by reading the actual source files in this repository on 2026-03-30.

| Item | Location | Verified state |
|------|----------|----------------|
| Structured JSON request logs | [ward-backend/middleware/requestLogger.js](../../ward-backend/middleware/requestLogger.js) | One JSON line per response to stdout: `requestId`, `method`, `resource`, `statusCode`, `durationMs`, `userId`, `userRole` |
| DB audit trail | [ward-backend/middleware/audit.js](../../ward-backend/middleware/audit.js) | Inserts into `AuditLogs` for authenticated requests (skips `/health`). Fields: `id`, `userId`, `userRole`, `tenantId`, `action`, `resource`, `ipAddress`, `statusCode`, `success` |
| Health endpoints | [ward-backend/server.js](../../ward-backend/server.js) | `GET /health` → `{ status: 'ok' }` (public); `GET /api/version` → `{ backendVersion }` (public); `GET /api/health/detail` → `{ status, postgres }` (authenticated) |
| Auth flow | [ward-backend/controllers/AuthController.js](../../ward-backend/controllers/AuthController.js) | `POST /api/auth/login` (rate limited 100/15min), `POST /api/auth/logout`, `GET /api/auth/me`; JWT httpOnly cookie `ward_token`; account lockout via `AuthLockoutRepository` |
| Payment processing | *(none)* | **No payment SDKs, no billing routes, no webhook handlers exist in the codebase** |
| User signup/registration | *(none)* | **No self-service signup**; users created via `seed.js` or direct DB insert |
| Onboarding milestones | *(none)* | **No product onboarding wizard**; clinical workflows are: patient registration, vitals, medications, escalations, tasks, handover, discharge |
| Feature flags / kill switches | *(none)* | **None exist**; only env vars for lockout tuning (`LOGIN_MAX_FAILED_ATTEMPTS`, etc.) |
| Global error handler | *(none)* | **No** Express `(err, req, res, next)` handler in `server.js`; per-route try/catch only |
| Monitoring/APM | *(none)* | **No** Sentry, Datadog, Prometheus, Grafana, PagerDuty, or OpenTelemetry |
| Stress test | [ward-backend/stressEverything.js](../../ward-backend/stressEverything.js) | 20s, 10 workers; pass criteria: `server5xx=0`, `timeouts=0`, `fetchErrors=0`, `p95<200ms` |
| DB engine | [ward-backend/dbAdapter/index.js](../../ward-backend/dbAdapter/index.js) | SQLite default; Postgres when `DATABASE_URL` is set |
| CSRF | [ward-backend/middleware/csrf.js](../../ward-backend/middleware/csrf.js) | JWT `csrf` claim + `X-CSRF-Token` header for mutations |
| Tenant isolation | [ward-backend/middleware/tenant.js](../../ward-backend/middleware/tenant.js) | `requireTenantPatient`, `requireTenantTask`, etc. |

---

## 1. Scope adaptation (what the checklist means for General Ward)

The original launch checklist targets a SaaS product with payments and user signup. General Ward is a **clinical ward management system** without billing or self-service registration. The plan adapts each item to what is real and actionable.

| Original checklist item | Adaptation for General Ward |
|-------------------------|----------------------------|
| Authentication/signup success rates | **Login + signup success/failure rates** — signup and staff registration added via [signup-payment plan](./signup-payment-detailed.md) |
| Server health (uptime, latency, error rate) | Direct match — build on existing `/health` and `requestLogger.js` |
| Payment processing success/failure | **Razorpay subscription events** — integrated via [signup-payment plan](./signup-payment-detailed.md); monitoring activates when webhook events flow through `SubscriptionEvents` table |
| Conversion across onboarding milestones | **Clinical workflow completion rates** — patient admission → vitals → medication → discharge; **plus signup funnel** — org signup → payment → staff invite → staff register |
| Alerts for critical failures | Direct match — build alerting on the metrics collected above |
| Kill switches | Direct match — build feature flag middleware from scratch |
| Rollback plan | Direct match — document and test rollback procedures |
| Escalation protocols | Direct match — define who does what |
| Pre-written communications | Direct match — prepare templates for known failure modes |
| Team roles | Direct match — define and document |

---

## 2. PROGRESS file (mandatory)

Create/update [launch-monitoring-contingency-PROGRESS.md](./launch-monitoring-contingency-PROGRESS.md) with:

- **Last completed step:** e.g. `M1.2`
- **Interrupted at:** file list + partial intent if crash mid-step
- **Blockers:** errors, failed tests, decisions needed
- **Log table:** date | step | outcome | verifier | notes
- **Rollback:** env values, git ref, or file state pointer

---

## 3. Execution protocol

1. **One step only** per session slice; commit or PROGRESS entry before the next.
2. **Confirm** each step: all checkboxes in that step's "Acceptance" section must pass.
3. **Stress test** after each step (minimum):
   - **Frontend touch:** `cd ward-frontend && npm run lint && npm run build`
   - **Backend touch:** `cd ward-backend && npm test`
   - **Stress gate:** `cd ward-backend && node stressEverything.js` — pass criteria from [stress-test-gate.md](../../docs/runbooks/stress-test-gate.md)
   - **Manual smoke:** login with seed user; one read + one write on the touched workflow
4. **No hallucinated paths:** if a file is not listed in codemap, open it and verify before referencing.
5. **Crash recovery:** before and after every numbered step, fill in the checkpoint template in the PROGRESS file.

---

## 4. Stress test matrix (copy per phase)

| Check | Command / action | Pass | Date |
|-------|------------------|------|------|
| Lint | `cd ward-frontend && npm run lint` | ☐ | |
| Build | `cd ward-frontend && npm run build` | ☐ | |
| Backend tests | `cd ward-backend && npm test` | ☐ | |
| Stress | `cd ward-backend && node stressEverything.js` | ☐ (5xx=0, timeouts=0) | |
| Login smoke | Browser: doctor seed user login/logout | ☐ | |
| Workflow smoke | One patient create + one vitals entry | ☐ | |

---

## Phase M1 — Server health monitoring (uptime, latency, error rate)

**Goal:** Make server health visible in real-time. Build a metrics collection layer on top of the existing `requestLogger.js` structured JSON logs and `/health` endpoint.

### M1.0 Snapshot (read-only)

- Record current `requestLogger.js` output format in PROGRESS.
- Record current `/health`, `/api/version`, `/api/health/detail` response shapes in PROGRESS.
- Verify backend test count: `cd ward-backend && npm test -- --listTests`.

**Acceptance:** PROGRESS rollback section filled; no code changes.

### M1.1 Global Express error handler

**Files:** [ward-backend/server.js](../../ward-backend/server.js)

**Problem:** Currently no `(err, req, res, next)` handler. Unhandled errors in async routes that escape try/catch will crash the process or return no response.

**Implementation:**

1. After all route mounts (after line 97 in `server.js`), add a global error-handling middleware:
   - Log: `console.error` with `requestId`, stack trace, and timestamp.
   - Respond: `500 { error: 'Internal server error', requestId }` — never leak stack to client.
   - Increment an in-memory error counter (used by M1.3).
2. Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers that log and **do not** crash the process (log + counter, not `process.exit`).

**Edge cases:**
- Double-send: check `res.headersSent` before calling `res.status(500).json(...)`.
- Async route errors in Express 5: Express 5 natively handles rejected promises from async route handlers and passes them to the error middleware — verify this by checking Express 5 docs. If using Express 4, would need `express-async-errors` but this project uses Express 5 (`"express": "^5.2.1"`).

**Acceptance:**
- `npm test` passes.
- Manual: introduce a deliberate throw in a route (temporary), confirm 500 JSON response with `requestId`, remove throw.

### M1.2 In-memory metrics collector

**Files:** New file `ward-backend/middleware/metricsCollector.js`

**Purpose:** Collect real-time request metrics in memory (no external dependency). These will be exposed via a metrics endpoint (M1.3) and used by the admin dashboard (M1.5).

**Implementation:**

1. Create a singleton metrics store that tracks (in memory, reset on restart):
   - `totalRequests` (counter)
   - `statusCodeHistogram` (object: `{ '200': N, '401': N, '500': N, ... }`)
   - `latencyHistogram` (buckets: `<50ms`, `<100ms`, `<200ms`, `<500ms`, `<1000ms`, `>1000ms`)
   - `errorCount5xx` (counter)
   - `errorCount4xx` (counter)
   - `activeRequests` (gauge — increment on request start, decrement on finish)
   - `uptimeStartedAt` (timestamp — set once on module load)
   - Rolling window arrays (last 60 data points, one per minute) for:
     - `requestsPerMinute`
     - `avgLatencyPerMinute`
     - `errorsPerMinute`
2. Middleware function that hooks into `res.on('finish')` similar to `requestLogger.js`:
   - Increment counters.
   - Record latency into histogram.
   - Push to rolling window arrays (aggregate per minute via a `setInterval(60000)` tick).
3. Export a `getMetrics()` function that returns the current snapshot.
4. Export a `recordCustomEvent(eventType, data)` function for non-HTTP events (used by M2 for login metrics).

**Design decisions:**
- **In-memory only** — no Redis/external store needed. Metrics reset on restart; that's acceptable for a first launch (persistent metrics require Prometheus/TimescaleDB and is out of scope for this phase).
- Rolling window capped at 60 entries (1 hour of per-minute data) to avoid memory growth.
- Thread-safe: Node.js is single-threaded, so no mutex needed.

**Edge cases:**
- Server restart resets all counters — document this in the metrics response (`uptimeStartedAt`).
- Very high traffic: histogram bucket increments are O(1), no memory growth concern.

**Acceptance:**
- `npm test` passes.
- `node stressEverything.js` passes.
- Manual: after a few requests, `getMetrics()` returns non-zero values.

### M1.3 Metrics & health API endpoints

**Files:** New file `ward-backend/routes/monitoring.js`, modify [ward-backend/server.js](../../ward-backend/server.js)

**Implementation:**

1. Create `ward-backend/routes/monitoring.js` with:
   - `GET /api/monitoring/metrics` — **admin-only** (`authenticateToken` + `requireRole(['admin'])`):
     Returns `getMetrics()` snapshot: counters, histograms, rolling windows, uptimeStartedAt, current timestamp.
   - `GET /api/monitoring/health` — **public**, extended liveness check:
     Returns `{ status: 'ok'|'degraded'|'down', uptime: seconds, activeRequests: N, errorRate5xxLastMinute: N }`.
     Status logic:
     - `'ok'`: error rate < 5% in last minute
     - `'degraded'`: error rate >= 5% and < 20%
     - `'down'`: error rate >= 20% or DB check fails
   - `GET /api/monitoring/features` — **admin-only**: returns current feature flag states (built in Phase C1).
2. Mount in `server.js`: `app.use('/api/monitoring', monitoringRoutes)`.
3. Apply the metrics collector middleware globally (after `requestLogger` in the middleware chain).

**Edge cases:**
- Zero requests in the last minute: error rate = 0%, status = `'ok'`.
- `/api/monitoring/health` must not require auth (used by external uptime monitors, load balancers).
- Limit response size: rolling window data is max 60 entries × 3 fields = small.

**Acceptance:**
- `npm test` passes.
- `curl http://localhost:3001/api/monitoring/health` returns JSON with status field.
- Stress test passes; metrics endpoint returns non-zero data afterward.
- Admin login → `GET /api/monitoring/metrics` returns full snapshot.

### M1.4 Backend test coverage for monitoring

**Files:** New test file `ward-backend/tests/integration/monitoring.test.js`

**Implementation:**

1. Test `GET /api/monitoring/health` — public, returns `{ status: 'ok', uptime, activeRequests, errorRate5xxLastMinute }`.
2. Test `GET /api/monitoring/metrics` — requires admin auth; returns counters, histograms.
3. Test `GET /api/monitoring/metrics` — returns 401 without token, 403 for non-admin.
4. Test that after a request, `totalRequests` counter increments.

**Acceptance:**
- `npm test` passes with new tests included.
- No existing test broken.

### M1.5 Admin monitoring dashboard (frontend)

**Files:** New view `ward-frontend/src/views/MonitoringDashboard.jsx`, modify route configuration

**Implementation:**

1. Create `MonitoringDashboard.jsx` — admin-only view:
   - **Server Health Card**: uptime, current status (ok/degraded/down with color indicator), active requests.
   - **Request Rate Chart**: line chart (Recharts — already in `ward-frontend/package.json`) showing `requestsPerMinute` from rolling window.
   - **Latency Chart**: line chart showing `avgLatencyPerMinute`.
   - **Error Rate Chart**: line chart showing `errorsPerMinute`, with a red threshold line at 5%.
   - **Status Code Distribution**: bar chart from `statusCodeHistogram`.
   - **Auto-refresh**: `useQuery` with `refetchInterval: 15000` (15 seconds) — follows existing pattern in `Dashboard.jsx` and `Tasks.jsx`.
2. Add route in the app router (admin-only gated by role check in `AuthContext`).
3. Add navigation link in the admin section (wherever admin links exist — verify in `AdminAudit.jsx` or navigation component).

**Edge cases:**
- Empty data on first load (server just started): show "No data yet" placeholder, not a broken chart.
- Non-admin user: route should redirect to dashboard or show "Unauthorized".
- Charts must handle zero values without NaN or visual glitches.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Admin login → navigate to monitoring dashboard → see live charts updating.
- Doctor/nurse login → monitoring route not accessible.

---

## Phase M2 — Authentication monitoring (login success/failure rates)

**Goal:** Track login attempts, success rates, failure reasons, and lockout events. Make these visible in the monitoring dashboard.

### M2.0 Snapshot (read-only)

- Record current `AuthController.js` login flow in PROGRESS (line numbers, response codes).
- Record current `AuthLockoutRepository.js` behavior (env vars, window, max attempts).
- Note: **no signup exists** — monitoring is login-only.

**Acceptance:** PROGRESS snapshot filled; no code changes.

### M2.1 Login event recording

**Files:** [ward-backend/controllers/AuthController.js](../../ward-backend/controllers/AuthController.js), [ward-backend/middleware/metricsCollector.js](../../ward-backend/middleware/metricsCollector.js) (from M1.2)

**Implementation:**

1. In `metricsCollector.js`, add auth-specific counters:
   - `authLoginAttempts` (counter)
   - `authLoginSuccess` (counter)
   - `authLoginFailure` (counter)
   - `authLoginLockout` (counter — when `429` returned due to lockout)
   - `authLoginRolling` — rolling window (last 60 minutes, per-minute): `{ attempts, successes, failures, lockouts }`
   - Derived: `authSuccessRate` = `authLoginSuccess / authLoginAttempts * 100` (computed on read, not stored)
2. In `AuthController.js` `POST /login`:
   - After successful login (line 53-55): call `recordCustomEvent('auth.login.success', { userId, role })`.
   - After failed login (line 56-66): call `recordCustomEvent('auth.login.failure', { username, reason: 'invalid_credentials' })`.
   - After lockout (line 48-49): call `recordCustomEvent('auth.login.lockout', { username, ipAddress })`.
3. `recordCustomEvent` in the collector increments the appropriate counters and pushes to the rolling window.

**Edge cases:**
- Rate-limited request (429 from `express-rate-limit` before hitting the handler): these are **not** login failures — they never reach the handler. Document this limitation in PROGRESS.
- Lockout vs credential failure: distinguish clearly; lockout means the user *may* have valid credentials but is blocked by policy.
- `username` logging: store for metrics but **never** log passwords. Only log `username` (which is not PHI in the General Ward context — it's a staff username like `doc_carter`).

**Acceptance:**
- `npm test` passes.
- Manual: login with wrong password → `authLoginFailure` increments. Login correctly → `authLoginSuccess` increments.

### M2.2 Auth metrics in monitoring endpoint

**Files:** [ward-backend/routes/monitoring.js](../../ward-backend/routes/monitoring.js) (from M1.3)

**Implementation:**

1. Extend `GET /api/monitoring/metrics` response to include:
   ```json
   {
     "auth": {
       "loginAttempts": N,
       "loginSuccess": N,
       "loginFailure": N,
       "loginLockouts": N,
       "successRate": N.N,
       "rolling": [ { "minute": "ISO", "attempts": N, "successes": N, "failures": N, "lockouts": N } ]
     }
   }
   ```

**Acceptance:**
- `npm test` passes (update monitoring test from M1.4 to assert `auth` field).
- After login attempts, metrics endpoint reflects accurate counts.

### M2.3 Auth monitoring in dashboard (frontend)

**Files:** [ward-frontend/src/views/MonitoringDashboard.jsx](../../ward-frontend/src/views/MonitoringDashboard.jsx) (from M1.5)

**Implementation:**

1. Add an **Auth Health** section to the monitoring dashboard:
   - **Success Rate Gauge**: large number display — green >95%, yellow 80-95%, red <80%.
   - **Login Activity Chart**: stacked area chart (Recharts) showing successes vs failures over the rolling window.
   - **Lockout Indicator**: if `loginLockouts > 0` in last 5 minutes, show a yellow warning badge.
   - **Current Session Count**: derive from `authLoginSuccess - authLoginFailure` is wrong; instead show total successful logins in session (since server start).

**Edge cases:**
- Zero login attempts (server just started): show "No login activity" instead of `NaN%`.
- Very high failure rate: don't crash the chart component with extreme axis values.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Admin sees auth metrics updating after login attempts.

---

## Phase M3 — Clinical workflow milestone tracking

**Goal:** Track conversion/completion rates across the clinical workflow: patient admission → vitals recorded → medication prescribed → escalation handled → discharge. This replaces "onboarding milestone conversion" from the original checklist.

### M3.0 Design checkpoint (PROGRESS, before code)

Document in PROGRESS:

- **Milestone definitions** (derived from existing API routes):
  1. `patient.admitted` — `POST /api/patients` (patient created)
  2. `vitals.recorded` — `POST /api/patients/:id/stats` with type containing vitals
  3. `medication.prescribed` — `POST /api/patients/:id/medications`
  4. `medication.administered` — `POST /api/patients/:id/medications/:medId/administer`
  5. `escalation.created` — `POST /api/patients/:patientId/escalations`
  6. `escalation.reviewed` — `POST /api/patients/:patientId/escalations/:id/review`
  7. `task.created` — `POST /api/patients/:id/tasks`
  8. `task.completed` — `PUT /api/tasks/:taskId/complete`
  9. `patient.discharged` — `POST /api/patients/:id/discharge`
- **Funnel metric**: For patients admitted in the last 24h, what % have at least one vitals recording? At least one medication? Successfully discharged?

**Acceptance:** PROGRESS design section filled; no code changes.

### M3.1 Workflow event recording

**Files:** [ward-backend/middleware/metricsCollector.js](../../ward-backend/middleware/metricsCollector.js), multiple route/controller files

**Implementation:**

1. In `metricsCollector.js`, add:
   - `workflowEvents` counter object: `{ 'patient.admitted': N, 'vitals.recorded': N, ... }` for each milestone.
   - `workflowRolling` — per-minute rolling window for each event type (last 60 minutes).
2. Add `recordCustomEvent('workflow.<event>', { patientId, tenantId })` calls in the relevant route handlers:
   - `POST /api/patients` success → `workflow.patient.admitted` — in [PatientController.js](../../ward-backend/controllers/PatientController.js) after line ~31.
   - `POST /api/patients/:id/stats` success → `workflow.vitals.recorded` — in [stats.js](../../ward-backend/routes/stats.js) after successful insert.
   - `POST /api/patients/:id/medications` success → `workflow.medication.prescribed` — in [medications.js](../../ward-backend/routes/medications.js) after successful insert.
   - `POST /api/patients/:id/medications/:medId/administer` success → `workflow.medication.administered` — in [medications.js](../../ward-backend/routes/medications.js) after successful administer.
   - `POST /api/patients/:patientId/escalations` success → `workflow.escalation.created` — in [EscalationController.js](../../ward-backend/controllers/EscalationController.js).
   - `POST /api/patients/:patientId/escalations/:id/review` success → `workflow.escalation.reviewed` — in [EscalationController.js](../../ward-backend/controllers/EscalationController.js).
   - `POST /api/patients/:id/tasks` success → `workflow.task.created` — in [patientTasks.js](../../ward-backend/routes/patientTasks.js).
   - `PUT /api/tasks/:taskId/complete` success → `workflow.task.completed` — in [tasks.js](../../ward-backend/routes/tasks.js).
   - `POST /api/patients/:id/discharge` success → `workflow.patient.discharged` — in [PatientController.js](../../ward-backend/controllers/PatientController.js).

**Edge cases:**
- Only record **after** the DB operation succeeds (not before, not on error).
- Idempotent observations via `/api/observations/ingest` — these are vitals from devices, not manual entries. Decide whether to count these as `vitals.recorded` or keep separate. **Decision: count them separately as `vitals.ingested`** to avoid double-counting.
- Duplicate admin events from the nested `/api/escalations/` mount (without `patientId`) — the POST on that path likely errors out (see baseline audit); only count from the nested patient path.

**Acceptance:**
- `npm test` passes.
- Stress test passes (event recording must not slow down requests).
- Manual: create a patient → check metrics → `patient.admitted` incremented.

### M3.2 Workflow metrics in monitoring endpoint

**Files:** [ward-backend/routes/monitoring.js](../../ward-backend/routes/monitoring.js)

**Implementation:**

1. Extend `GET /api/monitoring/metrics` response to include:
   ```json
   {
     "workflow": {
       "events": { "patient.admitted": N, "vitals.recorded": N, ... },
       "rolling": { "patient.admitted": [ { "minute": "ISO", "count": N } ], ... }
     }
   }
   ```

**Acceptance:**
- Updated monitoring test asserts `workflow` field exists.
- After clinical actions, metrics reflect correct counts.

### M3.3 Workflow funnel in dashboard (frontend)

**Files:** [ward-frontend/src/views/MonitoringDashboard.jsx](../../ward-frontend/src/views/MonitoringDashboard.jsx)

**Implementation:**

1. Add **Clinical Workflow** section:
   - **Funnel Bar Chart**: horizontal bar chart showing event counts — admitted → vitals → meds → escalations → discharge.
   - **Activity Timeline**: line chart showing per-minute event rates from rolling window.
   - **Completion Rate**: if `patient.admitted > 0`, show `discharged / admitted * 100%` (note: this is a rough metric since discharge may happen days later — label it "since server start").

**Edge cases:**
- Discharge rate > 100% is possible if server restarted after admissions but before discharges — show as-is with a note "metrics since last restart".

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Admin sees workflow metrics in dashboard.

---

## Phase M4 — Payment & signup monitoring

**Goal:** Monitor Razorpay subscription events and signup funnel. Depends on [signup-payment plan](./signup-payment-detailed.md) being executed first (Phases S1–P1 minimum). If signup/payment phases are not yet complete, this phase creates the scaffolding that activates automatically once they are.

### M4.1 Payment and signup event tracking in metrics collector

**Files:** [ward-backend/middleware/metricsCollector.js](../../ward-backend/middleware/metricsCollector.js)

**Implementation:**

1. Add payment-specific counter structure:
   - `paymentAttempts`, `paymentSuccess`, `paymentFailure`, `paymentHalted`
   - `paymentRolling` — per-minute window (same pattern as auth and workflow)
   - `enabled` flag: `true` when `RAZORPAY_KEY_ID` env var is set (from `isPaymentEnabled()` in [razorpay.js](../../ward-backend/services/razorpay.js))
2. Add signup-specific counters:
   - `signupOrgAttempts`, `signupOrgSuccess`, `signupOrgFailure`
   - `signupStaffAttempts`, `signupStaffSuccess`, `signupStaffFailure`
   - `signupRolling` — per-minute window for org and staff signups
3. Wire into:
   - Webhook handler ([webhooks.js](../../ward-backend/routes/webhooks.js)): `recordCustomEvent('payment.charged')` on `subscription.charged`, `recordCustomEvent('payment.failed')` on `payment.failed`, etc.
   - Signup controller ([SignupController.js](../../ward-backend/controllers/SignupController.js)): `recordCustomEvent('signup.org.success')` / `recordCustomEvent('signup.org.failure')` after org signup; same for staff registration.
4. In `GET /api/monitoring/metrics`, include:
   ```json
   {
     "payment": {
       "enabled": true,
       "attempts": N, "success": N, "failure": N, "halted": N,
       "successRate": N.N
     },
     "signup": {
       "org": { "attempts": N, "success": N, "failure": N },
       "staff": { "attempts": N, "success": N, "failure": N },
       "rolling": [...]
     }
   }
   ```

**Edge cases:**
- Payment features not configured: `payment.enabled = false`, all counters stay at 0.
- Signup features not yet built: signup counters stay at 0 (no signup routes to fire events).

**Acceptance:**
- `npm test` passes.
- If signup/payment routes exist: events tracked correctly after signup and webhook.
- If not yet built: metrics endpoint returns zero counters gracefully.

---

## Phase M5 — Alert system for critical failures

**Goal:** Configure alerts that can notify the team when critical thresholds are breached. Since no external alerting service (PagerDuty, OpsGenie) is wired up, build an in-app alert engine that logs critical alerts and can be extended to webhooks/email.

### M5.0 Design checkpoint (PROGRESS, before code)

Document alert rules and thresholds:

| Alert ID | Condition | Severity | Action |
|----------|-----------|----------|--------|
| `HEALTH_DOWN` | `/api/monitoring/health` returns `status: 'down'` | Critical | Log + mark in DB |
| `HIGH_5XX_RATE` | `errorsPerMinute > 10` or `errorRate5xx > 10%` in last 5 min | Critical | Log + mark in DB |
| `HIGH_LATENCY` | `p95 > 2000ms` for 3 consecutive minutes | Warning | Log + mark in DB |
| `AUTH_FAILURE_SPIKE` | `authLoginFailure > 20` in last 5 min (potential brute force) | Critical | Log + mark in DB |
| `AUTH_LOCKOUT_ACTIVE` | `authLoginLockout > 0` in last 5 min | Warning | Log + mark in DB |
| `DB_UNREACHABLE` | Postgres connectivity check fails | Critical | Log + mark in DB |
| `ZERO_TRAFFIC` | `totalRequests` unchanged for 5 minutes (during expected active hours) | Warning | Log + mark in DB |

**Acceptance:** PROGRESS design section filled; no code changes.

### M5.1 Alert engine

**Files:** New file `ward-backend/services/AlertEngine.js`

**Implementation:**

1. Create `AlertEngine` class/module:
   - Runs on a `setInterval(60000)` tick (every minute).
   - On each tick, reads current metrics from `metricsCollector.getMetrics()`.
   - Evaluates each alert rule (from the table above).
   - For fired alerts:
     - Logs to stdout as structured JSON: `{ alertId, severity, message, timestamp, metrics }`.
     - Inserts into a new `Alerts` DB table: `id`, `alertId`, `severity`, `message`, `firedAt`, `resolvedAt`, `acknowledged`, `tenantId`.
     - Tracks "active" alerts to avoid duplicate firing (only fire once per incident; resolve when condition clears).
   - For resolved conditions: update `resolvedAt` in DB for the active alert.
2. Export functions:
   - `startAlertEngine()` — called in `server.js` after app starts.
   - `getActiveAlerts()` — returns currently firing alerts.
   - `acknowledgeAlert(alertId)` — admin action to acknowledge.
3. **Webhook hook** (for future use):
   - On alert fire, if `ALERT_WEBHOOK_URL` env var is set, POST the alert payload to that URL.
   - This allows future integration with Slack, Discord, PagerDuty, email relay, etc.
   - If the webhook fails, log the failure but don't block the alert engine.

**Edge cases:**
- Alert flapping: if a condition oscillates between fired and resolved every minute, implement a **cooldown** of 5 minutes before re-firing.
- Server restart: all alerts are new (no historical state); first minute always clean.
- DB write failure for alert: log to stdout (alerts must not be silently lost even if DB is down — which is itself an alert condition).

**Acceptance:**
- `npm test` passes.
- Manual: force high error rate → alert fires in stdout and DB.
- Stress test with high concurrency → no false `HIGH_5XX_RATE` alerts under normal load.

### M5.2 Alerts schema (DB)

**Files:** [ward-backend/db.js](../../ward-backend/db.js) (for SQLite), new migration for Postgres

**Implementation:**

1. Add to SQLite schema in `db.js`:
   ```sql
   CREATE TABLE IF NOT EXISTS Alerts (
     id TEXT PRIMARY KEY,
     alertId TEXT NOT NULL,
     severity TEXT NOT NULL,
     message TEXT NOT NULL,
     firedAt TEXT NOT NULL DEFAULT (datetime('now')),
     resolvedAt TEXT,
     acknowledged INTEGER DEFAULT 0,
     acknowledgedBy TEXT,
     tenantId TEXT DEFAULT 'system'
   );
   CREATE INDEX IF NOT EXISTS idx_alerts_active ON Alerts (resolvedAt, acknowledged);
   CREATE INDEX IF NOT EXISTS idx_alerts_fired ON Alerts (firedAt);
   ```
2. Add corresponding Postgres migration `003_create_alerts_table.sql`.

**Acceptance:**
- Backend starts without error (SQLite table created).
- `npm test` passes.

### M5.3 Alert API endpoints

**Files:** [ward-backend/routes/monitoring.js](../../ward-backend/routes/monitoring.js)

**Implementation:**

1. Add to monitoring routes:
   - `GET /api/monitoring/alerts` — **admin-only**: returns active (unresolved) alerts + recent (last 24h) resolved alerts.
   - `POST /api/monitoring/alerts/:id/acknowledge` — **admin-only**: marks alert as acknowledged.
2. Optionally: `GET /api/monitoring/alerts/history` — paginated alert history.

**Acceptance:**
- Test: admin can list and acknowledge alerts.
- Non-admin gets 403.

### M5.4 Alert display in dashboard (frontend)

**Files:** [ward-frontend/src/views/MonitoringDashboard.jsx](../../ward-frontend/src/views/MonitoringDashboard.jsx)

**Implementation:**

1. Add **Active Alerts** banner at the top of the monitoring dashboard:
   - Red banner for critical alerts, yellow for warnings.
   - Each alert shows: `alertId`, `severity`, `message`, `firedAt`, "Acknowledge" button.
   - Acknowledged alerts move to a "Recent" section.
2. Auto-refresh: poll `GET /api/monitoring/alerts` every 15 seconds.
3. If any critical alert is active, show a persistent indicator in the main navigation (a red dot or badge on the Monitoring nav link).

**Edge cases:**
- No alerts: show "All systems operational" green banner.
- Many alerts: paginate or cap at 20 most recent.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Force an alert → see it in the dashboard → acknowledge it → see it move to "Recent".

---

## Phase C1 — Kill switches (feature flags)

**Goal:** Build a lightweight feature flag system that allows admins to disable high-risk features in production without a code deploy.

### C1.0 Design checkpoint (PROGRESS, before code)

Define the feature flags and their defaults:

| Flag ID | Description | Default | Risk |
|---------|-------------|---------|------|
| `FEATURE_PATIENT_DISCHARGE` | Patient discharge workflow | `true` (enabled) | High — data loss if buggy |
| `FEATURE_MEDICATION_ADMIN` | Medication administration recording | `true` (enabled) | High — clinical safety |
| `FEATURE_ESCALATION_CREATE` | Creating new escalations | `true` (enabled) | Medium — communication flow |
| `FEATURE_OBSERVATION_INGEST` | Device observation ingestion | `true` (enabled) | Medium — automated data |
| `FEATURE_PATIENT_CREATE` | New patient registration | `true` (enabled) | Low — core workflow |
| `FEATURE_BULK_OPERATIONS` | Any future bulk operations | `false` (disabled) | High — new, untested |

**Design decisions:**
- Flags stored in a `FeatureFlags` DB table (persists across restarts, unlike env vars).
- Default values hardcoded in the flag middleware (fallback if DB read fails).
- Admin can toggle via API; changes take effect immediately (no restart needed).
- Middleware checks flag before allowing the request through to the route handler.

**Acceptance:** PROGRESS design section filled; no code changes.

### C1.1 Feature flags schema and repository

**Files:** [ward-backend/db.js](../../ward-backend/db.js), new migration for Postgres, new file `ward-backend/repositories/FeatureFlagRepository.js`

**Implementation:**

1. SQLite schema:
   ```sql
   CREATE TABLE IF NOT EXISTS FeatureFlags (
     id TEXT PRIMARY KEY,
     enabled INTEGER NOT NULL DEFAULT 1,
     updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
     updatedBy TEXT
   );
   ```
2. Postgres migration `004_create_feature_flags.sql`.
3. `FeatureFlagRepository.js`:
   - `getAll()` — returns all flags.
   - `get(flagId)` — returns single flag state.
   - `set(flagId, enabled, updatedBy)` — upsert flag.
   - In-memory cache with 10-second TTL (avoid DB hit on every request):
     - On `get()`, if cache is < 10s old, return cached value.
     - On `set()`, invalidate cache immediately.

**Edge cases:**
- Flag not in DB: return hardcoded default (from the table in C1.0).
- DB read failure: return hardcoded default (fail-open for safety — features stay enabled if DB is down, which is better than disabling clinical features when the alert DB has an issue).

**Acceptance:**
- `npm test` passes.
- Manual: insert a flag row → `get(flagId)` returns correct state.

### C1.2 Feature flag middleware

**Files:** New file `ward-backend/middleware/featureFlag.js`

**Implementation:**

1. Create `requireFeature(flagId)` middleware:
   ```javascript
   function requireFeature(flagId) {
     return async (req, res, next) => {
       const flag = await featureFlagRepository.get(flagId);
       if (!flag.enabled) {
         return res.status(503).json({
           error: 'This feature is temporarily disabled',
           featureId: flagId,
           code: 'FEATURE_DISABLED'
         });
       }
       next();
     };
   }
   ```
2. Wire into routes:
   - `POST /api/patients/:id/discharge` → `requireFeature('FEATURE_PATIENT_DISCHARGE')`
   - `POST /api/patients/:id/medications/:medId/administer` → `requireFeature('FEATURE_MEDICATION_ADMIN')`
   - `POST /api/patients/:patientId/escalations` → `requireFeature('FEATURE_ESCALATION_CREATE')`
   - `POST /api/observations/ingest` → `requireFeature('FEATURE_OBSERVATION_INGEST')`
   - `POST /api/patients` → `requireFeature('FEATURE_PATIENT_CREATE')`

**Edge cases:**
- GET requests are **never** gated by feature flags (reading data is always allowed).
- `503` status code (not 403) — signals temporary unavailability, not authorization failure.
- Frontend should handle `503 FEATURE_DISABLED` gracefully (toast message, not generic error).

**Acceptance:**
- `npm test` passes.
- Manual: set `FEATURE_PATIENT_DISCHARGE` to `false` in DB → `POST /api/patients/:id/discharge` returns 503 → set back to `true` → works again.

### C1.3 Admin feature flag API

**Files:** [ward-backend/routes/monitoring.js](../../ward-backend/routes/monitoring.js)

**Implementation:**

1. Add endpoints:
   - `GET /api/monitoring/features` — **admin-only**: returns all flag states with defaults.
   - `PUT /api/monitoring/features/:flagId` — **admin-only**: body `{ enabled: true|false }`. Updates flag, logs the change to `ClinicalChangeLog` (who toggled what, when).
2. Toggling a flag fires a `feature.toggled` custom event in metrics collector.

**Edge cases:**
- Unknown `flagId`: return 404.
- Non-boolean `enabled`: return 400 with clear message.

**Acceptance:**
- `npm test` passes.
- Admin can toggle flags via API and see immediate effect.

### C1.4 Kill switch UI in dashboard (frontend)

**Files:** [ward-frontend/src/views/MonitoringDashboard.jsx](../../ward-frontend/src/views/MonitoringDashboard.jsx)

**Implementation:**

1. Add **Kill Switches** section:
   - Table of flags: name, description, current state (toggle switch), last updated, updated by.
   - Toggle sends `PUT /api/monitoring/features/:flagId`.
   - Confirmation dialog before disabling: "Disabling [feature] will prevent [action]. Are you sure?"
   - Visual indicator: red badge on disabled features.

**Edge cases:**
- Toggling while offline: toast error, don't update local state.
- Concurrent admins: refetch flag state after toggle to confirm.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Admin can toggle features from dashboard.

### C1.5 Frontend handling of 503 FEATURE_DISABLED

**Files:** [ward-frontend/src/utils/api.ts](../../ward-frontend/src/utils/api.ts)

**Implementation:**

1. In the `api` fetch wrapper, handle `503` responses:
   - If response JSON contains `code: 'FEATURE_DISABLED'`:
     - Show `toast.error('This feature is temporarily disabled by an administrator')`.
     - Do **not** redirect to login (unlike 401/403).
   - Re-throw with a clear error so calling components can react (e.g., disable the button).

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Manual: disable a feature → try the action in UI → see the toast, not a crash.

---

## Phase C2 — Rollback plan

**Goal:** Document and test rollback procedures so any change can be reversed quickly.

### C2.1 Rollback runbook

**Files:** New file `docs/runbooks/rollback-procedures.md`

**Implementation:**

Create a runbook documenting:

1. **Git-based rollback:**
   - How to revert to a known-good commit: `git log --oneline -10` to find the commit, `git revert <hash>` or `git checkout <hash> -- .` (with caveats about DB schema changes).
   - When to use: code bug introduced by recent deploy.
   - Risk: DB schema changes may not be backward-compatible.

2. **Feature flag rollback:**
   - How to disable a specific feature via `PUT /api/monitoring/features/:flagId`.
   - When to use: specific feature is causing issues but overall app is stable.
   - Risk: none (feature flags don't change code or schema).

3. **Database rollback:**
   - SQLite: restore from backup (`cp ward.db.bak ward.db`; document backup procedure).
   - Postgres: restore from pg_dump snapshot (document the command).
   - When to use: data corruption or bad migration.
   - Risk: data loss since last backup.
   - **Pre-deploy checklist item:** always take a DB snapshot before deploying.

4. **Environment rollback:**
   - How to revert environment variables to previous values.
   - Document the pre-deploy env state in PROGRESS file.

5. **Full rollback (nuclear option):**
   - Stop the app.
   - Restore DB from backup.
   - Checkout known-good git commit.
   - Restore environment variables.
   - Restart.
   - Verify via `/health` and manual smoke test.

**Acceptance:**
- Runbook reviewed for accuracy against actual file paths and commands.
- Each procedure includes "Verify" step.

### C2.2 Pre-deploy backup script

**Files:** New file `ward-backend/scripts/preDeployBackup.js`

**Implementation:**

1. Script that:
   - If using SQLite: copies `ward.db` to `ward.db.bak.<timestamp>`.
   - If using Postgres (`DATABASE_URL` set): runs `pg_dump` to a file.
   - Logs the backup location.
   - Exits with code 0 on success, 1 on failure.
2. Add npm script: `"predeploy:backup": "node scripts/preDeployBackup.js"`.

**Edge cases:**
- SQLite file locked by running server: warn and suggest stopping first.
- Postgres dump fails: log error with connection details (without password).
- Disk space: warn if less than 2x DB size available.

**Acceptance:**
- Run script → backup file created → restore from backup → data intact.
- `npm test` still passes.

### C2.3 Rollback test (dry run)

**Implementation:**

1. On a development machine:
   - Take backup with `preDeployBackup.js`.
   - Make a deliberate schema or data change.
   - Follow the SQLite rollback procedure from the runbook.
   - Verify the app works with the restored DB.
2. Document results in PROGRESS.

**Acceptance:**
- Rollback procedure tested end-to-end.
- PROGRESS documents: backup file path, restore command, verification result.

---

## Phase C3 — Escalation protocols & team roles

**Goal:** Define who handles what during launch incidents. This is a **documentation-only** phase — no code changes.

### C3.1 Escalation protocol document

**Files:** New file `docs/runbooks/incident-escalation.md`

**Implementation:**

Create a document with:

1. **Severity levels:**
   - **P0 (Critical):** App completely down, data corruption, security breach.
     - Response time: immediate (within 5 minutes).
     - Actions: page all on-call; use kill switches; initiate rollback if needed.
   - **P1 (High):** Major feature broken, high error rate, login failures.
     - Response time: within 15 minutes.
     - Actions: investigate; use feature flag to disable affected feature; communicate status.
   - **P2 (Medium):** Degraded performance, non-critical feature issue.
     - Response time: within 1 hour.
     - Actions: investigate; fix forward if possible; schedule fix.
   - **P3 (Low):** Minor UI issue, cosmetic bug.
     - Response time: next business day.
     - Actions: log issue; fix in next sprint.

2. **Team role template** (to be filled by the team):
   - **Incident Commander:** [Name] — owns the incident; makes decisions on rollback vs fix-forward.
   - **Backend Engineer:** [Name] — investigates server errors, DB issues, API failures.
   - **Frontend Engineer:** [Name] — investigates UI issues, client-side errors.
   - **DevOps/Infra:** [Name] — handles deployment, server access, DB backups/restores.
   - **Communications:** [Name] — sends status updates to stakeholders.

3. **Escalation flowchart:**
   ```
   Alert fires → Check severity
     P0 → Page all on-call → Incident Commander takes charge → Kill switch / rollback → Postmortem
     P1 → Notify backend + frontend → Investigate → Feature flag / fix → Status update
     P2 → Log in issue tracker → Assign → Fix in next deploy
     P3 → Log → Backlog
   ```

4. **Communication channels** (template — to be filled):
   - Primary: [Slack channel / phone tree / etc.]
   - Secondary: [Email list / etc.]
   - Status page: [URL / etc.]

**Acceptance:**
- Document reviewed by team.
- Each team member knows their role.

### C3.2 Pre-written communication templates

**Files:** New file `docs/runbooks/incident-communications.md`

**Implementation:**

Create templates for:

1. **App down:**
   > "We are aware that [General Ward / specific feature] is currently unavailable. Our team is actively investigating. We will provide an update within [30 minutes]. Current status: [investigating / identified / fixing / monitoring]."

2. **Degraded performance:**
   > "[General Ward] is experiencing slower than normal response times. We have identified the issue and are working on a fix. Core functionality remains available. Expected resolution: [time]."

3. **Feature disabled (kill switch activated):**
   > "The [feature name] feature has been temporarily disabled while we address a technical issue. All other features remain fully operational. We expect to restore this feature within [time]."

4. **Security incident:**
   > "We have detected unusual login activity and are taking precautionary measures. We have temporarily restricted access to [affected area]. If you experience access issues, please contact [support channel]. No patient data has been compromised."

5. **Resolved:**
   > "The issue affecting [description] has been resolved as of [time]. Normal service has been restored. We will conduct a postmortem and share findings with the team."

6. **Database issue:**
   > "We are experiencing a database connectivity issue. Read operations may be slow or unavailable. Write operations have been paused to prevent data inconsistency. Our team is working on restoration."

**Acceptance:**
- Templates are clear, professional, and cover all known risk scenarios.
- Templates include placeholder fields to fill in during an actual incident.

---

## Phase C4 — Integration testing & stress validation

**Goal:** Validate the entire monitoring + contingency stack under load and failure conditions.

### C4.1 Monitoring stress test

**Implementation:**

1. Run `stressEverything.js` with default config (20s, 10 workers).
2. Immediately after, check:
   - `GET /api/monitoring/metrics` → `totalRequests` should be > 0, `statusCodeHistogram` populated.
   - `GET /api/monitoring/health` → status should be `ok` (no 5xx during normal stress).
   - Auth metrics reflect the stress test's login attempts.
   - Workflow metrics reflect patient creates, vitals, etc.
3. Document results in PROGRESS.

**Acceptance:**
- All metrics endpoints return accurate data post-stress.
- No alerts falsely fired during normal stress load.

### C4.2 Alert firing test

**Implementation:**

1. Temporarily modify a route to return 500 for 50% of requests (or use a feature flag to force errors).
2. Wait for alert engine tick (1 minute).
3. Verify `HIGH_5XX_RATE` alert fires in:
   - Stdout logs.
   - `Alerts` DB table.
   - `GET /api/monitoring/alerts` endpoint.
   - Admin dashboard (if frontend built).
4. Stop the error injection.
5. Wait for resolution tick.
6. Verify alert is resolved.
7. Remove the temporary modification.

**Acceptance:**
- Alert fires within 2 minutes of condition.
- Alert resolves within 2 minutes of condition clearing.
- Alert history shows both fired and resolved timestamps.

### C4.3 Kill switch test

**Implementation:**

1. Disable `FEATURE_PATIENT_DISCHARGE`:
   - `PUT /api/monitoring/features/FEATURE_PATIENT_DISCHARGE` with `{ enabled: false }`.
2. Try to discharge a patient → expect 503.
3. Re-enable the flag.
4. Try to discharge a patient → expect success.
5. Repeat for each flag.

**Acceptance:**
- Each kill switch works as expected.
- Feature re-enables cleanly.
- `ClinicalChangeLog` records the toggle.

### C4.4 Rollback test

**Implementation:**

1. Follow the rollback runbook (C2.1) for a simulated incident:
   - Take backup.
   - Make a deliberate data change.
   - Restore from backup.
   - Verify restoration.
2. Document results in PROGRESS.

**Acceptance:**
- Full rollback procedure works end-to-end.
- Data is restored correctly.

### C4.5 Full stress + monitoring validation

**Implementation:**

1. Run `stressEverything.js` with **heavy** config: `DURATION_SEC=30 CONCURRENCY=20`.
2. During the run, in parallel:
   - Monitor `GET /api/monitoring/health` — should stay `ok`.
   - Monitor `GET /api/monitoring/metrics` — counters incrementing.
3. After completion:
   - Verify `server5xx=0`, `timeouts=0`, `fetchErrors=0`.
   - Verify monitoring metrics match stress test summary.
   - Verify no false alerts fired.

**Acceptance:**
- Stress test passes all criteria.
- Monitoring accurately reflects the stress run.
- No false alerts.

---

## 5. Execution order summary

| Step | Phase | Description | Dependencies |
|------|-------|-------------|-------------|
| M1.0 | M1 | Snapshot | None |
| M1.1 | M1 | Global error handler | M1.0 |
| M1.2 | M1 | Metrics collector | M1.1 |
| M1.3 | M1 | Metrics API endpoints | M1.2 |
| M1.4 | M1 | Monitoring tests | M1.3 |
| M1.5 | M1 | Admin monitoring dashboard | M1.3 |
| M2.0 | M2 | Auth snapshot | M1.2 |
| M2.1 | M2 | Login event recording | M2.0 |
| M2.2 | M2 | Auth metrics endpoint | M2.1 |
| M2.3 | M2 | Auth dashboard section | M2.2 |
| M3.0 | M3 | Workflow design | M1.2 |
| M3.1 | M3 | Workflow event recording | M3.0 |
| M3.2 | M3 | Workflow metrics endpoint | M3.1 |
| M3.3 | M3 | Workflow dashboard section | M3.2 |
| M4.1 | M4 | Payment hook scaffolding | M1.2 |
| M5.0 | M5 | Alert design | M1.2 |
| M5.1 | M5 | Alert engine | M5.0, M5.2 |
| M5.2 | M5 | Alerts DB schema | M5.0 |
| M5.3 | M5 | Alert API endpoints | M5.1 |
| M5.4 | M5 | Alert dashboard section | M5.3 |
| C1.0 | C1 | Kill switch design | None |
| C1.1 | C1 | Feature flags schema/repo | C1.0 |
| C1.2 | C1 | Feature flag middleware | C1.1 |
| C1.3 | C1 | Admin flag API | C1.2 |
| C1.4 | C1 | Kill switch UI | C1.3 |
| C1.5 | C1 | Frontend 503 handling | C1.2 |
| C2.1 | C2 | Rollback runbook | None |
| C2.2 | C2 | Backup script | C2.1 |
| C2.3 | C2 | Rollback dry run | C2.2 |
| C3.1 | C3 | Escalation protocol | None |
| C3.2 | C3 | Communication templates | C3.1 |
| C4.1 | C4 | Monitoring stress test | M1–M5 |
| C4.2 | C4 | Alert firing test | M5 |
| C4.3 | C4 | Kill switch test | C1 |
| C4.4 | C4 | Rollback test | C2 |
| C4.5 | C4 | Full validation | All above |

---

## 6. Out of scope (explicit)

- External APM services (Datadog, New Relic, Sentry) — can be added later by shipping stdout logs to any log aggregator
- External alerting (PagerDuty, OpsGenie) — webhook hook in M5.1 enables this without code changes
- Payment processing implementation — only monitoring scaffolding in M4
- User signup/registration — no signup exists; plan covers login monitoring only
- Performance profiling / APM tracing — in-memory metrics are sufficient for launch
- Log shipping / persistence across restarts — requires external infrastructure (ELK, CloudWatch, etc.)

---

## 7. Final regression sweep

After all phases executed:

1. Walk [codemap/CODEMAP.md](../../codemap/CODEMAP.md) workflows: login, dashboard, patient chart (tabs), meds, history, handover, tasks, escalations, discharge, admin audit.
2. Verify monitoring dashboard shows accurate data for all workflows.
3. Verify kill switches work for all gated features.
4. Verify alert engine fires and resolves correctly.
5. Run `stressEverything.js` at heavy config one final time.
6. Verify rollback procedure is documented and tested.
7. Verify escalation protocol is documented and team-acknowledged.
8. Update [COMPLIANCE.md](../../docs/COMPLIANCE.md) if monitoring stores any new data categories.

---

*Plan depth version: 1 — aligned with repo paths as of 2026-03-30; re-validate paths if refactors occur.*
