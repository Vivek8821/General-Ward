---
id: "env_database_url"
file_type: rationale
community: "DB Migration Pipeline"
community_id: 8
source_file: "ward-backend/.env.example"
source_location: "line 13"
tags:
  - "rationale"
  - community/DB_Migration_Pipeline
---

# Config Key: DATABASE_URL

**Source:** `ward-backend/.env.example` · `line 13`

## Relationships

- **semantically_similar_to** → [[Dashboard & Patient UI Components/Config Key_ PG_HOST|Config Key: PG_HOST]] `INFERRED`

## Referenced by

- [[DB Migration Pipeline/Postgres Service (postgres_16)|Postgres Service (postgres:16)]] → **conceptually_related_to** `INFERRED`
- [[Dashboard & Patient UI Components/Database Adapter|Database Adapter]] → **rationale_for**
- [[DB Migration Pipeline/Step_ Apply Postgres Migrations (node ._migratePostgres.js)|Step: Apply Postgres Migrations (node ./migratePostgres.js)]] → **references**
- [[DB Migration Pipeline/Step_ npx jest postgresSmoke.test.js|Step: npx jest postgresSmoke.test.js]] → **references**

---

*Community: [[DB Migration Pipeline/_COMMUNITY_DB Migration Pipeline|DB Migration Pipeline]]*