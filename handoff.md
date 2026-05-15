# General Ward — Handoff Document

## Project

Patient management software for hospitals, deployed on-premise.
- **Backend**: Node.js + Express 5, SQLite (dev) / PostgreSQL (prod), `ward-backend/`
- **Frontend**: React 18 + Vite + TanStack Query v5, `ward-frontend/`
- **Auth**: JWT in httpOnly cookie, CSRF double-submit, bcrypt
- **Multi-tenant**: every DB query scoped by `tenantId` from JWT

Start servers: `bash /home/vn/Documents/General-Ward/start-test-server.sh`

---

## Current State

All edits are complete and saved. The server loads cleanly. No partial implementations.

---

## Feature Inventory

### Phase 1 — Security & Quality Audit (complete)

| ID | What |
|----|------|
| protect() | Middleware factory at `middleware/protect.js` — auth + authz + tokenVersion revocation |
| H1 | Rate limiters in `middleware/rateLimiters.js`; applied to all write routes |
| H2 | All unexpected errors go through `next(err)` — PharmacyController, EscalationController, PatientController |
| H3 | List endpoints return `{ data: [] }` envelope |
| H5 | StockRepository atomic UPDATE — no read-then-write race |
| H6 | 8 new indexes in schema + migration 019 |
| H8 | AbortController in VitalsTab, DietTab, SleepTab, HistoryTab, HandoverNotesPanel, DischargeSummaryTab |
| M1 | `resolveTenant` global in server.js — eliminates 90 inline `req.user.tenantId` copies |
| M4 | ObservationController: `authenticateToken` moved before rate limiter |
| M6 | EscalationRepository pre-fetches before UPDATE inside transaction |
| M9 | DashboardView escalation polling via `useQuery` (was `setInterval`) |
| M10 | DischargeSummaryTab PDF generation via `useMutation` |
| C1 | DischargeSummaryTab: removed `localStorage.getItem('token')` — uses cookie auth |
| C3 | `DEFAULT CURRENT_TIMESTAMP` in schema; JS-computed cutoffs in TransactionRepository |
| H4/L5 | Soft deletes on 6 clinical tables; migration 018 |
| L1 | Deleted `legacy/routes/auth.js` and `legacy/routes/patients.js` |
| error.js | Stack traces stripped from production log payloads |

---

### Phase 2 — Billing / RCM Module (complete)

**Migrations**
- `023_billing.sql` — ServiceCatalog, Invoices, InvoiceLines, Payments
- `024_ward_rates.sql` — WardRates (per careIntensity), ConsultationRate
- `025_service_subtypes.sql` — ServiceLab, ServiceImaging, ServiceProcedure, ServiceConsumable (1:1 with ServiceCatalog)

**Backend**
- `repositories/billing/ServiceCatalogRepository.js` — CRUD + `search(query, tenantId)` ranked typeahead (code prefix → name prefix → contains)
- `repositories/billing/InvoiceRepository.js` — create, listByPatient, findWithDetails, setDiscount, finalize, cancel
- `repositories/billing/InvoiceLineRepository.js` — create (idempotency via partial unique index on `sourceRef`), delete
- `repositories/billing/PaymentRepository.js` — record, refund
- `services/billing/AccrualService.js` — auto-charges: ward day fees (WardRates), consultation fees, pharmacy dispenses, lab/imaging
- `controllers/BillingController.js` — all billing HTTP routes under `/api/billing`

**Frontend**
- `components/billing/BillingTab.jsx` — invoice view, line items, payments, discount, finalize/cancel; AddLineForm with debounced catalog typeahead (280ms, 30s cache, `onMouseDown` to avoid blur race)

**Money invariants**
- `subtotal = SUM(lineTotal)`
- `grandTotal = subtotal − discountTotal + taxTotal`
- `balanceDue = grandTotal − paidTotal`
- Idempotency: `UNIQUE(tenantId, source, sourceRef) WHERE sourceRef IS NOT NULL` on InvoiceLines

---

### Phase 3 — HL7 v2.x MLLP Integration (complete)

Connects lab analyzers (LIMS) and imaging machines (PACS) directly to the database over TCP using HL7 v2.x + MLLP transport. No manual data entry required for machine-generated results.

