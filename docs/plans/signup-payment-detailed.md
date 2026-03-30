# Signup & Payment Integration — detailed execution plan (Phases S → P)

**Authoritative copy** for crash recovery: keep this file and [`signup-payment-PROGRESS.md`](./signup-payment-PROGRESS.md) in sync after **every** numbered step.

**Codemap / navigation (before each phase):**

- [codemap/CODEMAP.md](../../codemap/CODEMAP.md) — architecture, feature workflows, data model pointer
- [ward-backend/CODENAV.md](../../ward-backend/CODENAV.md) — API surface, route nesting
- [ward-frontend/CODENAV.md](../../ward-frontend/CODENAV.md) — routes, auth context, api.ts
- [ward-backend/server.js](../../ward-backend/server.js) — middleware chain, route mounts
- [ward-backend/controllers/AuthController.js](../../ward-backend/controllers/AuthController.js) — current login/logout/me
- [ward-backend/services/AuthService.js](../../ward-backend/services/AuthService.js) — JWT generation, bcrypt verify
- [ward-backend/middleware/auth.js](../../ward-backend/middleware/auth.js) — token extraction, role check
- [ward-backend/middleware/tenant.js](../../ward-backend/middleware/tenant.js) — tenant isolation guards
- [ward-backend/db.js](../../ward-backend/db.js) — full SQLite schema (Users, Tenants, all tables)
- [ward-backend/postgres-migrations/migrations/002_create_application_schema.sql](../../ward-backend/postgres-migrations/migrations/002_create_application_schema.sql) — Postgres parity schema

---

## 0. Verified baseline (accuracy checklist — no hallucinations)

Every statement below was verified by reading actual source files on 2026-03-30.

| Item | Location | Verified state |
|------|----------|----------------|
| Users schema | [db.js lines 75-83](../../ward-backend/db.js) | `id TEXT PK, name TEXT, role TEXT CHECK('doctor','nurse','admin'), tenantId TEXT, passwordHash TEXT` — **no email, no username, no status column** |
| Tenants schema | [db.js lines 86-91](../../ward-backend/db.js) | `id TEXT PK, name TEXT` — **only 2 columns; no billing/subscription fields** |
| Auth lookup | [AuthRepository.js](../../ward-backend/repositories/AuthRepository.js) | Finds user by `name` column: `SELECT * FROM Users WHERE name = ?` — uses display name as login username |
| JWT payload | [AuthService.js line 26](../../ward-backend/services/AuthService.js) | `{ id, name, role, tenantId, csrf }` — expiresIn 8h |
| Cookie auth | [AuthController.js lines 18-27](../../ward-backend/controllers/AuthController.js) | HttpOnly cookie `ward_token`; secure in prod; sameSite `none` prod / `lax` dev; maxAge 8h |
| Account lockout | [AuthLockoutRepository.js](../../ward-backend/repositories/AuthLockoutRepository.js) | Keyed by `(username, ipAddress)`; 5 attempts / 15 min window / 15 min lockout |
| Signup routes | *(none)* | **No registration/signup API endpoint exists anywhere** |
| Payment routes | *(none)* | **No payment provider SDK, no billing routes, no webhook handlers** |
| Seed users | [seed.js lines 29-31](../../ward-backend/seed.js) | `Dr. Smith` (doctor), `Nurse Johnson` (nurse), `Ward Admin` (admin) — all `tenant-default` |
| Frontend login | [Login.jsx](../../ward-frontend/src/views/Login.jsx) | Username + password form; demo autofill buttons; no "Sign up" link |
| Frontend routing | [main.jsx](../../ward-frontend/src/main.jsx) | Routes: `/login`, `/` (Dashboard), `/patient/:id`, `/tasks`, `/admin/audit` — **no signup or billing routes** |
| Layout/Nav | [Layout.jsx](../../ward-frontend/src/components/Layout.jsx) | Header ribbon with user info, theme toggle, "Audit log" (admin), logout — **no nav for signup/billing** |
| Razorpay SDK | [ward-backend/package.json](../../ward-backend/package.json) | **Not installed** — no `razorpay` dependency |
| dbAdapter | [dbAdapter/index.js](../../ward-backend/dbAdapter/index.js) | `DATABASE_URL` set → Postgres, else SQLite |

---

## 1. Architecture overview

### 1.1 Signup flows

**Flow A: Organization registration (org admin signup)**

```
New org admin visits /signup
  → Fills: org name, admin name, email, password
  → Backend creates:
    1. New Tenant row (org)
    2. New User row (role: admin, status: active)
    3. Razorpay Customer (linked to tenant)
    4. Razorpay Subscription (per-seat plan, quantity: 1)
  → Frontend redirects to Razorpay Standard Checkout for first payment
  → Razorpay webhook confirms payment
  → Tenant status set to "active"
  → Admin can now log in and invite staff
```

**Flow B: Staff self-registration (within an existing org)**

```
Org admin creates an invite link or invite code for the org
Staff member visits /signup?invite=<code>
  → Fills: name, email, password, role (doctor/nurse)
  → Backend validates invite code + tenant
  → Creates User row (status: pending_approval OR active depending on org setting)
  → Updates Razorpay subscription quantity (seat count += 1)
  → Admin approves (if approval required) → user status → active
  → Staff can now log in
```

### 1.2 Payment model

- **Provider:** Razorpay (npm package `razorpay`)
- **Billing model:** Per-seat pricing, **one consolidated bill per organization per billing cycle**.
  - A Razorpay **Plan** defines the price per seat and billing interval (monthly or annual).
    Example: Rs 500/seat/month or Rs 5,000/seat/year.
  - A Razorpay **Subscription** is created per tenant (organization) with `quantity` = number of active seats.
  - Each billing cycle, Razorpay charges **plan_amount x quantity** as a **single invoice** to the organization.
    Example: 10 seats x Rs 500/seat = Rs 5,000 billed as one transaction to the org.
  - When staff are added or removed, `quantity` is updated via the Razorpay Update Subscription API.
    The quantity change takes effect at the **next billing cycle** (no mid-cycle surprise charges to the org).
  - The **org admin** (not individual staff members) is the billing contact and receives the consolidated invoice.
  - Individual staff members never see or interact with billing — it is entirely org-level.
- **Razorpay concepts used:**
  - **Plan:** Reusable template — price per unit (seat) + interval. Created once via Razorpay Dashboard or API.
  - **Subscription:** One per tenant. Links to a Plan. `quantity` = seat count. Razorpay auto-charges `plan_amount x quantity` each cycle as one invoice.
  - **Standard Checkout:** Frontend payment capture for the initial authentication transaction (first payment).
  - **Webhooks:** Server receives events: `subscription.charged` (one per org per cycle), `payment.failed`, `subscription.halted`, `subscription.cancelled`.
  - **Invoices:** Razorpay auto-generates one invoice per org per billing cycle. Fetchable via `razorpay.invoices.all({ subscription_id })`.
- **Seat counting:** Each active User in a tenant = 1 seat. Subscription `quantity` synced from DB `seatCount`.
- **Grace period:** If payment fails, tenant enters `past_due` state (read-only access for 7 days, then `halted`/locked).

### 1.3 Schema changes summary

| Table | Change type | New columns / tables |
|-------|------------|---------------------|
| `Users` | ALTER | `email TEXT UNIQUE`, `username TEXT UNIQUE`, `status TEXT DEFAULT 'active'`, `invitedBy TEXT`, `approvedAt TEXT` |
| `Tenants` | ALTER | `billingEmail TEXT`, `orgSlug TEXT UNIQUE`, `subscriptionStatus TEXT DEFAULT 'trial'`, `razorpayCustomerId TEXT`, `razorpaySubscriptionId TEXT`, `planId TEXT`, `pricePerSeat INTEGER`, `billingInterval TEXT DEFAULT 'monthly'`, `seatCount INTEGER DEFAULT 1`, `maxSeats INTEGER DEFAULT 50`, `billingCycleEnd TEXT`, `createdAt TEXT` |
| `Invitations` (new) | CREATE | `id`, `tenantId`, `email`, `role`, `inviteCode`, `status`, `expiresAt`, `createdBy`, `createdAt` |
| `SubscriptionEvents` (new) | CREATE | `id`, `tenantId`, `razorpayEventId`, `eventType`, `payload`, `processedAt`, `createdAt` |

