const crypto = require('crypto');
const patientRepository = require('../repositories/PatientRepository');
const medicationRepository = require('../repositories/MedicationRepository');
const observationRepository = require('../repositories/ObservationRepository');
const handoverNotesRepository = require('../repositories/HandoverNotesRepository');
const escalationRepository = require('../repositories/EscalationRepository');
const taskRepository = require('../repositories/TaskRepository');
const scoringService = require('./ScoringService');
const config = require('../config');

class ReportDataService {
  /**
   * Aggregates all clinical data for a patient across all domains.
   */
  async aggregatePatientData(patientId, tenantId) {
    const [
      patient,
      allStats,
      medications,
      administrations,
      notes,
      escalations,
      tasks,
      dischargeSummary
    ] = await Promise.all([
      patientRepository.findById(patientId, tenantId),
      observationRepository.findAllByPatientId(patientId, tenantId, {}),
      medicationRepository.findAllByPatientId(patientId, tenantId),
      medicationRepository.findAdministrationsByPatientId(patientId, tenantId, { limit: 1000 }),
      handoverNotesRepository.listByPatient(patientId, tenantId),
      escalationRepository.findAllByPatientId(patientId, tenantId),
      taskRepository.listByPatient(patientId, tenantId, 'open'),
      patientRepository.findDischargeSummary(patientId, tenantId)
    ]);

    if (!patient) {
      throw new Error('Patient not found');
    }

    // Group stats by type
    const vitals = allStats.filter(s => s.type === 'vital').reverse(); // ASC order for timeline
    const diet = allStats.filter(s => s.type === 'diet').reverse();
    const sleep = allStats.filter(s => s.type === 'sleep').reverse();

    // Compute NEWS2 history
    const scoring = vitals.map(v => {
      const data = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
      return {
        timestamp: v.timestamp,
        ...scoringService.calculateFromVital(data, v.timestamp)
      };
    });

    return {
      patient,
      vitals: vitals.map(v => ({ ...v, data: typeof v.data === 'string' ? JSON.parse(v.data) : v.data })),
      diet: diet.map(d => ({ ...d, data: typeof d.data === 'string' ? JSON.parse(d.data) : d.data })),
      sleep: sleep.map(s => ({ ...s, data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data })),
      medications,
      administrations,
      notes,
      escalations,
      tasks,
      scoring,
      discharge: dischargeSummary || null
    };
  }

  /**
   * Serializes data and computes a tamper-evident HMAC hash.
   */
  computeReportHash(aggregatedData) {
    const tenantId = aggregatedData.patient?.tenantId || 'tenant-default';
    const globalSecret = config.jwtSecret || 'default-secret';
    
    // Derive a unique secret per tenant for reporting signatures.
    // This ensures that even if one tenant's report signatures are leaked/cracked,
    // others remain secure, and prevents cross-tenant signature reuse.
    const tenantSecret = crypto
      .createHmac('sha256', globalSecret)
      .update(tenantId)
      .digest('hex');

    // Canonical serialization: Sort keys alphabetically
    const canonical = this._canonicalStringify(aggregatedData);
    
    return crypto
      .createHmac('sha256', tenantSecret)
      .update(canonical)
      .digest('hex');
  }

  /**
   * Recursively stringifies an object with keys sorted alphabetically.
   */
  _canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this._canonicalStringify(item)).join(',') + ']';
    }

    const keys = Object.keys(obj).sort();
    return '{' + keys
      .map(key => `${JSON.stringify(key)}:${this._canonicalStringify(obj[key])}`)
      .join(',') + '}';
  }
}

module.exports = new ReportDataService();
