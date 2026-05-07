---
id: "concept_razorpay_per_seat_billing"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/plans/signup-payment-detailed.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# Razorpay Per-Seat Subscription Billing

**Source:** `docs/plans/signup-payment-detailed.md`

## Description

One Razorpay Subscription per tenant with quantity = seat count; Razorpay bills plan_amount x quantity as single consolidated org invoice. Quantity updates take effect at next billing cycle (no mid-cycle surprise charges). pricePerSeat cached in Tenants table.

## Referenced by

- [[Auth, Audit & Admin Security/Signup & Payment Integration Detailed Plan|Signup & Payment Integration Detailed Plan]] → **implements**
- [[Auth, Audit & Admin Security/Clinical Workflow Milestone Tracking|Clinical Workflow Milestone Tracking]] → **semantically_similar_to** `INFERRED`

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*