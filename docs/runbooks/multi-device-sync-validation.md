# Multi-device sync validation checklist

## Preconditions

- Backend deployed with `DATABASE_URL` set.
- Frontend deployed with `VITE_API_BASE` pointing to that backend.
- Backend `CORS_ORIGIN` matches frontend origin.
- Postgres migrations applied (`node ward-backend/migratePostgres.js`).

## Sessions

- Device A: login as doctor or nurse.
- Device B: login as a second user in same tenant.
- Keep both sessions open at the same time.

## Test matrix

1. Task completion sync
   - On Device A, complete an open task from `My Tasks`.
   - Expected on Device B: task state refreshes within polling window (<= 15s) without manual page reload.

2. Patient create sync
   - On Device A, create a new patient from Dashboard.
   - Expected on Device B: patient appears in active roster within polling window.

3. Escalation visibility sync
   - On Device A, trigger an escalation from patient detail.
   - Expected on Device B (doctor view): escalated indicators/toast path updates within polling window.

4. Tenant isolation guard
   - Repeat with a user from another tenant (if available).
   - Expected: no cross-tenant data visibility.

## Stress loop (minimum)

Run this cycle 10 times:

1. Alternate creates/updates/completes between Device A and Device B.
2. Confirm both sides converge within polling window.
3. Watch backend logs for 5xx errors.

Pass criteria:

- No stale state beyond one polling interval.
- No 500 errors during sync operations.
- No cross-tenant leakage.

## Failure logging template

- Scenario:
- Step:
- Observed:
- Expected:
- Device/browser:
- Timestamp:
- Backend log snippet:
- Probable root cause:
- Fix applied:
