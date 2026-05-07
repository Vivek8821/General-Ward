---
id: "cursorrules_directives"
file_type: document
community: "Clinical Audit Service"
community_id: 18
source_file: "cursorrules.md"
tags:
  - "document"
  - community/Clinical_Audit_Service
---

# System Architect Directives (cursorrules)

**Source:** `cursorrules.md`

## Relationships

- **rationale_for** → [[Clinical Audit Service/Tenant Isolation Pattern|Tenant Isolation Pattern]]
- **rationale_for** → [[Clinical Audit Service/Clinical Grade Stability Principle|Clinical Grade Stability Principle]]
- **rationale_for** → [[Clinical Audit Service/Concurrency Hardening via SQLite WAL|Concurrency Hardening via SQLite WAL]]
- **rationale_for** → [[Clinical Audit Service/Layered Architecture Pattern (Controllers-_Services-_Repositories)|Layered Architecture Pattern (Controllers->Services->Repositories)]]
- **rationale_for** → [[Config & Environment/Audit Logging Pattern (AuditLogs + ClinicalChangeLog)|Audit Logging Pattern (AuditLogs + ClinicalChangeLog)]]
- **rationale_for** → [[Clinical Audit Service/HospitalArchives Immutable Discharge Snapshots|HospitalArchives Immutable Discharge Snapshots]]
- **references** → [[Admin Audit Tests/Session Initiation Sequence|Session Initiation Sequence]]
- **references** → [[Clinical Audit Service/IMPLEMENTATION_STATE.json (Crash Recovery State)|IMPLEMENTATION_STATE.json (Crash Recovery State)]]
- **references** → [[Waste Service/Repository Codemap|Repository Codemap]]

## Referenced by

- [[Dashboard & Patient UI Components/Polymorphic DB Adapter (SQLite_Postgres)|Polymorphic DB Adapter (SQLite/Postgres)]] → **rationale_for**

---

*Community: [[Clinical Audit Service/_COMMUNITY_Clinical Audit Service|Clinical Audit Service]]*