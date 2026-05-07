---
id: "clinicalchangelog_table"
file_type: rationale
community: "Pharmacy & Inventory UI"
community_id: 0
source_file: "docs/COMPLIANCE.md"
tags:
  - "rationale"
  - community/Pharmacy_&_Inventory_UI
---

# ClinicalChangeLog (SQLite table)

**Source:** `docs/COMPLIANCE.md`

## Description

Records which fields were touched on patient profile updates. Intentionally stores field names only, not values, to avoid inadvertent PHI exposure in the audit trail.

## Referenced by

- [[Pharmacy & Inventory UI/ward-backend_services_ClinicalAuditService.js|ward-backend/services/ClinicalAuditService.js]] → **calls** `INFERRED`
- [[Pharmacy & Inventory UI/cursorrules.md (System Architect Directives)|cursorrules.md (System Architect Directives)]] → **references**

---

*Community: [[Pharmacy & Inventory UI/_COMMUNITY_Pharmacy & Inventory UI|Pharmacy & Inventory UI]]*