---

## 2. PROGRESS file (mandatory)

Create/update [signup-payment-PROGRESS.md](./signup-payment-PROGRESS.md) with:

- **Last completed step:** e.g. `S1.2`
- **Interrupted at:** file list + partial intent if crash mid-step
- **Blockers:** errors, failed tests, decisions needed
- **Log table:** date | step | outcome | verifier | notes
- **Rollback:** env values, git ref, or file state pointer

---

## 3. Execution protocol

1. **One step only** per session slice; commit or PROGRESS entry before the next.
2. **Confirm** each step: all checkboxes in that step's "Acceptance" section.
3. **Stress test** after each step (minimum):
   - **Frontend touch:** `cd ward-frontend && npm run lint && npm run build`
   - **Backend touch:** `cd ward-backend && npm test`
   - **Stress gate:** `cd ward-backend && node stressEverything.js` — pass criteria: `server5xx=0`, `timeouts=0`, `fetchErrors=0`
   - **Manual smoke:** login with seed user; one read + one write on existing workflow (verify nothing broke)
4. **No hallucinated paths:** verify every file path before referencing.
5. **Crash recovery:** fill checkpoint template in PROGRESS before and after every step.

---

## 4. Stress test matrix (copy per phase)

| Check | Command / action | Pass | Date |
|-------|------------------|------|------|
| Lint | `cd ward-frontend && npm run lint` | ☐ | |
| Build | `cd ward-frontend && npm run build` | ☐ | |
| Backend tests | `cd ward-backend && npm test` | ☐ | |
| Stress | `cd ward-backend && node stressEverything.js` | ☐ (5xx=0, timeouts=0) | |
| Login smoke (existing) | Browser: `Dr. Smith` / `1234` login/logout | ☐ | |
| Signup smoke (new) | Browser: new org signup flow end-to-end | ☐ | |
| Payment smoke (new) | Razorpay test mode: subscription created + checkout completes | ☐ | |

---

## Phase S1 — Schema changes for signup

**Goal:** Extend Users, Tenants, and add Invitations/SubscriptionEvents tables — without breaking any existing functionality.

### S1.0 Snapshot (read-only)

- Record current `Users` CREATE TABLE from [db.js lines 75-83](../../ward-backend/db.js) in PROGRESS.
- Record current `Tenants` CREATE TABLE from [db.js lines 86-91](../../ward-backend/db.js) in PROGRESS.
- Record current `AuthRepository.findUserByName` query from [AuthRepository.js](../../ward-backend/repositories/AuthRepository.js) in PROGRESS.
- Run `cd ward-backend && npm test` — record test count.
- Run `cd ward-backend && node stressEverything.js` — record baseline metrics.

**Acceptance:** PROGRESS snapshot filled; no code changes.

### S1.1 Extend Users table

**Files:** [ward-backend/db.js](../../ward-backend/db.js), Postgres migration `003_signup_payment_schema.sql`

**Implementation:**

1. In `db.js` (SQLite), add idempotent ALTER TABLE statements (same pattern as existing tenant column backfills):
   ```sql
   ALTER TABLE Users ADD COLUMN email TEXT
   ALTER TABLE Users ADD COLUMN username TEXT
   ALTER TABLE Users ADD COLUMN status TEXT DEFAULT 'active'
   ALTER TABLE Users ADD COLUMN invitedBy TEXT
   ALTER TABLE Users ADD COLUMN approvedAt TEXT
   ```
   Wrap each in error-ignoring callbacks (duplicate column safe).

2. Add unique index:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON Users(email) WHERE email IS NOT NULL
   CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON Users(username) WHERE username IS NOT NULL
   ```
   Note: SQLite supports partial indexes since 3.8.0. The `WHERE ... IS NOT NULL` clause ensures existing users without email/username don't violate the unique constraint.

3. Backfill existing seed users: set `username` = lowercased sanitized `name` (e.g. `Dr. Smith` → `dr.smith`), `status` = `'active'`, `email` = null (they're demo users).

**Edge cases:**
- Existing users have no `email` or `username` — backfill must handle this gracefully.
- `username` uniqueness: the backfill must generate non-colliding usernames from names.
- Null emails: don't enforce NOT NULL on email yet (existing demo users don't have one); enforce in the signup route validation only.
- The `status` column needs a CHECK constraint but only for new databases (ALTER TABLE + CHECK is complex in SQLite). For SQLite, validate in application code. For Postgres, add CHECK in the migration.

**Acceptance:**
- `npm test` passes (all existing tests unaffected).
- `node stressEverything.js` passes (stress test uses existing auth — unaffected by new columns).
- Manual: query `SELECT id, name, username, email, status FROM Users` — existing users have `username` and `status='active'`.

### S1.2 Extend Tenants table

**Files:** [ward-backend/db.js](../../ward-backend/db.js), Postgres migration `003_signup_payment_schema.sql`

**Implementation:**

1. Add columns to Tenants:
   ```sql
   ALTER TABLE Tenants ADD COLUMN billingEmail TEXT
   ALTER TABLE Tenants ADD COLUMN orgSlug TEXT
   ALTER TABLE Tenants ADD COLUMN subscriptionStatus TEXT DEFAULT 'active'
   ALTER TABLE Tenants ADD COLUMN razorpayCustomerId TEXT
   ALTER TABLE Tenants ADD COLUMN razorpaySubscriptionId TEXT
   ALTER TABLE Tenants ADD COLUMN planId TEXT
   ALTER TABLE Tenants ADD COLUMN pricePerSeat INTEGER
   ALTER TABLE Tenants ADD COLUMN billingInterval TEXT DEFAULT 'monthly'
   ALTER TABLE Tenants ADD COLUMN seatCount INTEGER DEFAULT 1
   ALTER TABLE Tenants ADD COLUMN maxSeats INTEGER DEFAULT 50
   ALTER TABLE Tenants ADD COLUMN billingCycleEnd TEXT
   ALTER TABLE Tenants ADD COLUMN createdAt TEXT DEFAULT (datetime('now'))
   ```
   `pricePerSeat` caches the Razorpay plan amount (in smallest currency unit, e.g. paise) so the frontend can display "10 seats x Rs 500 = Rs 5,000" without calling Razorpay on every page load. `billingInterval` records whether the org chose `'monthly'` or `'annual'`.

2. Unique index on `orgSlug`:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_orgslug ON Tenants(orgSlug) WHERE orgSlug IS NOT NULL
   ```
3. Backfill `tenant-default`: set `subscriptionStatus = 'active'`, `seatCount = 3` (matching 3 seed users), `orgSlug = 'default'`, `pricePerSeat = 0` (demo tenant, no billing), `billingInterval = 'monthly'`.

**Edge cases:**
- `tenant-default` must remain fully functional — it's the fallback for all existing data.
- New tenants created via signup will have all fields populated from the start.
- `subscriptionStatus` values: `'trial'`, `'active'`, `'past_due'`, `'halted'`, `'cancelled'`. Validated in application code for SQLite; CHECK constraint in Postgres migration.

**Acceptance:**
- `npm test` passes.
- `SELECT * FROM Tenants` shows `tenant-default` with new columns populated.

### S1.3 Create Invitations table

**Files:** [ward-backend/db.js](../../ward-backend/db.js), Postgres migration `003_signup_payment_schema.sql`

**Implementation:**

```sql
CREATE TABLE IF NOT EXISTS Invitations (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  email TEXT,
  role TEXT CHECK(role IN ('doctor', 'nurse', 'admin')) NOT NULL,
  inviteCode TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'expired', 'revoked')),
  expiresAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON Invitations(inviteCode);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON Invitations(tenantId);
```

