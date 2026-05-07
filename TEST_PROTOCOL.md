# General Ward — Test Protocol

## Start the Test Server

```bash
bash start-test-server.sh
```

Or tell Claude/the IDE: **"Start the test server"**

Gives you a clean database every run. Both servers stop with Ctrl+C.

---

## Test Accounts

| Username    | Password   | Role   | Key permissions                              |
|-------------|------------|--------|----------------------------------------------|
| Admin User  | admin123   | Admin  | All features + audit log + user management   |
| Dr. Smith   | doctor123  | Doctor | Patients, meds, observations, discharge      |
| Nurse Joy   | nurse123   | Nurse  | Patients, vitals, tasks, handover notes      |

---

## Pre-loaded Test Data

| Entity            | Count | Notable                                         |
|-------------------|-------|-------------------------------------------------|
| Patients          | 12    | Across Wards A, B, C — care intensities 1–4     |
| Vitals (NEWS2)    | 6     | p5 Michael Brown scores 9 (critical)            |
| Observations      | 5     | symptom, diet, sleep, history types             |
| Medications       | 6     | Including 1 PRN (morphine), 1 IV (furosemide)   |
| Pharmacy stock    | 3     | 8 batches total, FEFO ordered                   |
| Escalations       | 2     | 1 pending (p5), 1 reviewed (p7)                 |
| Tasks             | 4     | 3 open, 1 completed                             |
| Handover notes    | 4     | Morning and evening shifts                      |

---

## Feature Checklist

### 1. Authentication
- [ ] Log in as **Admin User** → confirm redirect to dashboard
- [ ] Log out → confirm redirect to login page
- [ ] Log in as **Dr. Smith** → confirm doctor view
- [ ] Log in as **Nurse Joy** → confirm nurse view
- [ ] Attempt login with wrong password → expect "Invalid credentials" error
- [ ] Attempt 11 logins with wrong password from same IP → expect 429 lockout

**DB check:** `SELECT name, role FROM Users;` — should show 3 rows.

---

### 2. Dashboard
- [ ] View patient grid — 12 patients should appear
- [ ] Confirm care intensity badges (1–4) are visible
- [ ] Check NEWS2 score badge on **Michael Brown** (p5) — should show high alert (score ≈ 9)
- [ ] Click a patient card → navigates to patient detail
- [ ] Use "Add Patient" modal:
  - Fill all required fields (name, MRN, bed, DOB, diagnosis)
  - Submit → patient appears in grid

**DB check:** `SELECT COUNT(*) FROM Patients WHERE tenantId='tenant-default';` — 12 rows before add, 13 after.

---

### 3. Patient Detail — Vitals Tab
- [ ] Open **John Doe** (p1) → Vitals tab
- [ ] Add new vitals: pulse 80, BP 125, resp 16, temp 36.8, SpO2 97, alert
- [ ] Confirm NEWS2 score updates in the UI
- [ ] Open **Michael Brown** (p5) → vitals already show critical score

**DB check:** `SELECT data FROM DailyStats WHERE patientId='p1' AND type='vital' ORDER BY timestamp DESC LIMIT 1;`

---

### 4. Patient Detail — Medications Tab
- [ ] Open **John Doe** (p1) → Medications tab
- [ ] Confirm Metformin 500mg and Lisinopril 10mg are listed
- [ ] Mark Metformin morning dose as **Given**
- [ ] Mark Lisinopril as **Refused** (add reason)
- [ ] Add a new medication: Aspirin 75mg, oral, once daily
- [ ] Open **Michael Brown** (p5) → confirm Morphine is listed as PRN

**DB check:** `SELECT status FROM MedicationAdministrations WHERE patientId='p1';` — should show 'given' and 'refused'.

---

### 5. Patient Detail — Observations Tab
- [ ] Open **Alice Williams** (p4) → confirm symptom "Productive cough" is visible
- [ ] Add a diet observation for p4: "50% intake, refused breakfast"
- [ ] Open **Jane Roe** (p2) → confirm diet observation is present

**DB check:** `SELECT type, data FROM DailyStats WHERE tenantId='tenant-default' AND type != 'vital';`

---

### 6. Escalations
- [ ] Log in as **Nurse Joy**
- [ ] Navigate to Escalations
- [ ] Confirm **Michael Brown** escalation (NEWS2 9) shows as Pending
- [ ] Confirm **William Wilson** escalation shows as Reviewed
- [ ] Create a new escalation for **James Taylor** (p9): "SpO2 dropping"
- [ ] Log in as **Admin User** → review the new escalation → mark Reviewed

**DB check:** `SELECT patientId, status FROM Escalations;`

---

### 7. Tasks
- [ ] Navigate to Tasks
- [ ] Confirm 3 open tasks are visible
- [ ] Confirm 1 completed task is visible
- [ ] Create a new task: type=vital, assign to Nurse Joy, due in 1 hour, patient p2
- [ ] Complete one of the open tasks
- [ ] Filter tasks by assignee "Dr. Smith" → only assessment task shows

**DB check:** `SELECT type, status, assignee FROM Tasks;`

---

