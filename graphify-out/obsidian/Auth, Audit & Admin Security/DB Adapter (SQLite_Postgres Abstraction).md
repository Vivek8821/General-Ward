---
id: "concept_db_adapter"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/enterprise-hardening-PROGRESS.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# DB Adapter (SQLite/Postgres Abstraction)

**Source:** `docs/plans/enterprise-hardening-PROGRESS.md`

## Description

dbAdapter switches between SQLite (default for tests) and Postgres (when DATABASE_URL set). Repositories ported one by one to use adapter methods.

## Referenced by

- [[Auth, Audit & Admin Security/Enterprise Hardening Progress|Enterprise Hardening Progress]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*