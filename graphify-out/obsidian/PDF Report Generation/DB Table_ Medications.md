---
id: "table_medications"
file_type: document
community: "PDF Report Generation"
community_id: 5
source_file: "ward-backend/postgres-migrations/migrations/002_create_application_schema.sql"
tags:
  - "document"
  - community/PDF_Report_Generation
---

# DB Table: Medications

**Source:** `ward-backend/postgres-migrations/migrations/002_create_application_schema.sql`

## Relationships

- **references** → [[PDF Report Generation/DB Table_ MedicationAdministrations|DB Table: MedicationAdministrations]]
- **semantically_similar_to** → [[DB Adapter (SQLite & Postgres)/DB Table_ PharmacyStock|DB Table: PharmacyStock]] `INFERRED`

## Referenced by

- [[PDF Report Generation/Migration 002_ Application Schema|Migration 002: Application Schema]] → **implements**
- [[PDF Report Generation/DB Table_ Patients|DB Table: Patients]] → **references**

---

*Community: [[PDF Report Generation/_COMMUNITY_PDF Report Generation|PDF Report Generation]]*