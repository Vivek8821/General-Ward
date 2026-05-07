---
id: "concept_phi_safe_logging"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/security-remediation-PROGRESS.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# PHI-Safe Logging Guardrails

**Source:** `docs/plans/security-remediation-PROGRESS.md`

## Description

Logs store path without query string to reduce PHI/secret leakage via query params; req.body logging banned by guidance doc.

## Relationships

- **semantically_similar_to** → [[Auth, Audit & Admin Security/GDPR Data Subject Export & Deletion|GDPR Data Subject Export & Deletion]] `INFERRED`

## Referenced by

- [[Auth, Audit & Admin Security/Security Remediation Progress|Security Remediation Progress]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*