---
id: "service_postgres"
file_type: document
community: "DB Migration Pipeline"
community_id: 8
source_file: ".github/workflows/postgres-ci.yml"
source_location: "line 13"
tags:
  - "document"
  - community/DB_Migration_Pipeline
---

# Postgres Service (postgres:16)

**Source:** `.github/workflows/postgres-ci.yml` · `line 13`

## Relationships

- **conceptually_related_to** → [[DB Migration Pipeline/Config Key_ DATABASE_URL|Config Key: DATABASE_URL]] `INFERRED`
- **references** → [[DB Migration Pipeline/migratePostgres.js|migratePostgres.js]] `INFERRED`
- **references** → [[DB Migration Pipeline/tests_services_postgresSmoke.test.js|tests/services/postgresSmoke.test.js]] `INFERRED`

## Referenced by

- [[DB Migration Pipeline/Job_ Postgres Smoke Test|Job: Postgres Smoke Test]] → **references**

## Hyperedges

- [[_hyperedges/Postgres CI Smoke Pipeline_ Service → Migration → Smoke Test|Postgres CI Smoke Pipeline: Service → Migration → Smoke Test]]

---

*Community: [[DB Migration Pipeline/_COMMUNITY_DB Migration Pipeline|DB Migration Pipeline]]*