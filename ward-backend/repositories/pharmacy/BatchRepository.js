const dbAdapter = require('../../dbAdapter');

class BatchRepository {
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
}

module.exports = new BatchRepository();
