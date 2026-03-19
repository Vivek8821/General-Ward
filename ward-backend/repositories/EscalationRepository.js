const { db } = require('../db');

class EscalationRepository {
    createEscalationWithStatusUpdate(escalationData) {
        return new Promise((resolve, reject) => {
            const tenantId = escalationData.tenantId || 'tenant-default';
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                db.run(
                    `INSERT INTO Escalations (id, tenantId, patientId, reason, escalatedBy) VALUES (?, ?, ?, ?, ?)`,
                    [escalationData.id, tenantId, escalationData.patientId, escalationData.reason, escalationData.escalatedBy],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        
                        db.run(
                            `UPDATE Patients SET status = 'escalated' WHERE id = ?`,
                            [escalationData.patientId],
                            function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }
                                
                                db.run('COMMIT', () => {
                                    resolve({ ...escalationData, tenantId, status: 'pending' });
                                });
                            }
                        );
                    }
                );
            });
        });
    }

    findAllPending() {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM Escalations WHERE status = 'pending' ORDER BY timestamp DESC`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    reviewEscalationWithStatusUpdate(escalationId) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                db.run(`UPDATE Escalations SET status = 'reviewed' WHERE id = ?`, [escalationId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    
                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        return reject(new Error('Escalation not found'));
                    }
                    
                    db.get(`SELECT patientId FROM Escalations WHERE id = ?`, [escalationId], (err, row) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        
                        if (row) {
                            db.run(`UPDATE Patients SET status = 'active' WHERE id = ? AND status = 'escalated'`, [row.patientId], function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }
                                
                                db.run('COMMIT', () => {
                                    resolve({ message: 'Escalation marked as reviewed' });
                                });
                            });
                        } else {
                            db.run('COMMIT', () => {
                                resolve({ message: 'Escalation marked as reviewed (Patient not found to update)' });
                            });
                        }
                    });
                });
            });
        });
    }
}

module.exports = new EscalationRepository();
