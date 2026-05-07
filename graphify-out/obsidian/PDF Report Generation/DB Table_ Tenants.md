---
id: "table_tenants"
file_type: document
community: "PDF Report Generation"
community_id: 5
source_file: "ward-backend/postgres-migrations/migrations/002_create_application_schema.sql"
tags:
  - "document"
  - community/PDF_Report_Generation
---

# DB Table: Tenants

**Source:** `ward-backend/postgres-migrations/migrations/002_create_application_schema.sql`

## Relationships

- **references** → [[PDF Report Generation/PG Function_ set_default_tenant()|PG Function: set_default_tenant()]]
- **references** → [[PDF Report Generation/DB Table_ Users|DB Table: Users]] `INFERRED`
- **references** → [[PDF Report Generation/DB Table_ Patients|DB Table: Patients]] `INFERRED`

## Referenced by

- [[PDF Report Generation/Migration 002_ Application Schema|Migration 002: Application Schema]] → **implements**

---

*Community: [[PDF Report Generation/_COMMUNITY_PDF Report Generation|PDF Report Generation]]*