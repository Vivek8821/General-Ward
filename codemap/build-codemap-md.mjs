// DO NOT DELETE `codemap/build-codemap-md.mjs`.
// It regenerates `codemap/CODEMAP.md` from `codemap/file-inventory.json`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const inventoryPath = path.resolve(__dirname, 'file-inventory.json');
const outPath = path.resolve(__dirname, 'CODEMAP.md');

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const files = inventory.files ?? [];
const counts = inventory.counts ?? { firstParty: 0, thirdParty: 0, data: 0 };

const firstParty = files
  .filter((f) => f.category === 'firstParty')
  .map((f) => f.path)
  .sort((a, b) => a.localeCompare(b));

const dataFiles = files
  .filter((f) => f.category === 'data')
  .map((f) => f.path)
  .sort((a, b) => a.localeCompare(b));

function slugAnchor(relPath) {
  return (
    'fp-' +
    relPath
      .replace(/\\/g, '/')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
  );
}

function describePath(relPath) {
  // Keep descriptions high-level; this codemap is generated for navigation.
  // Open the referenced file for authoritative behavior.
  if (relPath.endsWith('/ward.db') || relPath.endsWith('.db') || relPath.endsWith('.db-journal') || relPath.endsWith('.db-wal') || relPath.endsWith('.db-shm')) {
    return 'SQLite database artifact (runtime/generated data).';
  }
  if (relPath.endsWith('.test.js')) {
    const kind = relPath.includes('/integration/') ? 'Integration' : 'Unit';
    return `${kind} test validating service/routes behavior (run via ` + '`npm test`' + ` in ` + '`ward-backend`' + `).`;
  }
  if (relPath.endsWith('.json')) {
    return 'JSON configuration/state file used by the app or tooling.';
  }
  if (relPath.endsWith('.md')) {
    return 'Documentation file that explains how to work with this repo/subsystem.';
  }
  if (relPath.endsWith('.jsx') || relPath.endsWith('.js')) {
    return 'First-party source code in the backend/frontend layer.';
  }
  if (relPath.endsWith('.css')) return 'Frontend styling (global/app styles).';
  if (relPath.endsWith('.html')) return 'HTML entry/prototype for the SPA or legacy UI.';
  if (relPath.endsWith('.svg')) return 'SVG asset (icon/illustration).';
  return 'First-party file (open to inspect exact behavior).';
}

const lines = [];

lines.push('# General Ward — repository codemap');
lines.push('');
lines.push('This file is part of the repo documentation/audit trail.');
lines.push('DO NOT DELETE `codemap/CODEMAP.md`. It is regenerated from `codemap/file-inventory.json` and is used for developer navigation and completeness checks.');
lines.push('');
lines.push('Generated from `codemap/file-inventory.json` (run `node codemap/generate-codemap-index.mjs` first, then this script).');
lines.push('');
lines.push('---');
lines.push('');

lines.push('## Table of contents');
lines.push('- [Architecture overview](#architecture-overview)');
lines.push('- [Feature workflows](#feature-workflows)');
lines.push('- [Automation and scripts](#automation-and-scripts)');
lines.push('- [Data model (SQLite)](#data-model-sqlite)');
lines.push('- [Third-party inventory strategy](#third-party-inventory-strategy)');
lines.push('- [First-party file inventory](#first-party-file-inventory)');
lines.push('- [Completeness and known limitations](#completeness-and-known-limitations)');
lines.push('');

lines.push('---');
lines.push('');

lines.push('## Architecture overview');
lines.push('');
lines.push('Monorepo with a **React (Vite) SPA** in `ward-frontend/` and an **Express + SQLite** API in `ward-backend/`. The root `package.json` orchestrates install/run.');
lines.push('');
lines.push('### Component diagram');
lines.push('');
lines.push('```mermaid');
lines.push('flowchart LR');
lines.push('  subgraph Client');
lines.push('    FE[ward-frontend React]');
lines.push('  end');
lines.push('  subgraph API');
lines.push('    EX[Express server.js]');
lines.push('    MW[auth / audit / tenant middleware]');
lines.push('    SVC[services]');
lines.push('    REPO[repositories]');
lines.push('    DB[(SQLite ward.db)]');
lines.push('  end');
lines.push('  FE -->|HTTPS JSON| EX');
lines.push('  EX --> MW');
lines.push('  MW --> SVC');
lines.push('  SVC --> REPO');
lines.push('  REPO --> DB');
lines.push('```');
lines.push('');

lines.push('## Feature workflows');
lines.push('');

function workflowSection({ title, ui, api, backendKeys }) {
  lines.push('### ' + title);
  lines.push('');
  if (ui?.length) lines.push('- UI: ' + ui.map((p) => '`' + p + '`').join(', ') + '.');
  if (api?.length) lines.push('- API: ' + api.map((p) => '`' + p + '`').join(', ') + '.');
  if (backendKeys?.length) {
    lines.push('');
    lines.push('- Key implementation files:');
    for (const p of backendKeys) lines.push('  - `' + p + '`');
  }
  lines.push('');
}

workflowSection({
  title: 'Login and session',
  ui: ['ward-frontend/src/views/Login.jsx', 'ward-frontend/src/context/AuthContext.jsx'],
  api: ['/api/auth/*'],
  backendKeys: ['ward-backend/controllers/AuthController.js', 'ward-backend/services/AuthService.js', 'ward-backend/middleware/auth.js', 'ward-backend/repositories/AuthRepository.js'],
});

