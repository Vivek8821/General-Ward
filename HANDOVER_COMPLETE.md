# General Ward — Comprehensive Handover Document

> **Date**: 2026-05-15 | **Version**: 2.0.0  
> **Application**: General Ward Clinical Operations Platform  
> **Stack**: Express 5 + SQLite/PostgreSQL | React 19 + Vite + TanStack Query v5

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository Root Structure](#2-repository-root-structure)
3. [Backend Deep-Dive (ward-backend/)](#3-backend-deep-dive)
4. [Frontend Deep-Dive (ward-frontend/)](#4-frontend-deep-dive)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Security & Cybersecurity](#7-security)
8. [Authentication & Login Flow](#8-authentication)
9. [DPDPA Compliance](#9-dpdpa)
10. [DevOps & Deployment](#10-devops)
11. [Key Integration Flows](#11-key-integration-flows)
12. [Important Constraints & Gotchas](#12-important-constraints--gotchas)

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
│                                                                 │
│  ┌──────────────────────────────────────────────────┐           │
│  │  TCP :2575 (MLLP)  ← HL7 v2.x from LIMS/PACS    │           │
│  │  services/hl7/  (only when HL7_ENABLED=true)     │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
- **Multi-tenant isolation**: Every query scoped by `tenantId`
- **Dual-database**: SQLite for dev/low-resource, PostgreSQL for production
- **Layered architecture**: Controller → Service → Repository → DB Adapter
- **Clinical-first**: Medication administration never blocked by inventory errors
- **Always-Accept HL7**: ACK is sent before domain processing; machines never see AE for business errors

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
├── handoff.md                   # Previous handoff notes (feature changelog)
├── HANDOVER_COMPLETE.md         # This document
├── .env.example                 # Root env template
├── .gitignore                   # Ignores ward.db*, cookies, node_modules
│
├── ward-backend/                # Express API (see §3)
├── ward-frontend/               # React SPA (see §4)
│
├── tests/
│   └── hl7-mock-sender.js       # HL7 MLLP integration test (3 scenarios)
│
├── nginx/
│   ├── nginx.conf               # Reverse proxy: /api→backend, /→frontend
│   └── proxy_params             # Shared proxy headers
│
├── docs/
│   ├── COMPLIANCE.md            # DPDPA/regulatory compliance notes
│   ├── SECURITY_LOGGING.md      # Security logging architecture
│   ├── plans/                   # Implementation plans & progress trackers
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
| `server.js` | **Entry point**. Express setup, middleware chain, route mounting, startup/migration, HL7 service init. Exports `{ app }` for tests. |
| `config.js` | Centralizes env parsing: `NODE_ENV`, `JWT_SECRET`, `CORS_ORIGIN`. Throws on missing secrets in production. |
| `db.js` | SQLite driver. WAL mode, foreign keys, busy timeout. Sequential transaction queue to prevent nesting. |
| `db-postgres.js` | PostgreSQL `pg.Pool` (max 20). File-based migration runner via `SchemaMigrations` table. |
| `db-adapter.js` | **Critical abstraction**. Translates `?`→`$n` for Postgres. Exposes `query()`, `queryOne()`, `execute()`, `withTransaction()`. All repo code MUST use this. |
| `schema.sql` | **Source of truth** for SQLite schema. Contains all CREATE TABLE, ALTER TABLE migrations, and indexes. MigratorService executes this at startup. |
| `db/schema.js` | JS-based SQLite migration runner. Handles `runIgnoreDuplicateColumn()` for safe `ALTER TABLE` on existing DBs. Used for HL7 and billing column additions. |
| `db/billingCatalogSeed.js` | Seeds ServiceCatalog with default procedure/lab/imaging entries |
| `package.json` | Dependencies: express, bcrypt, jsonwebtoken, pg, sqlite3, helmet, cors, express-rate-limit, dotenv, uuid |
| `.env` / `.env.example` | Environment configuration (see §10) |

### 3.2 Controllers (Request Handlers)

```
controllers/
├── AuthController.js              # Login/signup/refresh/logout/password-reset
├── PatientController.js           # CRUD patients, discharge, archives
├── MedicationController.js        # Prescribe, administer (MAR), manage medications
├── ObservationController.js       # Record vitals/symptoms/diet/sleep/history
├── PharmacyController.js          # Pharmacy: inventory, batches, waste, analytics, orders
├── BarcodeController.js           # Barcode registration and lookup (GS1 parsing)
├── EscalationController.js        # Clinical escalation create/review
├── HandoverController.js          # Shift handover notes CRUD
├── TaskController.js              # Clinical task management
├── StatisticsController.js        # Ward-level analytics
├── UserController.js              # Admin: create staff within tenant
├── ReportController.js            # Patient treatment report generation
├── MedicalHistoryController.js    # Past medical/surgical/family/social history
├── AllergiesController.js         # Structured allergy records
├── ClinicalPresentationController.js # HPI + physical exam
├── LabInvestigationsController.js # Lab results per investigation date
├── ImagingController.js           # ECG/X-ray/USG/CT/MRI/PET/Echo/Spirometry
├── ProceduresController.js        # Clinical procedures log
├── ClinicalTeamController.js      # Treating team + remarks
├── ToxicologyController.js        # BAC, drug screen, poison screen, heavy metals
├── BillingController.js           # Full billing/RCM: services, invoices, lines, payments
└── Hl7StatusController.js         # HL7 server status, inbound messages, orphan queue

routes/                            # Route files (NOT controllers — no business logic)
├── adminAudit.js                  # Mounted at /api/admin — audit logs, DPDPA tools,
│                                  # clinical-changes, breach report, purge
└── reports.js                     # Mounted at /api/reports — generate, verify, history,
                                   # clinical discharge report
```

**Route mounting** (from `server.js`):

| API prefix | Source |
|-----------|--------|
| `/api/auth` | `AuthController.js` |
| `/api/patients` | `PatientController.js` — also sub-mounts Medications, Observations, Escalations, Handover, MedicalHistory, Allergies, ClinicalPresentation, Labs, Imaging, Procedures, ClinicalTeam, Toxicology |
| `/api/escalations` | `EscalationController.js` — **dual-mounted**: also reachable at `/api/patients/:id/escalations` via PatientController sub-router |
| `/api/tasks` | `TaskController.js` |
| `/api/observations` | `ObservationController.js` |
| `/api/pharmacy` | `PharmacyController.js` |
| `/api/pharmacy/barcodes` | `BarcodeController.js` |
| `/api/admin` | `routes/adminAudit.js` |
| `/api/admin/users` | `UserController.js` |
| `/api/reports` | `routes/reports.js` |
| `/api/statistics` | `StatisticsController.js` |
| `/api/billing` | `BillingController.js` |
| `/api/hl7` | `Hl7StatusController.js` |

### 3.3 Services (Business Logic)

```
services/
├── AuthService.js
├── PatientService.js
├── MedicationService.js           # MAR + auto pharmacy deduction (FEFO)
├── ObservationService.js          # Vital ingestion, NEWS2 scoring
├── ScoringService.js              # NEWS2 calculation engine
├── ClinicalAuditService.js
├── MigratorService.js             # schema.sql auto-migrations at startup
├── PharmacyAnalyticsService.js    # 30-day consumption + replenishment forecasting
├── PharmacyReorderService.js      # Automated PO generation
├── WasteService.js                # Waste: initiate → witness → confirm/cancel
├── StatisticsService.js
├── StatisticsReportService.js
├── ClinicalDischargeReportService.js
├── PDFReportService.js
├── ReportDataService.js
├── ReportVerificationService.js   # HMAC-SHA256 report integrity
├── BarcodeService.js
├── DiseaseCategorizer.js
├── EscalationService.js
├── HandoverNotesService.js
├── TaskService.js
├── EmailService.js
├── PasswordResetService.js
│
├── billing/
│   ├── AccrualService.js          # Auto-charges: ward day fees, consultations,
│   │                              # pharmacy dispenses, lab/imaging (idempotent)
│   ├── InvoiceHelpers.js          # findOrCreateOpenInvoice() — shared by AccrualService
│   │                              # and PharmacyBillingHook; auto-creates open invoice
│   │                              # on first chargeable event for a patient
│   ├── PharmacyBillingHook.js     # recordDispenseCharge() — called by MedicationService
│   │                              # after each dispense. Best-effort: billing errors are
│   │                              # swallowed so clinical flow is never blocked
│   └── ServiceCatalogPresenter.js # Formats ServiceCatalog subtype detail rows for display.
│                                  # SUBTYPE_FIELDS manifest drives skip-if-empty rendering
│                                  # for ServiceLab/Imaging/Procedure/Consumable across
│                                  # API, PDF, and print consumers
│
├── hl7/
│   ├── Hl7Parser.js               # MLLP framing, UTF-8/latin-1 decode, segment
│   │                              # parser (MSH/PID/OBR/OBX), ACK builder
│   ├── MllpServer.js              # TCP server, partial-packet buffer reassembly,
│   │                              # fire-and-forget AA, per-IP 60-min watchdog
│   ├── Hl7MappingService.js       # Idempotency, fuzzy MRN match, lab ingest,
│   │                              # orphan protocol, ClinicalChangeLog audit
│   └── index.js                   # start()/stop()/getStatus() lifecycle,
│                                  # Windows netsh firewall hint on win32
│
└── pharmacy/
    ├── StockService.js
    ├── BatchService.js
    └── TransactionService.js
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

**Billing Accrual Pipeline** (`AccrualService.safeAccrueForPatient`):
- Called automatically when any invoice is opened or listed
- Idempotency enforced via partial unique index on `InvoiceLines(tenantId, source, sourceRef) WHERE sourceRef IS NOT NULL`
- Accrues: ward day fees (WardRates × careIntensity), consultation fee, pharmacy dispenses, lab results, imaging reports

**HL7 MLLP Design:**
- AA sent synchronously before `await processMessage()` — domain errors (unknown MRN, duplicate) never produce AE
- Orphan protocol: unresolvable MRNs → `Hl7OrphanedMessages` table for admin linking
- Idempotency guard: duplicate `controlId` (MSH-10) detected before transaction opens

### 3.4 Repositories (Data Access)

```
repositories/
├── AuthRepository.js
├── AuthLockoutRepository.js
├── PatientRepository.js
├── MedicationRepository.js
├── ObservationRepository.js
├── EscalationRepository.js
├── HandoverNotesRepository.js
├── TaskRepository.js
├── BarcodeRepository.js
├── DpdpaRepository.js
├── ClinicalChangeLogRepository.js
├── ReportRepository.js
├── PurchaseOrderRepository.js
├── WasteRepository.js
├── MedicalHistoryRepository.js
├── StructuredAllergyRepository.js
├── ClinicalPresentationRepository.js
├── LabInvestigationRepository.js  # Added createFromHl7(tx, data) for MLLP ingest
├── ImagingReportRepository.js
├── ClinicalProcedureRepository.js
├── ClinicalTeamRepository.js
├── ToxicologyScreenRepository.js
├── PasswordResetRepository.js
├── Hl7OrphanRepository.js         # listPending(), linkToPatient()
│
├── billing/
│   ├── ServiceCatalogRepository.js  # CRUD + search(query, tenantId) ranked typeahead
│   ├── InvoiceRepository.js         # create, listByPatient, findWithDetails,
│   │                                # setDiscount, finalize, cancel
│   ├── InvoiceLineRepository.js     # create (idempotent), delete
│   └── PaymentRepository.js         # record, refund
│
└── pharmacy/
    ├── StockRepository.js
    ├── BatchRepository.js
    └── TransactionRepository.js
```

**All repositories use `dbAdapter` — never raw `db.js`.**  
**All queries include `tenantId` for multi-tenant isolation.**

### 3.5 Middleware Stack

```
1. trust proxy          → parseInt(TRUST_PROXY || '0')
2. CORS                 → Dynamic origin in dev, explicit whitelist in prod
3. Helmet               → CSP in production, disabled in dev
4. express.json         → 512kb body limit
5. attachUserIfPresent  → Parses JWT, sets req.user (non-blocking)
6. resolveTenant        → Sets req.tenantId from JWT or 'tenant-default'
7. verifyCsrfForMutations → Double-submit CSRF on POST/PUT/PATCH/DELETE
8. detectAttackPatterns  → XSS/SQLi pattern scanner on request bodies
9. submissionLimiter     → Per-user+IP+path rate limit (10/min for mutations)
10. auditLog            → Records all authenticated requests to AuditLogs
11. requestLogger       → Structured request/response logging
```

| File | Purpose |
|------|---------|
| `auth.js` | `extractToken()`, `attachUserIfPresent()`, `authenticateToken()`, `requireRole()` |
| `rbac.js` | 4 roles × 16 permissions. `authorize()` and `authorizeAny()` factories |
| `csrf.js` | Double-submit: JWT `csrf` claim vs `X-CSRF-Token` header |
| `tenant.js` | 7 tenant-scope guards for patient/task/medication/escalation/pharmacy resources |
| `protect.js` | Combined auth+RBAC+tenant in one composable middleware with denial logging |
| `abuseProtection.js` | XSS/SQLi scanner (11 patterns), field length limits, honeypot, per-form limiter |
| `audit.js` | Every authenticated request: userId, role, action, resource, IP, statusCode, patientId |
| `error.js` | Global error handler. Strips stack traces in production. Logs structured error payloads |
| `requestLogger.js` | Request timing and metadata logging |
| `rateLimiters.js` | Shared rate limiter configurations |
| `resolveTenant.js` | Sets `req.tenantId = req.user?.tenantId \|\| 'tenant-default'` |

### 3.6 Utils

| File | Purpose |
|------|---------|
| `validation.js` | 365 lines. Validators for vitals, patients, discharge, medications, inventory, waste, barcodes, clinical records, signup. |
| `passwordSecurity.js` | Two-layer check: local ~300 common passwords + HIBP k-anonymity API (graceful degradation). |
| `logger.js` | Buffered structured JSON logger. Flushes every 2s or 50 entries. SIGINT/SIGTERM flush handlers. |
| `gs1Parser.js` | GS1/EAN-128 barcode parsing for pharmaceutical barcodes. |

### 3.7 Tests

```
ward-backend/tests/
├── integration/                   # 18 integration test suites (Jest, --runInBand)
│   ├── auth.test.js, authCookie.test.js, signup.test.js
│   ├── rbac.test.js, tenantIsolation.test.js, patient_guard.test.js
│   ├── medications.test.js, ingest.test.js, history.test.js
│   ├── stats.test.js, trends.test.js, notes.test.js, tasks.test.js
│   ├── audit.test.js, adminAudit.test.js, barcode.test.js
│   ├── reorder.test.js, reports.test.js
│   └── (billing and HL7 tested via manual scripts — see §11)
│
└── services/
    ├── ScoringService.test.js, scoring.test.js
    ├── PatientService.test.js
    └── postgresSmoke.test.js, migratePostgres.test.js

ward-backend/scripts/              # Utility and data scripts (not part of app startup)
├── seed.js                        # Seeds dev users (Dr. Smith, Nurse Joy, etc.)
├── seed-test.js                   # Comprehensive test data: 30 patients + full clinical data (idempotent)
├── seed_clinical_part1-3.js       # Clinical data seeders (vitals, medications, labs, imaging)
├── seed_history.js                # Medical history seeder
├── seed_pharmacy.js               # Pharmacy inventory seeder
├── comprehensive_seeder.js        # Full demo dataset generator
├── stressEverything.js            # Concurrent load test harness
├── stress_test.js                 # Additional stress/load tests
├── migrate-sqlite-to-postgres.js  # One-time data migration: SQLite → PostgreSQL
├── migratePostgres.js             # PostgreSQL schema migration runner
├── cleanup_test_patients.js       # Test data cleanup
├── check_schema.js                # Diagnostic: print live schema state
├── check_users.js                 # Diagnostic: print user records
├── check_lockouts.js              # Diagnostic: print active login lockouts
├── adapter-test.js                # DB adapter smoke test
├── test_gs1.js                    # GS1 barcode parser test
├── verify_pw.js                   # Password hashing verification
└── compareSqlitePostgresCounts.js # Cross-DB row count comparison

# Root-level integration scripts
tests/
└── hl7-mock-sender.js             # 3 HL7 MLLP tests (requires running server)
```

**Run backend tests**: `cd ward-backend && npm test`

---

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
│   ├── dateFormat.ts              # Date formatting helpers (en-IN locale). Used by
│   │                              # PatientCard and clinical components to render
│   │                              # DD-MM-YYYY strings consistently
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
│   │       ├── PatientCard.jsx     # NEWS2 risk-stratified patient card. EWS halo glow + vitals strip.
│   │       │                       # Fixed: hover uses CSS animation (not animation:none),
│   │       │                       # box-shadow uses hex color (not rgba+44 suffix),
│   │       │                       # background uses CSS var (not hardcoded dark value)
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
│   ├── billing/
│   │   └── BillingTab.jsx         # Invoice view, line items, payments, discount,
│   │                              # finalize/cancel. AddLineForm has 280ms debounced
│   │                              # catalog typeahead (30s cache, onMouseDown to
│   │                              # prevent blur race on dropdown selection).
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

**TanStack Query v5** manages all server state (`staleTime: 30s`, `refetchOnWindowFocus: false`).

Centralized keys in `utils/queryKeys.ts` (type-safe factories):

| Key Pattern | Data |
|-------------|------|
| `['patients', viewMode]` | Patient list (active or archived) |
| `['patient', id]` | Single patient detail |
| `['patient', id, 'tasks']` | Patient's tasks |
| `['tasks', 'my', {role, limit}]` | Current user's assigned tasks |
| `['escalations']` | Active escalations |
| `['statistics', 'summary'\|'diseases'\|'demographics'\|'medications'\|'admissions'\|'outcomes', period, filters]` | Analytics (6 named sub-types) |
| `['clinical', patientId, recordType]` | Clinical records (8 sub-types) |

Inline keys (pharmacy and billing components define their own):

| Key Pattern | Data |
|-------------|------|
| `['billing', 'invoices', patientId]` | Patient invoices |
| `['billing', 'invoice', invoiceId]` | Invoice detail with lines + payments |
| `['billing', 'catalog-search', q]` | Service catalog typeahead (enabled ≥2 chars) |
| `['pharmacy', 'inventory']` | EDL stock |
| `['pharmacy', 'history']` | Transaction audit logs |
| `['pharmacy', 'orders']` | Purchase orders |

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

| Table | Purpose |
|-------|---------|
| `Users` | id, name, role, tenantId, passwordHash, email, employeeCode, tokenVersion | App users |
| `Tenants` | id, name, code | Hospital/organization |
| `Patients` | 34 columns — demographics (name, MRN, DOB, gender, blood group, contact, UHID), clinical state (diagnosis, careIntensity, codeStatus), DPDPA fields (notice, guardian, nominee, retention), insurance (provider, policy, TPA) |
| `DailyStats` | id, patientId, tenantId, type, data(JSON), recordedBy, timestamp | Vitals, symptoms, diet, sleep, history |
| `Medications` | id, patientId, name, dosage, route, frequency, scheduledTimes, prn, status | Active prescriptions |
| `MedicationAdministrations` | id, medicationId, patientId, status, notes, administeredBy, doseActuallyGiven | MAR records |
| `Escalations` | id, patientId, reason, escalatedBy, status | Clinical escalations |
| `Tasks` | id, patientId, type, dueAt, status, assignee, completedBy | Clinical tasks |
| `HandoverNotes` | id, patientId, shift, note, tags, createdBy | Shift handover |
| `DischargeSummaries` | 17 columns — discharge data: diagnosis, vitals, prescriptions, follow-up |
| `HospitalArchives` | id, patientId, snapshotJson — full patient snapshot at discharge |

### 5.2 Clinical Record Tables (Migration 016)

| Table | Purpose |
|-------|---------|
| `MedicalHistory` | Comorbidities, surgical/family/social history (1 per patient) |
| `StructuredAllergies` | Drug/food/environmental allergies with severity (soft-delete) |
| `ClinicalPresentation` | HPI + physical exam findings (1 per patient) |
| `LabInvestigations` | Lab results per date with day labels (soft-delete). Added: `source`, `externalMsgId`, `isMachineGenerated` |
| `ImagingReports` | Multi-modality: ECG/XRay/USG/CT/MRI/PET/Echo/Spirometry (soft-delete). Added: `source`, `externalMsgId`, `isMachineGenerated` |
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
| `ClinicalChangeLog` | Domain-level entity changes. HL7 ingests write here with `userId='HL7_SERVICE'`, `userRole='system'` |
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

### 5.7 Billing Tables (Migration 023–025)

| Table | Purpose |
|-------|---------|
| `ServiceCatalog` | Chargeable services: code, name, category, unitPrice. Categories: consultation, ward, procedure, lab, imaging, misc |
| `ServiceLab` | Lab service detail: specimenType, container, methodology, unitsOfMeasure, normalLow/High, turnaroundHours |
| `ServiceImaging` | Imaging detail: modality, bodyRegion, contrast, durationMinutes, radiationDoseMsv |
| `ServiceProcedure` | Procedure detail: anaesthesiaType, otRequired, durationMinutes, surgeonGrade, specialty |
| `ServiceConsumable` | Consumable/misc detail: sku, size, sterile, singleUse, unit |
| `WardRates` | Daily rate per careIntensity level (1–4) |
| `ConsultationRate` | Per-tenant consultation fee |
| `Invoices` | Invoice header: status (open/finalized/paid/cancelled), subtotal, discountTotal, taxTotal, grandTotal, paidTotal, balanceDue |
| `InvoiceLines` | Line items: source (manual/pharmacy/ward/consultation/lab/imaging/procedure), sourceRef, quantity, unitPrice, lineTotal |
| `Payments` | Payments: method (cash/card/upi/razorpay/bank_transfer/other), amount, reference, status (recorded/captured/refunded/failed) |

**Money invariants:**
- `subtotal = SUM(lineTotal)`
- `grandTotal = subtotal − discountTotal + taxTotal`
- `balanceDue = grandTotal − paidTotal`
- Idempotency: `UNIQUE(tenantId, source, sourceRef) WHERE sourceRef IS NOT NULL`

### 5.8 HL7 Integration Tables (Migration 026)

| Table | Purpose |
|-------|---------|
| `Hl7InboundMessages` | All received HL7 messages. Columns: messageId (MSH-10), messageType, sendingApp, sendingFacility, rawMessage, patientId, labRecordId, status (processed/orphaned/duplicate). Unique index on `(tenantId, messageId)` for idempotency. |
| `Hl7OrphanedMessages` | Messages where MRN could not be resolved. Columns: inboundId (FK), rawMrn, rawMessage, linkedPatientId, linkedBy, linkedAt. Admin links via API when patient is identified. |

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
| GET | `/` | READ_PATIENT | List active patients |
| POST | `/` | WRITE_PATIENT | Create patient |
| GET | `/archives` | READ_PATIENT | List discharged patients |
| GET | `/archives/:archiveId` | READ_PATIENT | Full discharge snapshot |
| GET | `/:id` | READ_PATIENT + tenant | Get patient |
| PUT | `/:id` | WRITE_PATIENT + tenant | Update patient |
| POST | `/:id/discharge` | DISCHARGE_PATIENT + tenant | Discharge |
| GET | `/:id/discharge-summary` | READ_PATIENT + tenant | Discharge summary |

### 6.3 Clinical Records (`/api/patients/:id/...`)

| Endpoint | Purpose |
|----------|---------|
| `/medications` | Prescriptions CRUD |
| `/medications/:medId/administer` | Record administration |
| `/medications/:medId/administrations` | MAR history |
| `/history`, `/stats` | Observation history + vitals recording |
| `/escalations` | Escalation CRUD |
| `/handover-notes` | Handover notes CRUD |
| `/medical-history` | Medical history |
| `/allergies` | Structured allergies |
| `/clinical-presentation` | HPI + physical exam |
| `/labs` | Lab results (GET/POST/PUT/DELETE with soft-delete) |
| `/imaging-reports` | Imaging reports |
| `/procedures` | Procedures log |
| `/clinical-team` | Team members |
| `/toxicology` | Toxicology screens |

### 6.4 Pharmacy (`/api/pharmacy`)

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/inventory` | READ_PHARMACY | Full EDL stock list |
| POST | `/inventory` | MANAGE_PHARMACY | Add medication to EDL |
| PATCH | `/inventory/:id` | MANAGE_PHARMACY + tenant | Adjust stock level |
| DELETE | `/inventory/:id` | MANAGE_PHARMACY + tenant | Remove medication |
| GET | `/inventory/:stockId/batches` | READ_PHARMACY + tenant | Batch list for medication |
| POST | `/inventory/:stockId/batches` | MANAGE_PHARMACY + tenant | Add batch/lot |
| POST | `/inventory/:stockId/sync` | MANAGE_PHARMACY + tenant | Recalculate stock from batches |
| POST | `/batches/:batchId/recall` | MANAGE_PHARMACY + tenant | Recall batch |
| GET | `/recall-trace/:batchId` | MANAGE_PHARMACY + tenant | Trace patients affected by batch |
| GET | `/batches/search?lotNumber=X` | READ_PHARMACY | Search batches by lot number |
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
| GET | `/audit-logs/export.csv` | VIEW_AUDIT | CSV export |
| GET | `/audit-logs/patient/:id` | VIEW_AUDIT | Per-patient access log |
| POST | `/audit/purge` | PURGE_AUDIT | Delete old logs |
| GET | `/clinical-changes` | VIEW_AUDIT | Domain-level change log |
| GET | `/dpdpa/breach-report` | VIEW_AUDIT | DPDPA §8 breach report |
| POST/GET/PUT | `/dpdpa/correction-requests` | VIEW_AUDIT | §12 correction requests |
| POST/GET/PUT | `/dpdpa/grievances` | VIEW_AUDIT | §13 grievances |
| POST/GET | `/dpdpa/data-sharing` | VIEW_AUDIT | §11 data sharing log |
| GET | `/dpdpa/retention-review` | VIEW_AUDIT | Rule 8 retention review |

### 6.6 Billing (`/api/billing`)

| Method | Endpoint | Roles | Purpose |
|--------|----------|-------|---------|
| GET | `/services` | admin, doctor, nurse | List service catalog (filter by `?category=`) |
| GET | `/services/search?q=` | admin, doctor, nurse | Ranked typeahead (≥2 chars). Returns code-prefix matches first, then name-prefix, then contains. |
| POST | `/services` | admin | Create service |
| PUT | `/services/:id` | admin | Update service |
| GET | `/patients/:patientId/invoices` | admin, doctor, nurse | List invoices (triggers auto-accrual) |
| POST | `/patients/:patientId/invoices` | admin, doctor | Create invoice |
| GET | `/invoices/:id` | admin, doctor, nurse | Invoice detail with lines + payments |
| POST | `/invoices/:id/lines` | admin, doctor | Add line item |
| DELETE | `/invoices/:id/lines/:lineId` | admin, doctor | Remove line item |
| PUT | `/invoices/:id/discount` | admin, doctor | Set discount amount |
| POST | `/invoices/:id/finalize` | admin, doctor | Lock invoice (no further line edits) |
| POST | `/invoices/:id/cancel` | admin, doctor | Cancel invoice |
| POST | `/invoices/:id/payments` | admin, doctor | Record payment |
| POST | `/invoices/:id/payments/:paymentId/refund` | admin, doctor | Refund payment |

### 6.7 HL7 Status (`/api/hl7`) — admin only

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/status` | MLLP server status, connected devices, silence timers |
| GET | `/messages?limit=50` | Recent inbound HL7 messages (last 200) |
| GET | `/orphans` | Messages waiting for patient linkage |
| POST | `/orphans/:id/link` | Link orphan to a patient `{ patientId }` |

---

## 7. Security & Cybersecurity

### 7.1 Security Architecture

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
│  ├── RBAC: 4 roles × 16 permissions                         │
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

### 7.4 Rate Limiting

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Login | 15 min | 10 per IP |
| Signup | 1 hour | 5 per IP |
| Refresh | 1 min | 20 per IP |
| Change Password | 1 min | 5 per IP |
| Forgot Password | 1 hour | 3 per IP |
| All mutations | 1 min | 10 per user+IP+path |

### 7.5 RBAC Permission Matrix

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

Billing uses `protect()` with inline role checks: readers = admin+doctor+nurse, writers = admin+doctor, service catalog admin = admin only.  
HL7 status endpoints: admin only.

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
│  ├── Rotated on every use (old deleted, new created)│
│  └── Scoped path means only sent to /api/auth/*     │
│                                                     │
│  CSRF TOKEN                                         │
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
  ├─ API call returns 401 ────────►│ (access token expired)
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
| Logout All | Delete ALL refresh tokens + increment `tokenVersion` |
| Change Password | New hash + delete all tokens + increment `tokenVersion` |
| Password Reset | New hash + delete all tokens + increment `tokenVersion` |

`tokenVersion` is embedded in every JWT (`tv` claim) and checked against DB on every request. Mismatch → immediate 401.

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
| `JWT_SECRET` | **Always** | crashes if missing | JWT signing key |
| `CORS_ORIGIN` | **Production** | auto in dev | Comma-separated allowed origins |
| `NODE_ENV` | No | development | development/test/staging/production |
| `PORT` | No | 3001 | API port |
| `DB_DIALECT` | No | sqlite | `sqlite` or `postgres` |
| `PG_HOST/PORT/DATABASE/USER/PASSWORD` | Postgres only | — | PostgreSQL connection |
| `DATABASE_URL` | No | — | Full Postgres connection string |
| `PG_POOL_MAX` | No | 20 | Connection pool size |
| `TRUST_PROXY` | No | 0 | Set 1 behind reverse proxy |
| `STARTUP_MODE` | No | full | `full` (with migrations) or `perf` (skip) |
| `AUDIT_RETENTION_DAYS` | No | — | Default audit purge retention period |
| `HL7_ENABLED` | No | false | Set `true` to start the MLLP TCP listener |
| `HL7_PORT` | No | 2575 | TCP port for MLLP. Standard is 2575; Windows Server requires `netsh advfirewall` to allow inbound TCP on this port (command logged at startup). |
| `HL7_TENANT_ID` | If HL7_ENABLED | — | Which tenant receives HL7 messages |

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

### 10.6 NEWS2 Scoring

| Parameter | Score 3 | Score 2 | Score 1 | Score 0 | Score 1 | Score 2 | Score 3 |
|-----------|---------|---------|---------|---------|---------|---------|---------|
| Resp Rate | ≤8 | — | 9-11 | 12-20 | — | 21-24 | ≥25 |
| SpO₂ | ≤91 | 92-93 | 94-95 | ≥96 | — | — | — |
| Systolic BP | ≤90 | 91-100 | 101-110 | 111-219 | — | — | ≥220 |
| Heart Rate | ≤40 | — | 41-50 | 51-90 | 91-110 | 111-130 | ≥131 |
| Temperature | ≤35.0 | — | 35.1-36.0 | 36.1-38.0 | 38.1-39.0 | ≥39.1 | — |
| Consciousness | — | — | — | Alert | — | — | V/P/U |
| On Oxygen | — | +2 if on O₂ | — | Air | — | — | — |

Risk: ≥7 → HIGH/critical, ≥5 → MEDIUM/warning, ≥1 → LOW/stable

---

## 11. Key Integration Flows

### 11.1 Patient Discharge Pipeline

```
1. Doctor → DischargeModal → POST /api/patients/:id/discharge
2. PatientRepository.discharge() in transaction:
   a. UPDATE Patients SET status='discharged'
   b. INSERT DischargeSummaries
   c. collectFullPatientSnapshot() — 15 tables in parallel
   d. INSERT HospitalArchives (full JSON)
   e. SET retention_due_at = now + 5 years
3. Clinical audit log
4. Frontend invalidates queries → patient moves to Archives
```

### 11.2 Medication Administration → Pharmacy

```
POST /api/patients/:id/medications/:medId/administer
→ MedicationService.administerMedication()
   If status='given':
     → Find EDL stock by name
     → FEFO: BatchService picks oldest-expiry batch
     → Deduct 1 unit, create PharmacyTransaction('dispense')
     → Stock error? Log it — DO NOT block administration
   → Create MedicationAdministrations record
   → Clinical audit log
```

### 11.3 Hospital Self-Registration

```
POST /api/auth/signup
→ AuthService.registerHospital()
   → Validate fields + checkPasswordSecurity (local + HIBP)
   → Create Tenant + admin User
   → Generate token pair → auto-login
   → New tenant fully isolated from all others
```

### 11.4 HL7 Lab Result Ingest (MLLP)

```
LIMS Analyzer  →  TCP :2575 (MLLP)
                   │
                   ├─ MLLP unwrap (VT body FS CR)
                   ├─ UTF-8 decode (falls back to latin-1)
                   ├─ Parse HL7 segments (MSH/PID/OBR/OBX)
                   │
                   ├─ AA sent synchronously ◄── fire-and-forget
                   │
                   └─ processOruR01() [async]
                        │
                        ├─ Idempotency: check Hl7InboundMessages(tenantId, controlId)
                        │   Duplicate? → skip silently (AA already sent)
                        │
                        ├─ fuzzy MRN match:
                        │   normalizeId() strips spaces/dashes/leading zeros
                        │   LOWER(REPLACE(REPLACE(mrn, '-', ''), ' ', '')) = ?
                        │
                        ├─ Patient not found? → Hl7OrphanedMessages (admin links later)
                        │
                        └─ withTransaction():
                             → labRepo.createFromHl7() → LabInvestigations row
                               (source='hl7', isMachineGenerated=1, externalMsgId=controlId)
                             → INSERT Hl7InboundMessages (status='processed')
                             → INSERT ClinicalChangeLog
                               (userId='HL7_SERVICE', action='HL7_INGEST')

Date storage: parseHl7Date() parses full DTM including optional +HHMM/-HHMM
  offset, converts to UTC, stores as DD-MM-YYYY.
  No offset supplied → treated as UTC (configure analyzers to send UTC or include offset).
```

**Windows Server note**: Port 2575 requires a firewall rule. The server logs the exact command on startup when `HL7_ENABLED=true` and `process.platform === 'win32'`:
```
netsh advfirewall firewall add rule name="HL7 MLLP" dir=in action=allow protocol=TCP localport=2575
```

**Running HL7 tests**:
```bash
HL7_ENABLED=true HL7_PORT=2575 HL7_TENANT_ID=tenant-default \
  node ward-backend/server.js &
HL7_TENANT_ID=tenant-default node tests/hl7-mock-sender.js
```
Tests: (1) happy path with real patient MRN, (2) idempotency trap (duplicate message), (3) fuzzy orphan (malformed MRN).

### 11.5 Billing Auto-Accrual

```
GET /api/billing/patients/:patientId/invoices
  → safeAccrueForPatient(patientId, tenantId)
     For the patient's open invoice:
     1. Ward day charges: days since admission × WardRates[careIntensity]
        sourceRef = 'ward:{date}' — idempotent per calendar day
     2. Consultation fees: ConsultationRate × consultation count
        sourceRef = 'consult:{count}' — idempotent
     3. Pharmacy dispenses: each PharmacyTransaction (dispense, patient-linked)
        sourceRef = 'pharmacy:{transactionId}' — idempotent
     4. Lab investigations: each LabInvestigation row
        sourceRef = 'lab:{labId}' — idempotent
     5. Imaging reports: each ImagingReport row
        sourceRef = 'imaging:{reportId}' — idempotent
     → Partial unique index on InvoiceLines prevents double-charging
```

---

## 12. Important Constraints & Gotchas

1. **JWT_SECRET and CORS_ORIGIN required in production** — server crashes at startup if missing
2. **Stop the API before running Jest tests** — SQLite file lock prevents concurrent access
3. **Never commit** `ward.db*`, `cookies.txt`, or `*_cookies.txt`
4. **All DB access via `db-adapter.js`** — never raw `db.js` calls directly
5. **Every query must scope by `tenantId`** — cross-tenant returns 403
6. **node_modules may be committed** in both packages — run `npm install` only for new deps
7. **Frontend requires Node ≥ 24.0.0**
8. **TRUST_PROXY must be 0** unless behind a controlled reverse proxy
9. **Clinical priority**: Medication administration is never blocked by inventory errors
10. **tokenVersion**: Any password change or logout-all immediately invalidates all existing tokens
11. **HL7 is off by default** — set `HL7_ENABLED=true` to start the MLLP listener; `HL7_TENANT_ID` is mandatory alongside it
12. **HL7 dates stored as DD-MM-YYYY** — consistent with the rest of clinical date fields in the schema
13. **Billing accrual is idempotent** — calling it multiple times (on every invoice fetch) is safe; the partial unique index on `InvoiceLines.sourceRef` is the hard guard
14. **PatientCard hover**: uses CSS animation (`card-halo` / `card-halo-urgent`) for the halo effect. The hover state adds only `boxShadow` and `backgroundColor` as inline styles — never `animation: none`, which would cancel the `slideUpFade` animation and make the card invisible
15. **Billing service search**: minimum 2 characters required; results are ranked by code-prefix (0) → name-prefix (1) → contains (2) and capped at 20

---

*End of Handover Document — v2.0.0*
