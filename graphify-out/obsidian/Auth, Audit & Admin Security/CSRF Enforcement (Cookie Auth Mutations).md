---
id: "concept_csrf_enforcement"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/security-remediation-PROGRESS.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# CSRF Enforcement (Cookie Auth Mutations)

**Source:** `docs/plans/security-remediation-PROGRESS.md`

## Description

CSRF now enforced only for cookie-authenticated mutation requests; header-auth clients (stress harness) bypass CSRF. authSource tagged in auth middleware.

## Relationships

- **conceptually_related_to** → [[Auth, Audit & Admin Security/HttpOnly Cookie + CSRF Double-Submit Auth|HttpOnly Cookie + CSRF Double-Submit Auth]] `INFERRED`
- **conceptually_related_to** → [[Auth, Audit & Admin Security/Existing Compliance Capabilities|Existing Compliance Capabilities]]

## Referenced by

- [[Auth, Audit & Admin Security/Security Remediation Progress|Security Remediation Progress]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*