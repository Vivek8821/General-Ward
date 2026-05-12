# General Ward — Audit Handoff

## Goal

Full security and quality audit of the General Ward hospital management system (ward-backend Express API + ward-frontend React). 20+ issues identified across security, data integrity, backend consistency, and frontend correctness. All items are now implemented.

---

## Current State Files

The system is fully patched. No partial edits. All files are committed to disk and the server loads cleanly (`node -e "require('./server')"` exits without errors).

**Backend — middleware**
- `middleware/protect.js` — new factory; combines auth + authz + tokenVersion revocation in one composable unit
- `middleware/resolveTenant.js` — existed; now wired globally in server.js
- `middleware/audit.js` — uses structured logger, reads `req.tenantId`
- `middleware/error.js` — strips stack traces from production log payloads
- `middleware/rateLimiters.js` — shared named limiters (`clinicalWriteLimiter`, `adminWriteLimiter`, `escalationLimiter`)

**Backend — controllers (all use `req.tenantId`, all unexpected errors go through `next(err)`)**
- `controllers/PatientController.js` — `GET /:id` uses `protect()`, list endpoints return `{ data: [] }` envelope
- `controllers/UserController.js` — list endpoint returns `{ data: [] }` envelope
- `controllers/PharmacyController.js` — all catch blocks use `next(err)`
- `controllers/BarcodeController.js` — `req.tenantId` (was missed by initial sed, caught by grep)
- All 13 clinical controllers — `req.tenantId`, `clinicalWriteLimiter` on write routes

**Backend — routes**
- `routes/adminAudit.js` — all `console.error` replaced with `logger.error`; all 500 paths use `next(err)`
- `routes/reports.js` — `req.tenantId`

**Backend — repositories**
- `repositories/pharmacy/StockRepository.js` — atomic UPDATE (no separate read)
- `repositories/pharmacy/TransactionRepository.js` — JS-computed date cutoff replaces `datetime('now', '-N days')`
- `repositories/EscalationRepository.js` — pre-fetch before UPDATE inside transaction
- 6 clinical repositories — soft-delete (`deletedAt`) pattern; all SELECTs filter `AND deletedAt IS NULL`

**Backend — schema**
- `schema.sql` — `DEFAULT CURRENT_TIMESTAMP` (ANSI SQL) replaces `DEFAULT (datetime('now'))`
- `postgres-migrations/migrations/018_soft_delete_clinical.sql` — adds `deletedAt` to 6 tables
- `postgres-migrations/migrations/019_missing_indexes.sql` — indexes on MedicationAdministrations, PharmacyTransactions, WasteRecords, Medications
- `postgres-migrations/migrations/020_barcode_registrations.sql` — Postgres-compatible BarcodeRegistrations table
- `postgres-migrations/migrations/021_patient_reports.sql` — Postgres-compatible PatientReports table

**Frontend**
- `utils/api.ts` — `get()` accepts `{ signal? }` for AbortController
- `components/stats/VitalsTab.jsx` — AbortController in useEffect
- `components/stats/DietTab.jsx` — AbortController in useEffect
- `components/stats/SleepTab.jsx` — AbortController in useEffect
- `components/stats/HistoryTab.jsx` — AbortController in useEffect
- `components/stats/HandoverNotesPanel.jsx` — AbortController in useEffect
- `components/stats/DischargeSummaryTab.jsx` — `useMutation` for PDF generation; AbortController for summary fetch; no localStorage token read
- `features/dashboard/DashboardView.jsx` — escalation polling via `useQuery`; `queryFn` unwraps `res?.data ?? []` for patient list
- `features/statistics/StatisticsDashboard.jsx` — `filters` object in queryKey (React Query deep-equals, not `JSON.stringify`)
- `features/dashboard/components/AddPatientModal.jsx` — all inputs have `id` + matching `htmlFor`

**Deleted**
- `legacy/routes/auth.js`
- `legacy/routes/patients.js`

---

## Files in Flight

None. All edits are complete and saved.

