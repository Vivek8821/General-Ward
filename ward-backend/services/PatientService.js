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
        
        const newPatient = {
            id: crypto.randomUUID(),
            ...data,
            careIntensity: Math.max(1, Math.min(4, careIntensity || 1))
        };
        
        return await patientRepository.create(newPatient);
    }

    async getAllPatients() {
        return await patientRepository.findAll();
    }

    async getArchivedPatients() {
        return await patientRepository.findArchived();
    }

    async getPatientById(id) {
        const patient = await patientRepository.findById(id);
        if (!patient) {
            throw new Error('Patient not found');
        }
        return patient;
    }

    async getDischargeSummary(patientId) {
        const summary = await patientRepository.findDischargeSummary(patientId);
        if (!summary) {
            throw new Error('Summary not found');
        }
        return summary;
    }

    async updatePatient(id, data) {
        const changes = await patientRepository.update(id, data);
        if (changes === 0) {
            throw new Error('Patient not found');
        }
        return { message: 'Patient updated successfully' };
    }

    async dischargePatient(id, data, dischargedBy) {
        if (!data || !data.reasonForAdmission || !data.duration || !data.dischargeVitals) {
            throw new Error('Missing required discharge fields');
        }

        const result = await patientRepository.discharge(id, data, dischargedBy);

        if (!result || result.updated === 0 || result.message === 'Patient not found') {
            throw new Error('Patient not found');
        }

        return result;
    }
}

module.exports = new PatientService();
