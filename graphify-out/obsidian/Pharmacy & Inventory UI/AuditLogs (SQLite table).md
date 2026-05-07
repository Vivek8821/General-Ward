---
id: "auditlogs_table"
file_type: rationale
community: "Pharmacy & Inventory UI"
community_id: 0
source_file: "docs/COMPLIANCE.md"
tags:
  - "rationale"
  - community/Pharmacy_&_Inventory_UI
---

# AuditLogs (SQLite table)

**Source:** `docs/COMPLIANCE.md`

## Description

Records authenticated HTTP API requests for compliance. Tenant-scoped and admin-only for export and purge.

## Referenced by

- [[Pharmacy & Inventory UI/ward-backend_middleware_audit.js|ward-backend/middleware/audit.js]] → **calls**
- [[Pharmacy & Inventory UI/cursorrules.md (System Architect Directives)|cursorrules.md (System Architect Directives)]] → **references**
- [[Pharmacy & Inventory UI/ward-backend_routes_adminAudit.js|ward-backend/routes/adminAudit.js]] → **references**

---

*Community: [[Pharmacy & Inventory UI/_COMMUNITY_Pharmacy & Inventory UI|Pharmacy & Inventory UI]]*