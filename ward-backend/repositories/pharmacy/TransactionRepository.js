const dbAdapter = require('../../db-adapter');

class TransactionRepository {
  async recordTransaction(tx, db = dbAdapter) {
    const sql = `
      INSERT INTO PharmacyTransactions (
        id, tenantId, medicationId, type, quantity, 
        userId, userName, patientId, notes, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const params = [
      tx.id,
      tx.tenantId,
      tx.medicationId,
      tx.type,
      tx.quantity,
      tx.userId,
      tx.userName,
      tx.patientId || null,
      tx.notes || null
    ];
    return await db.run(sql, params);
  }

  async listTransactions(tenantId, medicationId = null) {
    let sql = `SELECT * FROM PharmacyTransactions WHERE tenantId = ?`;
    const params = [tenantId];
    
    if (medicationId) {
      sql += ` AND medicationId = ?`;
      params.push(medicationId);
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT 100`;
    return await dbAdapter.all(sql, params);
  }

  async getDispenseHistory(tenantId, daysLookback) {
    const sql = `
      SELECT medicationId, SUM(ABS(quantity)) as totalDispensed
      FROM PharmacyTransactions
      WHERE tenantId = ? 
        AND type = 'dispense' 
        AND timestamp >= datetime('now', '-' || ? || ' days')
      GROUP BY medicationId
    `;
    return await dbAdapter.all(sql, [tenantId, daysLookback]);
  }
}

module.exports = new TransactionRepository();