**Edge cases:**
- Invite code must be cryptographically random (use `crypto.randomBytes(16).toString('hex')`).
- Expiry: default 7 days from creation.
- One invite per email per tenant (prevent duplicates) — enforce via unique index `(tenantId, email)` where email is not null.

**Acceptance:**
- Backend starts without errors.
- `npm test` passes.

### S1.4 Create SubscriptionEvents table

**Files:** [ward-backend/db.js](../../ward-backend/db.js), Postgres migration `003_signup_payment_schema.sql`

**Implementation:**

```sql
CREATE TABLE IF NOT EXISTS SubscriptionEvents (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  razorpayEventId TEXT UNIQUE,
  eventType TEXT NOT NULL,
  payload TEXT NOT NULL,
  processedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subevents_tenant ON SubscriptionEvents(tenantId);
CREATE INDEX IF NOT EXISTS idx_subevents_type ON SubscriptionEvents(eventType);
```

**Purpose:** Idempotent webhook processing log. `razorpayEventId` uniqueness prevents duplicate processing.

**Acceptance:**
- Backend starts without errors.
- `npm test` passes.

### S1.5 Consolidated Postgres migration

**Files:** New file `ward-backend/postgres-migrations/migrations/003_signup_payment_schema.sql`

**Implementation:**

Combine all schema changes from S1.1-S1.4 into a single Postgres migration file:
- ALTER Users (add email, username, status, invitedBy, approvedAt)
- ALTER Tenants (add billing/subscription fields including `pricePerSeat INTEGER`, `billingInterval TEXT DEFAULT 'monthly'`)
- Postgres CHECK constraints: `CHECK (billingInterval IN ('monthly', 'annual'))`, `CHECK (subscriptionStatus IN ('trial', 'active', 'past_due', 'halted', 'cancelled'))`, `CHECK (status IN ('active', 'disabled', 'pending_approval'))`
- CREATE Invitations
- CREATE SubscriptionEvents
- Unique indexes with proper Postgres syntax
- Backfill existing data (including `pricePerSeat = 0`, `billingInterval = 'monthly'` for tenant-default)

**Edge cases:**
- Migration must be idempotent (use `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` where Postgres supports it, or wrap in a DO block).
- Migration planner (`planMigrations.js`) must recognize the new migration.

**Acceptance:**
- `npm test` passes.
- If `DATABASE_URL` is set: migration runs without error; tables/columns exist.
- If `DATABASE_URL` is not set: SQLite schema from `db.js` has all new tables/columns.

---

## Phase S2 — Backend signup API

**Goal:** Build the registration endpoints for both org admin signup and staff self-registration.

### S2.0 Design checkpoint (PROGRESS)

Document the API contract:

| Endpoint | Auth | Body | Response |
|----------|------|------|----------|
| `POST /api/auth/signup` | Public | `{ orgName, adminName, email, password, planId? }` | `{ tenant, user, csrfToken }` + sets cookie |
| `POST /api/auth/register` | Public | `{ inviteCode, name, email, password }` | `{ user, csrfToken }` + sets cookie |
| `POST /api/admin/invitations` | Admin (same tenant) | `{ email?, role }` | `{ invitation }` |
| `GET /api/admin/invitations` | Admin (same tenant) | — | `{ items: [...] }` |
| `DELETE /api/admin/invitations/:id` | Admin (same tenant) | — | `{ message }` |
| `GET /api/admin/users` | Admin (same tenant) | — | `{ items: [...] }` |
| `PUT /api/admin/users/:id/status` | Admin (same tenant) | `{ status: 'active'|'disabled' }` | `{ user }` |

**Acceptance:** PROGRESS design section filled; no code changes.

### S2.1 Signup service

**Files:** New file `ward-backend/services/SignupService.js`

**Implementation:**

1. `signupOrganization({ orgName, adminName, email, password, planId })`:
   - Validate all fields (non-empty, email format, password min length 8).
   - Check email uniqueness across all tenants.
   - Generate `tenantId` (UUID), `userId` (UUID), `orgSlug` (from orgName, lowercase, hyphens, check uniqueness).
   - Hash password with bcrypt (salt rounds 10 — matches `seed.js`).
   - Within a transaction:
     - INSERT Tenant (with `subscriptionStatus: 'trial'`, `seatCount: 1`).
     - INSERT User (role: admin, status: active, tenantId).
   - Return `{ tenant, user }`.

2. `registerStaff({ inviteCode, name, email, password })`:
   - Validate invite code: exists, status = 'pending', not expired.
   - Check email uniqueness.
   - Generate `userId` (UUID), `username` from name.
   - Hash password.
   - Within a transaction:
     - INSERT User (role from invitation, status: active, tenantId from invitation).
     - UPDATE Invitation status → 'accepted'.
     - UPDATE Tenant `seatCount` += 1.
   - Return `{ user, tenant }`.

**Edge cases:**
- Duplicate email: return 409 Conflict with clear message.
- Duplicate orgSlug: append random suffix (e.g., `city-hospital-a1b2`).
- Expired invite: return 410 Gone.
- Revoked invite: return 403.
- Username generation from `name`: lowercase, replace spaces with dots, append random suffix if collision (e.g., `john.doe`, `john.doe.3f`).
- Transaction rollback: if any step fails, no partial data left behind.
- Password validation: minimum 8 characters. No upper limit enforcement (bcrypt handles any length by hashing).

**Acceptance:**
- Unit tests: signup with valid data → tenant + user created; duplicate email → 409; invalid invite → error.
- `npm test` passes.

### S2.2 Signup repository

**Files:** New file `ward-backend/repositories/SignupRepository.js`

**Implementation:**

1. `createTenant(tenantData)` — INSERT into Tenants with all new fields.
2. `createUser(userData)` — INSERT into Users with new fields (email, username, status).
3. `findUserByEmail(email)` — SELECT by email (cross-tenant uniqueness check).
4. `findUserByUsername(username)` — SELECT by username.
5. `findTenantBySlug(slug)` — SELECT by orgSlug.
6. `updateTenantSeatCount(tenantId, delta)` — UPDATE seatCount += delta.
7. `createInvitation(data)` — INSERT into Invitations.
8. `findInvitationByCode(code)` — SELECT by inviteCode.
9. `updateInvitationStatus(id, status)` — UPDATE status.
10. `listInvitationsByTenant(tenantId)` — SELECT all for a tenant.
11. `listUsersByTenant(tenantId)` — SELECT Users where tenantId matches.
12. `updateUserStatus(userId, status)` — UPDATE Users SET status.

All queries go through `dbAdapter` for SQLite/Postgres portability.

**Acceptance:**
- Unit tests for each method.
- `npm test` passes.

### S2.3 Auth login compatibility (username or email login)

**Files:** [ward-backend/repositories/AuthRepository.js](../../ward-backend/repositories/AuthRepository.js), [ward-backend/services/AuthService.js](../../ward-backend/services/AuthService.js)

**Implementation:**

1. Update `AuthRepository.findUserByName` to also search by `email` and `username`:
   ```javascript
   async findUser(identifier) {
     return dbAdapter.get(
       `SELECT * FROM Users WHERE name = ? OR email = ? OR username = ?`,
       [identifier, identifier, identifier]
     );
   }
   ```
   Keep `findUserByName` as an alias for backward compatibility with tests.

2. In `AuthService.authenticateUser`:
   - Use `findUser(identifier)` instead of `findUserByName(username)`.
   - Add check: if `user.status !== 'active'`, throw error `'Account is disabled or pending approval'`.
   - Include `email` in JWT payload: `{ id, name, email, role, tenantId, csrf }`.

