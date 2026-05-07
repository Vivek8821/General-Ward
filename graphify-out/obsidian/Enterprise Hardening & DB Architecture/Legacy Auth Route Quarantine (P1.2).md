---
id: "security_remediation_legacy_auth_quarantine"
file_type: rationale
community: "Enterprise Hardening & DB Architecture"
community_id: 2
source_file: "docs/plans/security-remediation-PROGRESS.md"
tags:
  - "rationale"
  - community/Enterprise_Hardening_&_DB_Architecture
---

# Legacy Auth Route Quarantine (P1.2)

**Source:** `docs/plans/security-remediation-PROGRESS.md`

## Description

Moved legacy auth route to ward-backend/legacy/ with a fail-loud stub to prevent accidental mounting. The old route returned bare JSON tokens without cookie/CSRF, creating a security gap if ever mounted.

## Referenced by

- [[Enterprise Hardening & DB Architecture/Security Remediation Progress|Security Remediation Progress]] → **references**

---

*Community: [[Enterprise Hardening & DB Architecture/_COMMUNITY_Enterprise Hardening & DB Architecture|Enterprise Hardening & DB Architecture]]*