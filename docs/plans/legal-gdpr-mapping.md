# Legal / GDPR — responsibility mapping

This document maps the Phase 1 SaaS checklist legal items to **what the repo provides** and **what the organization must handle externally**. It is not legal advice.

See also: [COMPLIANCE.md](../COMPLIANCE.md) for existing audit trail and backup semantics.

---

## Checklist items: repo vs organization

| Checklist item | Owner | Current state | Action needed |
|----------------|-------|---------------|---------------|
| **Terms of Service** | Organization | Not in repo | Draft with counsel; add link in app footer/login page |
| **Privacy Policy** | Organization | Not in repo | Draft with counsel; add link in app footer/login page |
| **Acceptable Use Policy** | Organization | Not in repo | Draft with counsel; host as static page or external URL |
| **DPA (Data Processing Agreement)** | Organization | Not in repo | Relevant only for enterprise/B2B; template from counsel |
| **SOC 2 controls** | Organization + Repo | Partial: audit logs, tenant isolation, RBAC, password hashing, CSRF | Document controls narrative against SOC 2 trust principles; repo provides evidence |
| **Cookie consent banner** | Repo (if analytics added) | Not needed today (only auth cookie, which is strictly necessary) | Add consent banner **only** if non-essential cookies (analytics, marketing) are introduced |
| **GDPR data export (subject access)** | Repo | Admin-scoped **audit log** export only (CSV); no per-subject data export | Build tenant+subject export endpoint if serving EU users (see schema below) |
| **GDPR data deletion (right to erasure)** | Repo | Admin **audit purge** only; no per-subject clinical data delete | Build tenant+subject deletion endpoint with appropriate safeguards (see schema below) |

---

## In-app legal links (repo task)

When Terms / Privacy / AUP documents exist, wire them into the frontend:

- **Login page footer** — add links below the Sign In button
- **Layout header or footer** — add a small "Legal" or "Privacy" link visible from all authenticated pages
- **Files to touch**: `ward-frontend/src/views/Login.jsx`, `ward-frontend/src/components/Layout.jsx`
- **Implementation**: simple `<a>` tags pointing to external hosted URLs (or internal static routes if self-hosted)

This is a trivial change once the legal texts exist. No endpoint or backend work needed.

---

## Data subject export — schema mapping

If GDPR subject access requests apply, the export must cover all personal data for a given user or patient within a tenant.

### Tables containing personal/identifiable data

| Table | Identifiable fields | Scope key |
|-------|-------------------|-----------|
| `Users` | name, role, passwordHash | `tenantId` + `id` |
| `Patients` | name, mrn, dob, diagnosis, allergies | `tenantId` + `id` |
| `DailyStats` | data (JSON: vitals, symptoms, diet, sleep), recordedBy | `tenantId` + `patientId` |
| `Medications` | name, dosage, prescribedBy | `tenantId` + `patientId` |
| `MedicationAdministrations` | administeredBy, notes, doseActuallyGiven | `tenantId` + `patientId` |
| `Escalations` | reason, escalatedBy | `tenantId` + `patientId` |
| `DischargeSummaries` | all fields (clinical summary) | `tenantId` + `patientId` |
| `Tasks` | assignee, notes, createdBy, completedBy | `tenantId` + `patientId` |
| `HandoverNotes` | note, tags, createdBy | `tenantId` + `patientId` |
| `AuditLogs` | userId, userRole, ipAddress | `tenantId` + `userId` |
| `ClinicalChangeLog` | userId, userRole, summary | `tenantId` + `userId` |
| `AuthLoginAttempts` | username, ipAddress | `username` |

### Proposed export endpoint (future)

```
GET /api/admin/data-export/patient/:patientId
```
- Auth: admin role, tenant-scoped
- Returns: JSON bundle of all rows from the tables above for the given patient within the requesting admin's tenant
- Format: structured JSON (or ZIP with per-table CSVs)

### Proposed deletion endpoint (future)

```
POST /api/admin/data-delete/patient/:patientId
```
- Auth: admin role, tenant-scoped
- Behavior: delete or anonymize all patient-linked rows; preserve audit trail summary (log that deletion occurred, not the deleted content)
- Safeguards: require confirmation token or `dryRun` mode (like existing audit purge)
- Edge cases:
  - Foreign key cascades: `DailyStats`, `Medications`, `Escalations`, `DischargeSummaries`, `Tasks`, `HandoverNotes` all reference `Patients(id)` — SQLite `PRAGMA foreign_keys = ON` with `CASCADE` or explicit multi-table delete
  - `MedicationAdministrations` references both `Medications(id)` and `Patients(id)` — must delete before medications
  - Audit integrity: insert a `ClinicalChangeLog` entry recording the deletion event before removing data

**Neither endpoint exists today.** Implementation is deferred until the product scope decision (Phase A.1) confirms GDPR applicability.

---

## What already works for compliance

These repo capabilities contribute to legal/compliance readiness:

| Capability | Implementation |
|-----------|---------------|
| Tenant data isolation | All queries scoped by `tenantId` via middleware; stress-tested |
| RBAC | `doctor`, `nurse`, `admin` roles enforced at route level |
| Audit trail | `AuditLogs` table with HTTP-level access logging; admin export/purge |
| Clinical change log | `ClinicalChangeLog` for patient profile updates |
| Password security | bcrypt hashing with salt rounds |
| Session security | HttpOnly cookie, CSRF double-submit, rate limiting, lockout |
| Data at rest | Depends on host; SQLite file not application-encrypted |
| Transport security | HTTPS at edge; `secure` cookie flag in production |

---

## Decision required

Before implementing export/delete endpoints or legal page links:

1. **Is this an EU-facing SaaS handling real patient data?** If yes, GDPR export/delete endpoints are required.
2. **Is this an internal tool within a single organization?** If yes, organizational DPA and internal policies may suffice; endpoints are optional.
3. **Will analytics or marketing cookies be added?** If yes, add a cookie consent banner before launch.

Record the decision in the Phase A.1 checkpoint and proceed accordingly.
