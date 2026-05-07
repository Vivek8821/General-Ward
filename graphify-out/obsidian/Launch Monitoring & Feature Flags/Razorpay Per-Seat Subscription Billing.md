---
id: "signup_payment_razorpay"
file_type: rationale
community: "Launch Monitoring & Feature Flags"
community_id: 3
source_file: "docs/plans/signup-payment-detailed.md"
tags:
  - "rationale"
  - community/Launch_Monitoring_&_Feature_Flags
---

# Razorpay Per-Seat Subscription Billing

**Source:** `docs/plans/signup-payment-detailed.md`

## Description

Per-seat pricing with one consolidated bill per org per billing cycle via Razorpay subscription quantity. Individual staff never see billing; only org admin is billing contact. Seat count changes at next cycle to avoid surprise mid-cycle charges. Payment features are opt-in; if Razorpay env vars absent, signup works without payment (dev-friendly).

## Relationships

- **rationale_for** → [[Launch Monitoring & Feature Flags/SubscriptionService.js|SubscriptionService.js]]

---

*Community: [[Launch Monitoring & Feature Flags/_COMMUNITY_Launch Monitoring & Feature Flags|Launch Monitoring & Feature Flags]]*