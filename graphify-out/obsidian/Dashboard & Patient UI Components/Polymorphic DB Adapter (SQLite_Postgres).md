---
id: "polymorphic_db_adapter"
file_type: rationale
community: "Dashboard & Patient UI Components"
community_id: 4
source_file: "cursorrules.md"
tags:
  - "rationale"
  - community/Dashboard_&_Patient_UI_Components
---

# Polymorphic DB Adapter (SQLite/Postgres)

**Source:** `cursorrules.md`

## Description

db-adapter.js abstracts over SQLite and PostgreSQL so the application can run locally on SQLite and scale to Postgres in production without changing service/repository code.

## Relationships

- **conceptually_related_to** → [[Dashboard & Patient UI Components/SQLite to PostgreSQL Migration Strategy|SQLite to PostgreSQL Migration Strategy]] `INFERRED`
- **rationale_for** → [[Clinical Audit Service/System Architect Directives (cursorrules)|System Architect Directives (cursorrules)]]
- **rationale_for** → [[Dashboard & Patient UI Components/Database Adapter|Database Adapter]] `INFERRED`

## Referenced by

- [[Pharmacy & Inventory UI/ward-backend_db-adapter.js (Polymorphic DB adapter)|ward-backend/db-adapter.js (Polymorphic DB adapter)]] → **rationale_for**

---

*Community: [[Dashboard & Patient UI Components/_COMMUNITY_Dashboard & Patient UI Components|Dashboard & Patient UI Components]]*