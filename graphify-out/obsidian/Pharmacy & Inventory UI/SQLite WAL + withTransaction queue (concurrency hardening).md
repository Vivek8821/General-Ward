---
id: "wal_transaction_queue_principle"
file_type: rationale
community: "Pharmacy & Inventory UI"
community_id: 0
source_file: "cursorrules.md"
tags:
  - "rationale"
  - community/Pharmacy_&_Inventory_UI
---

# SQLite WAL + withTransaction queue (concurrency hardening)

**Source:** `cursorrules.md`

## Description

WAL mode with synchronous=NORMAL and a sequential transaction queue (db.js) prevents SQLite corruption under concurrent requests — critical for a clinical system that must not corrupt patient data.

## Relationships

- **semantically_similar_to** → [[Pharmacy & Inventory UI/Offline-first with pending sync queue|Offline-first with pending sync queue]] `INFERRED`

## Referenced by

- [[Pharmacy & Inventory UI/cursorrules.md (System Architect Directives)|cursorrules.md (System Architect Directives)]] → **conceptually_related_to**

---

*Community: [[Pharmacy & Inventory UI/_COMMUNITY_Pharmacy & Inventory UI|Pharmacy & Inventory UI]]*