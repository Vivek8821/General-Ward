---
id: "table_pharmacystock"
file_type: document
community: "DB Adapter (SQLite & Postgres)"
community_id: 26
source_file: "ward-backend/postgres-migrations/migrations/004_pharmacy_v2.sql"
tags:
  - "document"
  - community/DB_Adapter_(SQLite_&_Postgres)
---

# DB Table: PharmacyStock

**Source:** `ward-backend/postgres-migrations/migrations/004_pharmacy_v2.sql`

## Relationships

- **references** → [[DB Adapter (SQLite & Postgres)/DB Table_ PharmacyTransactions|DB Table: PharmacyTransactions]]
- **references** → [[DB Adapter (SQLite & Postgres)/DB Table_ PharmacyBatches|DB Table: PharmacyBatches]]
- **references** → [[DB Adapter (SQLite & Postgres)/DB Table_ PurchaseOrders|DB Table: PurchaseOrders]]
- **references** → [[DB Adapter (SQLite & Postgres)/DB Table_ WasteRecords|DB Table: WasteRecords]]

## Referenced by

- [[DB Adapter (SQLite & Postgres)/Migration 004_ Pharmacy V2 Schema|Migration 004: Pharmacy V2 Schema]] → **implements**
- [[PDF Report Generation/DB Table_ Medications|DB Table: Medications]] → **semantically_similar_to** `INFERRED`

---

*Community: [[DB Adapter (SQLite & Postgres)/_COMMUNITY_DB Adapter (SQLite & Postgres)|DB Adapter (SQLite & Postgres)]]*