---
id: "security_remediation_phi_safe_logging"
file_type: rationale
community: "Enterprise Hardening & DB Architecture"
community_id: 2
source_file: "docs/plans/security-remediation-PROGRESS.md"
tags:
  - "rationale"
  - community/Enterprise_Hardening_&_DB_Architecture
---

# PHI-Safe Logging Guardrails (Step 4.3)

**Source:** `docs/plans/security-remediation-PROGRESS.md`

## Description

Request and audit logs now store path without query string to prevent leaking sensitive query params. SECURITY_LOGGING.md added to enforce the no-req.body/secrets policy.

## Relationships

- **semantically_similar_to** → [[Enterprise Hardening & DB Architecture/Legal _ GDPR Responsibility Mapping|Legal / GDPR Responsibility Mapping]] `INFERRED`

## Referenced by

- [[Enterprise Hardening & DB Architecture/PHI_PII Safe Logging Guidance|PHI/PII Safe Logging Guidance]] → **rationale_for**
- [[Enterprise Hardening & DB Architecture/Security Remediation Progress|Security Remediation Progress]] → **references**

---

*Community: [[Enterprise Hardening & DB Architecture/_COMMUNITY_Enterprise Hardening & DB Architecture|Enterprise Hardening & DB Architecture]]*