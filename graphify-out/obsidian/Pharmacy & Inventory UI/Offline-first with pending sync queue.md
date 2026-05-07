---
id: "offline_first_sync"
file_type: rationale
community: "Pharmacy & Inventory UI"
community_id: 0
source_file: "ward-management.html"
tags:
  - "rationale"
  - community/Pharmacy_&_Inventory_UI
---

# Offline-first with pending sync queue

**Source:** `ward-management.html`

## Description

The standalone ward-management.html stores data in localStorage and queues unsynced records to push to the API when connectivity is restored, enabling use in environments with unreliable internet.

## Referenced by

- [[Pharmacy & Inventory UI/ward-management.html (Legacy SPA prototype)|ward-management.html (Legacy SPA prototype)]] → **implements**
- [[Pharmacy & Inventory UI/SQLite WAL + withTransaction queue (concurrency hardening)|SQLite WAL + withTransaction queue (concurrency hardening)]] → **semantically_similar_to** `INFERRED`

---

*Community: [[Pharmacy & Inventory UI/_COMMUNITY_Pharmacy & Inventory UI|Pharmacy & Inventory UI]]*