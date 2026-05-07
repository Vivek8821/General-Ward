---
id: "job_postgres_smoke"
file_type: document
community: "DB Migration Pipeline"
community_id: 8
source_file: ".github/workflows/postgres-ci.yml"
source_location: "line 9"
tags:
  - "document"
  - community/DB_Migration_Pipeline
---

# Job: Postgres Smoke Test

**Source:** `.github/workflows/postgres-ci.yml` · `line 9`

## Relationships

- **references** → [[DB Migration Pipeline/Postgres Service (postgres_16)|Postgres Service (postgres:16)]]
- **references** → [[DB Migration Pipeline/Step_ Apply Postgres Migrations (node ._migratePostgres.js)|Step: Apply Postgres Migrations (node ./migratePostgres.js)]]
- **references** → [[DB Migration Pipeline/Step_ npx jest postgresSmoke.test.js|Step: npx jest postgresSmoke.test.js]]

## Referenced by

- [[DB Migration Pipeline/Postgres CI Workflow (postgres-ci.yml)|Postgres CI Workflow (postgres-ci.yml)]] → **references**
- [[DB Migration Pipeline/Job_ Backend Tests (SQLite)|Job: Backend Tests (SQLite)]] → **semantically_similar_to** `INFERRED`

---

*Community: [[DB Migration Pipeline/_COMMUNITY_DB Migration Pipeline|DB Migration Pipeline]]*