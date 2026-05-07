---
id: "security_remediation_jwt_hardening"
file_type: rationale
community: "Enterprise Hardening & DB Architecture"
community_id: 2
source_file: "docs/plans/security-remediation-PROGRESS.md"
tags:
  - "rationale"
  - community/Enterprise_Hardening_&_DB_Architecture
---

# JWT Secret Hardening (P1.1)

**Source:** `docs/plans/security-remediation-PROGRESS.md`

## Description

Prevent insecure fallback JWT secret from being used in non-dev environments by centralizing config validation. The hard-coded fallback was only usable in explicit dev mode; any non-dev mode without JWT_SECRET causes startup refusal.

## Referenced by

- [[Enterprise Hardening & DB Architecture/Security Remediation Progress|Security Remediation Progress]] → **references**

---

*Community: [[Enterprise Hardening & DB Architecture/_COMMUNITY_Enterprise Hardening & DB Architecture|Enterprise Hardening & DB Architecture]]*