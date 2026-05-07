---
id: "pin_lockout_mechanism"
file_type: rationale
community: "Pharmacy & Inventory UI"
community_id: 0
source_file: "ward-management.html"
tags:
  - "rationale"
  - community/Pharmacy_&_Inventory_UI
---

# PIN lockout mechanism (5 attempts, 30s lockout)

**Source:** `ward-management.html`

## Description

Prevents brute-force attacks on the PIN-based login. After 5 failed attempts the user is locked out for 30 seconds.

## Referenced by

- [[Pharmacy & Inventory UI/ward-management.html (Legacy SPA prototype)|ward-management.html (Legacy SPA prototype)]] → **implements**

---

*Community: [[Pharmacy & Inventory UI/_COMMUNITY_Pharmacy & Inventory UI|Pharmacy & Inventory UI]]*