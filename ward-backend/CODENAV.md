# Ward Backend - Architectural Navigation

## Structure Overview
The backend is an Express.js application designed for tenant-isolated healthcare management.

## Core Directories
- `controllers/`: Request handling and response formatting.
- `services/`: Business logic (e.g., EWS calculation, Inventory adjustment).
- `repositories/`: Data access layer (Tenant-aware queries).
- `middleware/`: Auth, RBAC, Tenant-Isolation, and Error handling.
- `utils/`: Logging, crypto, and helpers.

## Key Services
- `MedicationService.js`: Handles prescriptions and MAR flow. Integrated with Pharmacy for auto-dispensing.
- `PharmacyService.js`: Enterprise stock management with FEFO (First-Expiry, First-Out) dispensing and batch recall tracing.
- `PharmacyAnalyticsService.js`: 30-day replenishment forecasting and financial valuation logic.
- `PharmacyReorderService.js`: Automated procurement logic and PO generation. [NEW]
- `ScoringService.js`: NEWS2 (National Early Warning Score 2) calculation and clinical risk stratification.
- `MigratorService.js`: Schema-first auto-migrations using `schema.sql`.
- `ClinicalAuditService.js`: Clinical action logging for regulatory compliance.

## Database Schema (Key Tables)
- `Tenants`: Multi-tenant root.
- `Patients`: Core patient demographic and clinical state.
- `PharmacyStock`: Enterprise inventory tracking (Packs, Units per Pack, Total Quantity).
- `PharmacyBatches`: Lot/Batch tracking with expiry dates and per-batch costing.
- `PharmacyTransactions`: Immutable audit trail for stock movements (Restock, Dispense, Adjustment, Waste). Traceable to specific batches.
- `PurchaseOrders`: Automated and manual procurement records for stock replenishment. [NEW]
- `MedicationAdministrations`: Clinical administration records.

## Integration Points
- **MAR -> Pharmacy**: `administerMedication` triggers `PharmacyService.adjustStock`.
- **EWS Trend**: Computed on-the-fly via `TrendService` based on `DailyStats`.
- **RBAC**: Enforced via `rbac.js` middleware based on JWT roles.

## Critical Files
- `server.js`: Entry point.
- `db.js`: Database initialization.
- `dbAdapter.js`: DB abstraction layer.
- `schema.sql`: Source of truth for database structure.
