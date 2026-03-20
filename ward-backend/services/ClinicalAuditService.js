const clinicalChangeLogRepository = require('../repositories/ClinicalChangeLogRepository');

const PATIENT_UPDATE_KEYS = ['name', 'bedNumber', 'dob', 'diagnosis', 'allergies', 'careIntensity'];

/**
 * Records which patient fields were touched (field names only; not values — reduces PHI in the log).
 */
async function recordPatientUpdate({ tenantId, user, patientId, body }) {
  if (!body || typeof body !== 'object') return;
  const touched = PATIENT_UPDATE_KEYS.filter((k) =>
    Object.prototype.hasOwnProperty.call(body, k)
  );
  if (touched.length === 0) return;

  const summary = `patient update; fields=${touched.join(',')}`;
  await clinicalChangeLogRepository.insert({
    tenantId: tenantId || 'tenant-default',
    userId: user?.id || 'unknown',
    userRole: user?.role || 'unknown',
    entityType: 'patient',
    entityId: patientId,
    action: 'update',
    summary,
  });
}

module.exports = { recordPatientUpdate };
