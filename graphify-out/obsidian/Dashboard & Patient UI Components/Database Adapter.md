---
id: "db_adapter"
file_type: code
community: "Dashboard & Patient UI Components"
community_id: 4
source_file: "ward-backend/.env.example"
source_location: "line 9"
tags:
  - "code"
  - community/Dashboard_&_Patient_UI_Components
---

# Database Adapter

**Source:** `ward-backend/.env.example` · `line 9`

## Relationships

- **implements** → [[Clinical Audit Service/SQLite Database (ward.db)|SQLite Database (ward.db)]]
- **implements** → [[Dashboard & Patient UI Components/PostgreSQL Database|PostgreSQL Database]]
- **rationale_for** → [[DB Migration Pipeline/Config Key_ DATABASE_URL|Config Key: DATABASE_URL]]
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ DB_DIALECT|Config Key: DB_DIALECT]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_HOST|Config Key: PG_HOST]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_PORT|Config Key: PG_PORT]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_DATABASE|Config Key: PG_DATABASE]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_USER|Config Key: PG_USER]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_PASSWORD|Config Key: PG_PASSWORD]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_POOL_MAX|Config Key: PG_POOL_MAX]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_POOL_IDLE_TIMEOUT|Config Key: PG_POOL_IDLE_TIMEOUT]] `INFERRED`
- **rationale_for** → [[Dashboard & Patient UI Components/Config Key_ PG_POOL_CONNECTION_TIMEOUT|Config Key: PG_POOL_CONNECTION_TIMEOUT]] `INFERRED`

## Referenced by

- [[Dashboard & Patient UI Components/Polymorphic DB Adapter (SQLite_Postgres)|Polymorphic DB Adapter (SQLite/Postgres)]] → **rationale_for** `INFERRED`
- [[Test Helpers & Fixtures/Ward Backend Architectural Navigation|Ward Backend Architectural Navigation]] → **references**
- [[Dashboard & Patient UI Components/Postgres Cutover Runbook (Phase D.4)|Postgres Cutover Runbook (Phase D.4)]] → **references**

---

*Community: [[Dashboard & Patient UI Components/_COMMUNITY_Dashboard & Patient UI Components|Dashboard & Patient UI Components]]*