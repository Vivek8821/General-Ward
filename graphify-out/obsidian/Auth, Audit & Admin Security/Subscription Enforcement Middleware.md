---
id: "concept_subscription_enforcement"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/signup-payment-detailed.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# Subscription Enforcement Middleware

**Source:** `docs/plans/signup-payment-detailed.md`

## Description

Allows read-only access for past_due tenants; blocks writes with 402. Uses 503 for feature flags (temporary disable) vs 402 for payment issues. Skipped when RAZORPAY_KEY_ID not set (payment opt-in).

## Referenced by

- [[Auth, Audit & Admin Security/Signup & Payment Integration Detailed Plan|Signup & Payment Integration Detailed Plan]] → **implements**
- [[Auth, Audit & Admin Security/Feature Flags _ Kill Switches|Feature Flags / Kill Switches]] → **semantically_similar_to** `INFERRED`

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*