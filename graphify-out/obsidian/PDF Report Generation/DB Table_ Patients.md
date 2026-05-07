---
id: "table_patients"
file_type: document
community: "PDF Report Generation"
community_id: 5
source_file: "ward-backend/postgres-migrations/migrations/002_create_application_schema.sql"
tags:
  - "document"
  - community/PDF_Report_Generation
---

# DB Table: Patients

**Source:** `ward-backend/postgres-migrations/migrations/002_create_application_schema.sql`

## Relationships

- **references** → [[PDF Report Generation/DB Table_ DailyStats|DB Table: DailyStats]]
- **references** → [[PDF Report Generation/DB Table_ Medications|DB Table: Medications]]
- **references** → [[PDF Report Generation/DB Table_ MedicationAdministrations|DB Table: MedicationAdministrations]]
- **references** → [[PDF Report Generation/DB Table_ Escalations|DB Table: Escalations]]
- **references** → [[PDF Report Generation/DB Table_ DischargeSummaries|DB Table: DischargeSummaries]]
- **references** → [[PDF Report Generation/DB Table_ Tasks|DB Table: Tasks]]
- **references** → [[PDF Report Generation/DB Table_ HandoverNotes|DB Table: HandoverNotes]]
- **references** → [[PDF Report Generation/DB Table_ HospitalArchives|DB Table: HospitalArchives]]

## Referenced by

- [[PDF Report Generation/Migration 002_ Application Schema|Migration 002: Application Schema]] → **implements**
- [[PDF Report Generation/DB Table_ Tenants|DB Table: Tenants]] → **references** `INFERRED`

---

*Community: [[PDF Report Generation/_COMMUNITY_PDF Report Generation|PDF Report Generation]]*