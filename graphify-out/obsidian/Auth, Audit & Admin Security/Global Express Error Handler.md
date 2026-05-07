---
id: "concept_global_error_handler"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/launch-monitoring-contingency-detailed.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# Global Express Error Handler

**Source:** `docs/plans/launch-monitoring-contingency-detailed.md`

## Description

Needed because server.js currently has no (err,req,res,next) handler. Express 5 natively handles async route errors. Never leak stack to client; respond with requestId only.

## Referenced by

- [[Auth, Audit & Admin Security/Launch Monitoring & Contingency Detailed Plan|Launch Monitoring & Contingency Detailed Plan]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*