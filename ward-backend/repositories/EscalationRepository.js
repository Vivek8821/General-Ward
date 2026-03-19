const { db, withTransaction } = require('../db');

class EscalationRepository {
    createEscalationWithStatusUpdate(escalationData) {
        const tenantId = escalationData.tenantId || 'tenant-default';
        return withTransaction(async ({ runAsync }) => {
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

    findAllPending(tenantId) {
        const tenant = tenantId || 'tenant-default';
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM Escalations WHERE tenantId = ? AND status = 'pending' ORDER BY timestamp DESC`,
                [tenant],
                (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
                }
            );
        });
    }

    reviewEscalationWithStatusUpdate(escalationId, tenantId) {
        const tenant = tenantId || 'tenant-default';
        return withTransaction(async ({ runAsync, getAsync }) => {
            const updEsc = await runAsync(
                `UPDATE Escalations SET status = 'reviewed' WHERE id = ? AND tenantId = ?`,
                [escalationId, tenant]
            );

            if (!updEsc || updEsc.changes === 0) {
                throw new Error('Escalation not found');
            }

            const row = await getAsync(
                `SELECT patientId FROM Escalations WHERE id = ? AND tenantId = ?`,
                [escalationId, tenant]
            );

            if (row?.patientId) {
                await runAsync(
                    `UPDATE Patients SET status = 'active' WHERE id = ? AND status = 'escalated' AND tenantId = ?`,
                    [row.patientId, tenant]
                );
                return { message: 'Escalation marked as reviewed' };
            }

            return { message: 'Escalation marked as reviewed (Patient not found to update)' };
        });
    }
}

module.exports = new EscalationRepository();
