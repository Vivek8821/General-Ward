// DO NOT DELETE `codemap/build-codemap-md.mjs`.
// It regenerates `codemap/CODEMAP.md` from `codemap/file-inventory.json`
// with deep source analysis of every first-party file.
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

const firstPartyPaths = files
  .filter(f => f.category === 'firstParty')
  .map(f => f.path)
  .sort((a, b) => a.localeCompare(b));
const firstPartySet = new Set(firstPartyPaths);

// ── cache for file contents ─────────────────────────────────────────
const fileCache = new Map();

function readFile(relPath) {
  if (fileCache.has(relPath)) return fileCache.get(relPath);
  try {
    const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
    fileCache.set(relPath, content);
    return content;
  } catch {
    fileCache.set(relPath, '');
    return '';
  }
}

// ── source analysis ─────────────────────────────────────────────────

function extractCommentHeader(source) {
  const m = source.match(/^\s*(\/\*\*[\s\S]*?\*\/|\/\/[^\n]*(\n\s*\/\/[^\n]*)*)/);
  if (!m) return null;
  const c = m[1];
  return c
    .replace(/^\s*\/\*\*?\s*|\s*\*\/\s*$/g, '')
    .replace(/^[ \t]*\*[ \t]?/gm, '')
    .replace(/^[ \t]*\/\/[ \t]?/gm, '')
    .trim() || null;
}

function extractExports(source, filePath) {
  const isESM = source.includes('export ') && !source.includes('module.exports');
  const result = [];

  if (isESM) {
    const dft = source.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (dft) result.push(`default: ${dft[1]}`);
    for (const m of source.matchAll(/export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g)) {
      result.push(m[1]);
    }
    if (source.match(/export\s*\{\s*([^}]+)\s*\}/)) {
      const names = RegExp.$1.split(',').map(s => s.trim().replace(/\s+as\s+.+$/, ''));
      for (const n of names) if (n && !result.includes(n)) result.push(n);
    }
  } else {
    // CJS
    for (const m of source.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*require\(/g)) {
      result.push(`requires: ${m[1]}`); // track require aliases for later
    }
    // module.exports = X  or  module.exports = { ... }
    const me = source.match(/module\.exports\s*=\s*(\{[\s\S]*?\}|[\w.]+)/);
    if (me) {
      const val = me[1];
      if (val.startsWith('{')) {
        for (const m of val.matchAll(/(\w+)(?:\s*:\s*\w+)?\s*[,}]/g)) {
          if (m[1] !== 'true' && m[1] !== 'false' && m[1] !== 'null') result.push(m[1]);
        }
      } else {
        result.push(`exports: ${val}`);
      }
    }
    // exports.X = ...
    for (const m of source.matchAll(/exports\.(\w+)\s*=/g)) {
      result.push(m[1]);
    }
  }
  return result;
}

function extractFunctions(source) {
  const fns = [];
  // named function declarations (not inside comments)
  for (const m of source.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)) {
    fns.push({ name: m[1], params: m[2] });
  }
  // arrow functions assigned to variables
  for (const m of source.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g)) {
    fns.push({ name: m[1], params: m[2] });
  }
  return fns;
}

