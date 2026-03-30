# Signup & Payment Integration — PROGRESS

**Master steps:** [signup-payment-detailed.md](./signup-payment-detailed.md)

## Status

| Field | Value |
|--------|--------|
| Last completed step | *(plan created — execution not yet started)* |
| Interrupted at | *(none)* |
| Branch / commit | *(local)* |

## Blockers

- *(none yet)*
- **Razorpay credentials needed:** Test mode API keys required for Phase P1+. Create at https://dashboard.razorpay.com/app/keys
- **Razorpay plans needed:** Monthly and annual per-seat plans must be created in Razorpay dashboard before P1.3.

## Follow-ups (optional / not blocking)

- **Email verification:** MVP trusts email provided during signup. Add email verification (send OTP or magic link) in a future phase.
- **OAuth/social login:** Not in scope — add as a separate feature later.
- **Invoice PDFs:** Use Razorpay's built-in invoice system rather than generating custom PDFs.
- **Multi-plan switching:** Currently admin must contact support to switch monthly ↔ annual. UI for self-service plan switching is a future enhancement.

## Session checkpoint template (crash recovery)

Use this block before and after every numbered step:

- `Step ID`:
- `Intent`:
- `Files to touch`:
- `Commands to run`:
- `Verifier expected`:
- `Stress check`:
- `Rollback pointer`:
- `Interrupted at` (if any):
- `Next action`:

## Pre-plan baseline (2026-03-30)

Recorded from actual source files — no hallucinations.

### Users table (current)
```sql
-- From ward-backend/db.js lines 75-83
CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('doctor', 'nurse', 'admin')) NOT NULL,
  tenantId TEXT,
  passwordHash TEXT NOT NULL
)
```

### Tenants table (current)
```sql
-- From ward-backend/db.js lines 86-91
CREATE TABLE IF NOT EXISTS Tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
)
```

### Auth lookup (current)
```javascript
// From ward-backend/repositories/AuthRepository.js
async findUserByName(username) {
  return dbAdapter.get(`SELECT * FROM Users WHERE name = ?`, [username]);
}
```

### Seed users (current)
```
Dr. Smith    (doctor)  password: 1234    tenant-default
Nurse Johnson (nurse)  password: 5678    tenant-default
Ward Admin   (admin)   password: 9999    tenant-default
```

### Frontend routes (current)
```
/login          → Login.jsx (public)
/               → Dashboard.jsx (protected)
/patient/:id    → PatientDetail.jsx (protected)
/tasks          → Tasks.jsx (protected)
/admin/audit    → AdminAudit.jsx (admin only)
*               → NotFound.jsx
```

### Backend dependencies (no razorpay)
```json
{
  "bcrypt": "^6.0.0",
  "cors": "^2.8.6",
  "express": "^5.2.1",
  "express-rate-limit": "^8.3.1",
  "helmet": "^8.1.0",
  "jsonwebtoken": "^9.0.3",
  "pg": "^8.20.0",
  "sqlite3": "^5.1.7"
}
```

## Log

| Date | Step | Outcome | Verifier | Notes |
|------|------|---------|----------|-------|
| 2026-03-30 | Plan | Created | — | Plan document written at `docs/plans/signup-payment-detailed.md` |
| 2026-03-30 | Plan update | Billing model clarified | — | Section 1.2 rewritten: explicit consolidated per-org billing (one invoice per org per cycle via Razorpay `quantity`). Added `pricePerSeat INTEGER` and `billingInterval TEXT` to Tenants schema (sections 1.3, S1.2, S1.5). Updated P1.2 with `getInvoiceHistory` method and `pricePerSeat` caching. Updated P2.4 billing page with line-item breakdown and invoice history table. |

## Rollback / snapshots

**Pre-plan baseline (2026-03-30):**

- No signup routes exist.
- No payment provider integrated.
- Users table: 5 columns (id, name, role, tenantId, passwordHash).
- Tenants table: 2 columns (id, name).
- Auth: login by `name` column only.
- No Invitations or SubscriptionEvents tables.

To revert all signup/payment changes: revert to the git commit recorded in "Branch / commit" above.
