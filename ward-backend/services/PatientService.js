const patientRepository = require('../repositories/PatientRepository');
const crypto = require('crypto');

class PatientService {
    async createPatient(data) {
        if (!data.name || !data.mrn || !data.bedNumber || !data.dob || !data.diagnosis) {
            throw new Error('Missing required fields');
        }
        
        const newPatient = {
            id: crypto.randomUUID(),
            ...data
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
        if (!data.reasonForAdmission || !data.duration || !data.dischargeVitals) {
             throw new Error("Missing required discharge fields");
        }
        return await patientRepository.discharge(id, data, dischargedBy);
    }
}

module.exports = new PatientService();