workflowSection({
  title: 'Dashboard (patient list / ward overview)',
  ui: ['ward-frontend/src/views/Dashboard.jsx', 'ward-frontend/src/utils/api.js'],
  api: ['/api/patients'],
  backendKeys: ['ward-backend/controllers/PatientController.js', 'ward-backend/services/PatientService.js', 'ward-backend/repositories/PatientRepository.js'],
});

workflowSection({
  title: 'Patient chart tabs (vitals, diet, sleep, scoring)',
  ui: ['ward-frontend/src/views/PatientDetail.jsx', 'ward-frontend/src/components/stats/VitalsTab.jsx', 'ward-frontend/src/components/stats/DietTab.jsx', 'ward-frontend/src/components/stats/SleepTab.jsx'],
  api: ['/api/patients/:patientId/stats', '/api/observations/*'],
  backendKeys: ['ward-backend/routes/stats.js', 'ward-backend/routes/observations.js', 'ward-backend/services/ScoringService.js'],
});

workflowSection({
  title: 'Medications and MAR',
  ui: ['ward-frontend/src/components/stats/MedsTab.jsx'],
  api: ['/api/patients/:patientId/medications'],
  backendKeys: ['ward-backend/routes/medications.js'],
});

workflowSection({
  title: 'History timeline',
  ui: ['ward-frontend/src/components/stats/HistoryTab.jsx'],
  api: ['/api/patients/:patientId/history'],
  backendKeys: ['ward-backend/routes/history.js'],
});

workflowSection({
  title: 'Escalations',
  ui: ['ward-frontend/src/views/PatientDetail.jsx'],
  api: ['/api/patients/:patientId/escalations'],
  backendKeys: ['ward-backend/controllers/EscalationController.js', 'ward-backend/services/EscalationService.js', 'ward-backend/repositories/EscalationRepository.js'],
});

workflowSection({
  title: 'Tasks (ward board)',
  ui: ['ward-frontend/src/views/Tasks.jsx'],
  api: ['/api/tasks'],
  backendKeys: ['ward-backend/routes/tasks.js', 'ward-backend/services/TaskService.js', 'ward-backend/repositories/TaskRepository.js', 'ward-backend/middleware/tenant.js'],
});

workflowSection({
  title: 'Handover / patient notes',
  ui: ['ward-frontend/src/components/stats/HandoverNotesPanel.jsx'],
  api: ['/api/patients/:patientId/notes'],
  backendKeys: ['ward-backend/routes/patientNotes.js', 'ward-backend/services/HandoverNotesService.js', 'ward-backend/repositories/HandoverNotesRepository.js'],
});

workflowSection({
  title: 'Discharge / archive',
  ui: ['ward-frontend/src/components/stats/DischargeSummaryTab.jsx'],
  api: ['/api/patients/archives'],
  backendKeys: ['ward-backend/controllers/PatientController.js', 'ward-backend/services/PatientService.js'],
});

lines.push('## Automation and scripts');
lines.push('');
lines.push('| Location | Command | Purpose |');
lines.push('| --- | --- | --- |');
lines.push('| Root | `npm run install-all` | Install backend + frontend deps. |');
lines.push('| Root | `npm start` | Run API and Vite dev server together (concurrently). |');
lines.push('| ward-backend | `npm test` | Jest + Supertest tests. |');
lines.push('| codemap | `node codemap/generate-codemap-index.mjs` | Regenerate `codemap/file-inventory.json`. |');
lines.push('| codemap | `node codemap/build-codemap-md.mjs` | Regenerate this codemap markdown. |');
lines.push('');

lines.push('## Data model (SQLite)');
lines.push('');
lines.push('Schema is defined/bootstrapped in `ward-backend/db.js` and uses `DailyStats` with a JSON/text `data` payload for multiple types.');
lines.push('');

lines.push('### Data files on disk');
lines.push('');
for (const p of dataFiles) lines.push('- `' + p + '` — runtime/DB artifact, not app source.');
if (dataFiles.length === 0) lines.push('_No `data`-category files in current inventory._');
lines.push('');

lines.push('## Third-party inventory strategy');
lines.push('');
lines.push('`node_modules/**` is included in the inventory (`category: "thirdParty"`) and referenced via `packageName` in `codemap/file-inventory.json`. This markdown does not enumerate every third-party file.');
lines.push('');

lines.push('## First-party file inventory');
lines.push('');
lines.push('**' + firstParty.length + '** first-party paths. Each entry provides a high-level reason; open the file for authoritative behavior.');
lines.push('');

for (const relPath of firstParty) {
  const id = slugAnchor(relPath);
  lines.push('<a id="' + id + '"></a>');
  lines.push('### `' + relPath + '`');
  lines.push('');
  lines.push(describePath(relPath));
  lines.push('');
}

lines.push('## Completeness and known limitations');
lines.push('');
lines.push('- Inventory counts: **firstParty ' + counts.firstParty + '**, **thirdParty ' + counts.thirdParty + '**, **data ' + counts.data + '**, total ' + inventory.totals + '.');
lines.push('- `.git/` is skipped by the walker; the `codemap/` directory is skipped by default to avoid recursion.');
lines.push('- Descriptions are high-level; this codemap is meant to map responsibilities and entry points, not replace reading code.');
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
// eslint-disable-next-line no-console
console.log('Wrote ' + path.relative(repoRoot, outPath));

