---
id: "launch_monitoring_feature_flags"
file_type: rationale
community: "Launch Monitoring & Feature Flags"
community_id: 3
source_file: "docs/plans/launch-monitoring-contingency-detailed.md"
tags:
  - "rationale"
  - community/Launch_Monitoring_&_Feature_Flags
---

# Feature Flags / Kill Switches (Phase C1)

**Source:** `docs/plans/launch-monitoring-contingency-detailed.md`

## Description

Feature flags stored in DB (persists across restarts, unlike env vars). Default values hardcoded in middleware as fallback when DB read fails (fail-open: features stay enabled if DB is down, better than disabling clinical features). Admin can toggle via API with immediate effect without restart.

## Relationships

- **semantically_similar_to** → [[Launch Monitoring & Feature Flags/subscriptionGuard.js (middleware)|subscriptionGuard.js (middleware)]] `INFERRED`

## Referenced by

- [[Launch Monitoring & Feature Flags/Launch Monitoring & Contingency Detailed Plan|Launch Monitoring & Contingency Detailed Plan]] → **references**

---

*Community: [[Launch Monitoring & Feature Flags/_COMMUNITY_Launch Monitoring & Feature Flags|Launch Monitoring & Feature Flags]]*