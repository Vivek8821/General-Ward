# General Ward — Comprehensive Handover Document

> **Date**: 2026-05-12 | **Version**: 1.0.0  
> **Application**: General Ward Clinical Operations Platform  
> **Stack**: Express 5 + SQLite/PostgreSQL | React 19 + Vite + TanStack Query v5

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository Root Structure](#2-repository-root-structure)
3. [Backend Deep-Dive (ward-backend/)](#3-backend-deep-dive)
4. [Frontend Deep-Dive (ward-frontend/)](#4-frontend-deep-dive) → PART2
5. [Database Schema](#5-database-schema) → PART2
6. [API Reference](#6-api-reference) → PART3
7. [Security & Cybersecurity](#7-security) → PART3
8. [Authentication & Login Flow](#8-authentication) → PART3
9. [DPDPA Compliance](#9-dpdpa) → PART3
10. [DevOps & Deployment](#10-devops) → PART3

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React SPA)                      │
│  React 19 + Vite + TanStack Query v5 + Tailwind CSS 4          │
│  Port 5173 (dev) / Nginx (prod)                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (JSON) + httpOnly cookies
                           │ CSRF: X-CSRF-Token header
┌──────────────────────────▼──────────────────────────────────────┐
│                    EXPRESS 5 API (Node.js)                       │
│  Port 3001 | CommonJS | JWT Auth | RBAC | Tenant Isolation     │
│                                                                 │
│  ┌─────────────┐  ┌───────────┐  ┌──────────────┐              │
│  │ Controllers  │→│ Services  │→│ Repositories  │              │
│  │ (routing)    │  │ (logic)   │  │ (data access) │              │
│  └─────────────┘  └───────────┘  └──────┬───────┘              │
│                                          │                      │
│                              ┌───────────▼───────────┐          │
│                              │    db-adapter.js       │          │
│                              │  (dialect abstraction) │          │
│                              └─────┬─────────┬───────┘          │
│                                    │         │                  │
│                              ┌─────▼──┐ ┌───▼──────────┐       │
│                              │ db.js  │ │db-postgres.js│       │
│                              │(SQLite)│ │  (pg Pool)   │       │
│                              └────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
- **Multi-tenant isolation**: Every query scoped by `tenantId`
- **Dual-database**: SQLite for dev/low-resource, PostgreSQL for production
- **Layered architecture**: Controller → Service → Repository → DB Adapter
- **Clinical-first**: Medication administration never blocked by inventory errors

---

## 2. Repository Root Structure

```
General-Ward/
├── package.json                 # Root scaffolding (concurrently, codemap)
├── start-test-server.sh         # One-command dev startup with seeded data
├── setup-prod.sh                # Generates .env with random secrets
├── docker-compose.yml           # Production: Postgres + Backend + Frontend + Nginx
├── docker-compose.postgres.yml  # Standalone Postgres for local dev (port 5433)
├── AGENTS.md                    # Developer guidelines (rules for AI agents)
├── CLAUDE.md                    # Extended startup protocol
├── README.md                    # Project overview
├── CODE_AUDIT.md                # Security audit findings
├── SECURITY_AUDIT.md            # Security hardening log
├── TEST_PROTOCOL.md             # Testing procedures
├── handoff.md                   # Previous handoff notes
├── .env.example                 # Root env template
├── .gitignore                   # Ignores ward.db*, cookies, node_modules
│
├── ward-backend/                # Express API (see §3)
├── ward-frontend/               # React SPA (see §4)
│
├── nginx/
│   ├── nginx.conf               # Reverse proxy: /api→backend, /→frontend
│   └── proxy_params             # Shared proxy headers
│
├── docs/
│   ├── COMPLIANCE.md            # DPDPA/regulatory compliance notes
│   ├── SECURITY_LOGGING.md      # Security logging architecture
│   ├── plans/                   # Implementation plans & progress trackers
│   │   ├── enterprise-hardening-*.md
│   │   ├── security-remediation-PROGRESS.md
│   │   ├── signup-payment-*.md
│   │   ├── legal-gdpr-mapping.md
│   │   └── launch-monitoring-contingency-*.md
│   └── runbooks/                # Operational runbooks
│       ├── core-workflow-manual-test.md
│       ├── multi-device-sync-validation.md
│       ├── postgres-cutover.md
│       └── stress-test-gate.md
│
├── codemap/
│   ├── CODEMAP.md               # Auto-generated full codebase map
│   ├── file-inventory.json      # Machine-readable file index
│   ├── generate-codemap-index.mjs
│   └── build-codemap-md.mjs
│
├── .github/workflows/
│   ├── ci.yml                   # Backend tests + frontend lint/test/build + audit
│   └── postgres-ci.yml          # Smoke tests against Postgres 16 container
│
└── cursorrules/                 # Editor AI configuration
```

---

## 3. Backend Deep-Dive (`ward-backend/`)

### 3.1 Top-Level Files

| File | Purpose |
|------|---------|
| `server.js` | **Entry point**. Sets up Express, middleware chain, route mounting, startup/migration logic. Exports `{ app }` for tests. |
| `config.js` | Centralizes env parsing: `NODE_ENV`, `JWT_SECRET`, `CORS_ORIGIN`. Validates allowed environments. Throws on missing secrets. |
| `db.js` | SQLite driver initialization. WAL mode, foreign keys, busy timeout. Global sequential transaction queue to prevent nested transactions. |
| `db-postgres.js` | PostgreSQL `pg.Pool` setup. Connection pool (max 20), `withTransaction` using dedicated client. File-based migration runner via `SchemaMigrations` table. |
| `db-adapter.js` | **Critical abstraction**. Translates `?` → `$n` for Postgres. Normalizes row shapes. Exposes `query()`, `queryOne()`, `execute()`, `withTransaction()`. All repo code MUST use this, never raw db.js. |
| `schema.sql` | **Source of truth** for SQLite schema. 563 lines. Contains all CREATE TABLE, ALTER TABLE migrations, and indexes. MigratorService executes this at startup. |
| `package.json` | Dependencies: express, bcrypt, jsonwebtoken, pg, sqlite3, helmet, cors, express-rate-limit, dotenv, uuid |
| `.env` / `.env.example` | Environment configuration (see §10) |

### 3.2 Controllers (Request Handlers)

```
controllers/
├── AuthController.js              # Login/signup/refresh/logout/password-reset (290 lines)
├── PatientController.js           # CRUD patients, discharge, archives (178 lines)
├── MedicationController.js        # Prescribe, administer (MAR), manage medications
├── ObservationController.js       # Record vitals/symptoms/diet/sleep/history
├── PharmacyController.js          # Full pharmacy: inventory, batches, waste, analytics, orders (343 lines)
├── BarcodeController.js           # Barcode registration and lookup (GS1 parsing)
├── EscalationController.js        # Clinical escalation create/review
├── HandoverController.js          # Shift handover notes CRUD
├── TaskController.js              # Clinical task management
├── StatisticsController.js        # Ward-level analytics (demographics, outcomes, admissions)
├── UserController.js              # Admin: create staff members within tenant
├── ReportController.js            # Patient treatment report generation
├── MedicalHistoryController.js    # Past medical/surgical/family/social history
├── AllergiesController.js         # Structured allergy records (drug/food/environmental)
├── ClinicalPresentationController.js # HPI + physical exam findings
├── LabInvestigationsController.js # Lab results per investigation date
├── ImagingController.js           # ECG/X-ray/USG/CT/MRI/PET/Echo/Spirometry reports
├── ProceduresController.js        # Clinical procedures log
├── ClinicalTeamController.js      # Treating team members + remarks
└── ToxicologyController.js        # BAC, drug screen, poison screen, heavy metals
```

**Routing pattern**: Controllers are Express routers mounted in `server.js`:
- `app.use('/api/auth', authRoutes)`
- `app.use('/api/patients', patientRoutes)` — sub-routers for nested resources (medications, observations, etc.)
- `app.use('/api/pharmacy', pharmacyRoutes)`
- `app.use('/api/admin', adminAuditRoutes)`

### 3.3 Services (Business Logic)

```
services/
├── AuthService.js                 # JWT pair generation, bcrypt verify, hospital registration, token rotation
├── PatientService.js              # Patient CRUD orchestration, discharge workflow
├── MedicationService.js           # Prescribe + administer with auto pharmacy deduction (FEFO)
├── ObservationService.js          # Vital ingestion, NEWS2 scoring, trend computation
├── ScoringService.js              # NEWS2 (National Early Warning Score 2) calculation engine
├── ClinicalAuditService.js        # Domain-level audit trail (patient updates, med actions, reports)
├── MigratorService.js             # Schema-first auto-migrations from schema.sql at startup
├── PharmacyAnalyticsService.js    # 30-day consumption forecasting, financial valuation, replenishment
├── PharmacyReorderService.js      # Automated PO generation for low-stock medications
├── WasteService.js                # Clinical waste/spillage: initiate → witness → confirm/cancel
├── StatisticsService.js           # Ward analytics: demographics, disease categories, outcomes (15K lines)
├── StatisticsReportService.js     # Period-based statistical report generation
├── ClinicalDischargeReportService.js # Full discharge report compilation (25K lines)
├── PDFReportService.js            # PDF generation for treatment reports
├── ReportDataService.js           # Aggregates all patient data for report generation
├── ReportVerificationService.js   # HMAC-SHA256 report integrity verification
├── BarcodeService.js              # Barcode registration + lookup
├── DiseaseCategorizer.js          # ICD-style diagnosis categorization for statistics
├── EscalationService.js           # Escalation workflow
├── HandoverNotesService.js        # Handover CRUD
├── TaskService.js                 # Task assignment and completion
├── EmailService.js                # Password reset email delivery
├── PasswordResetService.js        # Token-based password reset flow
│
└── pharmacy/                      # Sub-domain services
    ├── StockService.js            # EDL stock add/remove/update
    ├── BatchService.js            # Batch/lot tracking, FEFO dispensing, recall + trace
    └── TransactionService.js      # Immutable transaction audit trail, stock adjustment
```

**Key integration: MAR → Pharmacy Pipeline**
```
MedicationService.administerMedication()
  → If status === 'given':
    → stockRepo.findByName(med.name, tenantId)
    → txService.adjustStock(stockId, tenantId, -1, 'dispense', user, {patientId})
      → BatchService picks oldest-expiry batch (FEFO)
      → Creates PharmacyTransaction record
      → Updates PharmacyStock.totalQuantity
  → Clinical administration ALWAYS recorded regardless of stock outcome
```

### 3.4 Repositories (Data Access)

```
repositories/
├── AuthRepository.js              # User CRUD, tenant creation, refresh token management, tokenVersion
├── AuthLockoutRepository.js       # Login attempt tracking, DB-backed lockout per username+IP
├── PatientRepository.js           # Patient CRUD, archive snapshot collection, discharge transaction (381 lines)
├── MedicationRepository.js        # Medications + MedicationAdministrations queries
├── ObservationRepository.js       # DailyStats CRUD with cursor pagination
├── EscalationRepository.js        # Escalation CRUD
├── HandoverNotesRepository.js     # HandoverNotes CRUD
├── TaskRepository.js              # Task CRUD with assignee queries
├── BarcodeRepository.js           # BarcodeRegistrations + stock/batch barcode queries
├── DpdpaRepository.js             # Correction requests, grievances, data sharing log, retention review
├── ClinicalChangeLogRepository.js # ClinicalChangeLog inserts
├── ReportRepository.js            # PatientReports metadata
├── PurchaseOrderRepository.js     # PurchaseOrders CRUD
├── WasteRepository.js             # WasteRecords lifecycle
├── MedicalHistoryRepository.js    # MedicalHistory upsert/get
├── StructuredAllergyRepository.js # StructuredAllergies CRUD (soft-delete)
├── ClinicalPresentationRepository.js # ClinicalPresentation upsert/get
├── LabInvestigationRepository.js  # LabInvestigations CRUD (soft-delete)
├── ImagingReportRepository.js     # ImagingReports CRUD (soft-delete)
├── ClinicalProcedureRepository.js # ClinicalProcedures CRUD (soft-delete)
├── ClinicalTeamRepository.js      # ClinicalTeam CRUD (soft-delete)
├── ToxicologyScreenRepository.js  # ToxicologyScreens upsert/get
├── PasswordResetRepository.js     # PasswordResetTokens CRUD
│
└── pharmacy/
    ├── StockRepository.js         # PharmacyStock queries
    ├── BatchRepository.js         # PharmacyBatches with FEFO ordering
    └── TransactionRepository.js   # PharmacyTransactions insert + history
```

**All repositories use `dbAdapter` — never raw `db.js`.**  
**All queries include `tenantId` parameter for multi-tenant isolation.**

### 3.5 Middleware Stack

The middleware executes in this order (defined in `server.js`):

```
1. trust proxy          → parseInt(TRUST_PROXY || '0')
2. CORS                 → Dynamic origin in dev, explicit whitelist in prod
3. Helmet               → CSP headers in production, disabled in dev
4. express.json         → 512kb body limit
5. attachUserIfPresent  → Parses JWT from cookie/header, sets req.user (non-blocking)
6. resolveTenant        → Sets req.tenantId from req.user.tenantId or 'tenant-default'
7. verifyCsrfForMutations → Double-submit CSRF on POST/PUT/PATCH/DELETE (cookie-auth only)
8. detectAttackPatterns  → XSS/SQLi pattern scanner on request bodies
9. submissionLimiter     → Per-user+IP+path rate limit (10/min for mutations)
10. auditLog            → Records all authenticated requests to AuditLogs table
11. requestLogger       → Structured request logging
```

**Individual middleware files:**

| File | Purpose |
|------|---------|
| `auth.js` | `extractToken()` from cookie/header, `attachUserIfPresent()` (soft), `authenticateToken()` (hard 401), `requireRole()` |
| `rbac.js` | Defines 4 roles × 15 permissions. `authorize(PERMISSION)` and `authorizeAny([PERMS])` middleware factories |
| `csrf.js` | Double-submit: JWT carries `csrf` claim, client sends `X-CSRF-Token` header. Allowlist for login/signup/refresh |
| `tenant.js` | 7 tenant-scope guards: `requireTenantPatient`, `requireTenantTask`, `requireTenantMedication`, `requireTenantMedicationAdministration`, `requireTenantEscalation`, `requireTenantPharmacyStock`, `requireTenantPharmacyBatch` |
| `protect.js` | Combined auth+RBAC+tenant in single middleware with structured denial logging |
| `abuseProtection.js` | XSS/SQLi regex scanner (11 patterns), field length limits, honeypot validator, per-form rate limiter |
| `audit.js` | Records every authenticated request: userId, role, action, resource, IP, statusCode, patientId |
| `error.js` | Global error handler. Hides stack traces in production. Logs structured error payloads |
| `requestLogger.js` | Request timing and metadata logging |
| `rateLimiters.js` | Shared rate limiter configurations |
| `resolveTenant.js` | Sets `req.tenantId = req.user?.tenantId || 'tenant-default'` |

### 3.6 Utils

| File | Purpose |
|------|---------|
| `validation.js` | **365 lines**. Validators for: vitals (physiological ranges), patients, discharge, medications, inventory, waste, barcodes, clinical records, signup. `bad()` helper for 400 responses. |
| `passwordSecurity.js` | Two-layer password check: (1) Local set of ~300 common passwords, (2) HIBP k-anonymity API. Graceful degradation if network unavailable. |
| `logger.js` | Buffered structured JSON logger. Flushes every 2s or 50 entries. SIGINT/SIGTERM flush handlers. |
| `gs1Parser.js` | GS1/EAN-128 barcode parsing for pharmaceutical barcodes. |

### 3.7 Scripts

| File | Purpose |
|------|---------|
| `seed.js` | Seeds dev users with PIN-based auth (Dr. Smith/1234, etc.) |
| `seed-test.js` | **76K lines**. Comprehensive test data seeder: 30 patients with full clinical data. Idempotent. |
| `seed_clinical_part1-3.js` | Clinical data seeders (vitals, medications, labs, imaging) |
| `seed_history.js` | Medical history seeder |
| `seed_pharmacy.js` | Pharmacy inventory seeder |
| `comprehensive_seeder.js` | Full demo dataset generator |
| `stressEverything.js` | Concurrent load test harness (17K lines) |
| `migrate-sqlite-to-postgres.js` | Data migration script |
| `migratePostgres.js` | PostgreSQL schema migration runner |
| `cleanup_test_patients.js` | Test data cleanup |
| `check_*.js` | Diagnostic scripts (schema, users, lockouts) |

### 3.8 Tests

```
tests/
├── integration/                   # 18 integration test suites
│   ├── auth.test.js               # Login flow
│   ├── authCookie.test.js         # Cookie-based auth
│   ├── signup.test.js             # Hospital registration
│   ├── rbac.test.js               # Role-based access control
│   ├── tenantIsolation.test.js    # Cross-tenant access prevention
│   ├── patient_guard.test.js      # Patient access guards
│   ├── medications.test.js        # Prescription + MAR flow
│   ├── ingest.test.js             # Vital sign ingestion
│   ├── history.test.js            # Observation history
│   ├── stats.test.js              # Statistics endpoints
│   ├── trends.test.js             # Clinical trend data
│   ├── notes.test.js              # Handover notes
│   ├── tasks.test.js              # Task management
│   ├── audit.test.js              # Audit logging
│   ├── adminAudit.test.js         # Admin audit endpoints
│   ├── barcode.test.js            # Barcode operations
│   ├── reorder.test.js            # Pharmacy reorder
│   └── reports.test.js            # Report generation
│
└── services/
    ├── ScoringService.test.js     # NEWS2 calculation
    ├── scoring.test.js            # Additional scoring tests
    ├── PatientService.test.js     # Patient service logic
    ├── postgresSmoke.test.js      # PostgreSQL connectivity
    └── migratePostgres.test.js    # Migration script tests
```

**Run**: `cd ward-backend && npm test` (Jest, `--runInBand --forceExit`)

---

*Continued in HANDOVER_PART2.md*
# General Ward — Handover Document (Part 2)

## 4. Frontend Deep-Dive (`ward-frontend/`)

### 4.1 Top-Level Files

| File | Purpose |
|------|---------|
| `index.html` | SPA shell. Loads `/src/main.jsx` |
| `vite.config.js` | Vite config with `@tailwindcss/vite` plugin |
| `tsconfig.json` | `strict: false`, `noEmit: true` — TypeScript for IDE support only |
| `eslint.config.js` | Flat ESLint config (React + refresh rules) |
| `package.json` | React 19, react-router-dom, @tanstack/react-query, react-hot-toast, lucide-react, recharts |
| `.env.local` | `VITE_API_BASE=http://localhost:3001` |
| `nginx-spa.conf` | Production Nginx config for SPA fallback |

### 4.2 Source Structure

```
src/
├── main.jsx                       # ReactDOM.createRoot entry
├── App.jsx                        # Router + QueryClient + AuthProvider setup
├── App.css                        # Global app styles
├── index.css                      # Tailwind v4 tokens + custom utilities (6.5K)
├── vite-env.d.ts                  # Vite type declarations
│
├── context/
│   └── AuthContext.jsx            # Auth state: login/signup/logout/logoutAll/changePassword
│
├── utils/
│   ├── api.ts                     # Centralized fetch wrapper with CSRF + silent refresh
│   ├── queryKeys.ts               # TanStack Query key factory (type-safe)
│   ├── clinicalUtils.js           # Clinical display helpers (EWS colors, risk labels)
│   └── patientDisplay.ts          # Patient name/MRN formatting
│
├── views/                         # Page-level route components
│   ├── Login.jsx                  # Username/password form with honeypot
│   ├── Signup.jsx                 # Hospital self-registration (multi-step)
│   ├── ForgotPassword.jsx         # Email-based password reset request
│   ├── ResetPassword.jsx          # Token-validated password reset form
│   ├── PatientDetail.jsx          # Full patient profile (21K) — tabs for vitals/meds/notes/discharge
│   ├── HospitalArchiveDetail.jsx  # Read-only discharged patient snapshot viewer
│   ├── Tasks.jsx                  # Task list with filters
│   ├── AdminAudit.jsx             # Audit log viewer + DPDPA tools (40K — largest view)
│   ├── VerifyReport.jsx           # Public report verification via HMAC hash
│   ├── NotFound.jsx               # 404 page
│   └── Login.test.jsx             # Login component test
│
├── features/                      # Feature-sliced modules
│   ├── dashboard/
│   │   ├── DashboardView.jsx      # Ward overview: patient grid + stats + alerts
│   │   └── components/
│   │       ├── AddPatientModal.jsx # New patient admission form (11K)
│   │       ├── PatientCard.jsx     # NEWS2 risk-stratified patient card
│   │       ├── PatientGrid.jsx    # Responsive patient card grid
│   │       ├── DashboardStats.jsx # Summary statistics banner
│   │       └── DashboardAlerts.jsx # Active alerts panel
│   │
│   ├── pharmacy/
│   │   ├── PharmacyView.jsx       # Pharmacy hub: tabs for inventory/waste/procurement (19K)
│   │   └── components/
│   │       ├── InventoryTable.jsx  # EDL stock table with search/sort/batch drill-down (12K)
│   │       ├── StockStats.jsx     # Financial + stock summary cards
│   │       ├── WasteTab.jsx       # Waste records: initiate → witness → confirm (14K)
│   │       ├── ProcurementTab.jsx # Purchase orders list + status management
│   │       ├── AddStockModal.jsx  # Add new medication to EDL
│   │       ├── AddBatchModal.jsx  # Add batch/lot to existing stock
│   │       ├── AuditLogSlideover.jsx # Transaction history slideover
│   │       └── RegisterBarcodeModal.jsx # Barcode registration
│   │
│   ├── clinical/                  # Clinical record forms (per-patient sub-tabs)
│   │   ├── MedicalHistoryForm.jsx
│   │   ├── StructuredAllergiesForm.jsx
│   │   ├── ClinicalPresentationForm.jsx
│   │   ├── LabInvestigationsForm.jsx
│   │   ├── ImagingReportsForm.jsx
│   │   ├── ProceduresLog.jsx
│   │   ├── ClinicalTeamForm.jsx
│   │   ├── ToxicologyForm.jsx
│   │   └── DischargeReportButton.jsx
│   │
│   └── statistics/
│       ├── StatisticsDashboard.jsx # Analytics hub: charts + filters (16K)
│       └── components/
│           ├── SummaryCards.jsx    # KPI summary (patients, avg stay, mortality)
│           ├── AdmissionTrendLine.jsx # Time-series admissions chart (Recharts)
│           ├── DemographicsBarChart.jsx # Age/gender distribution
│           ├── DiseasePieChart.jsx # Diagnosis category breakdown
│           ├── MedicationTopTable.jsx # Most prescribed medications
│           ├── OutcomeCards.jsx    # Discharge outcome distribution
│           ├── FilterBar.jsx      # Date range + demographic filters
│           └── PeriodSelector.jsx # Period selection (7d/30d/90d/1y)
│
├── components/                    # Shared/reusable components
│   ├── Layout.jsx                 # ProtectedLayout: sidebar nav + role-based menu + Toaster
│   ├── ChangePasswordModal.jsx    # Password change form with validation
│   ├── BarcodeScanner.jsx         # Camera-based barcode scanning
│   ├── modals/
│   │   ├── DischargeModal.jsx     # Discharge workflow form
│   │   ├── EditPatientModal.jsx   # Patient details editor
│   │   └── EscalateModal.jsx     # Clinical escalation form
│   ├── stats/                     # Patient detail tab components
│   │   ├── VitalsTab.jsx          # Vital signs entry + history table (14K)
│   │   ├── MedsTab.jsx           # Prescription + MAR — largest component (33K)
│   │   ├── HistoryTab.jsx        # Observation history timeline
│   │   ├── HandoverNotesPanel.jsx # Shift handover notes
│   │   ├── DischargeSummaryTab.jsx # Discharge summary display (14K)
│   │   ├── DietTab.jsx           # Diet tracking
│   │   └── SleepTab.jsx          # Sleep tracking
│   └── ui/
│       └── tabs.jsx              # Reusable tab component
│
└── test/
    └── setup.js                   # Vitest + Testing Library auto-cleanup
```

### 4.3 State Management

**TanStack Query v5** manages all server state. Query keys in `queryKeys.ts`:

| Key Pattern | Data |
|-------------|------|
| `['patients', viewMode]` | Patient list (active or archived) |
| `['patient', id]` | Single patient detail |
| `['patient', id, 'tasks']` | Patient's tasks |
| `['tasks', 'my', {role, limit}]` | Current user's assigned tasks |
| `['escalations']` | Active escalations |
| `['statistics', type, period, filters]` | Analytics data (6 sub-types) |
| `['clinical', patientId, recordType]` | Clinical records (8 sub-types) |
| `['pharmacy', 'inventory']` | EDL stock (in PharmacyView) |
| `['pharmacy', 'history']` | Transaction audit logs |
| `['pharmacy', 'orders']` | Purchase orders |

**Config**: `staleTime: 30s`, `refetchOnWindowFocus: false`

### 4.4 Auth Flow (Frontend)

```
AuthContext.jsx
├── State: user (sessionStorage), loading, theme (localStorage)
├── login(username, password)
│   → POST /api/auth/login {username, password, website: ''} ← honeypot
│   → Stores user in sessionStorage, CSRF token in sessionStorage
├── signup(payload)
│   → POST /api/auth/signup
│   → Same token handling as login
├── logout()
│   → POST /api/auth/logout → clears sessionStorage + CSRF
├── logoutAll()
│   → POST /api/auth/logout-all → invalidates all sessions, refreshes current
├── changePassword(current, new)
│   → PUT /api/auth/change-password → fresh tokens issued
└── Bootstrap (useEffect on mount)
    → GET /api/auth/me → rehydrates user from cookie if valid
    → Skipped on /login and /signup pages
```

### 4.5 API Client (`api.ts`)

- `API_BASE`: Normalizes `VITE_API_BASE` (appends `/api` if missing)
- All requests include `credentials: 'include'` (sends httpOnly cookies)
- Mutation methods auto-attach `X-CSRF-Token` from sessionStorage
- **401 handling**: Tries silent refresh via `POST /api/auth/refresh`, replays original request if successful. Redirects to `/login` if refresh fails.
- **403 handling**: Throws with status code for component-level handling

---

## 5. Database Schema

### 5.1 Core Clinical Tables

| Table | Rows | Purpose |
|-------|------|---------|
| `Users` | id, name, role, tenantId, passwordHash, email, employeeCode, tokenVersion | App users |
| `Tenants` | id, name, code | Hospital/organization |
| `Patients` | 33 columns | Patient demographics, clinical state, DPDPA fields, insurance |
| `DailyStats` | id, patientId, tenantId, type, data(JSON), recordedBy, timestamp | Vitals, symptoms, diet, sleep, history |
| `Medications` | id, patientId, name, dosage, route, frequency, scheduledTimes, prn, status | Active prescriptions |
| `MedicationAdministrations` | id, medicationId, patientId, status, notes, administeredBy, doseActuallyGiven | MAR records |
| `Escalations` | id, patientId, reason, escalatedBy, status | Clinical escalations |
| `Tasks` | id, patientId, type, dueAt, status, assignee, completedBy | Clinical tasks |
| `HandoverNotes` | id, patientId, shift, note, tags, createdBy | Shift handover |
| `DischargeSummaries` | 17 columns | Discharge data: diagnosis, vitals, prescriptions, follow-up |
| `HospitalArchives` | id, patientId, snapshotJson | Full patient snapshot at discharge |

### 5.2 Clinical Record Tables (Migration 016)

| Table | Purpose |
|-------|---------|
| `MedicalHistory` | Comorbidities, surgical/family/social history (1 per patient) |
| `StructuredAllergies` | Drug/food/environmental allergies with severity (soft-delete) |
| `ClinicalPresentation` | HPI + physical exam findings (1 per patient) |
| `LabInvestigations` | Lab results per date with day labels (soft-delete) |
| `ImagingReports` | Multi-modality: ECG/XRay/USG/CT/MRI/PET/Echo/Spirometry |
| `ClinicalProcedures` | Procedures log with outcomes |
| `ClinicalTeam` | Treating team with registration numbers + clinical remarks |
| `ToxicologyScreens` | BAC, drug screen, poison screen, heavy metals |

### 5.3 Pharmacy Tables

| Table | Purpose |
|-------|---------|
| `PharmacyStock` | EDL inventory: name, composition, type, units, cost, barcode |
| `PharmacyBatches` | Lot/batch tracking: batchNumber, expiryDate, quantity, status (active/expired/recalled/depleted) |
| `PharmacyTransactions` | Immutable audit trail: restock/dispense/adjustment/waste |
| `PurchaseOrders` | Procurement: pending/ordered/received/cancelled |
| `WasteRecords` | Waste management: initiate → witness → confirm lifecycle |
| `BarcodeRegistrations` | Barcode → stock/batch mapping with audit trail |

### 5.4 Auth & Audit Tables

| Table | Purpose |
|-------|---------|
| `AuthLoginAttempts` | DB-backed login lockout (username + IP compound key) |
| `RefreshTokens` | Long-lived refresh tokens with IP/UA tracking |
| `PasswordResetTokens` | One-time-use reset tokens with HMAC hash |
| `AuditLogs` | Every authenticated request: user, action, resource, IP, status, patientId |
| `ClinicalChangeLog` | Domain-level entity changes (patient updates, med actions) |
| `IdempotencyKeys` | Deduplication for critical mutations |
| `PatientReports` | Report metadata + HMAC-SHA256 integrity hash |

### 5.5 DPDPA Compliance Tables

| Table | Purpose | DPDPA Section |
|-------|---------|---------------|
| `DpdpaCorrectionRequests` | Data correction/erasure requests | §12 |
| `DpdpaGrievances` | Complainant grievance tracking | §13 |
| `DpdpaDataSharingLog` | Records of data shared with third parties | §11 |
| `Patients.retention_due_at` | 5-year NMC retention tracking | Rule 8 |
| `Patients.notice_given_at` | Data processing notice timestamp | §5 |
| `Patients.data_nominee` | Data nominee for deceased/incapacitated | §14 |

### 5.6 Indexes

The schema defines **40+ indexes** for performance:
- Composite tenant+timestamp indexes on high-traffic tables
- Partial unique indexes for barcodes (`WHERE barcode IS NOT NULL`)
- Patient-scoped indexes on all clinical tables
- Timestamp-descending indexes for audit log queries

---

## 6. API Reference

### 6.1 Authentication (`/api/auth`)

| Method | Endpoint | Auth | Rate Limit | Purpose |
|--------|----------|------|------------|---------|
| POST | `/login` | ❌ | 10/15min | Authenticate → access token (15m cookie) + refresh token (30d cookie) |
| POST | `/signup` | ❌ | 5/hr | Register hospital + admin user → auto-login |
| POST | `/refresh` | ❌ (refresh cookie) | 20/min | Exchange refresh token → new token pair (rotation) |
| POST | `/logout` | ✅ | — | Invalidate refresh token + bump tokenVersion |
| POST | `/logout-all` | ✅ | — | Invalidate ALL sessions → new token pair for caller |
| GET | `/me` | ✅ | — | Return current user + fresh CSRF token |
| PUT | `/change-password` | ✅ | 5/min | Change password → invalidate all sessions → new pair |
| POST | `/forgot-password` | ❌ | 3/hr | Send reset link (constant-time response) |
| GET | `/reset-password/validate` | ❌ | — | Check if reset token is valid |
| POST | `/reset-password` | ❌ | 3/hr | Execute password reset → revoke all sessions |

### 6.2 Patients (`/api/patients`)

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/` | READ_PATIENT | List active patients (limit 500) |
| POST | `/` | WRITE_PATIENT | Create patient |
| GET | `/archives` | READ_PATIENT | List discharged patients |
| GET | `/archives/:archiveId` | READ_PATIENT | Full discharge snapshot |
| GET | `/:id` | READ_PATIENT + tenant | Get patient by ID |
| PUT | `/:id` | WRITE_PATIENT + tenant | Update patient |
| POST | `/:id/discharge` | DISCHARGE_PATIENT + tenant | Discharge with summary + archive |
| GET | `/:id/discharge-summary` | READ_PATIENT + tenant | Get discharge summary |

### 6.3 Clinical Records (nested under `/api/patients`)

| Endpoint Pattern | Purpose |
|-----------------|---------|
| `/:patientId/medications` | Prescriptions CRUD |
| `/:patientId/medications/:medId/administer` | Record medication administration |
| `/:patientId/medications/:medId/administrations` | MAR history |
| `/:patientId/history` | Observation history |
| `/:patientId/stats` | Record vitals/symptoms/diet/sleep |
| `/:patientId/escalations` | Escalation CRUD |
| `/:patientId/handover-notes` | Handover notes CRUD |
| `/:patientId/medical-history` | Medical history upsert/get |
| `/:patientId/allergies` | Structured allergies CRUD |
| `/:patientId/clinical-presentation` | HPI + physical exam |
| `/:patientId/lab-investigations` | Lab results CRUD |
| `/:patientId/imaging-reports` | Imaging reports CRUD |
| `/:patientId/procedures` | Procedures log CRUD |
| `/:patientId/clinical-team` | Clinical team CRUD |
| `/:patientId/toxicology` | Toxicology screen upsert/get |

### 6.4 Pharmacy (`/api/pharmacy`)

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/inventory` | READ_PHARMACY | Full EDL stock list |
| POST | `/inventory` | MANAGE_PHARMACY | Add medication to EDL |
| PATCH | `/inventory/:id` | MANAGE_PHARMACY + tenant | Adjust stock level |
| DELETE | `/inventory/:id` | MANAGE_PHARMACY + tenant | Remove medication |
| GET | `/inventory/:stockId/batches` | READ_PHARMACY + tenant | Batch list for medication |
| POST | `/inventory/:stockId/batches` | MANAGE_PHARMACY + tenant | Add batch/lot |
| POST | `/batches/:batchId/recall` | MANAGE_PHARMACY + tenant | Recall batch |
| GET | `/recall-trace/:batchId` | MANAGE_PHARMACY + tenant | Trace patients affected by batch |
| GET | `/batches/search?lotNumber=X` | READ_PHARMACY | Search batches by lot number |
| POST | `/inventory/:stockId/sync` | MANAGE_PHARMACY + tenant | Recalculate stock from batches |
| GET | `/history` | READ_PHARMACY | Transaction audit trail |
| GET | `/analytics/consumption` | READ_PHARMACY | Consumption burn rates |
| GET | `/analytics/financial` | MANAGE_PHARMACY or VIEW_AUDIT | Financial valuation |
| GET | `/analytics/replenishment` | READ_PHARMACY | 30-day replenishment forecast |
| GET | `/orders` | READ_PHARMACY | List purchase orders |
| PATCH | `/orders/:id/status` | MANAGE_PHARMACY | Update PO status |
| POST | `/orders/check-all` | MANAGE_PHARMACY | Trigger auto-reorder check |
| POST | `/waste` | MANAGE_PHARMACY | Initiate waste record |
| GET | `/waste/pending` | READ_PHARMACY | List pending waste |
| GET | `/waste` | READ_PHARMACY | List all waste records |
| POST | `/waste/:id/confirm` | MANAGE_PHARMACY | Witness confirm waste |
| POST | `/waste/:id/cancel` | MANAGE_PHARMACY | Cancel waste record |

### 6.5 Admin & DPDPA (`/api/admin`)

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/audit-logs` | VIEW_AUDIT | Paginated system audit logs |
| GET | `/audit-logs/export.csv` | VIEW_AUDIT | CSV export of audit logs |
| GET | `/audit-logs/patient/:patientId` | VIEW_AUDIT | Who accessed this patient's data |
| POST | `/audit/purge` | PURGE_AUDIT | Delete old audit logs (with dryRun) |
| GET | `/clinical-changes` | VIEW_AUDIT | Domain-level change log |
| GET | `/dpdpa/breach-report` | VIEW_AUDIT | DPDPA §8 breach notification report |
| POST/GET/PUT | `/dpdpa/correction-requests` | VIEW_AUDIT | DPDPA §12 data correction requests |
| POST/GET/PUT | `/dpdpa/grievances` | VIEW_AUDIT | DPDPA §13 grievance management |
| POST/GET | `/dpdpa/data-sharing` | VIEW_AUDIT | DPDPA §11 data sharing log |
| GET | `/dpdpa/retention-review` | VIEW_AUDIT | DPDPA Rule 8 retention review |

---

*Continued in HANDOVER_PART3.md*
# General Ward — Handover Document (Part 3)

## 7. Security & Cybersecurity

### 7.1 Security Architecture Overview

```
┌──────────────────── DEFENSE IN DEPTH ────────────────────────┐
│                                                               │
│  Layer 1: NETWORK                                             │
│  ├── Nginx reverse proxy (TLS termination)                   │
│  ├── CORS whitelist enforcement in production                │
│  └── TRUST_PROXY=0 prevents IP spoofing (rate limit bypass)  │
│                                                               │
│  Layer 2: TRANSPORT                                           │
│  ├── httpOnly cookies (no JS access to tokens)               │
│  ├── Secure flag on cookies in production                    │
│  ├── SameSite=lax default (configurable to None)             │
│  └── Helmet CSP headers in production                        │
│                                                               │
│  Layer 3: AUTHENTICATION                                      │
│  ├── JWT access tokens (15-min TTL, HS256)                   │
│  ├── Opaque refresh tokens (30-day TTL, DB-backed)           │
│  ├── Token version check (instant revocation)                │
│  ├── bcrypt (cost factor 12)                                 │
│  ├── DB-backed login lockout (per username+IP)               │
│  └── Rate limiting on all auth endpoints                     │
│                                                               │
│  Layer 4: AUTHORIZATION                                       │
│  ├── RBAC: 4 roles × 15 permissions                         │
│  ├── Tenant isolation on every data query                    │
│  └── Resource-level guards (tenant.js middleware)            │
│                                                               │
│  Layer 5: INPUT VALIDATION                                    │
│  ├── 11 XSS/SQLi regex patterns scanned on all bodies       │
│  ├── Field-level length limits (10K default, 50K clinical)   │
│  ├── Honeypot field on login/signup forms                    │
│  ├── Comprehensive server-side validation (365 lines)        │
│  └── Physiological range checks on clinical data             │
│                                                               │
│  Layer 6: AUDIT & MONITORING                                  │
│  ├── AuditLogs: every authenticated request                  │
│  ├── ClinicalChangeLog: domain-level entity changes          │
│  ├── Structured JSON logging (buffered, async)               │
│  └── IP/UA anomaly detection on token refresh                │
│                                                               │
│  Layer 7: DATA PROTECTION                                     │
│  ├── Per-tenant data isolation                               │
│  ├── Soft-delete on clinical records (audit trail)           │
│  ├── 5-year NMC retention enforcement                        │
│  └── DPDPA compliance modules                                │
└───────────────────────────────────────────────────────────────┘
```

### 7.2 Attack Pattern Detection

`abuseProtection.js` scans all mutation request bodies:

| Category | Patterns Detected |
|----------|-------------------|
| XSS | `<script>`, `<iframe>`, `javascript:`, `vbscript:`, `on*=` event handlers |
| SQL Injection | `UNION SELECT`, stacked statements (`;DROP`), comment injection (`'--`), boolean tautologies (`' OR '1'='1`) |
| Oversized fields | Default 10K chars, clinical fields 50K chars |

**Design**: Conservative patterns to avoid blocking legitimate clinical text containing SQL keywords.

### 7.3 Password Security

Two-layer check in `passwordSecurity.js`:

1. **Local Set** (~300 common passwords): instant, works offline
2. **HIBP API** (k-anonymity): Only first 5 hex chars of SHA-1 sent. Covers billions of breached passwords. 4-second timeout, graceful degradation if network unavailable.

### 7.4 Rate Limiting Summary

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Login | 15 min | 10 per IP |
| Signup | 1 hour | 5 per IP |
| Refresh | 1 min | 20 per IP |
| Change Password | 1 min | 5 per IP |
| Forgot Password | 1 hour | 3 per IP |
| All mutations | 1 min | 10 per user+IP+path |

---

## 8. Authentication & Login Flow

### 8.1 Token Architecture

```
┌─────────────────────────────────────────────────────┐
│                    TOKEN PAIR                        │
│                                                     │
│  ACCESS TOKEN (JWT, 15 min)                         │
│  ├── Cookie: ward_token (httpOnly, path=/)          │
│  ├── Claims: id, name, role, tenantId, csrf, tv     │
│  ├── Fallback: Authorization: Bearer <token>        │
│  └── tokenVersion (tv) checked against DB on use    │
│                                                     │
│  REFRESH TOKEN (Opaque UUID, 30 days)               │
│  ├── Cookie: ward_refresh (httpOnly, path=/api/auth)│
│  ├── Stored in RefreshTokens table with IP + UA     │
│  ├── Rotated on every use (old deleted, new created) │
│  └── Scoped path means only sent to /api/auth/*     │
│                                                     │
│  CSRF TOKEN                                          │
│  ├── 32-byte random hex embedded in JWT `csrf` claim│
│  ├── Returned to client in login/refresh response   │
│  ├── Client stores in sessionStorage                │
│  └── Sent as X-CSRF-Token header on mutations       │
└─────────────────────────────────────────────────────┘
```

### 8.2 Login Sequence

```
Client                          Server
  │                                │
  ├─ POST /api/auth/login ────────►│
  │  {username, password,          │
  │   website: ''}  ← honeypot    │
  │                                │
  │                                ├─ Check honeypot (website must be '')
  │                                ├─ Rate limit check (10/15min per IP)
  │                                ├─ DB lockout check (AuthLoginAttempts)
  │                                ├─ Find user by name
  │                                ├─ bcrypt.compare(password, hash)
  │                                ├─ Generate access JWT (15min, HS256)
  │                                ├─ Generate CSRF token (32 bytes)
  │                                ├─ Create refresh token (UUID → DB)
  │                                ├─ Reset lockout counter
  │                                │
  │◄─ Set-Cookie: ward_token ──────┤
  │◄─ Set-Cookie: ward_refresh ────┤
  │◄─ {user, csrfToken} ──────────┤
  │                                │
  ├─ Store CSRF in sessionStorage  │
  ├─ Store user in sessionStorage  │
```

### 8.3 Silent Refresh Flow

```
Client                          Server
  │                                │
  ├─ API call returns 401 ─────────►│ (access token expired)
  │                                │
  ├─ POST /api/auth/refresh ───────►│ (ward_refresh cookie auto-sent)
  │                                │
  │                                ├─ Find refresh token in DB
  │                                ├─ Check expiry (30 days)
  │                                ├─ Log IP/UA anomalies (no hard block)
  │                                ├─ Delete old refresh token
  │                                ├─ Generate new token pair
  │                                │
  │◄─ New ward_token + ward_refresh┤
  │◄─ New csrfToken ───────────────┤
  │                                │
  ├─ Replay original API call ─────►│ (with new tokens)
```

### 8.4 Session Revocation

| Action | Mechanism |
|--------|-----------|
| Logout (single) | Delete refresh token + increment `tokenVersion` |
| Logout All | Delete ALL refresh tokens for user + increment `tokenVersion` |
| Change Password | New password hash + delete ALL refresh tokens + increment `tokenVersion` |
| Password Reset | New password hash + delete ALL refresh tokens + increment `tokenVersion` |

`tokenVersion` in the JWT (`tv` claim) is checked against DB on every request. If mismatched → 401.

---

## 9. DPDPA 2023 Compliance

### 9.1 Implemented Modules

| DPDPA Section | Feature | Implementation |
|---------------|---------|----------------|
| §5 Notice | Data processing notice tracking | `Patients.notice_given_at`, `notice_given_by` columns |
| §5 Minor | Guardian consent for minors | `Patients.is_minor`, `guardian_name`, `guardian_contact`, `guardian_notice_at` |
| §8 Breach | Breach notification report | `GET /api/admin/dpdpa/breach-report` — generates structured report from audit logs |
| §11 Access | Right to access (who accessed data) | `GET /api/admin/audit-logs/patient/:patientId` — full access log per patient |
| §11 Sharing | Data sharing log | `POST/GET /api/admin/dpdpa/data-sharing` with legal basis tracking |
| §12 Correction | Right to correction/erasure | `POST/GET/PUT /api/admin/dpdpa/correction-requests` with status workflow |
| §13 Grievance | Grievance redressal | `POST/GET/PUT /api/admin/dpdpa/grievances` with category + resolution tracking |
| §14 Nominee | Data nominee for deceased/incapacitated | `Patients.data_nominee`, `data_nominee_relationship` |
| Rule 8 | Data retention review | `GET /api/admin/dpdpa/retention-review` — flags patients approaching 5-year NMC retention |

### 9.2 Retention Policy

- **IPD records**: 5-year retention (NMC regulation, overrides DPDPA 1-year inactivity rule)
- `Patients.retention_due_at` set at discharge: `now + 5 years`
- Admin dashboard flags upcoming and overdue retention reviews

---

## 10. DevOps & Deployment

### 10.1 Local Development

```bash
# First time setup
npm run install-all

# Start both servers (concurrent)
npm start                    # Backend :3001 + Frontend :5173

# Test server with seeded data
bash start-test-server.sh           # Preserves existing data
bash start-test-server.sh --fresh   # Wipes and reloads 30 patients
```

### 10.2 Test Credentials

| Username | Password | Role |
|----------|----------|------|
| Admin User | admin123 | admin |
| Dr. Smith | doctor123 | doctor |
| Dr. Patel | doctor123 | doctor |
| Nurse Joy | nurse123 | nurse |
| Nurse Riya | nurse123 | nurse |
| PharmD Jones | pharma123 | pharmacist |

### 10.3 Environment Variables

**Backend (`ward-backend/.env`)**:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `JWT_SECRET` | **Always** | (crashes if missing) | JWT signing key |
| `CORS_ORIGIN` | **Production** | auto in dev | Comma-separated allowed origins |
| `NODE_ENV` | No | development | development/test/staging/production |
| `PORT` | No | 3001 | API port |
| `DB_DIALECT` | No | sqlite | `sqlite` or `postgres` |
| `PG_HOST/PORT/DATABASE/USER/PASSWORD` | Postgres | — | PostgreSQL connection |
| `DATABASE_URL` | No | — | Full Postgres connection string |
| `PG_POOL_MAX` | No | 20 | Connection pool size |
| `TRUST_PROXY` | No | 0 | Set 1 behind reverse proxy |
| `STARTUP_MODE` | No | full | `full` (migrations) or `perf` (skip) |
| `AUDIT_RETENTION_DAYS` | No | — | Default audit purge retention |

**Frontend (`ward-frontend/.env`)**:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE` | http://localhost:3001 | Backend API origin |

### 10.4 Production Deployment (Docker Compose)

```yaml
# docker-compose.yml runs 4 services:
services:
  postgres:     # PostgreSQL 16 Alpine
  backend:      # Node.js Express API
  frontend:     # Nginx serving built React SPA
  nginx:        # Reverse proxy (TLS, /api routing)
```

Required `.env` at root: `PG_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN`

```bash
bash setup-prod.sh           # Generates .env with random secrets
docker compose up -d         # Start all services
```

### 10.5 CI/CD

**`.github/workflows/ci.yml`**: On push/PR
1. Backend: `npm test` (Jest integration tests)
2. Frontend: `npm run lint` + `npm test` + `npm run build`
3. Both: `npm audit --audit-level=high`

**`.github/workflows/postgres-ci.yml`**: Postgres 16 service container smoke test

### 10.6 RBAC Permission Matrix

| Permission | Doctor | Nurse | Pharmacist | Admin |
|-----------|--------|-------|------------|-------|
| READ_PATIENT | ✅ | ✅ | ❌ | ✅ |
| WRITE_PATIENT | ✅ | ❌ | ❌ | ❌ |
| DISCHARGE_PATIENT | ✅ | ❌ | ❌ | ❌ |
| WRITE_VITALS | ✅ | ✅ | ❌ | ❌ |
| WRITE_MEDICATIONS | ✅ | ❌ | ❌ | ❌ |
| ADMINISTER_MEDS | ✅ | ✅ | ❌ | ❌ |
| WRITE_NOTES | ✅ | ✅ | ❌ | ❌ |
| WRITE_TASKS | ✅ | ✅ | ❌ | ❌ |
| READ_TASKS | ✅ | ✅ | ❌ | ✅ |
| READ_PHARMACY | ✅ | ✅ | ✅ | ❌ |
| MANAGE_PHARMACY | ❌ | ❌ | ✅ | ❌ |
| WRITE_CLINICAL_RECORDS | ✅ | ✅ | ❌ | ❌ |
| VIEW_STATISTICS | ✅ | ✅ | ❌ | ✅ |
| VIEW_AUDIT | ❌ | ❌ | ❌ | ✅ |
| PURGE_AUDIT | ❌ | ❌ | ❌ | ✅ |
| MANAGE_USERS | ❌ | ❌ | ❌ | ✅ |

### 10.7 NEWS2 Clinical Scoring

The ScoringService implements the **National Early Warning Score 2** protocol:

| Parameter | Score 3 | Score 2 | Score 1 | Score 0 | Score 1 | Score 2 | Score 3 |
|-----------|---------|---------|---------|---------|---------|---------|---------|
| Resp Rate | ≤8 | — | 9-11 | 12-20 | — | 21-24 | ≥25 |
| SpO₂ | ≤91 | 92-93 | 94-95 | ≥96 | — | — | — |
| Systolic BP | ≤90 | 91-100 | 101-110 | 111-219 | — | — | ≥220 |
| Heart Rate | ≤40 | — | 41-50 | 51-90 | 91-110 | 111-130 | ≥131 |
| Temperature | ≤35.0 | — | 35.1-36.0 | 36.1-38.0 | 38.1-39.0 | — | ≥39.1 |
| Consciousness | — | — | — | Alert | — | — | V/P/U |
| On Oxygen | — | +2 if yes | — | Air | — | — | — |

**Risk Levels**: Score ≥7 → HIGH/critical, ≥5 → MEDIUM/warning, ≥1 → LOW/stable

---

## 11. Key Integration Flows

### 11.1 Patient Discharge Pipeline

```
1. Doctor clicks "Discharge" → DischargeModal form
2. POST /api/patients/:id/discharge
3. PatientRepository.discharge() in transaction:
   a. UPDATE Patients SET status='discharged'
   b. INSERT DischargeSummaries (17 columns)
   c. collectFullPatientSnapshot() — parallel queries across 15 tables
   d. INSERT HospitalArchives (full JSON snapshot)
   e. SET retention_due_at = now + 5 years
4. Clinical audit log recorded
5. Frontend invalidates patient queries → patient moves to Archives
```

### 11.2 Medication Administration → Pharmacy

```
1. Nurse clicks "Give Dose" on MedsTab
2. POST /api/patients/:id/medications/:medId/administer
3. MedicationService.administerMedication():
   a. Find medication record
   b. If status='given':
      - Find matching EDL stock by name
      - FEFO: BatchService picks oldest-expiry batch
      - Deduct 1 unit from batch → update stock totals
      - Create PharmacyTransaction (type='dispense')
      - If stock error → log but DON'T block administration
   c. Create MedicationAdministrations record
   d. Clinical audit log
```

### 11.3 Hospital Self-Registration

```
1. Signup form: hospital name, code, admin name, email, password
2. POST /api/auth/signup
3. AuthService.registerHospital():
   a. Validate all fields
   b. checkPasswordSecurity() — local list + HIBP
   c. Create Tenant (code = lowercase hospital code)
   d. Create User (role='admin', tenantId=new tenant)
   e. Generate token pair → auto-login
4. New tenant is fully isolated — no data visible from other tenants
```

---

## 12. Important Constraints & Gotchas

1. **JWT_SECRET and CORS_ORIGIN required in production** — server crashes at startup if missing
2. **Stop the API before running tests** — SQLite file lock prevents concurrent access
3. **Never commit** `ward.db*`, `cookies.txt`, or `*_cookies.txt` files
4. **All repo queries must use db-adapter.js** — never raw db.js calls
5. **Every DB query must scope by tenantId** — cross-tenant access returns 403
6. **node_modules are committed** in both packages — run `npm install` only for new deps
7. **Frontend requires Node ≥ 24.0.0**
8. **TRUST_PROXY must be 0** unless behind a controlled reverse proxy
9. **Clinical priority**: Medication administration is never blocked by inventory errors
10. **Token version**: Any password change or logout-all immediately invalidates all existing tokens

---

*End of Handover Document*
