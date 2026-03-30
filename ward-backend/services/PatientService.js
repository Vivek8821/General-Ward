const patientRepository = require('../repositories/PatientRepository');
const crypto = require('crypto');

class PatientService {
    async createPatient(data) {
        const { name, mrn, bedNumber, dob, diagnosis, careIntensity } = data;
        
        if (!name || !mrn || !bedNumber || !dob || !diagnosis) {
            throw new Error('Missing required fields');
        }

        // Basic MRN validation: should be a non-empty string, maybe alphanumeric
        if (typeof mrn !== 'string' || mrn.length < 3) {
            throw new Error('Invalid MRN format');
        }

        // Basic DOB validation: ensure it's a valid date string
        if (isNaN(Date.parse(dob))) {
            throw new Error('Invalid Date of Birth');
        }
        
        const tenantId = data.tenantId || 'tenant-default';
        const newPatient = {
            id: crypto.randomUUID(),
            ...data,
            tenantId,
            careIntensity: Math.max(1, Math.min(4, careIntensity || 1))
        };
        
        return await patientRepository.create(newPatient);
    }

    async getAllPatients(tenantId) {
        return await patientRepository.findAll(tenantId);
    }

    async getArchivedPatients(tenantId) {
        return await patientRepository.findArchived(tenantId);
    }

    async getPatientById(id, tenantId) {
        const patient = await patientRepository.findById(id, tenantId);
        if (!patient) {
            throw new Error('Patient not found');
        }
        return patient;
    }

    async getDischargeSummary(patientId, tenantId) {
        const summary = await patientRepository.findDischargeSummary(patientId, tenantId);
        if (!summary) {
            throw new Error('Summary not found');
        }
        return summary;
    }

    async updatePatient(id, data, tenantId) {
        const changes = await patientRepository.update(id, data, tenantId);
        if (changes === 0) {
            throw new Error('Patient not found');
        }
        return { message: 'Patient updated successfully' };
    }

    async dischargePatient(id, data, dischargedBy, tenantId) {
        if (!data || !data.reasonForAdmission || !data.duration || !data.dischargeVitals) {
            throw new Error('Missing required discharge fields');
        }

        const tenant = tenantId || 'tenant-default';
        return patientRepository.discharge(id, data, dischargedBy, tenant);
    }

    async getHospitalArchive(archiveId, tenantId) {
        const row = await patientRepository.findArchiveById(archiveId, tenantId);
        if (!row) {
            throw new Error('Archive not found');
        }
        return row;
    }
}

module.exports = new PatientService();
