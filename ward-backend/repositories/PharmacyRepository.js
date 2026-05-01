const dbAdapter = require('../dbAdapter');

class PharmacyRepository {
  async listStock(tenantId) {
    const sql = `SELECT * FROM PharmacyStock WHERE tenantId = ? ORDER BY name ASC`;
    return await dbAdapter.all(sql, [tenantId]);
  }

  async findById(id, tenantId) {
    const sql = `SELECT * FROM PharmacyStock WHERE id = ? AND tenantId = ?`;
    return await dbAdapter.get(sql, [id, tenantId]);
  }

  async findByName(name, tenantId) {
    const sql = `SELECT * FROM PharmacyStock WHERE name = ? AND tenantId = ?`;
    return await dbAdapter.get(sql, [name, tenantId]);
  }

  async create(data) {
    const sql = `
      INSERT INTO PharmacyStock (
        id, tenantId, name, composition, type, category, 
        quantityPerUnit, totalUnits, totalQuantity, unit, itemUnit,
        costPerUnit, expiryDate, manufacturer, minThreshold, lastUpdated
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const params = [
      data.id,
      data.tenantId,
      data.name,
      data.composition || null,
      data.type || null,
      data.category || null,
      data.quantityPerUnit || 1,
      data.totalUnits || 0,
      data.totalQuantity || 0,
      data.unit || 'unit',
      data.itemUnit || 'items',
      data.costPerUnit || 0,
      data.expiryDate || null,
      data.manufacturer || null,
      data.minThreshold || 10
    ];
    return await dbAdapter.run(sql, params);
  }

  async updateStock(id, tenantId, totalUnits) {
    // We need the quantityPerUnit to update totalQuantity correctly
    const item = await this.findById(id, tenantId);
    if (!item) return { changes: 0 };

    const totalQuantity = totalUnits * (item.quantityPerUnit || 1);
    const sql = `
      UPDATE PharmacyStock 
      SET totalUnits = ?, totalQuantity = ?, lastUpdated = CURRENT_TIMESTAMP
      WHERE id = ? AND tenantId = ?
    `;
    return await dbAdapter.run(sql, [totalUnits, totalQuantity, id, tenantId]);
  }

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

  async delete(id, tenantId) {
    const sql = `DELETE FROM PharmacyStock WHERE id = ? AND tenantId = ?`;
    return await dbAdapter.run(sql, [id, tenantId]);
  }
}

module.exports = new PharmacyRepository();