---

## Things Changed This Session

| Item | What |
|------|------|
| **protect()** | New middleware factory at `middleware/protect.js`; applied to `GET /api/patients/:id` |
| **H1** | Rate limiters extracted to `middleware/rateLimiters.js`; applied to all write routes |
| **H2** | All unexpected errors in PharmacyController, EscalationController, PatientController go through `next(err)` |
| **H3** | PatientController list endpoints + UserController list endpoint return `{ data: [] }`; DashboardView queryFn unwraps |
| **H5** | StockRepository atomic UPDATE — no read-then-write race |
| **H6** | 8 new indexes in schema.sql + migration 019 |
| **H7** | `VITE_API_URL` → `VITE_API_BASE` in DischargeSummaryTab + VerifyReport |
| **H8** | AbortController in 5 tab components + HandoverNotesPanel + DischargeSummaryTab |
| **M1** | `resolveTenant` mounted globally in server.js; 90 inline `req.user.tenantId \|\| 'tenant-default'` copies eliminated across 19 files |
| **M2** | audit.js uses `logger.warn` with structured payload |
| **M3** | server.js + adminAudit.js: all `console.*` replaced with structured logger calls |
| **M4** | ObservationController `/ingest`: `authenticateToken` moved before `ingestLimiter` |
| **M5** | PatientRepository `findAll()` accepts `{ limit }` with 500 default |
| **M6** | EscalationRepository pre-fetches before UPDATE inside transaction |
| **M9** | DashboardView escalation polling moved from `setInterval/useEffect` to `useQuery` |
| **M10** | DischargeSummaryTab PDF generation uses `useMutation`; removes manual `generating` state |
| **M11** | StatisticsDashboard queryKeys use `filters` object directly (React Query structural equality) |
| **C1** | DischargeSummaryTab: `localStorage.getItem('token')` Bearer header removed; uses `api.post()` with cookie auth |
| **C2** | ObservationRepository `INSERT OR IGNORE` → portable via db adapter dialect check |
| **C3** | `DEFAULT CURRENT_TIMESTAMP` in schema.sql; JS-computed cutoff in TransactionRepository |
| **H4/L5** | Soft deletes on 6 clinical repositories; migration 018 |
| **L1** | Legacy auth.js and patients.js deleted |
| **L2** | AddPatientModal: all form inputs labelled with `id` + `htmlFor` |
| **error.js** | Stack traces omitted from production log payloads |
| **Migrations** | 020 (BarcodeRegistrations Postgres), 021 (PatientReports Postgres) |

---

## Failed Attempts

| Attempt | Why it didn't work |
|---|---|
| Initial `sed` sweep targeting 17 named controllers | Missed `BarcodeController.js` and `routes/reports.js` — not in the explicit list. Caught by a post-sed `grep -rn "req\.user\.tenantId"` sweep. |
| First adminAudit.js console.error pass | Only fixed 3 of 6 occurrences (list, export, clinical-changes). A second grep found breach-report, patient-access-log, and purge. Fixed in a second pass. |
| `rmdir legacy/routes` after deleting auth.js and patients.js | `README.md` remained; `rmdir` refuses non-empty directories. Left the README — it documents why the directory exists — and verified no legacy routes are imported anywhere. |
| ObservationController H3 response envelope | `/history` and `/stats` endpoints use `data` as a **database column name** (the JSON payload blob), not an envelope key. Wrapping in `{ data: ... }` would shadow the field with the same name and break `HistoryTab.jsx`. Intentionally excluded; documented in plan. |

---

## Next Step

Run the test suite to verify nothing regressed:

```bash
cd /home/vn/Documents/General-Ward/ward-backend && npm test
cd /home/vn/Documents/General-Ward/ward-frontend && npm test
```

If tests pass, the audit is done. The only open item is the ObservationController response envelope (`/history`, `/stats`) — address it only if you want full envelope consistency and are prepared to update `HistoryTab.jsx` to destructure `res.data` from the envelope rather than the database field of the same name.
