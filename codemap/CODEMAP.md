# General Ward — repository codemap

This file is part of the repo documentation/audit trail.
DO NOT DELETE `codemap/CODEMAP.md`. It is regenerated from `codemap/file-inventory.json` and is used for developer navigation and completeness checks.

Generated from `codemap/file-inventory.json` (run `node codemap/generate-codemap-index.mjs` first, then this script).

---

## Table of contents
- [Architecture overview](#architecture-overview)
- [Feature workflows](#feature-workflows)
- [Automation and scripts](#automation-and-scripts)
- [Data model (SQLite)](#data-model-sqlite)
- [Third-party inventory strategy](#third-party-inventory-strategy)
- [First-party file inventory](#first-party-file-inventory)
- [Completeness and known limitations](#completeness-and-known-limitations)

---

## Architecture overview

Monorepo with a **React (Vite) SPA** in `ward-frontend/` and an **Express + SQLite** API in `ward-backend/`. The root `package.json` orchestrates install/run.

### Component diagram

```mermaid
flowchart LR
  subgraph Client
    FE[ward-frontend React]
  end
  subgraph API
    EX[Express server.js]
    MW[auth / audit / tenant middleware]
    SVC[services]
    REPO[repositories]
    DB[(SQLite ward.db)]
  end
  FE -->|HTTPS JSON| EX
  EX --> MW
  MW --> SVC
  SVC --> REPO
  REPO --> DB
```

## Feature workflows

### Login and session

- UI: `ward-frontend/src/views/Login.jsx`, `ward-frontend/src/context/AuthContext.jsx`.
- API: `/api/auth/*`.

- Key implementation files:
  - `ward-backend/controllers/AuthController.js`
  - `ward-backend/services/AuthService.js`
  - `ward-backend/middleware/auth.js`
  - `ward-backend/repositories/AuthRepository.js`

### Dashboard (patient list / ward overview)

- UI: `ward-frontend/src/views/Dashboard.jsx`, `ward-frontend/src/utils/api.js`.
- API: `/api/patients`.

- Key implementation files:
  - `ward-backend/controllers/PatientController.js`
  - `ward-backend/services/PatientService.js`
  - `ward-backend/repositories/PatientRepository.js`

### 📑 Patient Treatment Report & Verification (Phase 11)

- UI: `ward-frontend/src/components/stats/DischargeSummaryTab.jsx`.
- API: `/api/reports`.

- Key implementation files:
  - `ward-backend/controllers/ReportController.js`
  - `ward-backend/services/ReportDataService.js`
  - `ward-backend/services/PDFReportService.js`
  - `ward-backend/services/ReportVerificationService.js`
  - `ward-backend/repositories/ReportRepository.js`

### Patient chart tabs (vitals, diet, sleep, scoring)

- UI: `ward-frontend/src/views/PatientDetail.jsx`, `ward-frontend/src/components/stats/VitalsTab.jsx`, `ward-frontend/src/components/stats/DietTab.jsx`, `ward-frontend/src/components/stats/SleepTab.jsx`.
- API: `/api/patients/:patientId/stats`, `/api/observations/*`.

- Key implementation files:
  - `ward-backend/routes/stats.js`
  - `ward-backend/routes/observations.js`
  - `ward-backend/services/ScoringService.js`

### Pharmacy Barcode & QR

- UI: `ward-frontend/src/components/BarcodeScanner.jsx`, `ward-frontend/src/views/Pharmacy.jsx`, `ward-frontend/src/components/stats/MedsTab.jsx`.
- API: `/api/pharmacy/scan/:code`, `/api/pharmacy/barcode/register`, `/api/pharmacy/stock/:stockId/qr`.

- Key implementation files:
  - `ward-backend/controllers/BarcodeController.js`
  - `ward-backend/services/BarcodeService.js`
  - `ward-backend/repositories/BarcodeRepository.js`
  - `ward-backend/utils/gs1Parser.js`

### Medications and MAR

- UI: `ward-frontend/src/components/stats/MedsTab.jsx`.
- API: `/api/patients/:patientId/medications`.

- Key implementation files:
  - `ward-backend/routes/medications.js`

### History timeline

- UI: `ward-frontend/src/components/stats/HistoryTab.jsx`.
- API: `/api/patients/:patientId/history`.

- Key implementation files:
  - `ward-backend/routes/history.js`

### Escalations

- UI: `ward-frontend/src/views/PatientDetail.jsx`.
- API: `/api/patients/:patientId/escalations`.

- Key implementation files:
  - `ward-backend/controllers/EscalationController.js`
  - `ward-backend/services/EscalationService.js`
  - `ward-backend/repositories/EscalationRepository.js`

### Tasks (ward board)

- UI: `ward-frontend/src/views/Tasks.jsx`.
- API: `/api/tasks`.

- Key implementation files:
  - `ward-backend/routes/tasks.js`
  - `ward-backend/services/TaskService.js`
  - `ward-backend/repositories/TaskRepository.js`
  - `ward-backend/middleware/tenant.js`

### Handover / patient notes

- UI: `ward-frontend/src/components/stats/HandoverNotesPanel.jsx`.
- API: `/api/patients/:patientId/notes`.

- Key implementation files:
  - `ward-backend/routes/patientNotes.js`
  - `ward-backend/services/HandoverNotesService.js`
  - `ward-backend/repositories/HandoverNotesRepository.js`

### Discharge / archive

- UI: `ward-frontend/src/components/stats/DischargeSummaryTab.jsx`.
- API: `/api/patients/archives`.

- Key implementation files:
  - `ward-backend/controllers/PatientController.js`
  - `ward-backend/services/PatientService.js`

## Automation and scripts

| Location | Command | Purpose |
| --- | --- | --- |
| Root | `npm run install-all` | Install backend + frontend deps. |
| Root | `npm start` | Run API and Vite dev server together (concurrently). |
| ward-backend | `npm test` | Jest + Supertest tests. |
| codemap | `node codemap/generate-codemap-index.mjs` | Regenerate `codemap/file-inventory.json`. |
| codemap | `node codemap/build-codemap-md.mjs` | Regenerate this codemap markdown. |

## Data model (SQLite)

Schema is defined/bootstrapped in `ward-backend/db.js` and uses `DailyStats` with a JSON/text `data` payload for multiple types.

### Data files on disk

- `ward-backend/scratch/ward.db` — runtime/DB artifact, not app source.
- `ward-backend/ward.db` — runtime/DB artifact, not app source.

## Third-party inventory strategy

`node_modules/**` is included in the inventory (`category: "thirdParty"`) and referenced via `packageName` in `codemap/file-inventory.json`. This markdown does not enumerate every third-party file.

## First-party file inventory

**211** first-party paths. Each entry provides a high-level reason; open the file for authoritative behavior.

<a id="fp-cursorrules"></a>
### `.cursorrules`

First-party file (open to inspect exact behavior).

<a id="fp-github-workflows-ci-yml"></a>
### `.github/workflows/ci.yml`

First-party file (open to inspect exact behavior).

<a id="fp-github-workflows-postgres-ci-yml"></a>
### `.github/workflows/postgres-ci.yml`

First-party file (open to inspect exact behavior).

<a id="fp-gitignore"></a>
### `.gitignore`

First-party file (open to inspect exact behavior).

<a id="fp-admin-cookies-txt"></a>
### `admin_cookies.txt`

First-party file (open to inspect exact behavior).

<a id="fp-cookies-txt"></a>
### `cookies.txt`

First-party file (open to inspect exact behavior).

<a id="fp-cursorrules-md"></a>
### `cursorrules.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-cursorrules-session-init-md"></a>
### `cursorrules/SESSION_INIT.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docker-compose-postgres-yml"></a>
### `docker-compose.postgres.yml`

First-party file (open to inspect exact behavior).

<a id="fp-docs-compliance-md"></a>
### `docs/COMPLIANCE.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-enterprise-hardening-detailed-md"></a>
### `docs/plans/enterprise-hardening-detailed.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-enterprise-hardening-progress-md"></a>
### `docs/plans/enterprise-hardening-PROGRESS.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-launch-monitoring-contingency-detailed-md"></a>
### `docs/plans/launch-monitoring-contingency-detailed.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-launch-monitoring-contingency-progress-md"></a>
### `docs/plans/launch-monitoring-contingency-PROGRESS.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-legal-gdpr-mapping-md"></a>
### `docs/plans/legal-gdpr-mapping.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-patient-detail-ui-refresh-detailed-md"></a>
### `docs/plans/patient-detail-ui-refresh-detailed.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-patient-detail-ui-refresh-progress-md"></a>
### `docs/plans/patient-detail-ui-refresh-PROGRESS.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-security-remediation-progress-md"></a>
### `docs/plans/security-remediation-PROGRESS.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-signup-payment-detailed-md"></a>
### `docs/plans/signup-payment-detailed.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-plans-signup-payment-progress-md"></a>
### `docs/plans/signup-payment-PROGRESS.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-runbooks-core-workflow-manual-test-md"></a>
### `docs/runbooks/core-workflow-manual-test.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-runbooks-multi-device-sync-validation-md"></a>
### `docs/runbooks/multi-device-sync-validation.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-runbooks-postgres-cutover-md"></a>
### `docs/runbooks/postgres-cutover.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-runbooks-stress-test-gate-md"></a>
### `docs/runbooks/stress-test-gate.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-docs-security-logging-md"></a>
### `docs/SECURITY_LOGGING.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-doctor-cookies-txt"></a>
### `doctor_cookies.txt`

First-party file (open to inspect exact behavior).

<a id="fp-package-lock-json"></a>
### `package-lock.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-package-json"></a>
### `package.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-readme-md"></a>
### `README.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-ward-backend-env-example"></a>
### `ward-backend/.env.example`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-check-lockouts-js"></a>
### `ward-backend/check_lockouts.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-check-schema-js"></a>
### `ward-backend/check_schema.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-check-users-js"></a>
### `ward-backend/check_users.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-codenav-md"></a>
### `ward-backend/CODENAV.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-ward-backend-config-js"></a>
### `ward-backend/config.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-authcontroller-js"></a>
### `ward-backend/controllers/AuthController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-barcodecontroller-js"></a>
### `ward-backend/controllers/BarcodeController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-escalationcontroller-js"></a>
### `ward-backend/controllers/EscalationController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-handovercontroller-js"></a>
### `ward-backend/controllers/HandoverController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-medicationcontroller-js"></a>
### `ward-backend/controllers/MedicationController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-observationcontroller-js"></a>
### `ward-backend/controllers/ObservationController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-patientcontroller-js"></a>
### `ward-backend/controllers/PatientController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-pharmacycontroller-js"></a>
### `ward-backend/controllers/PharmacyController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-reportcontroller-js"></a>
### `ward-backend/controllers/ReportController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-controllers-taskcontroller-js"></a>
### `ward-backend/controllers/TaskController.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-db-js"></a>
### `ward-backend/db.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-db-schema-js"></a>
### `ward-backend/db/schema.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-dbadapter-index-js"></a>
### `ward-backend/dbAdapter/index.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-dbadapter-postgresadapter-js"></a>
### `ward-backend/dbAdapter/postgresAdapter.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-dbadapter-sqliteadapter-js"></a>
### `ward-backend/dbAdapter/sqliteAdapter.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-dbadapter-sqlplaceholders-js"></a>
### `ward-backend/dbAdapter/sqlPlaceholders.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-implementation-state-json"></a>
### `ward-backend/IMPLEMENTATION_STATE.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-ward-backend-legacy-readme-md"></a>
### `ward-backend/legacy/README.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-ward-backend-legacy-routes-auth-js"></a>
### `ward-backend/legacy/routes/auth.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-legacy-routes-patients-js"></a>
### `ward-backend/legacy/routes/patients.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-middleware-audit-js"></a>
### `ward-backend/middleware/audit.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-middleware-auth-js"></a>
### `ward-backend/middleware/auth.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-middleware-csrf-js"></a>
### `ward-backend/middleware/csrf.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-middleware-error-js"></a>
### `ward-backend/middleware/error.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-middleware-rbac-js"></a>
### `ward-backend/middleware/rbac.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-middleware-requestlogger-js"></a>
### `ward-backend/middleware/requestLogger.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-middleware-tenant-js"></a>
### `ward-backend/middleware/tenant.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-migratepostgres-js"></a>
### `ward-backend/migratePostgres.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-package-lock-json"></a>
### `ward-backend/package-lock.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-ward-backend-package-json"></a>
### `ward-backend/package.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-ward-backend-postgres-migrations-migrations-001-create-schema-migrations-sql"></a>
### `ward-backend/postgres-migrations/migrations/001_create_schema_migrations.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-migrations-002-create-application-schema-sql"></a>
### `ward-backend/postgres-migrations/migrations/002_create_application_schema.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-migrations-003-hospital-archives-sql"></a>
### `ward-backend/postgres-migrations/migrations/003_hospital_archives.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-migrations-004-pharmacy-v2-sql"></a>
### `ward-backend/postgres-migrations/migrations/004_pharmacy_v2.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-migrations-005-pharmacy-batches-sql"></a>
### `ward-backend/postgres-migrations/migrations/005_pharmacy_batches.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-migrations-006-purchase-orders-sql"></a>
### `ward-backend/postgres-migrations/migrations/006_purchase_orders.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-migrations-007-waste-records-sql"></a>
### `ward-backend/postgres-migrations/migrations/007_waste_records.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-migrations-008-user-uniqueness-sql"></a>
### `ward-backend/postgres-migrations/migrations/008_user_uniqueness.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-postgres-migrations-planmigrations-js"></a>
### `ward-backend/postgres-migrations/planMigrations.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-postgres-js"></a>
### `ward-backend/postgres.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-authlockoutrepository-js"></a>
### `ward-backend/repositories/AuthLockoutRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-authrepository-js"></a>
### `ward-backend/repositories/AuthRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-barcoderepository-js"></a>
### `ward-backend/repositories/BarcodeRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-clinicalchangelogrepository-js"></a>
### `ward-backend/repositories/ClinicalChangeLogRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-escalationrepository-js"></a>
### `ward-backend/repositories/EscalationRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-handovernotesrepository-js"></a>
### `ward-backend/repositories/HandoverNotesRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-medicationrepository-js"></a>
### `ward-backend/repositories/MedicationRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-observationrepository-js"></a>
### `ward-backend/repositories/ObservationRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-patientrepository-js"></a>
### `ward-backend/repositories/PatientRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-pharmacy-batchrepository-js"></a>
### `ward-backend/repositories/pharmacy/BatchRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-pharmacy-stockrepository-js"></a>
### `ward-backend/repositories/pharmacy/StockRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-pharmacy-transactionrepository-js"></a>
### `ward-backend/repositories/pharmacy/TransactionRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-purchaseorderrepository-js"></a>
### `ward-backend/repositories/PurchaseOrderRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-reportrepository-js"></a>
### `ward-backend/repositories/ReportRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-taskrepository-js"></a>
### `ward-backend/repositories/TaskRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-repositories-wasterepository-js"></a>
### `ward-backend/repositories/WasteRepository.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-routes-adminaudit-js"></a>
### `ward-backend/routes/adminAudit.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-routes-escalations-js"></a>
### `ward-backend/routes/escalations.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-routes-reports-js"></a>
### `ward-backend/routes/reports.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-schema-sql"></a>
### `ward-backend/schema.sql`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-scratch-seed-pharmacy-js"></a>
### `ward-backend/scratch/seed_pharmacy.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-scratch-stress-test-js"></a>
### `ward-backend/scratch/stress_test.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-scripts-comparesqlitepostgrescounts-js"></a>
### `ward-backend/scripts/compareSqlitePostgresCounts.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-seed-js"></a>
### `ward-backend/seed.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-server-js"></a>
### `ward-backend/server.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-authservice-js"></a>
### `ward-backend/services/AuthService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-barcodeservice-js"></a>
### `ward-backend/services/BarcodeService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-clinicalauditservice-js"></a>
### `ward-backend/services/ClinicalAuditService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-escalationservice-js"></a>
### `ward-backend/services/EscalationService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-handovernotesservice-js"></a>
### `ward-backend/services/HandoverNotesService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-medicationservice-js"></a>
### `ward-backend/services/MedicationService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-migratorservice-js"></a>
### `ward-backend/services/MigratorService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-observationservice-js"></a>
### `ward-backend/services/ObservationService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-patientservice-js"></a>
### `ward-backend/services/PatientService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-pdfreportservice-js"></a>
### `ward-backend/services/PDFReportService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-pharmacy-batchservice-js"></a>
### `ward-backend/services/pharmacy/BatchService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-pharmacy-stockservice-js"></a>
### `ward-backend/services/pharmacy/StockService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-pharmacy-transactionservice-js"></a>
### `ward-backend/services/pharmacy/TransactionService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-pharmacyanalyticsservice-js"></a>
### `ward-backend/services/PharmacyAnalyticsService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-pharmacyreorderservice-js"></a>
### `ward-backend/services/PharmacyReorderService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-reportdataservice-js"></a>
### `ward-backend/services/ReportDataService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-reportverificationservice-js"></a>
### `ward-backend/services/ReportVerificationService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-scoringservice-js"></a>
### `ward-backend/services/ScoringService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-taskservice-js"></a>
### `ward-backend/services/TaskService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-services-wasteservice-js"></a>
### `ward-backend/services/WasteService.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-stresseverything-js"></a>
### `ward-backend/stressEverything.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-test-gs1-js"></a>
### `ward-backend/test_gs1.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-test-output-log"></a>
### `ward-backend/test_output.log`

First-party file (open to inspect exact behavior).

<a id="fp-ward-backend-tests-integration-adminaudit-test-js"></a>
### `ward-backend/tests/integration/adminAudit.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-audit-test-js"></a>
### `ward-backend/tests/integration/audit.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-auth-test-js"></a>
### `ward-backend/tests/integration/auth.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-authcookie-test-js"></a>
### `ward-backend/tests/integration/authCookie.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-barcode-test-js"></a>
### `ward-backend/tests/integration/barcode.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-history-test-js"></a>
### `ward-backend/tests/integration/history.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-ingest-test-js"></a>
### `ward-backend/tests/integration/ingest.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-medications-test-js"></a>
### `ward-backend/tests/integration/medications.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-notes-test-js"></a>
### `ward-backend/tests/integration/notes.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-rbac-test-js"></a>
### `ward-backend/tests/integration/rbac.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-reorder-test-js"></a>
### `ward-backend/tests/integration/reorder.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-reports-test-js"></a>
### `ward-backend/tests/integration/reports.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-stats-test-js"></a>
### `ward-backend/tests/integration/stats.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-tasks-test-js"></a>
### `ward-backend/tests/integration/tasks.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-tenantisolation-test-js"></a>
### `ward-backend/tests/integration/tenantIsolation.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-integration-trends-test-js"></a>
### `ward-backend/tests/integration/trends.test.js`

Integration test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-services-migratepostgres-test-js"></a>
### `ward-backend/tests/services/migratePostgres.test.js`

Unit test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-services-patientservice-test-js"></a>
### `ward-backend/tests/services/PatientService.test.js`

Unit test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-services-postgressmoke-test-js"></a>
### `ward-backend/tests/services/postgresSmoke.test.js`

Unit test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-services-scoring-test-js"></a>
### `ward-backend/tests/services/scoring.test.js`

Unit test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-tests-services-scoringservice-test-js"></a>
### `ward-backend/tests/services/ScoringService.test.js`

Unit test validating service/routes behavior (run via `npm test` in `ward-backend`).

<a id="fp-ward-backend-utils-gs1parser-js"></a>
### `ward-backend/utils/gs1Parser.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-utils-logger-js"></a>
### `ward-backend/utils/logger.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-utils-validation-js"></a>
### `ward-backend/utils/validation.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-backend-verify-pw-js"></a>
### `ward-backend/verify_pw.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-env-example"></a>
### `ward-frontend/.env.example`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-gitignore"></a>
### `ward-frontend/.gitignore`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-codenav-md"></a>
### `ward-frontend/CODENAV.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-ward-frontend-eslint-config-js"></a>
### `ward-frontend/eslint.config.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-index-html"></a>
### `ward-frontend/index.html`

HTML entry/prototype for the SPA or legacy UI.

<a id="fp-ward-frontend-package-lock-json"></a>
### `ward-frontend/package-lock.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-ward-frontend-package-json"></a>
### `ward-frontend/package.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-ward-frontend-public-vite-svg"></a>
### `ward-frontend/public/vite.svg`

SVG asset (icon/illustration).

<a id="fp-ward-frontend-readme-md"></a>
### `ward-frontend/README.md`

Documentation file that explains how to work with this repo/subsystem.

<a id="fp-ward-frontend-src-app-css"></a>
### `ward-frontend/src/App.css`

Frontend styling (global/app styles).

<a id="fp-ward-frontend-src-app-jsx"></a>
### `ward-frontend/src/App.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-assets-react-svg"></a>
### `ward-frontend/src/assets/react.svg`

SVG asset (icon/illustration).

<a id="fp-ward-frontend-src-components-barcodescanner-jsx"></a>
### `ward-frontend/src/components/BarcodeScanner.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-layout-jsx"></a>
### `ward-frontend/src/components/Layout.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-modals-dischargemodal-jsx"></a>
### `ward-frontend/src/components/modals/DischargeModal.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-modals-editpatientmodal-jsx"></a>
### `ward-frontend/src/components/modals/EditPatientModal.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-modals-escalatemodal-jsx"></a>
### `ward-frontend/src/components/modals/EscalateModal.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-stats-diettab-jsx"></a>
### `ward-frontend/src/components/stats/DietTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-stats-dischargesummarytab-jsx"></a>
### `ward-frontend/src/components/stats/DischargeSummaryTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-stats-handovernotespanel-jsx"></a>
### `ward-frontend/src/components/stats/HandoverNotesPanel.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-stats-historytab-jsx"></a>
### `ward-frontend/src/components/stats/HistoryTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-stats-medstab-jsx"></a>
### `ward-frontend/src/components/stats/MedsTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-stats-sleeptab-jsx"></a>
### `ward-frontend/src/components/stats/SleepTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-stats-vitalstab-jsx"></a>
### `ward-frontend/src/components/stats/VitalsTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-components-ui-tabs-jsx"></a>
### `ward-frontend/src/components/ui/tabs.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-context-authcontext-jsx"></a>
### `ward-frontend/src/context/AuthContext.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-dashboard-components-addpatientmodal-jsx"></a>
### `ward-frontend/src/features/dashboard/components/AddPatientModal.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-dashboard-components-dashboardalerts-jsx"></a>
### `ward-frontend/src/features/dashboard/components/DashboardAlerts.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-dashboard-components-dashboardstats-jsx"></a>
### `ward-frontend/src/features/dashboard/components/DashboardStats.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-dashboard-components-patientcard-jsx"></a>
### `ward-frontend/src/features/dashboard/components/PatientCard.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-dashboard-components-patientgrid-jsx"></a>
### `ward-frontend/src/features/dashboard/components/PatientGrid.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-dashboard-dashboardview-jsx"></a>
### `ward-frontend/src/features/dashboard/DashboardView.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-addbatchmodal-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/AddBatchModal.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-addstockmodal-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/AddStockModal.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-auditlogslideover-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/AuditLogSlideover.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-inventorytable-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/InventoryTable.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-procurementtab-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/ProcurementTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-registerbarcodemodal-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/RegisterBarcodeModal.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-stockstats-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/StockStats.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-components-wastetab-jsx"></a>
### `ward-frontend/src/features/pharmacy/components/WasteTab.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-features-pharmacy-pharmacyview-jsx"></a>
### `ward-frontend/src/features/pharmacy/PharmacyView.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-index-css"></a>
### `ward-frontend/src/index.css`

Frontend styling (global/app styles).

<a id="fp-ward-frontend-src-main-jsx"></a>
### `ward-frontend/src/main.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-test-setup-js"></a>
### `ward-frontend/src/test/setup.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-utils-api-ts"></a>
### `ward-frontend/src/utils/api.ts`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-src-utils-patientdisplay-ts"></a>
### `ward-frontend/src/utils/patientDisplay.ts`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-src-utils-querykeys-ts"></a>
### `ward-frontend/src/utils/queryKeys.ts`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-src-views-adminaudit-jsx"></a>
### `ward-frontend/src/views/AdminAudit.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-close-divs-txt"></a>
### `ward-frontend/src/views/close_divs.txt`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-src-views-divs-txt"></a>
### `ward-frontend/src/views/divs.txt`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-src-views-hospitalarchivedetail-jsx"></a>
### `ward-frontend/src/views/HospitalArchiveDetail.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-login-jsx"></a>
### `ward-frontend/src/views/Login.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-login-test-jsx"></a>
### `ward-frontend/src/views/Login.test.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-notfound-jsx"></a>
### `ward-frontend/src/views/NotFound.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-patientdetail-jsx"></a>
### `ward-frontend/src/views/PatientDetail.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-pharmacy-jsx-bak"></a>
### `ward-frontend/src/views/Pharmacy.jsx.bak`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-src-views-signup-jsx"></a>
### `ward-frontend/src/views/Signup.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-tasks-jsx"></a>
### `ward-frontend/src/views/Tasks.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-views-verifyreport-jsx"></a>
### `ward-frontend/src/views/VerifyReport.jsx`

First-party source code in the backend/frontend layer.

<a id="fp-ward-frontend-src-vite-env-d-ts"></a>
### `ward-frontend/src/vite-env.d.ts`

First-party file (open to inspect exact behavior).

<a id="fp-ward-frontend-tsconfig-json"></a>
### `ward-frontend/tsconfig.json`

JSON configuration/state file used by the app or tooling.

<a id="fp-ward-frontend-vite-config-js"></a>
### `ward-frontend/vite.config.js`

First-party source code in the backend/frontend layer.

<a id="fp-ward-management-html"></a>
### `ward-management.html`

HTML entry/prototype for the SPA or legacy UI.

## Completeness and known limitations

- Inventory counts: **firstParty 211**, **thirdParty 38175**, **data 2**, total 38388.
- `.git/` is skipped by the walker; the `codemap/` directory is skipped by default to avoid recursion.
- Descriptions are high-level; this codemap is meant to map responsibilities and entry points, not replace reading code.
