# General Ward — Full Code Audit & Implementation Plan
> Conducted: 2026-05-07 | Auditor: Claude Code

---

## Table of Contents
1. [Stack Overview](#1-stack-overview)
2. [Database Schema](#2-database-schema)
3. [Full API Surface](#3-full-api-surface)
4. [Middleware Stack](#4-middleware-stack)
5. [RBAC & Auth](#5-rbac--auth)
6. [Clinical Logic](#6-clinical-logic)
7. [Frontend Overview](#7-frontend-overview)
8. [Issues Found](#8-issues-found)
9. [Implementation Plan](#9-implementation-plan)

---

## 1. Stack Overview

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express 5 |
| Primary DB | SQLite (dev/default) |
| Production DB | PostgreSQL 16 (`DB_DIALECT=postgres`) |
| DB Abstraction | Custom `db-adapter.js` — translates `?`→`$n`, normalises row shapes |
| Frontend | React 18 + Vite + TanStack Query v5 |
| Auth | JWT (8h) in `ward_token` httpOnly cookie + `Authorization` header fallback |
| Security | bcrypt, CSRF double-submit, Helmet CSP, express-rate-limit, DB-backed login lockout |
| PDF | pdfkit + qrcode |
| Testing | Jest + Supertest (44 tests, 15 suites) |

---

## 2. Database Schema

### Tables (21 total)

| Table | Purpose |
|---|---|
| `Users` | Staff accounts (doctor / nurse / admin) |
| `Tenants` | Organisation registry — default `tenant-default` |
| `Patients` | Active / discharged patients, care intensity 1–4 |
| `DailyStats` | Clinical observations: vital, diet, sleep, symptom, history (stored as JSON) |
| `Medications` | Prescribed meds per patient |
| `MedicationAdministrations` | MAR — given / refused / missed with witness fields |
| `Escalations` | Nurse → doctor escalation flags |
| `DischargeSummaries` | Discharge form data |
| `HospitalArchives` | Immutable full-patient JSON snapshot at discharge |
| `Tasks` | Clinical tasks: vital / assessment / followup |
| `HandoverNotes` | Shift handover notes with tags |
| `AuditLogs` | HTTP-level request audit (every authenticated request) |
| `ClinicalChangeLog` | Domain-level clinical changes (patient edits, meds, observations) |
| `IdempotencyKeys` | Deduplication for IoT observation ingest |
| `AuthLoginAttempts` | Per-username + IP brute-force lockout state |
| `PharmacyStock` | Drug inventory with reorder thresholds and cost |
| `PharmacyBatches` | Lot/batch tracking with expiry (FEFO ordering) |
| `PharmacyTransactions` | Ledger: restock / dispense / adjustment / waste |
| `WasteRecords` | 2-step witness waste workflow (PENDING → CONFIRMED / CANCELLED) |
| `BarcodeRegistrations` | GS1-128 / EAN-13 barcode → stock/batch mapping |
| `PatientReports` | Generated PDF report registry with HMAC-SHA256 hash |
| `PurchaseOrders` | Auto-generated reorder purchase orders |

### Dual Database Strategy
PostgreSQL mirrors the SQLite schema exactly via **8 sequential migration files** (`001`–`008` in `ward-backend/postgres-migrations/migrations/`). All tables use idempotent `CREATE TABLE IF NOT EXISTS`. Tenant defaulting is enforced by `BEFORE INSERT` triggers on both dialects.

### Key Indexes
```
idx_dailystats_patient          DailyStats(patientId)
idx_medications_patient         Medications(patientId)
idx_auditlogs_tenant_timestamp  AuditLogs(tenantId, timestamp DESC)
idx_clinicalchangelog_tenant_time ClinicalChangeLog(tenantId, timestamp DESC)
idx_tasks_patient / assignee / status
idx_pharmacystock_barcode       UNIQUE, partial (WHERE barcode IS NOT NULL)
idx_wasterecords_status         WasteRecords(status, tenantId)
```

---

## 3. Full API Surface

### Auth — `/api/auth`
| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/login` | Public | Rate-limited (100/15min) + DB lockout; sets `ward_token` cookie |
| POST | `/logout` | Public | Clears cookie |
| GET | `/me` | JWT | Returns user + fresh CSRF token |

### Patients — `/api/patients`
| Method | Endpoint | Auth | RBAC |
|---|---|---|---|
| GET | `/` | JWT | READ_PATIENT — returns list with latest NEWS2 EWS score per patient |
| POST | `/` | JWT | WRITE_PATIENT — admit patient |
| GET | `/archives` | JWT | READ_PATIENT — discharged archive index |
| GET | `/archives/:archiveId` | JWT | READ_PATIENT — full immutable discharge JSON snapshot |
| GET | `/:id` | JWT | READ_PATIENT |
| PUT | `/:id` | JWT | WRITE_PATIENT |
| POST | `/:id/discharge` | JWT | DISCHARGE_PATIENT (doctor only) — atomic discharge + archive |
| GET | `/:id/discharge-summary` | JWT | READ_PATIENT |

### Clinical Observations — `/api/patients/:patientId/stats` & `/history`
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/` | Record vital / diet / sleep / symptom / history |
| GET | `/` | Paginated (cursor: `timestamp\|id`), up to 200 records |
| GET | `/ews/latest` | Latest NEWS2 score computed from most recent vital |
| GET | `/trends` | Delta trends between last two vitals |

### IoT Ingest — `/api/observations`
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/ingest` | Idempotency-Key header supported; 30 req/min rate limit |

### Medications — `/api/patients/:patientId/medications`
| Method | Endpoint | RBAC | Notes |
|---|---|---|---|
| GET | `/` | READ_PATIENT | Active medications |
| POST | `/` | WRITE_MEDICATIONS | Prescribe |
| GET | `/administrations` | READ_PATIENT | MAR history, paginated |
| POST | `/:medId/administer` | ADMINISTER_MEDS | Triggers FEFO stock deduction |
| PUT | `/administrations/:adminId` | ADMINISTER_MEDS | Edit record |
| DELETE | `/administrations/:adminId` | ADMINISTER_MEDS | Delete record |
| PUT | `/:medId` | WRITE_MEDICATIONS | Change medication status |

### Escalations
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/patients/:patientId/escalations` | Create (nurse or doctor) |
| GET | `/api/escalations/all` | Global pending triage list |
| POST | `/api/patients/:patientId/escalations/:escalationId/review` | Mark reviewed (doctor) |

### Handover Notes & Tasks
| Method | Endpoint |
|---|---|
| GET / POST | `/api/patients/:patientId/notes` |
| GET / POST | `/api/patients/:patientId/tasks` |
| GET | `/api/tasks/my` — my open tasks (paginated) |
| PUT | `/api/tasks/:taskId/complete` |

### Pharmacy — `/api/pharmacy`
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/inventory` | Full stock list |
| POST | `/inventory` | Add drug |
| PATCH | `/inventory/:id` | Manual stock adjustment |
| DELETE | `/inventory/:id` | Remove drug |
| GET | `/history` | Transaction ledger |
| GET / POST | `/inventory/:stockId/batches` | Lot management |
| POST | `/batches/:batchId/recall` | Recall a lot |
| GET | `/recall-trace/:batchId` | Recall impact trace |
| GET | `/batches/search` | Search by lot number |
| POST | `/inventory/:stockId/sync` | Recalculate totals from batches |
| GET | `/analytics/consumption` | Consumption trends (configurable days) |
| GET | `/analytics/financial` | Financial analytics (admin only) |
| GET | `/analytics/replenishment` | Replenishment plan |
| GET | `/orders` | Purchase orders |
| PATCH | `/orders/:id/status` | Update PO status |
| POST | `/orders/check-all` | Manual reorder trigger |
| POST | `/waste` | Initiate waste record (PENDING) |
| GET | `/waste/pending` | Witness queue |
| GET | `/waste` | All waste records (paginated) |
| POST | `/waste/:id/confirm` | Witness confirmation (atomic, FEFO) |
| POST | `/waste/:id/cancel` | Cancel waste |

### Barcodes — `/api/pharmacy/barcodes`
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/scan/:barcode` | Resolve GS1-128, EAN-13, or QR |
| POST | `/register` | Map barcode to stock/batch |
| GET | `/qr/:id` | Generate QR PNG |
| GET | `/history/:barcode` | Scan history (admin only) |

### Admin — `/api/admin`
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/audit-logs` | Paginated audit log (cursor pagination, filter by success/date) |
| GET | `/audit-logs/export.csv` | CSV export (capped at 100) |
| GET | `/clinical-changes` | Clinical change log (by entityType, date range) |
| POST | `/audit/purge` | Retention purge with mandatory `dryRun` flag |

### Reports — `/api/reports`
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/patient/:patientId/generate` | Generate PDF (8-section pdfkit), HMAC-SHA256 signed |
| GET | `/patient/:patientId/history` | Report registry |
| GET | `/verify` | **Public** — QR-code report integrity check |

---

## 4. Middleware Stack

```
Request
  │
  ├─ CORS (getCorsMiddleware)         ← strict whitelist in prod, reflective in dev
  ├─ Helmet                           ← full CSP in prod, disabled in dev
  ├─ express.json (512kb limit)
  ├─ attachUserIfPresent              ← soft JWT parse, sets req.user / req.authSource
  ├─ verifyCsrfForMutations           ← enforces X-CSRF-Token for cookie-auth mutations
  ├─ auditLog                         ← inserts to AuditLogs on res.finish (non-blocking)
  ├─ requestLogger
  │
  ├─ /api/auth/*                      ← public + loginLimiter
  ├─ /api/patients/*
  │    ├─ authenticateToken           ← hard JWT guard
  │    ├─ authorize / authorizeAny    ← RBAC permission check
  │    └─ requireTenantPatient        ← DB-verified tenant ownership
  │
  └─ errorHandler                     ← masks internals in prod, exposes in dev
```

---

## 5. RBAC & Auth

### Roles & Permissions

| Permission | Doctor | Nurse | Admin |
|---|:---:|:---:|:---:|
| READ_PATIENT | ✅ | ✅ | ✅ |
| WRITE_PATIENT | ✅ | | |
| DISCHARGE_PATIENT | ✅ | | |
| WRITE_VITALS | ✅ | ✅ | |
| WRITE_MEDICATIONS | ✅ | | |
| ADMINISTER_MEDS | ✅ | ✅ | |
| WRITE_NOTES | ✅ | ✅ | |
| WRITE_TASKS | ✅ | ✅ | |
| READ_TASKS | ✅ | ✅ | ✅ |
| VIEW_AUDIT | | | ✅ |
| PURGE_AUDIT | | | ✅ |

### Auth Flow
```
1. POST /auth/login
   → check DB lockout (AuthLoginAttempts)
   → bcrypt.compare(password, hash)
   → sign JWT { id, name, role, tenantId, csrf }
   → Set-Cookie: ward_token (httpOnly, secure in prod)
   → return { user, csrfToken }

2. Subsequent requests (browser)
   → Cookie: ward_token → decoded by attachUserIfPresent
   → X-CSRF-Token header verified against JWT csrf claim

3. Subsequent requests (API/stress harness)
   → Authorization: Bearer <token> → CSRF skipped (by design)
```

### Multi-Tenancy
Every database query is scoped with `WHERE tenantId = ?`. The `tenantId` comes from the JWT claim. The `requireTenant*` middleware family does an additional DB-level ownership check before mutating any resource.

---

## 6. Clinical Logic

### NEWS2 Scoring (`ScoringService.js`)
Implements the National Early Warning Score 2 protocol across 7 parameters:

| Parameter | Source field | Scoring range |
|---|---|---|
| Respiration Rate | `respRate` | ≤8 = 3pts, 9-11 = 1pt, 12-20 = 0, 21-24 = 2pts, ≥25 = 3pts |
| SpO2 | `spo2` | ≤91 = 3pts, 92-93 = 2pts, 94-95 = 1pt, ≥96 = 0 |
| Oxygen status | `onOxygen` | true = 2pts |
| Systolic BP | `bpSystolic` | ≤90 = 3pts, 91-100 = 2pts, 101-110 = 1pt, ≥220 = 3pts |
| Heart Rate | `pulse` | ≤40 = 3pts, 41-50 = 1pt, 51-90 = 0, 91-110 = 1pt, ≥131 = 3pts |
| Consciousness | `consciousness` | Non-alert (AVPU) = 3pts |
| Temperature | `temp` | ≤35.0 = 3pts, auto-converts °F if >45 |

**Risk bands**: LOW (<5), MEDIUM (5–6), HIGH (≥7 / critical)

### FEFO Dispatch
All pharmacy dispense (medication administration) and waste confirmation resolve the **earliest-expiry active batch** via `batchRepo.getFefoCandidate()`. The waste confirmation flow is fully atomic — stock deduction, batch update, transaction ledger, and audit log all run inside a single `withTransaction`.

### Idempotency (IoT Ingest)
`POST /api/observations/ingest` supports `Idempotency-Key` header. On repeat, returns the original stored response without duplicating `DailyStats` inserts.

### Discharge Archive
At discharge, `PatientRepository.discharge()` runs a single transaction that: updates patient status → creates `DischargeSummaries` row → collects a full patient snapshot (all related rows) → writes immutable `HospitalArchives` JSON blob.

### PDF Reports
8-section pdfkit document: Cover Page → Demographics → Vitals Timeline (NEWS2 coloured) → MAR → Diet → Sleep → Clinical Notes → Escalations → Discharge Summary. Each report is HMAC-SHA256 signed and includes a QR code for public tamper verification via `GET /api/reports/verify`.

---

## 7. Frontend Overview

### Routes
| Path | View | Access |
|---|---|---|
| `/login` | Login.jsx | Public |
| `/signup` | Signup.jsx | Public |
| `/verify` | VerifyReport.jsx | Public |
| `/` | DashboardView | Authenticated |
| `/archives` | DashboardView (archive mode) | Authenticated |
| `/patient/:id` | PatientDetail | Authenticated |
| `/archive/:archiveId` | HospitalArchiveDetail | Authenticated |
| `/tasks` | Tasks | Authenticated |
| `/pharmacy` | PharmacyView | Authenticated |
| `/admin/audit` | AdminAudit | Admin only |

### Data Fetching
- TanStack Query with 30s stale time, no window-focus refetch
- Active patient list: 15s polling interval
- Doctor dashboard: 15s escalation poll via `setInterval`
- CSRF token stored in `sessionStorage`, sent as `X-CSRF-Token` on all mutations

### State & Auth
- `AuthContext` bootstraps from `GET /auth/me` on page load
- User data in `localStorage`, CSRF in `sessionStorage`
- On 401/403: clears local state and redirects to `/login` (except on login page itself)
- Dark/light theme in `localStorage`

### Pharmacy View (tabs)
Inventory · Procurement (Purchase Orders) · Waste & Spillage · Batch Management · Analytics · Barcodes

---

## 8. Issues Found

### 🔴 Critical

#### Issue 1 — Signup route is missing; the feature is completely broken
**File**: `ward-backend/controllers/AuthController.js`, `ward-frontend/src/context/AuthContext.jsx:67`

`AuthContext.jsx` calls `api.post('/auth/signup', ...)` and `Signup.jsx` exists in the frontend, but `POST /api/auth/signup` is **never defined or mounted** anywhere in the backend. Every signup attempt returns `404 Endpoint not found`.

---

### 🟠 Significant

#### Issue 2 — `ReportController.generateReport` missing tenantId fallback
**File**: `ward-backend/controllers/ReportController.js:13`

```js
// Current — tenantId can be undefined
const tenantId = req.user.tenantId;

// Every other controller does this
const tenantId = req.user.tenantId || 'tenant-default';
```

If `tenantId` is undefined, reports are stored and queried with `null` scope, silently breaking data isolation.

---

#### Issue 3 — O(n) inventory lookup in `PATCH /pharmacy/inventory/:id`
**File**: `ward-backend/controllers/PharmacyController.js:78`

```js
// Current — fetches ALL inventory, then searches in JS
const item = await stockService.getInventory(tenantId)
  .then(inv => inv.find(i => i.id === req.params.id));

// Should be
const item = await stockRepo.findById(req.params.id, tenantId);
```

`requireTenantPharmacyStock` middleware already verified the item exists. This needlessly loads every stock item.

---

#### Issue 4 — `PatientRepository.update()` always overwrites `admittedAt`
**File**: `ward-backend/repositories/PatientRepository.js:186`

The UPDATE statement includes `admittedAt` unconditionally. If the frontend `PUT /patients/:id` payload omits `admittedAt`, it will be overwritten with `undefined`.

---

### 🟡 Minor

#### Issue 5 — Auth pattern inconsistency on barcode history endpoint
**File**: `ward-backend/controllers/BarcodeController.js:47`

```js
// Uses old requireRole helper
router.get('/history/:barcode', authenticateToken, requireRole(['admin']), ...)

// All other admin-gated endpoints use the RBAC system
router.get('/audit-logs', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), ...)
```

Functionally equivalent, but inconsistent. `requireRole` bypasses the RBAC permissions map.

---

#### Issue 6 — Login rate limiter is very permissive for a healthcare system
**File**: `ward-backend/controllers/AuthController.js:11`

```js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,  // 100 attempts per IP before the rate limiter fires
  ...
});
```

100 attempts from a single IP before the HTTP limiter engages is high for clinical data. The DB-level lockout compensates, but the express-rate-limit provides weak first-line protection. Consider dropping to `max: 10`.

---

#### Issue 7 — Duplicate import of `ObservationController` under two names
**File**: `ward-backend/controllers/PatientController.js:9-10`

```js
const historyRoutes = require('./ObservationController');
const statRoutes = require('./ObservationController'); // exact same module
```

Works because Node.js caches modules, but the naming is misleading. One import is enough; mount it on both paths.

---

## 9. Implementation Plan

Priority ordering: **Critical → Significant → Minor**

---

### Phase A — Critical Fix (estimated: 1–2 hours)

#### A.1 — Implement the signup route

**Backend** (`ward-backend/controllers/AuthController.js`)
- Add `POST /signup` handler
- Accept `{ username, password, role, hospitalName }` 
- Create a new Tenant (or use existing default)
- Hash password with bcrypt
- Insert into `Users` with a new UUID
- Sign JWT and set cookie (same as login flow)
- Return `{ user, csrfToken }`

**Database** — no schema changes needed; `Users` table already exists.

**Validation to add**:
- `username` required, min 3 chars, no spaces
- `password` required, min 8 chars
- `role` must be one of `doctor`, `nurse`, `admin`
- Username uniqueness is already enforced by DB `UNIQUE(name)` constraint

**Mount in `server.js`** — already routed through `authRoutes`, so just adding the handler is enough.

---

### Phase B — Significant Fixes (estimated: 1 hour)

#### B.1 — Fix `ReportController` tenantId fallback
**File**: `ward-backend/controllers/ReportController.js:13`

```js
// Change
const tenantId = req.user.tenantId;
// To
const tenantId = req.user.tenantId || 'tenant-default';
```

Apply the same fix to `getHistory` (line 61) for consistency.

---

#### B.2 — Fix O(n) inventory lookup in pharmacy PATCH
**File**: `ward-backend/controllers/PharmacyController.js:73-96`

Replace the `getInventory().then(inv.find(...))` chain with a direct `stockRepo.findById()` call. The `requireTenantPharmacyStock` middleware already validates existence and tenant ownership, so the controller only needs the item's `quantityPerUnit` to calculate the diff.

```js
// Replace the getInventory call with:
const { StockRepository } = require('../repositories/pharmacy/StockRepository');
const item = await StockRepository.findById(req.params.id, tenantId);
if (!item) return res.status(404).json({ error: 'Medication not found' });
```

---

#### B.3 — Guard `admittedAt` in PatientRepository.update
**File**: `ward-backend/repositories/PatientRepository.js`

Change `update()` to only overwrite `admittedAt` if it's explicitly provided in the payload:

```js
// Build the UPDATE dynamically, or check before including admittedAt
const admittedAt = patientData.admittedAt || existingPatient.admittedAt;
```

Or, simpler: fetch the existing row first and merge, or remove `admittedAt` from the UPDATE columns entirely (admission date should never change after admit).

---

### Phase C — Minor Fixes (estimated: 30 minutes)

#### C.1 — Standardise barcode history auth to RBAC
**File**: `ward-backend/controllers/BarcodeController.js:47`

```js
// Replace
router.get('/history/:barcode', authenticateToken, requireRole(['admin']), ...)
// With
router.get('/history/:barcode', authenticateToken, authorize(PERMISSIONS.VIEW_AUDIT), ...)
```

---

#### C.2 — Tighten login rate limiter
**File**: `ward-backend/controllers/AuthController.js:11`

```js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // was 100
  ...
});
```

---

#### C.3 — Deduplicate ObservationController import
**File**: `ward-backend/controllers/PatientController.js:9-10`

```js
// Replace two identical requires with one
const observationRoutes = require('./ObservationController');

// Then mount on both paths
router.use('/:patientId/history', observationRoutes);
router.use('/:patientId/stats', observationRoutes);
```

---

### Phase D — Future Hardening (no immediate urgency)

| Item | Notes |
|---|---|
| Signup: hospitalName → auto-create Tenant | Currently all users land on `tenant-default`; proper multi-tenancy needs a Tenant creation flow |
| Pharmacy PATCH: atomic diff calculation | Current diff calc (`totalUnits * quantityPerUnit - totalQuantity`) can drift; prefer a stored procedure or batch-sum approach |
| `PatientReports.pdfStoredAt` is always null | The PDF is streamed to the client and never stored; if re-generation is needed (e.g. legal hold), add S3/filesystem storage |
| Observation ingest: expand idempotency scope | `IdempotencyKeys` PK includes `patientId` — this limits reuse for non-patient-bound ingest. Consider making it endpoint-scoped only |
| EWS alert: push notifications | Currently doctors poll escalations on a 15s interval; WebSocket or SSE would eliminate the poll overhead |
| `AUDIT_RETENTION_DAYS` env not documented | The purge endpoint reads this env var but it is not in `.env.example` |

---

### Fix Priority Summary

| # | Severity | File | Fix |
|---|---|---|---|
| A.1 | 🔴 Critical | `AuthController.js` | Add `POST /signup` route |
| B.1 | 🟠 Significant | `ReportController.js:13` | Add `\|\| 'tenant-default'` fallback |
| B.2 | 🟠 Significant | `PharmacyController.js:78` | Replace O(n) inventory search with `findById` |
| B.3 | 🟠 Significant | `PatientRepository.js:186` | Guard `admittedAt` overwrite |
| C.1 | 🟡 Minor | `BarcodeController.js:47` | Use `authorize(PERMISSIONS.VIEW_AUDIT)` |
| C.2 | 🟡 Minor | `AuthController.js:11` | Drop login rate limit from 100 to 10 |
| C.3 | 🟡 Minor | `PatientController.js:9-10` | Deduplicate import |

---

## 10. DPDPA 2023 Compliance Audit

| Requirement | Status | Gap / Recommendation |
|---|---|---|
| **Section 5: Notice** | 🔴 Missing | No workflow to generate or record service of notice to patients at collection. |
| **Section 6: Consent** | 🟡 Partial | System assumes implicit clinical consent; lacks structured consent flags for non-essential research use. |
| **Section 8: Accuracy** | 🟢 Good | `ClinicalChangeLog` tracks all mutations; `admittedAt` is now guarded from overwrite. |
| **Section 8: Retention** | 🟠 Gapped | Patients are archived at discharge but no "Right to Erasure" or auto-purge policy exists. |
| **Section 9: Minors** | 🔴 Critical | No "Guardian" field or age-gate logic for patients under 18. |
| **Section 11: Access** | 🟢 Good | `ReportController` allows full patient record export (portability/access right). |
| **Section 12: Correction**| 🟡 Partial | Record editing exists, but no formal "Correction Request" workflow/log. |
| **Rule 6: Security** | 🟠 Gapped | `AuditLogs` capture mutations, but a dedicated "Read Access Log" for sensitive records is required. |