**Activation** (disabled by default):
```
HL7_ENABLED=true
HL7_PORT=2575
HL7_TENANT_ID=tenant-default
```

**Migration**
- `026_hl7_integration.sql` — `Hl7InboundMessages`, `Hl7OrphanedMessages` tables; adds `source`, `externalMsgId`, `isMachineGenerated` columns to `LabInvestigations` and `ImagingReports`
- `db/schema.js` — same tables added as SQLite Migration 026 using `runIgnoreDuplicateColumn` for safe ALTER

**Backend files**

| File | Responsibility |
|------|----------------|
| `services/hl7/Hl7Parser.js` | MLLP framing (VT/FS/CR), UTF-8 → latin-1 fallback decode, HL7 segment parser (MSH/PID/OBR/OBX), ACK builder |
| `services/hl7/MllpServer.js` | TCP server, per-socket buffer for partial packets, fire-and-forget AA pattern, per-IP 60-min offline watchdog (5-min check interval) |
| `services/hl7/Hl7MappingService.js` | Idempotency check (MSH-10 controlId), fuzzy MRN match (strips spaces/dashes/leading zeros), happy-path lab ingest, orphan protocol, ClinicalChangeLog audit |
| `services/hl7/index.js` | `start()`/`stop()`/`getStatus()` lifecycle; Windows firewall hint logged on `win32` |
| `repositories/Hl7OrphanRepository.js` | List pending orphans, link to patient |
| `controllers/Hl7StatusController.js` | `GET /api/hl7/status`, `/messages`, `/orphans`; `POST /api/hl7/orphans/:id/link` |
| `repositories/LabInvestigationRepository.js` | Added `createFromHl7(tx, data)` — used inside withTransaction |

**Key design decisions**
- **Always Accept**: AA is sent synchronously before `await processMessage()`. Domain errors (bad MRN, duplicate) never produce AE — only TCP/framing failures do.
- **Orphan protocol**: Unrecognized MRNs are stored in `Hl7OrphanedMessages` for admin linking via the status API.
- **Idempotency**: Duplicate controlIds are detected before the transaction opens; the unique index on `(tenantId, messageId)` is the hard guard.
- **Timezone**: `parseHl7Date` parses the full DTM including optional `+HHMM`/`-HHMM` offset and converts to UTC before storing as **DD-MM-YYYY**. Without an offset, the value is treated as UTC (operators should configure analyzers to send UTC or include offset).
- **Audit**: Every ingested result writes a `ClinicalChangeLog` row with `userId: 'HL7_SERVICE'`, `userRole: 'system'`.

**Tests**
- `tests/hl7-mock-sender.js` — 3 integration tests (requires server running with `HL7_ENABLED=true`):
  1. Happy path — valid MRN, lab record created, changelog entry written
  2. Idempotency trap — same message twice, only one DB row
  3. Fuzzy orphan — malformed MRN (`XX - 99999 - UNKNOWN`), routed to orphan queue

Run: `HL7_TENANT_ID=tenant-default node tests/hl7-mock-sender.js`

---

## Open Items

| Item | Notes |
|------|-------|
| ObservationController envelope | `/history` and `/stats` use `data` as a DB column name — wrapping in `{ data: }` would shadow it. Intentionally left without envelope; update `HistoryTab.jsx` if you want full consistency. |
| HL7 ImagingReports ingest | `Hl7MappingService.processOruR01` only creates `LabInvestigation` rows. ORU^R01 for imaging (PACS) would need an `ingestImagingResult()` path added to `Hl7MappingService` and a `createFromHl7` method on `ImagingRepository`. |
| HL7 orphan re-processing | `POST /api/hl7/orphans/:id/link` links the orphan to a patient but does not re-create the lab record. A follow-up step to replay the raw message after linking is not yet implemented. |

---

## Key Conventions

- All DB access via `dbAdapter.query / queryOne / execute / withTransaction` — never raw `db.run`/`db.all` outside repositories
- Every DB query scoped by `tenantId`
- Write routes: `clinicalWriteLimiter` or `adminWriteLimiter`
- Auth on HTTP routes: `protect(authzFn, { resource: '...' })`
- Dates stored as `DD-MM-YYYY` strings in clinical tables
- Money stored as `NUMERIC` (no float arithmetic)
