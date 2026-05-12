const dbAdapter = require('../db-adapter');

class EscalationRepository {
    async createEscalationWithStatusUpdate(escalationData) {
        const tenantId = escalationData.tenantId || 'tenant-default';
        return dbAdapter.withTransaction(async ({ runAsync }) => {
            await runAsync(
                `INSERT INTO Escalations (id, tenantId, patientId, reason, escalatedBy) VALUES (?, ?, ?, ?, ?)`,
                [escalationData.id, tenantId, escalationData.patientId, escalationData.reason, escalationData.escalatedBy]
            );

            const upd = await runAsync(
                `UPDATE Patients SET status = 'escalated' WHERE id = ? AND tenantId = ?`,
                [escalationData.patientId, tenantId]
            );

            if (!upd || upd.changes === 0) {
                throw new Error('Patient not found');
            }

            return { ...escalationData, tenantId, status: 'pending' };
        });
    }

    async findAllPending(tenantId) {
        const tenant = tenantId || 'tenant-default';
        return dbAdapter.all(
            `SELECT * FROM Escalations WHERE tenantId = ? AND status = 'pending' ORDER BY timestamp DESC`,
            [tenant]
        );
    }

    async reviewEscalationWithStatusUpdate(escalationId, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return dbAdapter.withTransaction(async ({ runAsync, getAsync }) => {
            const row = await getAsync(
                `SELECT patientId FROM Escalations WHERE id = ? AND tenantId = ?`,
                [escalationId, tenant]
            );

            if (!row) {
                throw new Error('Escalation not found');
            }

            await runAsync(
                `UPDATE Escalations SET status = 'reviewed' WHERE id = ? AND tenantId = ?`,
                [escalationId, tenant]
            );

            if (row.patientId) {
                await runAsync(
                    `UPDATE Patients SET status = 'active' WHERE id = ? AND status = 'escalated' AND tenantId = ?`,
                    [row.patientId, tenant]
                );
            }

            return { message: 'Escalation marked as reviewed' };
        });
    }

    async findAllByPatientId(patientId, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return dbAdapter.all(
            `SELECT * FROM Escalations WHERE patientId = ? AND tenantId = ? ORDER BY timestamp DESC`,
            [patientId, tenant]
        );
    }
}

module.exports = new EscalationRepository();