**Edge cases:**
- Case sensitivity: email lookup should be case-insensitive (`LOWER(email) = LOWER(?)`).
- `name` lookup stays case-sensitive (preserves existing behavior for seed users like `Dr. Smith`).
- User with status `'disabled'`: cannot log in even with correct password.
- User with status `'pending_approval'`: cannot log in; must be approved by admin first.
- Multiple matches (name collision across tenants): the query `OR` may return wrong user. Fix: when multiple rows match, prefer exact `username` match, then `email`, then `name`. Use `ORDER BY CASE WHEN username = ? THEN 0 WHEN email = ? THEN 1 ELSE 2 END LIMIT 1`.

**Acceptance:**
- Existing seed users can still log in with their `name` (e.g., `Dr. Smith`).
- New users can log in with `email` or `username`.
- Disabled users get clear error message.
- `npm test` passes (existing login tests unaffected).
- `node stressEverything.js` passes (stress uses `name`-based login).

### S2.4 Signup controller and routes

**Files:** New file `ward-backend/controllers/SignupController.js`, modify [ward-backend/server.js](../../ward-backend/server.js)

**Implementation:**

1. Create `SignupController.js` as an Express router:

   - `POST /signup` — org admin signup:
     - Rate limit: 10 requests / 15 min per IP (prevent abuse).
     - Validate body: `orgName`, `adminName`, `email`, `password` required.
     - Call `signupService.signupOrganization(...)`.
     - Generate JWT, set `ward_token` cookie (same as `AuthController` login).
     - Return `{ tenant: { id, name, slug }, user: { id, name, email, role }, csrfToken }`.

   - `POST /register` — staff registration with invite:
     - Rate limit: 20 requests / 15 min per IP.
     - Validate body: `inviteCode`, `name`, `email`, `password` required.
     - Call `signupService.registerStaff(...)`.
     - Generate JWT, set cookie.
     - Return `{ user, csrfToken }`.

   - `GET /invite/:code` — public, validate invite (for frontend pre-fill):
     - Returns `{ valid: true, tenantName, role, email }` or `{ valid: false, reason }`.

2. Mount in `server.js`:
   ```javascript
   app.use('/api/auth', signupRoutes); // merge with existing authRoutes
   ```
   Or mount on same `/api/auth` prefix since `AuthController` is already there. Decision: **add routes to existing `AuthController.js`** to keep auth-related routes together, OR create a separate `SignupController.js` mounted alongside. **Decision: separate controller** to keep files focused; mount as `app.use('/api/auth', signupRoutes)` after the existing auth mount. Express merges routes from multiple `app.use` calls on the same prefix.

   Actually, Express Router instances are separate — two `app.use('/api/auth', ...)` calls both match. Routes are tried in mount order. Since signup routes (`/signup`, `/register`, `/invite/:code`) don't collide with existing auth routes (`/login`, `/logout`, `/me`), this works safely.

3. Mount in `server.js`: add `app.use('/api/auth', signupRoutes)` right after the existing `app.use('/api/auth', authRoutes)`.

**Edge cases:**
- CSRF: signup/register are **public** (no JWT yet), so CSRF middleware must **skip** these routes, similar to how `/api/auth/login` is already exempt in [csrf.js line 12-14](../../ward-backend/middleware/csrf.js). Verify that `verifyCsrfForMutations` skips when `req.user` has no `csrf` claim — yes, it does (line 9-10: `if (!req.user?.csrf) return next()`).
- Rate limiting: separate limiter from login to avoid legitimate signups being blocked by login brute-force attempts.
- Invite code in URL: the `GET /invite/:code` endpoint is public — don't leak sensitive tenant data. Only return `tenantName`, `role`, and `email` (if set in invitation).

**Acceptance:**
- `npm test` passes.
- Manual: `POST /api/auth/signup` with valid body → new tenant + user created, cookie set.
- Manual: `POST /api/auth/register` with valid invite → new user created in correct tenant.
- Existing login flow unchanged.

### S2.5 Admin user management routes

**Files:** [ward-backend/routes/adminAudit.js](../../ward-backend/routes/adminAudit.js) or new file `ward-backend/routes/adminUsers.js`

**Decision:** Create a new `ward-backend/routes/adminUsers.js` to keep admin routes organized, then mount as `app.use('/api/admin', adminUsersRoutes)` in `server.js`.

**Implementation:**

1. `POST /api/admin/invitations` — create invitation:
   - Requires `authenticateToken` + `requireRole(['admin'])`.
   - Body: `{ email, role }`. Email is optional (allows "open invite link for any doctor").
   - Generates invite code, sets expiry (7 days).
   - Returns `{ invitation: { id, inviteCode, role, expiresAt, inviteUrl } }`.
   - `inviteUrl` format: `${FRONTEND_URL}/signup?invite=${inviteCode}`.

2. `GET /api/admin/invitations` — list invitations for admin's tenant:
   - Returns `{ items: [...] }` with status, role, email, created date.

3. `DELETE /api/admin/invitations/:id` — revoke invitation:
   - Sets status to `'revoked'`.

4. `GET /api/admin/users` — list users in admin's tenant:
   - Returns `{ items: [...] }` with id, name, email, role, status.

5. `PUT /api/admin/users/:id/status` — activate/disable user:
   - Body: `{ status: 'active' | 'disabled' }`.
   - Cannot disable self (prevent admin self-lockout).
   - When disabling: decrement tenant `seatCount`.
   - When activating: increment tenant `seatCount`.

**Edge cases:**
- Admin cannot change users in other tenants (tenant middleware enforces this).
- Admin cannot change their own status (self-lockout protection).
- Disabling the last admin: prevent this — check if other active admins exist.
- Seat count update must be atomic with user status change (transaction).

**Acceptance:**
- `npm test` passes.
- Manual: admin creates invite → gets invite URL → use it to register → new user appears in user list.

### S2.6 Backend tests for signup

**Files:** New test files under `ward-backend/tests/`

**Implementation:**

1. `tests/services/signupService.test.js`:
   - Test org signup: valid input → tenant + user created.
   - Test org signup: duplicate email → 409.
   - Test staff register: valid invite → user created, invite consumed.
   - Test staff register: expired invite → error.
   - Test staff register: already-used invite → error.

2. `tests/integration/signup.test.js`:
   - Test `POST /api/auth/signup` → 201 with cookie.
   - Test `POST /api/auth/register` → 201 with cookie.
   - Test `GET /api/auth/invite/:code` → valid/invalid responses.
   - Test `POST /api/admin/invitations` → invitation created.
   - Test `PUT /api/admin/users/:id/status` → user disabled/enabled.

**Acceptance:**
- All new tests pass.
- All existing tests pass.
- Test count increased.

---

## Phase S3 — Frontend signup UI

**Goal:** Build the signup and registration pages, invite management UI, and user management UI.

### S3.1 Signup page (org admin)

**Files:** New file `ward-frontend/src/views/Signup.jsx`, modify [main.jsx](../../ward-frontend/src/main.jsx)

**Implementation:**

1. Create `Signup.jsx` — a public page (no auth required):
   - **Form fields:** Organization name, Your name, Email, Password, Confirm password.
   - **Validation:** All fields required; email format; password min 8 chars; passwords match.
   - On submit: `POST /api/auth/signup`.
   - On success: set CSRF token, store user in context, redirect to `/` (dashboard).
   - On error: show error message (duplicate email, server error, etc.).
   - **Link:** "Already have an account? Sign in" → `/login`.

2. Add route in `main.jsx`:
   ```jsx
   <Route path="/signup" element={<Signup />} />
   ```
   (Public route, outside `ProtectedLayout`)

3. Add "Sign up" link on `Login.jsx`:
   - Below the sign-in button: "Don't have an organization? Sign up"
   - Link to `/signup`.

**UI guidance:**
- Match existing login page style (gradient background, card, Hospital icon).
- Use `react-hot-toast` for error messages.
- Use existing CSS classes (`input-field`, `btn`, `btn-primary`, `card`).

**Edge cases:**
- User is already logged in and visits `/signup`: redirect to `/`.
- Very long org name: truncate display, don't limit input (DB handles TEXT).
- Network error during signup: show "Network error, please try again" toast.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Manual: visit `/signup` → fill form → submit → redirected to dashboard as admin of new org.