### 8. Handover Notes
- [ ] Open **Michael Brown** (p5) → Handover tab
- [ ] Confirm morning note about SpO2 is visible
- [ ] Add an evening note: "Patient agitated, sedation reviewed" with tag "critical"
- [ ] Switch to morning shift filter → original note visible, new note hidden

**DB check:** `SELECT shift, note FROM HandoverNotes WHERE patientId='p5';`

---

### 9. Pharmacy — Inventory
- [ ] Navigate to Pharmacy → Inventory tab
- [ ] Confirm 3 stock items (Amoxicillin, Metformin, Furosemide)
- [ ] Adjust stock level for Amoxicillin: reduce by 10 units
- [ ] Confirm total units updated in the table

**DB check:** `SELECT name, totalQuantity FROM PharmacyStock;`

---

### 10. Pharmacy — Batches
- [ ] Select Amoxicillin → view batches
- [ ] Confirm 3 batches listed, sorted by expiry (FEFO: AMX-2026-A01 first)
- [ ] Add a new batch: lot ABC-001, expiry 2027-12-31, qty 100, cost 5.00
- [ ] Confirm new batch appears at end of FEFO list (latest expiry)

**DB check:** `SELECT batchNumber, expiryDate, quantity FROM PharmacyBatches ORDER BY expiryDate;`

---

### 11. Pharmacy — Waste Management
- [ ] Log in as **Admin User**
- [ ] Navigate to Pharmacy → Waste tab
- [ ] Initiate a waste record: Furosemide, 5 units, reason=EXPIRED
- [ ] Confirm waste record shows as PENDING
- [ ] Witness/confirm the waste → status changes to CONFIRMED

**DB check:** `SELECT status, quantityWasted FROM WasteRecords;`

---

### 12. Reports
- [ ] Log in as **Dr. Smith**
- [ ] Open **John Doe** (p1) → Reports tab
- [ ] Generate a full treatment report (select date range covering today)
- [ ] Download the PDF
- [ ] Open the PDF → confirm patient name, MRN, medications, vitals are present
- [ ] Navigate to Report Verification → paste the report hash → confirm valid

**DB check:** `SELECT reportType, generatedByUserId FROM PatientReports WHERE patientId='p1';`

---

### 13. Discharge Flow
- [ ] Log in as **Dr. Smith**
- [ ] Open **Linda Anderson** (p10) — care intensity 1, no complications
- [ ] Initiate discharge:
  - Reason for admission: Urinary Tract Infection
  - Duration: 5 days
  - Discharge vitals: fill in normal values
  - Recommendations: "Complete antibiotic course, follow up in 2 weeks"
- [ ] Confirm patient disappears from active dashboard
- [ ] Log in as **Admin User** → check Hospital Archive → Linda Anderson should appear

**DB check:**
```sql
SELECT status FROM Patients WHERE id='p10';   -- should be 'discharged'
SELECT patientName FROM HospitalArchives WHERE patientId='p10';
```

---

### 14. Admin — Audit Log
- [ ] Log in as **Admin User**
- [ ] Navigate to Admin → Audit Log
- [ ] Confirm log entries exist (logins, patient views, medication administrations)
- [ ] Filter by resource type "patients" → only patient actions visible
- [ ] Filter by date range → entries reduce correctly

**DB check:** `SELECT COUNT(*) FROM AuditLogs WHERE tenantId='tenant-default';`

---

### 15. Role Access Control (RBAC)
Log in as **Nurse Joy** and verify these are blocked:
- [ ] Attempt to access Admin Audit → should get 403 or redirect
- [ ] Attempt to discharge a patient → discharge button should not be visible

Log in as **Dr. Smith** and verify:
- [ ] Admin Audit log is not accessible
- [ ] Can prescribe medications (nurse cannot)

---

### 16. Multi-Session Test
- [ ] Open two browser tabs (or two browsers)
- [ ] Log in as **Nurse Joy** in tab 1, **Dr. Smith** in tab 2
- [ ] In tab 1: add a vital for p1
- [ ] In tab 2: refresh p1 → new vital should appear
- [ ] Log out in tab 1 → confirm tab 1 goes to login; tab 2 still works

---

## Database Spot Checks (SQLite)

Run from `ward-backend/`:
```bash
sqlite3 ward.db
```

Key queries:
```sql
-- All tables populated
SELECT name FROM sqlite_master WHERE type='table';

-- Tenant isolation working
SELECT DISTINCT tenantId FROM Patients;      -- only 'tenant-default'

-- Session/JWT not stored in DB (stateless) — no sessions table
SELECT name FROM sqlite_master WHERE name='Sessions';   -- empty result

-- Audit coverage
SELECT action, COUNT(*) FROM AuditLogs GROUP BY action;

-- NEWS2 data present
SELECT patientId, data FROM DailyStats WHERE type='vital';

-- FEFO order check
SELECT batchNumber, expiryDate FROM PharmacyBatches ORDER BY expiryDate;
```

---

## Logs

| Log file                   | Contents                         |
|----------------------------|----------------------------------|
| `/tmp/ward-backend.log`    | Express server output            |
| `/tmp/ward-frontend.log`   | Vite dev server output           |

To tail live during testing:
```bash
tail -f /tmp/ward-backend.log
```
