---
id: "postgres_smoke_pipeline"
relation: participate_in
confidence: EXTRACTED
source_file: ".github/workflows/postgres-ci.yml"
tags:
  - hyperedge
---

# Postgres CI Smoke Pipeline: Service → Migration → Smoke Test

**Relation:** `participate_in`  |  **Confidence:** `EXTRACTED`

**Source:** `.github/workflows/postgres-ci.yml`

## Participants

- [[DB Migration Pipeline/Postgres Service (postgres_16)|Postgres Service (postgres:16)]]
- [[DB Migration Pipeline/Step_ Apply Postgres Migrations (node ._migratePostgres.js)|Step: Apply Postgres Migrations (node ./migratePostgres.js)]]
- [[DB Migration Pipeline/Step_ npx jest postgresSmoke.test.js|Step: npx jest postgresSmoke.test.js]]