### S3.2 Staff registration page

**Files:** New file `ward-frontend/src/views/Register.jsx`, modify [main.jsx](../../ward-frontend/src/main.jsx)

**Implementation:**

1. Create `Register.jsx` — public page:
   - Reads `invite` query param from URL.
   - On mount: `GET /api/auth/invite/:code` to validate and pre-fill org name, role.
   - If invalid invite: show "This invitation is invalid or has expired" with link to login.
   - **Form fields:** Name, Email (pre-filled if invitation has email), Password, Confirm password.
   - Role is shown as read-only (set by the invitation).
   - On submit: `POST /api/auth/register`.
   - On success: redirect to `/`.
   - On error: show error.
   - **Link:** "Already have an account? Sign in" → `/login`.

2. Add route in `main.jsx`:
   ```jsx
   <Route path="/register" element={<Register />} />
   ```

**Edge cases:**
- No invite code in URL: show "You need an invitation to register" with links to sign up as org or sign in.
- Invite for specific email: if the user enters a different email than the invitation, backend will reject — show clear error.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Manual: admin creates invite → copy URL → open in incognito → register → logged in as staff.

### S3.3 Admin user management page

**Files:** New file `ward-frontend/src/views/UserManagement.jsx`, modify [main.jsx](../../ward-frontend/src/main.jsx), [Layout.jsx](../../ward-frontend/src/components/Layout.jsx)

**Implementation:**

1. Create `UserManagement.jsx` — admin-only view:
   - **Users Section:**
     - Table: name, email, role, status, actions (enable/disable).
     - Disable button: confirmation dialog → `PUT /api/admin/users/:id/status`.
     - Current user row: disable button grayed out with tooltip "Cannot disable yourself".
   - **Invitations Section:**
     - "Create Invitation" button → modal: select role, optional email, submit.
     - Table: invite code (truncated), role, email, status, expiry, actions (revoke, copy link).
     - Copy link: copies `{window.location.origin}/register?invite={code}` to clipboard.
   - **Seat Summary:**
     - "X of Y seats used" (seatCount / maxSeats from tenant).
     - Warning when approaching limit.

2. Add route in `main.jsx`:
   ```jsx
   <Route element={<ProtectedLayout allowedRoles={['admin']} />}>
     <Route path="/admin/audit" element={<AdminAudit />} />
     <Route path="/admin/users" element={<UserManagement />} />
   </Route>
   ```

3. Add "Users" nav link in [Layout.jsx](../../ward-frontend/src/components/Layout.jsx) next to "Audit log" (admin-only).

**Edge cases:**
- Empty user list: show "No staff members yet. Create an invitation to get started."
- Expired invitations: show with "Expired" badge, no revoke action.
- Copy to clipboard: fallback for browsers that don't support `navigator.clipboard` — select + document.execCommand('copy').

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Admin: create invitation → copy link → revoke invitation → enable/disable user.
- Non-admin: route shows "Access Denied".

### S3.4 Update AuthContext for signup

**Files:** [ward-frontend/src/context/AuthContext.jsx](../../ward-frontend/src/context/AuthContext.jsx)

**Implementation:**

1. Add `signup` method:
   ```javascript
   const signup = async (orgName, adminName, email, password) => {
     const data = await api.post('/auth/signup', { orgName, adminName, email, password });
     if (!data?.user) throw new Error('Signup failed');
     if (data.csrfToken) setCsrfToken(data.csrfToken);
     localStorage.setItem('ward_user', JSON.stringify(data.user));
     setUser(data.user);
     return data;
   };
   ```

2. Add `register` method:
   ```javascript
   const register = async (inviteCode, name, email, password) => {
     const data = await api.post('/auth/register', { inviteCode, name, email, password });
     if (!data?.user) throw new Error('Registration failed');
     if (data.csrfToken) setCsrfToken(data.csrfToken);
     localStorage.setItem('ward_user', JSON.stringify(data.user));
     setUser(data.user);
     return data;
   };
   ```

3. Expose both in context provider value.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Signup and register flows work end-to-end via AuthContext.

---

## Phase P1 — Razorpay integration (backend)

**Goal:** Integrate Razorpay for per-seat subscription billing.

### P1.0 Snapshot & dependency install

**Files:** [ward-backend/package.json](../../ward-backend/package.json), [ward-backend/.env.example](../../ward-backend/.env.example)

**Implementation:**

1. Install Razorpay SDK:
   ```bash
   cd ward-backend && npm install razorpay
   ```

2. Add env vars to `.env.example`:
   ```
   # Razorpay API keys (required for payment features)
   # Get from https://dashboard.razorpay.com/app/keys
   # RAZORPAY_KEY_ID=
   # RAZORPAY_KEY_SECRET=

   # Razorpay webhook secret for signature verification
   # RAZORPAY_WEBHOOK_SECRET=

   # Plan IDs (create via Razorpay Dashboard or API)
   # RAZORPAY_PLAN_MONTHLY=
   # RAZORPAY_PLAN_ANNUAL=

   # Frontend URL (for generating invite links, payment callbacks)
   # FRONTEND_URL=http://localhost:5173
   ```

3. Add to `ward-frontend/.env.example`:
   ```
   # Razorpay key (public, for Standard Checkout)
   # VITE_RAZORPAY_KEY_ID=
   ```

**Acceptance:**
- `npm install` succeeds.
- `npm test` passes (SDK installed, not yet used).
- `.env.example` files updated.

### P1.1 Razorpay client module

**Files:** New file `ward-backend/services/razorpay.js`

**Implementation:**

1. Create singleton Razorpay instance:
   ```javascript
   const Razorpay = require('razorpay');

   let instance = null;

   function getRazorpay() {
     if (!instance) {
       const keyId = process.env.RAZORPAY_KEY_ID;
       const keySecret = process.env.RAZORPAY_KEY_SECRET;
       if (!keyId || !keySecret) {
         if (process.env.NODE_ENV === 'production') {
           throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in production');
         }
         return null; // Payment features disabled in dev without keys
       }
       instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
     }
     return instance;
   }

   function isPaymentEnabled() {
     return !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
   }
   ```

2. Export `getRazorpay()` and `isPaymentEnabled()`.

**Design decision:** Payment features are **opt-in** — if Razorpay env vars are not set, signup still works but skips payment creation. This allows development/testing without Razorpay credentials. In production, enforce via the startup check.

**Acceptance:**
- Module loads without error when env vars are absent (returns null).
- Module creates instance when env vars are set.
- `npm test` passes.

### P1.2 Subscription service

**Files:** New file `ward-backend/services/SubscriptionService.js`

**Implementation:**

1. `createSubscription(tenant, planId)`:
   - If payments not enabled: return `{ skipped: true }`.
   - Create Razorpay customer: `razorpay.customers.create({ name: tenant.name, email: tenant.billingEmail })`.
   - Fetch plan details to cache pricing: `razorpay.plans.fetch(planId)` → extract `item.amount` (price per seat in paise) and `period` (monthly/yearly).
   - Create Razorpay subscription (**one per organization** — produces a single consolidated invoice each billing cycle):
     ```javascript
     razorpay.subscriptions.create({
       plan_id: planId || process.env.RAZORPAY_PLAN_MONTHLY,
       total_count: 120,   // max billing cycles (10 years monthly)
       quantity: 1,         // seat count — Razorpay bills: plan_amount x quantity = ONE org invoice
       customer_notify: 1,  // Razorpay sends consolidated invoice email to org admin
       notes: { tenantId: tenant.id, orgName: tenant.name }
     })
     ```
     Razorpay generates **one invoice per billing cycle**: `plan_amount (per seat) x quantity (seats) = total billed to org`.
   - Update Tenant: `razorpayCustomerId`, `razorpaySubscriptionId`, `planId`, `pricePerSeat` (from plan fetch, converted from paise to display unit), `billingInterval` (`'monthly'` or `'annual'` from plan period).
   - Return `{ subscriptionId, shortUrl }` (Razorpay returns a `short_url` for hosted checkout).

