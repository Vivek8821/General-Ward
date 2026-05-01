# Code Navigation (Frontend)

## Development Protocol
Every session should start by following the [Session Initiation Sequence](file:///home/vn/Documents/General-Ward/cursorrules/SESSION_INIT.md).
- Auth: Dr. Smith (PIN 1234)
- Server: npm start


## Router entrypoints
`ward-frontend/src/App.jsx` (Routing and Provider setup)
`ward-frontend/src/main.jsx` (Entry point)

- `/login` -> `ward-frontend/src/views/Login.jsx`
- `/` (protected) -> `ward-frontend/src/views/Dashboard.jsx`
- `/patient/:id` (protected) -> `ward-frontend/src/views/PatientDetail.jsx`
- `/tasks` (protected) -> `ward-frontend/src/views/Tasks.jsx`
- `/admin/audit` (protected admin) -> `ward-frontend/src/views/AdminAudit.jsx`

## API helper + auth token
`ward-frontend/src/utils/api.js`

- Base URL: from `VITE_API_BASE` (see `ward-frontend/.env.example`); default `http://localhost:3001` + `/api` suffix unless the env value already ends with `/api`.
- Reads JWT from `localStorage` key `ward_token`
- On `401/403` redirects back to `/login` (and clears local storage)

`ward-frontend/src/context/AuthContext.jsx`

- `GET /auth/me` (loads `user`)
- `POST /auth/login` (login)

## Frontend API calls by view/component

### Login
`ward-frontend/src/views/Login.jsx`
- calls `POST /auth/login` via `AuthContext.login()`

### Dashboard
`ward-frontend/src/views/Dashboard.jsx`

- `GET /patients` or `GET /patients/archives` (depending on `viewMode`)
- `GET /escalations/all` (doctor polling + initial load)
- `POST /patients` (add new patient)

### Patient detail
`ward-frontend/src/views/PatientDetail.jsx`

- `GET /patients/:id`
- `PUT /patients/:id`
- `GET /patients/:id/tasks?status=open`
- `POST /patients/:id/escalations` (escalate)
- `POST /escalations/:escalationId/review` (review escalation)
- `GET /patients/:id/medications`
- `POST /patients/:id/discharge` (discharge)

#### Patient detail tabs/components
These are rendered inside `PatientDetail.jsx` based on the active tab:

- History + handover notes
  - `ward-frontend/src/components/stats/HistoryTab.jsx`
    - `GET /patients/:id/history`
    - `POST /patients/:id/history`
  - `ward-frontend/src/components/stats/HandoverNotesPanel.jsx`
    - `GET /patients/:id/notes`
    - `POST /patients/:id/notes`
- Vitals + derived trends
  - `ward-frontend/src/components/stats/VitalsTab.jsx`
    - `GET /patients/:id/stats?type=vital`
    - `POST /patients/:id/stats` (for vital/stat ingest)
    - `GET /patients/:id/stats/trends`
- Diet
  - `ward-frontend/src/components/stats/DietTab.jsx`
    - `GET /patients/:id/stats?type=diet`
    - `POST /patients/:id/stats`
- Sleep
  - `ward-frontend/src/components/stats/SleepTab.jsx`
    - `GET /patients/:id/stats?type=sleep`
    - `POST /patients/:id/stats`
- Medications
  - `ward-frontend/src/components/stats/MedsTab.jsx`
    - `GET /patients/:id/medications`
    - `GET /patients/:id/medications/administrations`
    - `POST /patients/:id/medications` (create medication)
    - `PUT /patients/:id/medications/:medId` (update med status)
    - `POST /patients/:id/medications/:medId/administer` (record an administration)
    - `PUT /patients/:id/medications/administrations/:adminId` (update admin record status/notes)
    - `DELETE /patients/:id/medications/administrations/:adminId` (remove admin record)
- Discharge summary
  - `ward-frontend/src/components/stats/DischargeSummaryTab.jsx`
    - `GET /patients/:id/discharge-summary`

### Tasks
`ward-frontend/src/views/Tasks.jsx`

- `GET /tasks/my`
- `PUT /tasks/:taskId/complete`

`ward-frontend/src/views/PatientDetail.jsx`

- `PUT /tasks/:taskId/complete` (via “Tasks Due” panel)

## Testing
`ward-frontend/src/test/setup.js`: Vitest setup
`ward-frontend/src/views/Login.test.jsx`: Example component test
