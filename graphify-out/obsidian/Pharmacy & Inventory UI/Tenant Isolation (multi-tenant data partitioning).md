---
id: "tenant_isolation_principle"
file_type: rationale
community: "Pharmacy & Inventory UI"
community_id: 0
source_file: "cursorrules.md"
tags:
  - "rationale"
  - community/Pharmacy_&_Inventory_UI
---

# Tenant Isolation (multi-tenant data partitioning)

**Source:** `cursorrules.md`

## Description

All database queries and service calls must enforce tenantId to prevent data leakage across tenants. This is a hard architectural constraint driven by multi-tenant hospital deployment requirements.

## Referenced by

- [[Pharmacy & Inventory UI/cursorrules.md (System Architect Directives)|cursorrules.md (System Architect Directives)]] → **conceptually_related_to**
- [[Pharmacy & Inventory UI/ward-backend CODENAV.md|ward-backend CODENAV.md]] → **conceptually_related_to**
- [[Pharmacy & Inventory UI/ward-management.html (Legacy SPA prototype)|ward-management.html (Legacy SPA prototype)]] → **semantically_similar_to** `AMBIGUOUS`

---

*Community: [[Pharmacy & Inventory UI/_COMMUNITY_Pharmacy & Inventory UI|Pharmacy & Inventory UI]]*