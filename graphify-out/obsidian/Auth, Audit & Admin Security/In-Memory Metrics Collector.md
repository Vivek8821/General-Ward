---
id: "concept_metrics_collector"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/launch-monitoring-contingency-detailed.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# In-Memory Metrics Collector

**Source:** `docs/plans/launch-monitoring-contingency-detailed.md`

## Description

In-memory only (no Redis/external store), metrics reset on restart. Rolling window capped at 60 entries. Acceptable for first launch; persistent metrics require Prometheus/TimescaleDB.

## Relationships

- **shares_data_with** → [[Auth, Audit & Admin Security/Alert Engine|Alert Engine]]
- **shares_data_with** → [[Auth, Audit & Admin Security/Admin Monitoring Dashboard|Admin Monitoring Dashboard]]

## Referenced by

- [[Auth, Audit & Admin Security/Launch Monitoring & Contingency Detailed Plan|Launch Monitoring & Contingency Detailed Plan]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*