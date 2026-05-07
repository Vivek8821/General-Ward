---
id: "concept_cookie_csrf_auth"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/enterprise-hardening-PROGRESS.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# HttpOnly Cookie + CSRF Double-Submit Auth

**Source:** `docs/plans/enterprise-hardening-PROGRESS.md`

## Description

ward_token HttpOnly cookie replaces localStorage JWT. JWT csrf claim + X-CSRF-Token header for mutations. Login omits token from JSON body.

## Referenced by

- [[Auth, Audit & Admin Security/CSRF Enforcement (Cookie Auth Mutations)|CSRF Enforcement (Cookie Auth Mutations)]] → **conceptually_related_to** `INFERRED`
- [[Auth, Audit & Admin Security/Enterprise Hardening Progress|Enterprise Hardening Progress]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*