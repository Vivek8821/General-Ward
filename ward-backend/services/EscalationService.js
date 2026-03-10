const escalationRepository = require('../repositories/EscalationRepository');
const crypto = require('crypto');

class EscalationService {
    async createEscalation(patientId, reason, escalatedBy) {
        if (!patientId || !reason) {
            throw new Error('Patient ID and reason are required');
        }

        const escalationData = {
            id: crypto.randomUUID(),
            patientId,
            reason,
            escalatedBy
        };

        return await escalationRepository.createEscalationWithStatusUpdate(escalationData);
    }

    async getPendingEscalations() {
        return await escalationRepository.findAllPending();
    }

    async reviewEscalation(escalationId) {
        if (!escalationId) {
            throw new Error('Escalation ID is required');
        }

        return await escalationRepository.reviewEscalationWithStatusUpdate(escalationId);
    }
}

module.exports = new EscalationService();
