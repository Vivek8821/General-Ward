---
id: "concept_feature_flags"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/launch-monitoring-contingency-detailed.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# Feature Flags / Kill Switches

**Source:** `docs/plans/launch-monitoring-contingency-detailed.md`

## Description

Flags stored in FeatureFlags DB table (persists across restarts); in-memory cache with 10s TTL; fail-open on DB read failure to prevent disabling clinical features when DB has issues.

## Relationships

- **conceptually_related_to** → [[Auth, Audit & Admin Security/Rollback Plan (Git + Feature Flag + DB)|Rollback Plan (Git + Feature Flag + DB)]] `INFERRED`
- **semantically_similar_to** → [[Auth, Audit & Admin Security/Subscription Enforcement Middleware|Subscription Enforcement Middleware]] `INFERRED`

## Referenced by

- [[Auth, Audit & Admin Security/Launch Monitoring & Contingency Detailed Plan|Launch Monitoring & Contingency Detailed Plan]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*