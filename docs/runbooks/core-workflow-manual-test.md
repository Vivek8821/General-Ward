# Core workflow — manual acceptance test

Run through each path below before any release or after significant changes.
Seeded credentials are in the project [README.md](../../README.md#seeded-users-development).

## Prerequisites

1. Backend running: `cd ward-backend && node server.js` (or `npm start` from root).
2. Frontend running: `cd ward-frontend && npm run dev`.
3. Database seeded: `node ward-backend/seed.js` (stop the API first if sharing `ward.db`).

---

## Path 1 — Doctor flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open the app root URL (e.g. `http://localhost:5173`) | Redirected to `/login` (not authenticated). |
| 2 | Sign in as **Dr. Smith** / `1234` | Dashboard loads; welcome banner shown on first visit. |
| 3 | Verify stat cards (Total Patients, Active Beds, Critical, Escalations) | Numbers match the seeded data. |
| 4 | Use the search bar to filter by MRN or name | List narrows correctly; clearing the search restores full list. |
| 5 | Click a patient card | `/patient/:id` loads with patient header, tabs, and tasks panel. |
| 6 | Switch between tabs (History, Vitals, Diet, Sleep, Meds) | Each tab renders without errors; data or empty states appear. |
| 7 | Click **Edit Info**, change a field, save | Toast: "Patient updated."; change visible on refresh. |
| 8 | Click **Discharge**, fill out the form, submit | Toast: "Patient successfully discharged."; redirected to Dashboard; patient moves to Archives. |
| 9 | Toggle **Hospital Archives** view on Dashboard | Discharged patient appears in archive list. |
| 10 | Navigate to `/tasks` | Tasks page loads; open tasks listed or empty state shown. |
| 11 | Navigate to an invalid URL, e.g. `/foobar` | 404 page with "Back to dashboard" link. |
| 12 | Logout | Redirected to `/login`; cookie cleared. |

## Path 2 — Nurse flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Sign in as **Nurse Johnson** / `5678` | Dashboard loads. |
| 2 | Open a patient detail page | Header, tabs, tasks visible. |
| 3 | Click **Escalate Case**, enter a reason, submit | Toast: "Case escalated. Doctors have been notified." |
| 4 | Navigate to `/tasks` | Tasks page loads. |
| 5 | Complete a task (if any open) | Toast: "Task marked completed."; task removed from list. |

## Path 3 — Admin flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Sign in as **Ward Admin** / `9999` | Dashboard loads; "Audit log" link visible in header. |
| 2 | Click **Audit log** (or navigate to `/admin/audit`) | Audit table loads with recent entries. |
| 3 | Change success filter, click Apply | Table re-filters. |
| 4 | Click **Export CSV** | CSV file downloads. |
| 5 | Run **Dry run** on retention | Toast: "Dry run: N row(s) would be deleted". |

## Path 4 — Error resilience

| Step | Action | Expected |
|------|--------|----------|
| 1 | Stop the backend process | — |
| 2 | Refresh Dashboard | "Failed to load patients." + **Retry** button shown. |
| 3 | Navigate to `/patient/<valid-id>` | Error card: "Unable to load patient data…" + **Retry** + **Go to Dashboard**. |
| 4 | Navigate to `/tasks` | "Failed to load tasks." + **Retry** button. |
| 5 | Navigate to `/admin/audit` (as admin) | "Failed to load audit logs." + **Retry** button. |
| 6 | Restart the backend; click **Retry** on any screen | Data loads successfully. |

## Path 5 — Mobile / responsive (manual)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open the app in a narrow viewport (~375px) or real mobile | Layout stacks; no horizontal overflow; all buttons reachable. |
| 2 | Walk through Path 1 steps 2–6 | No layout breakage; modals scrollable. |

---

## Pass criteria

- All steps complete without JS console errors (ignoring known warnings).
- No white screen or infinite spinner on any path.
- Toasts appear for all success/error actions.
- 404 page renders for unknown routes in both logged-in and logged-out states.