2. `updateSeatCount(tenantId, newQuantity)`:
   - If payments not enabled: return `{ skipped: true }`.
   - Fetch tenant's `razorpaySubscriptionId` from DB.
   - Call `razorpay.subscriptions.update(subscriptionId, { quantity: newQuantity })`.
   - Update Tenant `seatCount` in DB.
   - **Billing effect on the consolidated org invoice:** The next invoice will reflect the updated quantity.
     Example: org had 5 seats (Rs 2,500/month), added 2 staff → now 7 seats → next invoice = Rs 3,500.
     No mid-cycle charge — the change applies at the next billing cycle.
   - Note: Razorpay may support immediate proration depending on plan settings. For launch, use cycle-end updates (simpler, no surprise charges).

3. `cancelSubscription(tenantId, cancelAtCycleEnd)`:
   - `razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd)`.
   - Update Tenant `subscriptionStatus = 'cancelled'`.

4. `getSubscriptionStatus(tenantId)`:
   - Fetch from Razorpay API.
   - Return current status, next charge date, amount per cycle (`pricePerSeat x seatCount`).

5. `getInvoiceHistory(tenantId, count)`:
   - Fetch tenant's `razorpaySubscriptionId` from DB.
   - Call `razorpay.invoices.all({ subscription_id: subscriptionId, count })`.
   - Each invoice is **one org-level consolidated bill** for that billing cycle.
   - Return mapped array: `[{ invoiceId, amount, seatCount, status, billingStart, billingEnd, paidAt }]`.
   - The `amount` on each invoice = `pricePerSeat x seatCount` for that cycle.

**Edge cases:**
- Razorpay API timeout: retry once after 2 seconds; if still fails, log error and return partial result (tenant created but subscription pending — handle in a recovery job).
- Razorpay API error (invalid plan ID, etc.): log full error, return clear error message.
- Seat count = 0: prevent this — minimum 1 (the admin).
- Quantity update race condition: if two staff register simultaneously, one update may overwrite the other. Use DB-level `seatCount` as source of truth and update Razorpay from that.
- `pricePerSeat` cache stale: if plan pricing changes in Razorpay dashboard, the cached value becomes stale. Refresh on each `subscription.charged` webhook (the invoice amount / quantity = updated price per seat).
- Invoice fetch when no invoices yet (new subscription): return empty array, frontend shows "First invoice will be generated at end of billing cycle."