function extractClasses(source) {
  const classes = [];
  for (const m of source.matchAll(/class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g)) {
    const name = m[1];
    const parent = m[2] || null;
    // find methods inside this class
    const classStart = m.index + m[0].length;
    const classBody = findMatchingBrace(source, classStart);
    const methods = [];
    for (const mm of classBody.matchAll(/(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g)) {
      if (mm[1] !== 'constructor' && !['if','for','while','switch','catch'].includes(mm[1])) {
        methods.push({ name: mm[1], params: mm[2] });
      }
    }
    classes.push({ name, parent, methods });
  }
  return classes;
}

function findMatchingBrace(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return source.slice(start);
}

function extractRoutes(source) {
  const routes = [];
  for (const m of source.matchAll(/router\.(get|post|put|delete|patch|use)\s*\(\s*(['"`])([^'"]+)\2/g)) {
    routes.push(`${m[1].toUpperCase()} ${m[3]}`);
  }
  return routes;
}

function extractReactComponents(source) {
  const comps = [];
  // function ComponentName(...) that uses return with JSX
  for (const m of source.matchAll(/(?:export\s+)?(?:function|const)\s+(\w+)\s*(?:=\s*(?:\([^)]*\)|[\w.]+)\s*=>|\([^)]*\))/g)) {
    const name = m[1];
    if (/^[A-Z]/.test(name) && !['Boolean','Number','String','Array','Object','Promise','Error','Map','Set','Date','RegExp','Symbol','JSON','Math','Intl','Reflect'].includes(name)) {
      comps.push(name);
    }
  }
  return [...new Set(comps)];
}

function extractTables(source) {
  const tables = [];
  // match CREATE TABLE … ( … );
  const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\)\s*;/g;
  for (const m of source.matchAll(tableRegex)) {
    const name = m[1];
    const body = m[2];
    const cols = [];
    // match column definitions, handling CHECK(...) with nested parens
    const colRegex = /^\s*(\w+)\s+([A-Z]+(?:\s*\((?:(?:[^()]*|\([^()]*\))*)\))?(?:\s+(?:NOT\s+NULL|UNIQUE|PRIMARY\s+KEY|DEFAULT\s+\S+|CHECK\s*\((?:(?:[^()]*|\([^()]*\))*)\)))*(?:\s+REFERENCES\s+\w+\s*\([^)]*\))?)\s*,?\s*$/gm;
    for (const cm of body.matchAll(colRegex)) {
      const colName = cm[1];
      const colDef = cm[2];
      if (/^(FOREIGN|PRIMARY|CHECK|UNIQUE|CONSTRAINT|CREATE|INDEX)\b/i.test(colName)) continue;
      cols.push({ name: colName, type: colDef.trim().replace(/\s+/g, ' ') });
    }
    tables.push({ name, columns: cols });
  }
  return tables;
}

function extractMiddlewarePattern(source) {
  // detect if this file exports middleware functions
  const hasMiddleware = source.includes('(req, res, next)') || source.includes('(req,res,next)');
  return hasMiddleware;
}

// ── file role classifier ────────────────────────────────────────────

function classifyRole(relPath) {
  const p = relPath.split(path.sep).join('/');
  if (p.match(/ward-backend\/controllers?\//)) return 'controller';
  if (p.match(/ward-backend\/services?\//)) return 'service';
  if (p.match(/ward-backend\/repositories?\//)) return 'repository';
  if (p.match(/ward-backend\/middleware\//)) return 'middleware';
  if (p.match(/ward-backend\/routes?\//)) return 'route';
  if (p.match(/ward-backend\/utils?\//)) return 'utility';
  if (p.match(/ward-backend\/scripts?\//)) return 'script';
  if (p.match(/ward-backend\/db\//)) return 'schema-init';
  if (p.match(/ward-backend\/(db|db-adapter|db-postgres|config|server)\.js$/)) return 'core-backend';
  if (p.match(/ward-backend\/schema\.sql$/)) return 'schema';
  if (p.match(/postgres-migrations\//)) return 'migration';
  if (p.match(/ward-frontend\/src\/views?\//)) return 'frontend-view';
  if (p.match(/ward-frontend\/src\/features?\//)) return 'frontend-feature';
  if (p.match(/ward-frontend\/src\/components?\//)) return 'frontend-component';
  if (p.match(/ward-frontend\/src\/context\//)) return 'frontend-context';
  if (p.match(/ward-frontend\/src\/utils?\//)) return 'frontend-utility';
  if (p.match(/ward-frontend\/src\/.+\..*test\./)) return 'frontend-test';
  if (p.endsWith('.test.js')) return 'test';
  if (p.match(/codemap\//)) return 'codemap';
  if (p.match(/\.github\//)) return 'ci';
  if (p.match(/nginx\//)) return 'infra';
  if (p.match(/docs?\//)) return 'docs';
  if (p.match(/docker-compose/)) return 'infra';
  if (p.match(/Dockerfile/)) return 'infra';
  if (p.endsWith('.sh')) return 'script';
  if (p.endsWith('.md')) return 'docs';
  if (p.endsWith('.env.example') || p.endsWith('.env.postgres.example')) return 'config';
  return 'other';
}

// ── describe file from analysis ─────────────────────────────────────

function describeFile(relPath) {
  const source = readFile(relPath);
  if (!source) return { summary: '_Binary or empty file._', sections: [] };

  const ext = path.extname(relPath).toLowerCase();
  const role = classifyRole(relPath);
  const lines = source.split('\n').length;
  const size = source.length;

  const result = {
    summary: '',
    sections: [],
    role,
    lines,
    highlights: [],
  };

  // comment header
  const header = extractCommentHeader(source);
  if (header) result.summary = header;

  // specific analyzers by file type / role
  if (ext === '.sql') {
    const tables = extractTables(source);
    if (tables.length) {
      result.sections.push({
        heading: `Tables (${tables.length})`,
        items: tables.map(t => `**${t.name}** — ${t.columns.map(c => `\`${c.name}\` ${c.type}`).join(', ')}`),
      });
    }
    if (!result.summary) result.summary = 'SQL schema file defining database tables, columns, constraints, and indexes.';
  }

  if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx' || ext === '.mjs') {
    const routes = extractRoutes(source);
    const classes = extractClasses(source);
    const functions = extractFunctions(source);
    const exports = extractExports(source, relPath);
    const isMiddleware = extractMiddlewarePattern(source);
    const reactComps = ext.match(/\.jsx|\.tsx/) || relPath.includes('/components/') || relPath.includes('/views/') ? extractReactComponents(source) : [];

    // filter exports to meaningful names (not require aliases)
    const meaningfulExports = exports.filter(e => !e.startsWith('requires:') && !e.startsWith('exports:'));

    if (routes.length) {
      result.sections.push({ heading: 'Routes', items: routes.map(r => `\`${r}\``) });
    }

    if (classes.length) {
      for (const cls of classes) {
        const methods = cls.methods.slice(0, 12).map(m => `\`${m.name}(${m.params})\``);
        let desc = `**class ${cls.name}**`;
        if (cls.parent) desc += ` extends ${cls.parent}`;
        if (methods.length) desc += ` — ${methods.join(', ')}`;
        if (cls.methods.length > 12) desc += ` … +${cls.methods.length - 12} more`;
        result.highlights.push(desc);
      }
    }

    // top-level functions not inside classes and not in exports list
    const classMethodNames = new Set(classes.flatMap(c => c.methods.map(m => m.name)));
    const topFns = functions.filter(f => !classMethodNames.has(f.name));
    if (topFns.length && !classes.length) {
      const fnList = topFns.slice(0, 12).map(f => `\`${f.name}(${f.params})\``);
      if (fnList.length) {
        result.sections.push({ heading: 'Functions', items: fnList });
      }
    }

    if (meaningfulExports.length) {
      result.highlights.push(`Exports: ${meaningfulExports.slice(0, 10).map(e => `\`${e}\``).join(', ')}${meaningfulExports.length > 10 ? ' …' : ''}`);
    }

    if (isMiddleware && !relPath.includes('/test') && !relPath.endsWith('.test.js') && !relPath.endsWith('.test.jsx')) {
      result.highlights.push('Express middleware: processes `(req, res, next)`.');
    }

    // role-based summaries
    if (!result.summary) {
      const roleMap = {
        controller: `Express route controller handling HTTP requests for ${path.basename(relPath, path.extname(relPath)).replace('Controller','')} endpoints.`,
        service: `Business-logic service layer for ${path.basename(relPath, path.extname(relPath)).replace('Service','')} operations.`,
        repository: `Data-access repository for ${path.basename(relPath, path.extname(relPath)).replace('Repository','')} persistence.`,
        middleware: 'Express middleware — intercepts requests for auth, RBAC, CSRF, tenant isolation, audit logging, or error handling.',
        route: 'Express route definitions — mounts sub-routers and handler chains.',
        utility: 'Shared utility/helper module.',
        script: 'Standalone script for migrations, seeding, stress testing, or maintenance.',
        test: `Integration/unit test suite (Jest + Supertest). Run via \`npm test\` in ward-backend.`,
        'frontend-test': `Frontend test suite (Vitest + Testing Library). Run via \`npm test\` in ward-frontend.`,
      };
      result.summary = roleMap[role] || '';
    }
  }

  if (ext === '.json') {
    try {
      const obj = JSON.parse(source);
      const keys = Object.keys(obj);
      if (keys.length <= 20) {
        result.sections.push({ heading: 'Top-level keys', items: keys.map(k => `\`${k}\``) });
      }
      const note = obj._doNotDelete?.note || '';
      if (note) result.summary = note;
    } catch { /* ignore */ }
    if (!result.summary) result.summary = 'JSON configuration, state, or data file.';
  }

  if (ext === '.sh') {
    const shebang = source.match(/^#!\s*(.+)/);
    if (shebang) result.highlights.push(`Shebang: ${shebang[1]}`);
    // description from comments near top
    const descMatch = source.match(/^#[^!][^\n]+/m);
    if (!result.summary && descMatch) result.summary = descMatch[0].replace(/^#\s*/, '').trim();
    if (!result.summary) result.summary = 'Shell script for automation, setup, or maintenance.';
  }

  if (ext === '.yml' || ext === '.yaml') {
    const workflowName = source.match(/^name:\s*(.+)/m);
    if (workflowName) result.summary = `GitHub Actions workflow: ${workflowName[1]}`;
    const onTriggers = [];
    for (const m of source.matchAll(/^on:\s*(\[.*?\]|\w+)/gm)) {
      onTriggers.push(m[1]);
    }
    if (onTriggers.length) result.highlights.push(`Triggers: ${onTriggers.join(', ')}`);
    if (!result.summary) result.summary = 'CI/CD workflow definition.';
  }

  if (ext === '.md') {
    const title = source.match(/^#\s+(.+)/m);
    if (title) result.summary = title[1];
    const headings = [];
    for (const m of source.matchAll(/^##\s+(.+)/gm)) {
      headings.push(m[1]);
    }
    if (headings.length) result.sections.push({ heading: 'Sections', items: headings.slice(0, 15).map(h => h) });

    // extract cross-references like [link](path)
    const refs = [];
    for (const m of source.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      refs.push({ label: m[1], target: m[2] });
    }
    const localRefs = refs.filter(r => r.target.startsWith('./') || r.target.startsWith('../') || r.target.startsWith('#'));
    if (localRefs.length) {
      result.sections.push({ heading: 'Cross-references', items: localRefs.slice(0, 20).map(r => `[${r.label}](${r.target})`) });
    }
  }

  if (ext === '.conf' || relPath.includes('nginx')) {
    const servers = source.match(/server\s*\{/g);
    const upstreams = [];
    for (const m of source.matchAll(/upstream\s+(\w+)/g)) upstreams.push(m[1]);
    if (upstreams.length) result.highlights.push(`Upstreams: ${upstreams.join(', ')}`);
    result.summary = result.summary || `Nginx configuration${servers ? ` — ${servers.length} server block(s)` : ''}.`;
  }

  return result;
}

// ── build markdown ──────────────────────────────────────────────────

const lines = [];

lines.push('# General Ward — repository codemap');
lines.push('');
lines.push('> Auto-generated from `codemap/file-inventory.json` with deep source analysis.');
lines.push('> Regenerate: `npm run codemap` (or `node codemap/generate-codemap-index.mjs && node codemap/build-codemap-md.mjs`).');
lines.push('');
lines.push('---');
lines.push('');

// ── TOC ──
lines.push('## Table of contents');
lines.push('- [Architecture overview](#architecture-overview)');
lines.push('- [Feature workflows](#feature-workflows)');
lines.push('- [Data model (schema)](#data-model-schema)');
lines.push('- [Backend core](#backend-core)');
lines.push('- [Backend controllers](#backend-controllers)');
lines.push('- [Backend services](#backend-services)');
lines.push('- [Backend repositories](#backend-repositories)');
lines.push('- [Backend middleware](#backend-middleware)');
lines.push('- [Backend routes & utilities](#backend-routes--utilities)');
lines.push('- [Frontend views](#frontend-views)');
lines.push('- [Frontend features & components](#frontend-features--components)');
lines.push('- [Frontend context & utilities](#frontend-context--utilities)');
lines.push('- [Tests](#tests)');
lines.push('- [Scripts & automation](#scripts--automation)');
lines.push('- [Infrastructure & CI](#infrastructure--ci)');
lines.push('- [Documentation](#documentation)');
lines.push('- [First-party file inventory](#first-party-file-inventory)');
lines.push('- [Completeness and known limitations](#completeness-and-known-limitations)');
lines.push('');

lines.push('---');
lines.push('');

// ── architecture overview ──
lines.push('## Architecture overview');
lines.push('');
lines.push('Monorepo: **React 19 + Vite** SPA (`ward-frontend/`) and **Express 5 + PostgreSQL/SQLite** API (`ward-backend/`). Root `package.json` orchestrates install/run via `concurrently`.');
lines.push('');
lines.push('```mermaid');
lines.push('flowchart TB');
lines.push('  subgraph Client');
lines.push('    FE[ward-frontend React 19<br/>Vite + TanStack Query v5<br/>Tailwind CSS 4]');
lines.push('  end');
lines.push('  subgraph Gateway');
lines.push('    NGX[nginx reverse proxy<br/>rate limit / CSP / TLS]');
lines.push('  end');
lines.push('  subgraph API');
lines.push('    EX[Express server.js]');
lines.push('    MW[auth.js / csrf.js / rbac.js<br/>tenant.js / audit.js / error.js]');
lines.push('    SVC[services — business logic]');
lines.push('    REPO[repositories — data access]');
lines.push('    DBA[db-adapter.js — polymorphic<br/>?→$n placeholder translation<br/>row-shape normalization]');
lines.push('    DB[(PostgreSQL 16 / SQLite<br/>WAL + synchronous=NORMAL)]');
lines.push('  end');
lines.push('  FE -->|HTTPS JSON + cookie auth| NGX');
lines.push('  NGX --> EX');
lines.push('  EX --> MW');
lines.push('  MW --> SVC');
lines.push('  SVC --> REPO');
lines.push('  REPO --> DBA');
lines.push('  DBA --> DB');
lines.push('```');
lines.push('');
lines.push('**Key architectural rules:**');
lines.push('- **All repository code must use `db-adapter.js`** (not raw `db.js` calls) for cross-dialect compatibility.');
lines.push('- **Every query must scope by `tenantId`** — multi-tenant isolation enforced by middleware.');
lines.push('- **SQLite `withTransaction` uses a sequential global queue** (`BEGIN IMMEDIATE`) to prevent nested-transaction errors under concurrent writes.');
lines.push('- **Auth**: JWT (8h) in `ward_token` httpOnly cookie + `Authorization` header fallback + CSRF double-submit.');
lines.push('- **RBAC roles**: `doctor`, `nurse`, `pharmacist`, `admin` — permissions defined in `middleware/rbac.js`.');
lines.push('');

// ── feature workflows ──
lines.push('## Feature workflows');
lines.push('');
lines.push('| Feature | UI entry | API route | Key backend files |');
lines.push('|---------|----------|-----------|-------------------|');
lines.push('| Login / session | `views/Login.jsx`, `context/AuthContext.jsx` | `/api/auth/*` | `controllers/AuthController.js`, `services/AuthService.js`, `middleware/auth.js` |');
lines.push('| Dashboard (patient list) | `features/dashboard/DashboardView.jsx` | `/api/patients` | `controllers/PatientController.js`, `services/PatientService.js`, `repositories/PatientRepository.js` |');
lines.push('| Patient detail (vitals, diet, sleep, scoring) | `views/PatientDetail.jsx` | `/api/patients/:id/stats`, `/api/observations/*` | `controllers/ObservationController.js`, `services/ScoringService.js`, `routes/stats.js` |');
lines.push('| Medications & MAR | `components/stats/MedsTab.jsx` | `/api/patients/:id/medications` | `controllers/MedicationController.js`, `services/MedicationService.js` |');
lines.push('| Pharmacy inventory | `features/pharmacy/PharmacyView.jsx` | `/api/pharmacy/*` | `controllers/PharmacyController.js`, `services/PharmacyService.js` |');
lines.push('| Pharmacy barcode scanning | `components/BarcodeScanner.jsx` | `/api/pharmacy/scan/:code` | `controllers/BarcodeController.js`, `services/BarcodeService.js`, `utils/gs1Parser.js` |');
lines.push('| Tasks (ward board) | `views/Tasks.jsx` | `/api/tasks` | `controllers/TaskController.js`, `services/TaskService.js`, `repositories/TaskRepository.js` |');
lines.push('| Escalations | `views/PatientDetail.jsx` | `/api/escalations` | `controllers/EscalationController.js`, `services/EscalationService.js` |');
lines.push('| Handover notes | `components/stats/HandoverNotesPanel.jsx` | `/api/patients/:id/notes` | `services/HandoverNotesService.js`, `repositories/HandoverNotesRepository.js` |');
lines.push('| Discharge & archive | `components/stats/DischargeSummaryTab.jsx` | `/api/patients/archives` | `controllers/PatientController.js`, `services/PatientService.js` |');
lines.push('| Patient treatment reports (PDF) | `views/VerifyReport.jsx` | `/api/reports` | `services/ReportDataService.js`, `services/PDFReportService.js` |');
lines.push('| Audit log (admin) | `views/AdminAudit.jsx` | `/api/admin/audit` | `routes/adminAudit.js` |');
lines.push('| Waste & spillage | `features/pharmacy/` | `/api/pharmacy/waste/*` | `services/WasteService.js`, `repositories/WasteRepository.js` |');
lines.push('| Purchase orders | `features/pharmacy/` | `/api/pharmacy/orders/*` | `services/PharmacyReorderService.js`, `repositories/PurchaseOrderRepository.js` |');
lines.push('');

// ── data model ──
lines.push('## Data model (schema)');
lines.push('');
lines.push('Source of truth: `ward-backend/schema.sql`. Postgres migrations: `ward-backend/postgres-migrations/migrations/`.');
lines.push('');

// parse schema.sql for tables
const schemaPath = 'ward-backend/schema.sql';
if (firstPartySet.has(schemaPath) || fs.existsSync(path.join(repoRoot, schemaPath))) {
  const schemaSource = readFile(schemaPath);
  const tables = extractTables(schemaSource);
  for (const t of tables) {
    lines.push(`### \`${t.name}\``);
    lines.push('');
    lines.push('| Column | Type |');
    lines.push('|--------|------|');
    for (const c of t.columns) {
      lines.push(`| \`${c.name}\` | ${c.type} |`);
    }
    lines.push('');
  }
} else {
  lines.push('_schema.sql not found in inventory — run `npm run codemap:inventory` first._');
}
lines.push('');

// ── group files by role ──

const roleGroups = {
  'Backend core': { role: 'core-backend', icon: '⚙' },
  'Backend controllers': { role: 'controller', icon: '↗' },
  'Backend services': { role: 'service', icon: '◆' },
  'Backend repositories': { role: 'repository', icon: '▣' },
  'Backend middleware': { role: 'middleware', icon: '⬡' },
  'Backend routes & utilities': { role: ['route', 'utility', 'schema-init'], icon: '○' },
  'Frontend views': { role: 'frontend-view', icon: '◉' },
  'Frontend features & components': { role: ['frontend-feature', 'frontend-component'], icon: '◇' },
  'Frontend context & utilities': { role: ['frontend-context', 'frontend-utility'], icon: '▽' },
  'Tests': { role: ['test', 'frontend-test'], icon: '✓' },
  'Scripts & automation': { role: ['script', 'codemap'], icon: '▶' },
  'Infrastructure & CI': { role: ['infra', 'ci', 'config', 'migration'], icon: '⬢' },
  'Documentation': { role: 'docs', icon: '📄' },
};

function matchesRole(fileRole, groupRole) {
  if (Array.isArray(groupRole)) return groupRole.includes(fileRole);
  return fileRole === groupRole;
}

for (const [sectionName, { role: groupRole, icon }] of Object.entries(roleGroups)) {
  const groupFiles = firstPartyPaths.filter(p => {
    const r = classifyRole(p);
    return matchesRole(r, groupRole);
  });

  if (groupFiles.length === 0) continue;

  lines.push(`## ${sectionName}`);
  lines.push('');

  for (const relPath of groupFiles) {
    const basename = path.basename(relPath);
    const desc = describeFile(relPath);
    const role = classifyRole(relPath);

    lines.push(`### \`${relPath}\``);
    lines.push('');

    if (desc.summary) {
      lines.push(desc.summary);
      lines.push('');
    }

    lines.push(`_${desc.lines} lines_`);

    if (desc.highlights.length) {
      for (const h of desc.highlights) {
        lines.push(`- ${h}`);
      }
    }

    if (desc.sections.length) {
      for (const sec of desc.sections) {
        lines.push('');
        lines.push(`**${sec.heading}:**`);
        if (sec.items.length <= 20) {
          for (const item of sec.items) {
            lines.push(`- ${item}`);
          }
        } else {
          for (const item of sec.items.slice(0, 20)) {
            lines.push(`- ${item}`);
          }
          lines.push(`- … and ${sec.items.length - 20} more`);
        }
      }
    }

    lines.push('');
  }
}

// ── completeness ──
lines.push('---');
lines.push('');
lines.push('## Completeness and known limitations');
lines.push('');
lines.push(`- First-party files: **${counts.firstParty}** | Third-party: **${counts.thirdParty}** | Data files: **${counts.data}** | Total: **${(counts.firstParty + counts.thirdParty + counts.data).toLocaleString()}**`);
lines.push(`- Generated at: ${new Date().toISOString()}`);
lines.push('- `.git/` is skipped; `codemap/` is excluded from inventory by default.');
lines.push('- Descriptions are extracted via regex-based source analysis — not a full parser. Open the file for authoritative behavior.');
lines.push('- `node_modules/**` files are inventoried as `thirdParty` with `packageName` metadata but not enumerated in this markdown.');
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${path.relative(repoRoot, outPath)} (${lines.length} lines)`);
