---
id: "concept_org_signup_flow"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/signup-payment-detailed.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# Organization Signup Flow

**Source:** `docs/plans/signup-payment-detailed.md`

## Description

Two flows: org admin creates tenant+user then Razorpay subscription; staff self-registers via cryptographically random 128-bit invite code. Transaction rollback if any step fails.

## Referenced by

- [[Auth, Audit & Admin Security/Signup & Payment Integration Detailed Plan|Signup & Payment Integration Detailed Plan]] → **implements**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*