**Acceptance:**
- Unit tests with mocked Razorpay (don't hit real API in tests).
- `npm test` passes.
- `createSubscription` caches `pricePerSeat` and `billingInterval` in Tenants.
- `getInvoiceHistory` returns org-level invoices (one per cycle).

### P1.3 Wire payment into signup flow

**Files:** [ward-backend/services/SignupService.js](../../ward-backend/services/SignupService.js) (from S2.1), [ward-backend/controllers/SignupController.js](../../ward-backend/controllers/SignupController.js) (from S2.4)

**Implementation:**

1. In `signupOrganization`:
   - After creating tenant + user, call `subscriptionService.createSubscription(tenant, planId)`.
   - If payment is enabled: return `{ ... , razorpaySubscriptionId, checkoutRequired: true }`.
   - If payment is not enabled: return `{ ... , checkoutRequired: false }`.

2. In the signup controller response:
   - If `checkoutRequired`: include `razorpaySubscriptionId` and `razorpayKeyId` in response.
   - Frontend will use these to open Razorpay Standard Checkout.

3. In `registerStaff`:
   - After creating user, call `subscriptionService.updateSeatCount(tenantId, newCount)`.
   - Seat count update failure should **not** block registration — log the error, create the user, and reconcile later via webhook.

**Edge cases:**
- Signup succeeds but Razorpay fails: tenant exists with `subscriptionStatus: 'trial'`. A background reconciliation process or webhook will catch up.
- Staff registration when tenant is `past_due`: allow registration but warn admin about payment.
- Staff registration when tenant is `cancelled` or `halted`: reject registration with message "Organization subscription is inactive. Please contact your administrator."

**Acceptance:**
- `npm test` passes.
- Manual (with test Razorpay keys): signup → Razorpay subscription created → subscription ID in response.
- Manual (without Razorpay keys): signup → user/tenant created, `checkoutRequired: false`.

### P1.4 Razorpay webhook handler

**Files:** New file `ward-backend/routes/webhooks.js`, modify [ward-backend/server.js](../../ward-backend/server.js)

**Implementation:**

1. Create `webhooks.js`:
   - `POST /api/webhooks/razorpay` — public (no JWT; verified by Razorpay signature).
   - **Signature verification:**
     ```javascript
     const crypto = require('crypto');
     const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
     const signature = req.headers['x-razorpay-signature'];
     const expectedSignature = crypto
       .createHmac('sha256', secret)
       .update(JSON.stringify(req.body))
       .digest('hex');
     if (signature !== expectedSignature) return res.status(400).json({ error: 'Invalid signature' });
     ```
   - **Idempotency:** Check `SubscriptionEvents.razorpayEventId` before processing.
   - **Event handling:**

     | Razorpay Event | Action |
     |----------------|--------|
     | `subscription.authenticated` | Set tenant `subscriptionStatus = 'active'` |
     | `subscription.charged` | Set `subscriptionStatus = 'active'`, update `billingCycleEnd` |
     | `subscription.pending` | Set `subscriptionStatus = 'past_due'` |
     | `subscription.halted` | Set `subscriptionStatus = 'halted'` (payment failed after retries) |
     | `subscription.cancelled` | Set `subscriptionStatus = 'cancelled'` |
     | `subscription.paused` | Set `subscriptionStatus = 'paused'` |
     | `subscription.resumed` | Set `subscriptionStatus = 'active'` |
     | `payment.failed` | Log failure, increment failure counter in metrics |

   - Log every event to `SubscriptionEvents` table.
   - Return 200 OK to Razorpay (even if processing fails — reprocess from DB later).

2. Mount in `server.js`:
   - **Before** `express.json()` middleware, add raw body parsing for webhook route:
     ```javascript
     app.use('/api/webhooks/razorpay', express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
     ```
     Actually, Razorpay's Node SDK signature verification works with the JSON body stringified. Since `express.json()` is already applied globally, verify against `JSON.stringify(req.body)`. If this doesn't match due to formatting differences, use `express.raw()` for the webhook route specifically.
   - Mount: `app.use('/api/webhooks', webhookRoutes)`.

3. CSRF exemption: webhook route is public (no `req.user`), so CSRF middleware already skips it (line 9-10 of `csrf.js`: `if (!req.user?.csrf) return next()`).

**Edge cases:**
- Missing webhook secret: if `RAZORPAY_WEBHOOK_SECRET` is not set, skip signature verification in non-production (log warning) or reject all webhooks in production.
- Duplicate webhook delivery: `razorpayEventId` uniqueness in `SubscriptionEvents` prevents double-processing.
- Webhook arrives before signup completes: tenant may not exist yet — return 200 and skip (Razorpay will retry).
- `subscription.halted`: this is serious — tenant should be notified. For MVP, just update status; notification handled by alert engine (from monitoring plan).

**Acceptance:**
- `npm test` passes.
- Manual: simulate webhook with `curl` → event logged, tenant status updated.
- Signature verification: invalid signature → 400.

### P1.5 Subscription enforcement middleware

**Files:** New file `ward-backend/middleware/subscriptionGuard.js`, modify [ward-backend/server.js](../../ward-backend/server.js)

**Implementation:**

1. Create middleware that checks tenant subscription status on authenticated requests:
   ```javascript
   async function requireActiveSubscription(req, res, next) {
     if (!isPaymentEnabled()) return next(); // skip if payments not configured
     const tenantId = req.user?.tenantId;
     if (!tenantId) return next();

     const tenant = await dbAdapter.get('SELECT subscriptionStatus FROM Tenants WHERE id = ?', [tenantId]);
     if (!tenant) return next();

     const status = tenant.subscriptionStatus;

     if (status === 'active' || status === 'trial') return next();

     if (status === 'past_due') {
       // Allow read operations, block writes
       if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
       return res.status(402).json({
         error: 'Payment past due. Please update your payment method.',
         code: 'PAYMENT_REQUIRED',
         subscriptionStatus: status
       });
     }

     // halted, cancelled, or unknown
     if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
     return res.status(402).json({
       error: 'Subscription inactive. Please contact your administrator.',
       code: 'SUBSCRIPTION_INACTIVE',
       subscriptionStatus: status
     });
   }
   ```

2. Apply after `authenticateToken` on `/api` routes (but **not** on `/api/auth/*`, `/api/webhooks/*`, `/api/monitoring/*`).

   In `server.js`, apply selectively:
   ```javascript
   app.use('/api/patients', requireActiveSubscription, patientRoutes);
   app.use('/api/escalations', requireActiveSubscription, escalationRoutes);
   // etc. for clinical routes
   ```
   Don't apply to: `/api/auth/*` (need login to manage subscription), `/api/admin/*` (admin needs access to manage billing), `/api/monitoring/*`, `/api/webhooks/*`.

**Edge cases:**
- `tenant-default` (seed/demo): has `subscriptionStatus = 'active'` from backfill — always works.
- New tenant before first payment: `subscriptionStatus = 'trial'` — allowed.
- Cached tenant status: the middleware queries DB on every request. For performance, consider a short TTL cache (30 seconds). But for launch, direct DB query is fine (SQLite is fast for single-row lookups).
- `402 Payment Required` HTTP status: standard for this use case.

**Acceptance:**
- `npm test` passes (test tenant has `active` status).
- `node stressEverything.js` passes (stress tenant is `active`).
- Manual: set a tenant to `past_due` → POST requests get 402, GET requests work.

---

## Phase P2 — Frontend payment integration

**Goal:** Integrate Razorpay Standard Checkout on the frontend for the initial authentication transaction and subscription management.

### P2.1 Razorpay Checkout in signup flow

**Files:** [ward-frontend/src/views/Signup.jsx](../../ward-frontend/src/views/Signup.jsx) (from S3.1)

**Implementation:**

1. After successful `POST /api/auth/signup`:
   - If response has `checkoutRequired: true` and `razorpaySubscriptionId`:
     - Load Razorpay Checkout script dynamically (or include in `index.html`):
       ```html
       <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
       ```
     - Open checkout:
       ```javascript
       const options = {
         key: import.meta.env.VITE_RAZORPAY_KEY_ID,
         subscription_id: data.razorpaySubscriptionId,
         name: 'General Ward',
         description: 'Per-seat subscription',
         handler: function(response) {
           // Payment success — verify on backend
           api.post('/auth/verify-payment', {
             razorpay_payment_id: response.razorpay_payment_id,
             razorpay_subscription_id: response.razorpay_subscription_id,
             razorpay_signature: response.razorpay_signature
           }).then(() => navigate('/'));
         },
         prefill: { name: adminName, email: email },
         theme: { color: '#2563eb' }
       };
       const rzp = new Razorpay(options);
       rzp.open();
       ```
   - If `checkoutRequired: false`: redirect directly to dashboard.

2. Add payment verification endpoint (backend):
   - `POST /api/auth/verify-payment` — verifies Razorpay signature server-side.
   - Uses HMAC-SHA256: `payment_id | subscription_id` signed with key_secret.
   - On success: update tenant `subscriptionStatus = 'active'`.
   - On failure: return 400.

**Edge cases:**
- User closes Razorpay Checkout without paying: account exists with `trial` status. Show a banner on next login prompting payment.
- Razorpay Checkout script fails to load (ad blocker, network): show manual payment link.
- Double payment verification: idempotent — if already active, return success.

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Manual (Razorpay test mode): signup → checkout opens → test card payment → redirected to dashboard.

### P2.2 Subscription status banner

**Files:** [ward-frontend/src/components/Layout.jsx](../../ward-frontend/src/components/Layout.jsx)

**Implementation:**

1. Fetch tenant subscription status (include in `/auth/me` response or separate endpoint).
2. If status is `'trial'`: show yellow banner "You're on a trial. Set up billing to continue using General Ward."
3. If status is `'past_due'`: show red banner "Payment failed. Please update your payment method. Write access will be restricted until payment is resolved."
4. If status is `'halted'` or `'cancelled'`: show red banner "Subscription inactive. Contact your administrator."
5. Banner is dismissible for the session but reappears on next login.

**Edge cases:**
- Non-admin users see the banner but "update payment" link only shows for admins.
- Banner should not interfere with critical clinical workflows (positioned above nav, not blocking content).

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Manual: tenant with `past_due` → banner visible → admin sees payment link.

### P2.3 Frontend handling of 402 responses

**Files:** [ward-frontend/src/utils/api.ts](../../ward-frontend/src/utils/api.ts)

**Implementation:**

1. In the `api.request` method, handle `402` responses:
   ```typescript
   if (response.status === 402) {
     const errBody = await response.json().catch(() => ({}));
     const msg = errBody?.error || 'Payment required';
     toast.error(msg);
     const err = new Error(msg);
     err.status = 402;
     err.details = errBody;
     throw err;
   }
   ```
2. Do **not** redirect to login on 402 (unlike 401/403).
3. Calling components can check `err.status === 402` and show appropriate UI (e.g., "Please update your payment method").

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Manual: tenant with `past_due` → attempt POST → toast with payment message, no redirect.

### P2.4 Admin billing page (optional, recommended)

**Files:** New file `ward-frontend/src/views/Billing.jsx`, modify [main.jsx](../../ward-frontend/src/main.jsx)

**Implementation:**

1. Create `Billing.jsx` — admin-only:
   - **Current Plan Card:**
     - Plan name + billing interval (monthly/annual) from tenant's `billingInterval`.
     - Price per seat from tenant's cached `pricePerSeat`.
     - **Consolidated bill summary:** "X active seats x Rs Y/seat = **Rs Z total** per [month|year]"
       Example: "10 seats x Rs 500/seat = **Rs 5,000 total** per month"
     - Next billing date (from Razorpay subscription `current_end`).
   - **Seat Usage Card:**
     - "X of Y seats used" (seatCount / maxSeats) with progress bar.
     - "Manage seats" link → `/admin/users`.
     - Note below: "Adding or removing staff will update your next bill automatically."
   - **Invoice History Table:**
     - Fetched via `GET /api/admin/billing/invoices` (backend proxies to `subscriptionService.getInvoiceHistory`).
     - Columns: Date, Period, Seats, Amount, Status (paid/pending/failed).
     - Each row is **one consolidated org invoice** (not per-user lines).
     - Example row: "Mar 2026 | 1 Mar – 31 Mar | 10 seats | Rs 5,000 | Paid"
   - **Update Payment Method:** opens Razorpay Checkout for re-authentication.
   - **Cancel Subscription:** confirmation dialog → cancel API call.

2. Backend endpoints:
   - `GET /api/admin/billing` → returns subscription details + cached pricing:
     `{ planName, pricePerSeat, billingInterval, seatCount, maxSeats, nextBillingDate, subscriptionStatus, totalPerCycle }`.
     `totalPerCycle = pricePerSeat x seatCount` (computed server-side, returned for frontend display).
   - `GET /api/admin/billing/invoices` → returns invoice history from `subscriptionService.getInvoiceHistory()`. Each entry is one consolidated org-level invoice.
   - `POST /api/admin/billing/update-payment` → creates a new Razorpay subscription link for re-auth.

3. Add route: `/admin/billing` in admin-only layout.
4. Add "Billing" nav link in [Layout.jsx](../../ward-frontend/src/components/Layout.jsx) (admin-only, next to "Audit log" and "Users").

**Edge cases:**
- Payments not enabled (`isPaymentEnabled() = false`): show "Billing is not configured for this environment" message.
- Razorpay API down when fetching invoices: show cached data from last successful fetch with "Last updated at" timestamp; use `react-query` staleTime.
- Zero invoice history (new subscription, first cycle not yet billed): show "Your first invoice will be generated at the end of this billing cycle."
- Annual billing display: show "Rs 60,000/year for 10 seats" (not confusingly divided into monthly).
- Seat count changed mid-cycle: show note "Your next invoice will reflect 12 seats (updated from 10)."

**Acceptance:**
- `npm run lint` and `npm run build` pass.
- Admin sees: current plan card with consolidated total, seat usage, invoice history (one row per org per cycle).
- Non-admin: route shows "Access Denied".

---

## Phase P3 — Payment integration testing

**Goal:** End-to-end testing of the payment flow using Razorpay test mode.

### P3.1 Razorpay test mode setup

**Implementation:**

1. Create Razorpay test mode plans:
   - Monthly plan: ₹100/seat/month (test pricing).
   - Annual plan: ₹1000/seat/year (test pricing).
2. Configure test API keys in `.env`.
3. Configure webhook URL (use ngrok or similar for local testing).
4. Document test card numbers from Razorpay docs.

**Acceptance:**
- Plans visible in Razorpay test dashboard.
- Webhook endpoint reachable from Razorpay.

### P3.2 End-to-end payment test

**Implementation:**

1. Org admin signup → Razorpay Checkout opens → pay with test card → subscription active.
2. Admin invites staff → staff registers → seat count incremented in Razorpay.
3. Simulate payment failure → webhook fires `subscription.halted` → tenant enters `halted` status → writes blocked.
4. Admin updates payment → subscription reactivated → writes unblocked.
5. Admin cancels subscription → `subscription.cancelled` → appropriate UI.

**Acceptance:**
- Full flow works end-to-end in test mode.
- All webhook events handled correctly.
- Seat count accurate throughout.

### P3.3 Stress test with payment features

**Implementation:**

1. Run `stressEverything.js` — verify existing workflows unaffected by payment middleware.
2. Verify that `subscriptionGuard` middleware doesn't add significant latency (< 5ms per request for active tenants).
3. Verify no 5xx errors, no timeouts.

**Acceptance:**
- `server5xx=0`, `timeouts=0`, `fetchErrors=0`.
- P95 latency within acceptable range (< 200ms locally).

---

## 5. Execution order summary

| Step | Phase | Description | Dependencies |
|------|-------|-------------|-------------|
| S1.0 | S1 | Snapshot | None |
| S1.1 | S1 | Extend Users table | S1.0 |
| S1.2 | S1 | Extend Tenants table | S1.0 |
| S1.3 | S1 | Create Invitations table | S1.0 |
| S1.4 | S1 | Create SubscriptionEvents table | S1.0 |
| S1.5 | S1 | Postgres migration | S1.1–S1.4 |
| S2.0 | S2 | Design checkpoint | S1 |
| S2.1 | S2 | Signup service | S2.0 |
| S2.2 | S2 | Signup repository | S2.0 |
| S2.3 | S2 | Auth login compatibility | S2.2 |
| S2.4 | S2 | Signup controller/routes | S2.1, S2.2, S2.3 |
| S2.5 | S2 | Admin user management routes | S2.2 |
| S2.6 | S2 | Backend signup tests | S2.4, S2.5 |
| S3.1 | S3 | Signup page (org admin) | S2.4 |
| S3.2 | S3 | Staff registration page | S2.4 |
| S3.3 | S3 | Admin user management page | S2.5 |
| S3.4 | S3 | AuthContext updates | S3.1 |
| P1.0 | P1 | Razorpay SDK install | None |
| P1.1 | P1 | Razorpay client module | P1.0 |
| P1.2 | P1 | Subscription service | P1.1 |
| P1.3 | P1 | Wire payment into signup | S2.1, P1.2 |
| P1.4 | P1 | Webhook handler | P1.1, S1.4 |
| P1.5 | P1 | Subscription enforcement | P1.1, S1.2 |
| P2.1 | P2 | Razorpay Checkout in signup | S3.1, P1.3 |
| P2.2 | P2 | Subscription status banner | P1.5, S3.4 |
| P2.3 | P2 | Frontend 402 handling | P1.5 |
| P2.4 | P2 | Admin billing page | P1.2, S3.3 |
| P3.1 | P3 | Razorpay test setup | P1, P2 |
| P3.2 | P3 | End-to-end payment test | P3.1 |
| P3.3 | P3 | Stress test | P3.2 |

---

## 6. Environment variables (complete list)

| Variable | Where | Required | Purpose |
|----------|-------|----------|---------|
| `RAZORPAY_KEY_ID` | Backend `.env` | Production only | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Backend `.env` | Production only | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Backend `.env` | Production only | Webhook signature verification |
| `RAZORPAY_PLAN_MONTHLY` | Backend `.env` | When payments enabled | Razorpay plan ID for monthly billing |
| `RAZORPAY_PLAN_ANNUAL` | Backend `.env` | When payments enabled | Razorpay plan ID for annual billing |
| `FRONTEND_URL` | Backend `.env` | Recommended | For generating invite links, callback URLs |
| `VITE_RAZORPAY_KEY_ID` | Frontend `.env` | When payments enabled | Razorpay public key for Checkout |

---

## 7. Security considerations

| Concern | Mitigation |
|---------|-----------|
| Razorpay secrets exposed | Store only in `.env`, never in code or client-side. `RAZORPAY_KEY_SECRET` is server-only. |
| Webhook spoofing | HMAC-SHA256 signature verification on every webhook. |
| Signup abuse | Rate limiting on signup/register routes (10-20 req/15 min per IP). |
| Email enumeration | Signup returns generic error on duplicate email (no "email already exists" distinction). Actually, a 409 is needed for UX — compromise: rate-limit the endpoint to make enumeration slow. |
| Cross-tenant access | All user management routes enforce tenant isolation via `req.user.tenantId`. |
| Self-lockout | Admin cannot disable themselves. Cannot disable last admin. |
| Payment data | No card data touches our server — Razorpay Checkout handles PCI compliance. Only subscription IDs and events are stored. |
| Invite code brute-force | 32-character hex codes = 128 bits of entropy. Rate-limited invite validation endpoint. |

---

## 8. Out of scope (explicit)

- Multi-plan management UI (switch between monthly/annual from dashboard — do via Razorpay API or dashboard)
- Invoice PDF generation (use Razorpay's built-in invoice system)
- Proration calculations (handled by Razorpay subscription updates)
- Credit card storage (PCI handled by Razorpay)
- Multiple payment methods per tenant
- Refund automation (handle manually via Razorpay dashboard)
- OAuth/social login (SSO is a separate phase)
- Email verification (recommended but separate phase — for MVP, trust the email provided)

---

## 9. Cross-plan dependency

This plan integrates with the monitoring plan ([launch-monitoring-contingency-detailed.md](./launch-monitoring-contingency-detailed.md)):

- **Phase M2** (auth monitoring) will automatically track signup success/failure once signup routes exist.
- **Phase M4** (payment monitoring scaffolding) activates when Razorpay webhooks start recording events.
- **Phase C1** (kill switches) can gate signup and payment features.
- **Phase M5** (alerts) should include: `PAYMENT_FAILURE_SPIKE` (many subscription.halted events), `SIGNUP_FAILURE_RATE` (high signup error rate).

**Recommended execution order across plans:**
1. Phase S1 (schema) → S2 (backend signup) → S3 (frontend signup) — signup works without payments
2. Phase P1 (Razorpay backend) → P2 (Razorpay frontend) → P3 (payment testing)
3. Then: monitoring plan (M1–M5, C1–C4) — monitors everything including signup and payments

---

*Plan depth version: 1 — aligned with repo paths as of 2026-03-30; re-validate paths if refactors occur.*
