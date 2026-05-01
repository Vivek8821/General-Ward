const clinicalChangeLogRepository = require('../repositories/ClinicalChangeLogRepository');

const PATIENT_UPDATE_KEYS = ['name', 'bedNumber', 'dob', 'diagnosis', 'allergies', 'careIntensity'];

/**
 * Generic clinical audit service to record changes to patient data.
 * This provides a clinical-level audit trail separate from the technical request logs.
 */
class ClinicalAuditService {
  /**
   * Records which patient fields were touched.
   */
  async recordPatientUpdate({ tenantId, user, patientId, body }) {
    if (!body || typeof body !== 'object') return;
    const touched = PATIENT_UPDATE_KEYS.filter((k) =>
      Object.prototype.hasOwnProperty.call(body, k)
    );
    if (touched.length === 0) return;

    const summary = `patient update; fields=${touched.join(',')}`;
    await this._log({
      tenantId,
      user,
      entityType: 'patient',
      entityId: patientId,
      action: 'update',
      summary,
    });
  }

  /**
   * Records medication prescribing or status changes.
   */
  async recordMedicationAction({ tenantId, user, patientId, medicationId, action, details }) {
    const summary = details ? `medication ${action}: ${details}` : `medication ${action}`;
    await this._log({
      tenantId,
      user,
      entityType: 'medication',
      entityId: medicationId,
      action,
      summary,
    });
  }

  /**
   * Records administration of medication.
   */
  async recordMedicationAdministration({ tenantId, user, patientId, medicationId, administrationId, status }) {
    const summary = `medication administration: status=${status}`;
    await this._log({
      tenantId,
      user,
      entityType: 'medication_administration',
      entityId: administrationId,
      action: 'administer',
      summary,
    });
  }

  /**
   * Records recording of vital signs or other clinical observations.
   */
  async recordClinicalObservation({ tenantId, user, patientId, observationId, type }) {
    const summary = `recorded clinical observation: type=${type}`;
    await this._log({
      tenantId,
      user,
      entityType: 'observation',
      entityId: observationId,
      action: 'create',
      summary,
    });
  }

  /**
   * Internal helper to write to the repository.
   */
  async _log({ tenantId, user, entityType, entityId, action, summary }) {
    try {
      await clinicalChangeLogRepository.insert({
        tenantId: tenantId || 'tenant-default',
        userId: user?.id || 'unknown',
        userRole: user?.role || 'unknown',
        entityType,
        entityId,
        action,
        summary,
      });
    } catch (err) {
      // We don't want audit failures to crash the primary business flow, 
      // but we should definitely log them.
      console.error(`[ClinicalAuditService] Failed to record audit log: ${err.message}`);
    }
  }
}

module.exports = new ClinicalAuditService();
