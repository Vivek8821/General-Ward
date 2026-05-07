---
id: "concept_stress_test_pass_criteria"
file_type: rationale
community: "Workflow Steps"
community_id: 146
source_file: "docs/runbooks/stress-test-gate.md"
tags:
  - "rationale"
  - community/Workflow_Steps
---

# Stress Test Pass Criteria

**Source:** `docs/runbooks/stress-test-gate.md`

## Description

server5xx=0, timeouts=0, fetchErrors=0; p95 < 200ms locally / 500ms on CI. JWT (no cookie auth) used in stress to bypass CSRF by design.

---

*Community: [[Workflow Steps/_COMMUNITY_Workflow Steps|Workflow Steps]]*