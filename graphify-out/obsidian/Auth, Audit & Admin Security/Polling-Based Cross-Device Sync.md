---
id: "concept_polling_sync"
file_type: rationale
community: "Auth, Audit & Admin Security"
community_id: 1
source_file: "docs/runbooks/multi-device-sync-validation.md"
tags:
  - "rationale"
  - community/Auth,_Audit_&_Admin_Security
---

# Polling-Based Cross-Device Sync

**Source:** `docs/runbooks/multi-device-sync-validation.md`

## Description

15-second polling interval chosen as the synchronization window; no websockets, relies on periodic refetch via TanStack Query.

## Referenced by

- [[Auth, Audit & Admin Security/Enterprise Hardening Progress|Enterprise Hardening Progress]] → **implements**
- [[Auth, Audit & Admin Security/Multi-Device Sync Validation Runbook|Multi-Device Sync Validation Runbook]] → **references**

---

*Community: [[Auth, Audit & Admin Security/_COMMUNITY_Auth, Audit & Admin Security|Auth, Audit & Admin Security]]*