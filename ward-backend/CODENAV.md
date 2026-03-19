# Code Navigation (Backend)

## Express app mounts
`ward-backend/server.js`

- `GET /health`
- `GET /api/version`
- `POST /api/auth/login`, `GET /api/auth/me`
  - Route file: `ward-backend/routes/auth.js`
- `/api/patients/*`
  - Route/controller entry: `ward-backend/controllers/PatientController.js`
- `/api/escalations/*`
  - Controller entry: `ward-backend/controllers/EscalationController.js`
- `/api/tasks/*`
  - Route file: `ward-backend/routes/tasks.js`
- `/api/observations/*`
  - Route file: `ward-backend/routes/observations.js`

## PatientController: nested resources under `/api/patients/:patientId`
`ward-backend/controllers/PatientController.js`

- `/:patientId/medications` -> `ward-backend/routes/medications.js`
- `/:patientId/history` -> `ward-backend/routes/history.js`
- `/:patientId/stats` -> `ward-backend/routes/stats.js`
- `/:patientId/escalations` -> `ward-backend/controllers/EscalationController.js`
- `/:patientId/tasks` -> `ward-backend/routes/patientTasks.js`
- `/:patientId/notes` -> `ward-backend/routes/patientNotes.js`

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

## Tasks
`ward-backend/routes/tasks.js`

- `GET /api/tasks/my`
- `PUT /api/tasks/:taskId/complete`

Patient tasks are under:
`/api/patients/:patientId/tasks`
Route file: `ward-backend/routes/patientTasks.js`

- `POST /api/patients/:patientId/tasks`
- `GET /api/patients/:patientId/tasks`

## Observations ingest
`ward-backend/routes/observations.js`

- `POST /api/observations/ingest`

## Stats, History, Notes, Medications (patient-bound)

Route files (mounted under `/api/patients/:patientId/...` by `PatientController`):

- Stats: `ward-backend/routes/stats.js`
  - `POST /api/patients/:patientId/stats`
  - `GET /api/patients/:patientId/stats`
  - `GET /api/patients/:patientId/stats/ews/latest`
  - `GET /api/patients/:patientId/stats/trends`
- Medications: `ward-backend/routes/medications.js`
  - `GET /api/patients/:patientId/medications`
  - `POST /api/patients/:patientId/medications`
  - `GET /api/patients/:patientId/medications/administrations`
  - `PUT /api/patients/:patientId/medications/administrations/:adminId`
  - `DELETE /api/patients/:patientId/medications/administrations/:adminId`
  - `PUT /api/patients/:patientId/medications/:medId`
  - `POST /api/patients/:patientId/medications/:medId/administer`
- History: `ward-backend/routes/history.js`
  - `POST /api/patients/:patientId/history`
  - `GET /api/patients/:patientId/history`
- Notes: `ward-backend/routes/patientNotes.js`
  - `POST /api/patients/:patientId/notes`
  - `GET /api/patients/:patientId/notes`
