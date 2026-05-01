# Session Initiation Sequence (Development)

This sequence MUST be followed at the start of every development or testing session to ensure a consistent environment.

## 1. Environment Readiness
Ensure the local environment is set up and dependencies are installed.
```bash
# From the root directory
npm run install-all
```

## 2. Database Seeding
Ensure the database has the required test data.
```bash
# Stop the backend if running, then seed
node ward-backend/seed.js
```

## 3. Server Startup
Start the backend and frontend servers.
```bash
# From the root directory
npm start
```
*   **Backend**: `http://localhost:3001`
*   **Frontend**: `http://localhost:5173`

## 4. Login Sequence (Test Accounts)
Use the following credentials to authenticate during development.

| Account Type | Username | PIN |
| :--- | :--- | :--- |
| **Doctor (Primary Test)** | `Dr. Smith` | `1234` |
| **Nurse** | `Nurse Johnson` | `5678` |
| **Admin** | `Ward Admin` | `9999` |

### AI Assistant Protocol
If you are an AI assistant, you must perform a "virtual login" by verifying connectivity to the backend:
1. Call `GET http://localhost:3001/health` to confirm the server is up.
2. Call `POST http://localhost:3001/api/auth/login` with `{"username": "Dr. Smith", "password": "1234"}` to obtain a session.
3. Ensure the `ward_token` cookie is respected in subsequent requests.

## 5. Health Check
Verify the session by calling the "Me" endpoint:
```bash
GET /api/auth/me
```
Expected response: `200 OK` with user details for `Dr. Smith`.
