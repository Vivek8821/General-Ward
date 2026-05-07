---
id: "concept_jwt_secret_hardening"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/security-remediation-PROGRESS.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# JWT Secret Hardening

**Source:** `docs/plans/security-remediation-PROGRESS.md`

## Description

Centralized env/config validation module (ward-backend/config.js) added so JWT secret is never read directly and weak fallback cannot occur outside explicit dev mode.

## Referenced by

- [[Auth, Audit & Admin Security/Security Remediation Progress|Security Remediation Progress]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*