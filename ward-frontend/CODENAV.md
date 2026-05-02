# Ward Frontend - Architectural Navigation

## Structure Overview
A React + Vite application using TanStack Query for state management and Tailwind CSS for styling.

## Core Views
- `Pharmacy.jsx`: High-density enterprise inventory management with batch/lot tracking, FEFO-aware dispensing, and recall tracing.
- `Dashboard.jsx`: Central ward status overview.
- `PatientDetails.jsx`: Comprehensive patient profile (Vitals, MAR, Handover).
- `Trends.jsx`: Multi-parameter clinical data visualization.

## Key Components
- `MedsTab.jsx`: Stock-aware medication prescription and administration (MAR).
- `HandoverTab.jsx`: Shift-based clinical note management.
- `VitalForm.jsx`: Structured data entry for patient observations.

## Design System
- `index.css`: Custom utility classes and theme tokens.
- `components/ui/`: Reusable primitive components (Modals, Cards, Badges).

## State Management (Query Keys)
- `['pharmacy', 'inventory']`: EDL Stock data (includes batches).
- `['pharmacy', 'history']`: Transaction audit logs.
- `['pharmacy', 'batches', id]`: Specific batch/lot details.
- `['pharmacy', 'recall-trace', id]`: Tracing patients for a recalled batch.
- `['patient', id, 'medications']`: Active and discontinued prescriptions.

## Navigation Flow
- **Inventory -> Audit**: Click "Audit History" on any medication card.
- **MAR -> Stock**: Prescription form automatically checks EDL stock levels.
- **Dashboard -> Patient**: One-click drill-down to clinical profile.
