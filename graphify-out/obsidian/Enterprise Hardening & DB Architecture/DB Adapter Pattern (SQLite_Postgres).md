---
id: "enterprise_hardening_db_adapter"
file_type: rationale
community: "Enterprise Hardening & DB Architecture"
community_id: 2
source_file: "docs/plans/enterprise-hardening-detailed.md"
tags:
  - "rationale"
  - community/Enterprise_Hardening_&_DB_Architecture
---

# DB Adapter Pattern (SQLite/Postgres)

**Source:** `docs/plans/enterprise-hardening-detailed.md`

## Description

Adapter interface with SQLite for tests and Postgres for prod chosen over full rewrite. DATABASE_URL presence selects adapter at runtime. SQLite kept as default for existing tests to avoid cross-cutting port risk.

## Referenced by

- [[Enterprise Hardening & DB Architecture/Enterprise Hardening Detailed Plan|Enterprise Hardening Detailed Plan]] → **references**

---

*Community: [[Enterprise Hardening & DB Architecture/_COMMUNITY_Enterprise Hardening & DB Architecture|Enterprise Hardening & DB Architecture]]*