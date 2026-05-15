// Walks the subtype detail of a ServiceCatalog row and formats only the populated
// fields. Keeps presentation consistent across the API/PDF/print layers without
// each consumer reinventing "skip-if-empty" logic.
//
// `service` is the shape returned by ServiceCatalogRepository.findFull(id, tenantId):
//   { id, code, name, category, unitPrice, subtype: 'ServiceLab' | ..., detail: { ... } }

const SUBTYPE_FIELDS = {
  ServiceLab: [
    { key: 'specimenType',    label: 'Specimen' },
    { key: 'container',       label: 'Container' },
    { key: 'methodology',     label: 'Method' },
    { key: 'unitsOfMeasure',  label: 'Units' },
    { key: 'normalRange',     label: 'Normal range', derive: (d) => (d.normalLow != null && d.normalHigh != null) ? `${d.normalLow}–${d.normalHigh}` : null },
    { key: 'turnaroundHours', label: 'Turnaround',   format: (v) => `${v} h` },
    { key: 'fastingRequired', label: 'Fasting',      format: (v) => (v ? 'required' : 'not required'), includeFalse: true },
  ],
  ServiceImaging: [
    { key: 'modality',         label: 'Modality',  format: (v) => String(v).toUpperCase() },
    { key: 'bodyRegion',       label: 'Region' },
    { key: 'contrast',         label: 'Contrast' },
    { key: 'durationMinutes',  label: 'Duration',  format: (v) => `${v} min` },
    { key: 'radiationDoseMsv', label: 'Radiation', format: (v) => `${v} mSv` },
    { key: 'prepInstructions', label: 'Prep' },
  ],
  ServiceProcedure: [
    { key: 'anaesthesiaType', label: 'Anaesthesia' },
    { key: 'otRequired',      label: 'OT',          format: (v) => (v ? 'required' : 'not required'), includeFalse: true },
    { key: 'durationMinutes', label: 'Duration',    format: (v) => `${v} min` },
    { key: 'postOpStayDays',  label: 'Post-op stay', format: (v) => `${v} day${v === 1 ? '' : 's'}` },
    { key: 'surgeonGrade',    label: 'Surgeon' },
    { key: 'specialty',       label: 'Specialty',   format: (v) => String(v).replace(/_/g, ' ') },
  ],
  ServiceConsumable: [
    { key: 'sku',       label: 'SKU' },
    { key: 'size',      label: 'Size' },
    { key: 'sterile',   label: 'Sterile',    format: (v) => (v ? 'yes' : 'no'), includeFalse: true },
    { key: 'singleUse', label: 'Single-use', format: (v) => (v ? 'yes' : 'no'), includeFalse: true },
    { key: 'unit',      label: 'Unit' },
  ],
};

function isEmpty(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'string' && v.trim() === '');
}

// Returns an array of { label, value } for every subtype column that's populated.
function detailEntries(service) {
  if (!service || !service.subtype || !service.detail) return [];
  const spec = SUBTYPE_FIELDS[service.subtype];
  if (!spec) return [];

  const out = [];
  for (const f of spec) {
    let raw;
    if (typeof f.derive === 'function') {
      raw = f.derive(service.detail);
    } else {
      raw = service.detail[f.key];
    }

    // Booleans: include only when explicitly requested (sterile=false is meaningful;
    // missing fields stay missing).
    if (typeof raw === 'number' && raw === 0 && !f.includeFalse) continue;
    if (typeof raw === 'boolean' && raw === false && !f.includeFalse) continue;
    if (isEmpty(raw)) continue;

    // SQLite stores booleans as 0/1 integers. Surface them as real booleans for formatters.
    let value = raw;
    if (typeof raw === 'number' && (raw === 0 || raw === 1) && f.format && (f.label === 'Sterile' || f.label === 'Single-use' || f.label === 'OT' || f.label === 'Fasting')) {
      value = !!raw;
    }

    out.push({ label: f.label, value: f.format ? f.format(value) : value });
  }
  return out;
}

// One-line summary, comma-separated. Useful on invoice lines.
function summary(service) {
  return detailEntries(service).map((e) => `${e.label}: ${e.value}`).join(', ');
}

// Multi-line description for receipts / PDFs.
function fullDescription(service) {
  if (!service) return '';
  const head = `${service.name} [${service.code}]`;
  const entries = detailEntries(service);
  if (entries.length === 0) return head;
  return head + '\n' + entries.map((e) => `  • ${e.label}: ${e.value}`).join('\n');
}

module.exports = { detailEntries, summary, fullDescription, SUBTYPE_FIELDS };
