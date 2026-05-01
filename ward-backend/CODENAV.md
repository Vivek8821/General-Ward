# Code Navigation (Backend)

## Development Protocol
Every session should start by following the [Session Initiation Sequence](file:///home/vn/Documents/General-Ward/cursorrules/SESSION_INIT.md).
- Auth: Dr. Smith (PIN 1234)
- Server: npm start


## Express app mounts
`ward-backend/server.js`

- `GET /health`
- `GET /api/version`
- `/api/admin/*` → `ward-backend/routes/adminAudit.js` (admin role): audit log CSV/export/purge, **`GET /api/admin/clinical-changes`** (domain change log)
- `POST /api/auth/login`, `GET /api/auth/me`
  - Route/controller entry: `ward-backend/controllers/AuthController.js`
- `/api/patients/*`
  - Route/controller entry: `ward-backend/controllers/PatientController.js`
- `/api/escalations/*`
  - Controller entry: `ward-backend/controllers/EscalationController.js`
- `/api/tasks/*`
  - Controller entry: `ward-backend/controllers/TaskController.js`
- `/api/observations/*`
  - Controller entry: `ward-backend/controllers/ObservationController.js`

## PatientController: nested resources under `/api/patients/:patientId`
`ward-backend/controllers/PatientController.js`

- `/:patientId/medications` -> `ward-backend/controllers/MedicationController.js`
- `/:patientId/history` -> `ward-backend/controllers/ObservationController.js`
- `/:patientId/stats` -> `ward-backend/controllers/ObservationController.js`
- `/:patientId/escalations` -> `ward-backend/controllers/EscalationController.js`
- `/:patientId/tasks` -> `ward-backend/controllers/HandoverController.js`
- `/:patientId/notes` -> `ward-backend/controllers/HandoverController.js`

### Patient endpoints
`ward-backend/controllers/PatientController.js`

- `POST /api/patients` (create a patient)
- `GET /api/patients` (list patients)
- `GET /api/patients/archives` (list discharged/archived patients)
- `GET /api/patients/:id` (fetch patient)
- `PUT /api/patients/:id` (update patient)
- `GET /api/patients/:id/discharge-summary`
- `POST /api/patients/:id/discharge` (discharge)

## Escalations (two entrypoints)

### Global triage
`ward-backend/controllers/EscalationController.js`

- `GET /api/escalations/all`
- `POST /api/escalations/:escalationId/review`

### Patient-bound escalation create
`ward-backend/controllers/EscalationController.js` mounted under:
`/api/patients/:patientId/escalations`

- `POST /api/patients/:patientId/escalations`

## Tasks (General)
`ward-backend/controllers/TaskController.js`

- `GET /api/tasks/my`
- `PUT /api/tasks/:taskId/complete`

## Observations & Stats
`ward-backend/controllers/ObservationController.js`

- `POST /api/observations/ingest`
- `POST /api/patients/:patientId/stats`
- `GET /api/patients/:patientId/stats`
- `GET /api/patients/:patientId/stats/ews/latest`
- `GET /api/patients/:patientId/stats/trends`
- `POST /api/patients/:patientId/history`
- `GET /api/patients/:patientId/history`

## Medications
`ward-backend/controllers/MedicationController.js`

- `GET /api/patients/:patientId/medications`
- `POST /api/patients/:patientId/medications`
- `GET /api/patients/:patientId/medications/administrations`
- `PUT /api/patients/:patientId/medications/administrations/:adminId`
- `DELETE /api/patients/:patientId/medications/administrations/:adminId`
- `PUT /api/patients/:patientId/medications/:medId`
- `POST /api/patients/:patientId/medications/:medId/administer`

## Handover (Notes & Patient Tasks)
`ward-backend/controllers/HandoverController.js`

- `POST /api/patients/:patientId/notes`
- `GET /api/patients/:patientId/notes`
- `POST /api/patients/:patientId/tasks`
- `GET /api/patients/:patientId/tasks`

## Core Infrastructure
- `ward-backend/db.js`: Transaction management (`withTransaction`)
- `ward-backend/dbAdapter.js`: DB abstraction (SQLite/Postgres)
- `ward-backend/middleware/rbac.js`: Permission-based access control
- `ward-backend/utils/logger.js`: Buffered structured JSON logger
- `ward-backend/services/ClinicalAuditService.js`: Clinical intent logging
