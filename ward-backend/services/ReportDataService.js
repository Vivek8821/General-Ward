const crypto = require('crypto');
const patientRepository = require('../repositories/PatientRepository');
const medicationRepository = require('../repositories/MedicationRepository');
const observationRepository = require('../repositories/ObservationRepository');
const handoverNotesRepository = require('../repositories/HandoverNotesRepository');
const escalationRepository = require('../repositories/EscalationRepository');
const taskRepository = require('../repositories/TaskRepository');
const medicalHistoryRepo = require('../repositories/MedicalHistoryRepository');
const structuredAllergyRepo = require('../repositories/StructuredAllergyRepository');
const clinicalPresentationRepo = require('../repositories/ClinicalPresentationRepository');
const labInvestigationRepo = require('../repositories/LabInvestigationRepository');
const imagingReportRepo = require('../repositories/ImagingReportRepository');
const clinicalProcedureRepo = require('../repositories/ClinicalProcedureRepository');
const clinicalTeamRepo = require('../repositories/ClinicalTeamRepository');
const toxicologyScreenRepo = require('../repositories/ToxicologyScreenRepository');
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
    if (!config.jwtSecret) {
      throw new Error('[ReportDataService] JWT_SECRET is required for report HMAC signing');
    }
    const globalSecret = config.jwtSecret;
    
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

  async aggregateDischargeReportData(patientId, tenantId) {
    const [
      baseData,
      medicalHistory,
      structuredAllergies,
      clinicalPresentation,
      labInvestigations,
      imagingReports,
      clinicalProcedures,
      clinicalTeam,
      toxicologyScreen,
    ] = await Promise.all([
      this.aggregatePatientData(patientId, tenantId),
      medicalHistoryRepo.getByPatient(patientId, tenantId),
      structuredAllergyRepo.getByPatient(patientId, tenantId),
      clinicalPresentationRepo.getByPatient(patientId, tenantId),
      labInvestigationRepo.getByPatient(patientId, tenantId),
      imagingReportRepo.getByPatient(patientId, tenantId),
      clinicalProcedureRepo.getByPatient(patientId, tenantId),
      clinicalTeamRepo.getByPatient(patientId, tenantId),
      toxicologyScreenRepo.getByPatient(patientId, tenantId),
    ]);

    return {
      ...baseData,
      // Normalize key names for ClinicalDischargeReportService
      dischargeSummary: baseData.discharge || null,
      dailyStats: [
        ...(baseData.vitals || []).map(v => ({ ...v, type: 'vital' })),
        ...(baseData.diet || []).map(d => ({ ...d, type: 'diet' })),
        ...(baseData.sleep || []).map(s => ({ ...s, type: 'sleep' })),
      ],
      handoverNotes: baseData.notes || [],
      medicalHistory: medicalHistory || null,
      structuredAllergies: structuredAllergies || [],
      clinicalPresentation: clinicalPresentation || null,
      labInvestigations: labInvestigations || [],
      imagingReports: imagingReports || [],
      clinicalProcedures: clinicalProcedures || [],
      clinicalTeam: clinicalTeam || [],
      toxicologyScreen: toxicologyScreen || null,
    };
  }
}

module.exports = new ReportDataService();
