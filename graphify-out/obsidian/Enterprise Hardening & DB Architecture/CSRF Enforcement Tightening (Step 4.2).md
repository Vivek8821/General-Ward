---
id: "security_remediation_csrf_tightening"
file_type: rationale
community: "Enterprise Hardening & DB Architecture"
community_id: 2
source_file: "docs/plans/security-remediation-PROGRESS.md"
tags:
  - "rationale"
  - community/Enterprise_Hardening_&_DB_Architecture
---

# CSRF Enforcement Tightening (Step 4.2)

**Source:** `docs/plans/security-remediation-PROGRESS.md`

## Description

Tagged auth source (cookie vs header) to enforce CSRF only for cookie-auth mutations. Header-auth clients (stress harness) skip CSRF. Cookie-auth mutations missing csrf claim now fail 403.

## Relationships

- **semantically_similar_to** → [[Enterprise Hardening & DB Architecture/Cookie Sessions & CSRF (Phase C)|Cookie Sessions & CSRF (Phase C)]] `INFERRED`

## Referenced by

- [[Enterprise Hardening & DB Architecture/Security Remediation Progress|Security Remediation Progress]] → **references**

---

*Community: [[Enterprise Hardening & DB Architecture/_COMMUNITY_Enterprise Hardening & DB Architecture|Enterprise Hardening & DB Architecture]]*