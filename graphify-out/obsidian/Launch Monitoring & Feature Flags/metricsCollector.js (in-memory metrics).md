---
id: "launch_monitoring_metrics_collector"
file_type: rationale
community: "Launch Monitoring & Feature Flags"
community_id: 3
source_file: "docs/plans/launch-monitoring-contingency-detailed.md"
tags:
  - "rationale"
  - community/Launch_Monitoring_&_Feature_Flags
---

# metricsCollector.js (in-memory metrics)

**Source:** `docs/plans/launch-monitoring-contingency-detailed.md`

## Description

In-memory only metrics collector chosen to avoid external dependencies (no Redis needed). Metrics reset on restart; rolling window capped at 60 entries (1 hour) to avoid memory growth. Node.js single-threaded model makes mutex unnecessary.

## Referenced by

- [[Launch Monitoring & Feature Flags/Launch Monitoring & Contingency Detailed Plan|Launch Monitoring & Contingency Detailed Plan]] → **references**

---

*Community: [[Launch Monitoring & Feature Flags/_COMMUNITY_Launch Monitoring & Feature Flags|Launch Monitoring & Feature Flags]]*