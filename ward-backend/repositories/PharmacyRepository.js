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

  // ── Batch / Lot Tracking ──────────────────────────────────────────

  async listBatches(stockId, tenantId) {
    const sql = `SELECT * FROM PharmacyBatches WHERE stockId = ? AND tenantId = ? ORDER BY expiryDate ASC`;
    return await dbAdapter.all(sql, [stockId, tenantId]);
  }

  async listActiveBatches(stockId, tenantId) {
    const sql = `SELECT * FROM PharmacyBatches WHERE stockId = ? AND tenantId = ? AND status = 'active' ORDER BY expiryDate ASC`;
    return await dbAdapter.all(sql, [stockId, tenantId]);
  }

  async findBatchById(id, tenantId) {
    const sql = `SELECT * FROM PharmacyBatches WHERE id = ? AND tenantId = ?`;
    return await dbAdapter.get(sql, [id, tenantId]);
  }

  async findBatchByLot(batchNumber, tenantId) {
    const sql = `
      SELECT pb.*, ps.name AS drugName, ps.composition
      FROM PharmacyBatches pb
      JOIN PharmacyStock ps ON pb.stockId = ps.id
      WHERE pb.batchNumber = ? AND pb.tenantId = ?
    `;
    return await dbAdapter.all(sql, [batchNumber, tenantId]);
  }

  async createBatch(data) {
    const sql = `
      INSERT INTO PharmacyBatches (
        id, tenantId, stockId, batchNumber, expiryDate,
        quantity, costPerUnit, manufacturer, receivedDate,
        status, notes, createdAt, lastUpdated
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    const params = [
      data.id,
      data.tenantId,
      data.stockId,
      data.batchNumber,
      data.expiryDate,
      data.quantity || 0,
      data.costPerUnit || 0,
      data.manufacturer || null,
      data.receivedDate || null,
      data.status || 'active',
      data.notes || null
    ];
    return await dbAdapter.run(sql, params);
  }

  async updateBatchQuantity(id, tenantId, quantity, db = dbAdapter) {
    const sql = `
      UPDATE PharmacyBatches
      SET quantity = ?, lastUpdated = CURRENT_TIMESTAMP
      WHERE id = ? AND tenantId = ?
    `;
    return await db.run(sql, [quantity, id, tenantId]);
  }

  async updateBatchStatus(id, tenantId, status, db = dbAdapter) {
    const sql = `
      UPDATE PharmacyBatches
      SET status = ?, lastUpdated = CURRENT_TIMESTAMP
      WHERE id = ? AND tenantId = ?
    `;
    return await db.run(sql, [status, id, tenantId]);
  }

  async getFefoCandidate(stockId, tenantId) {
    const sql = `
      SELECT * FROM PharmacyBatches
      WHERE stockId = ? AND tenantId = ? AND status = 'active' AND quantity > 0
      ORDER BY expiryDate ASC
      LIMIT 1
    `;
    return await dbAdapter.get(sql, [stockId, tenantId]);
  }

  async listAllBatchesByTenant(tenantId) {
    const sql = `
      SELECT pb.*, ps.name AS drugName, ps.composition
      FROM PharmacyBatches pb
      JOIN PharmacyStock ps ON pb.stockId = ps.id
      WHERE pb.tenantId = ?
      ORDER BY pb.expiryDate ASC
    `;
    return await dbAdapter.all(sql, [tenantId]);
  }

  async sumActiveBatchQuantity(stockId, tenantId) {
    const sql = `
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM PharmacyBatches
      WHERE stockId = ? AND tenantId = ? AND status = 'active'
    `;
    const row = await dbAdapter.get(sql, [stockId, tenantId]);
    return row ? row.total : 0;
  }

  async getDispenseTransactionsForBatch(batchId, tenantId) {
    // PharmacyTransactions stores batchId in notes as "batchId:XXX" for traceability
    const sql = `
      SELECT * FROM PharmacyTransactions
      WHERE tenantId = ? AND type = 'dispense' AND notes LIKE ?
      ORDER BY timestamp DESC
    `;
    return await dbAdapter.all(sql, [tenantId, `%batchId:${batchId}%`]);
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

  async delete(id, tenantId) {
    const sql = `DELETE FROM PharmacyStock WHERE id = ? AND tenantId = ?`;
    return await dbAdapter.run(sql, [id, tenantId]);
  }
}

module.exports = new PharmacyRepository();

