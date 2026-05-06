const crypto = require('crypto');
const dbAdapter = require('../db-adapter');

class WasteRepository {
  /**
   * Insert a new PENDING waste record.
   * @param {Object} data - { tenantId, stockId, batchId?, quantityWasted, unit, reasonCode, reasonNotes?, initiatedByUserId, initiatedByUserName }
   * @param {Object} tx - Optional transaction handle (defaults to dbAdapter)
   * @returns {Object} The created record
   */
  async create(data, tx = dbAdapter) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO WasteRecords (
        id, tenantId, stockId, batchId, quantityWasted, unit,
        reasonCode, reasonNotes, status,
        initiatedByUserId, initiatedByUserName,
        initiatedAt, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    const params = [
      id,
      data.tenantId,
      data.stockId,
      data.batchId || null,
      data.quantityWasted,
      data.unit,
      data.reasonCode,
      data.reasonNotes || null,
      data.initiatedByUserId,
      data.initiatedByUserName
    ];
    await tx.run(sql, params);
    return { id, ...data, status: 'PENDING' };
  }

  /**
   * Find a single waste record by ID, scoped to tenant.
   * Joins PharmacyStock for drug name display.
   * @returns {Object|null}
   */
  async findById(id, tenantId) {
    const sql = `
      SELECT wr.*, ps.name AS stockName, ps.itemUnit
      FROM WasteRecords wr
      JOIN PharmacyStock ps ON wr.stockId = ps.id
      WHERE wr.id = ? AND wr.tenantId = ?
    `;
    return await dbAdapter.get(sql, [id, tenantId]);
  }

  /**
   * List all PENDING waste records for the tenant (witness dashboard).
   * Ordered oldest-first so the most urgent records appear at top.
   */
  async findPendingByTenant(tenantId) {
    const sql = `
      SELECT wr.*, ps.name AS stockName, ps.itemUnit
      FROM WasteRecords wr
      JOIN PharmacyStock ps ON wr.stockId = ps.id
      WHERE wr.tenantId = ? AND wr.status = 'PENDING'
      ORDER BY wr.initiatedAt ASC
    `;
    return await dbAdapter.all(sql, [tenantId]);
  }

  /**
   * Paginated list of all waste records (all statuses) for tenant.
   * Uses cursor pagination pattern (createdAt DESC) matching PurchaseOrderRepository.list.
   * @param {string} tenantId
   * @param {number} limit - Max records to return (default 50)
   * @param {string|null} cursor - ISO timestamp cursor for pagination
   */
  async findAllByTenant(tenantId, limit = 50, cursor = null) {
    let sql = `
      SELECT wr.*, ps.name AS stockName, ps.itemUnit
      FROM WasteRecords wr
      JOIN PharmacyStock ps ON wr.stockId = ps.id
      WHERE wr.tenantId = ?
    `;
    const params = [tenantId];

    if (cursor) {
      sql += ` AND wr.createdAt < ?`;
      params.push(cursor);
    }

    sql += ` ORDER BY wr.createdAt DESC LIMIT ?`;
    params.push(limit);

    return await dbAdapter.all(sql, params);
  }

  /**
   * Mark a waste record as CONFIRMED with witness details and transaction link.
   * Must be called within a withTransaction block for atomicity.
   * @param {string} id
   * @param {string} tenantId
   * @param {Object} updates - { witnessUserId, witnessUserName, pharmacyTransactionId }
   * @param {Object} tx - Transaction handle
   */
  async confirmWaste(id, tenantId, updates, tx = dbAdapter) {
    const sql = `
      UPDATE WasteRecords
      SET status = 'CONFIRMED',
          witnessUserId = ?,
          witnessUserName = ?,
          witnessedAt = CURRENT_TIMESTAMP,
          pharmacyTransactionId = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND tenantId = ? AND status = 'PENDING'
    `;
    return await tx.run(sql, [
      updates.witnessUserId,
      updates.witnessUserName,
      updates.pharmacyTransactionId,
      id,
      tenantId
    ]);
  }

  /**
   * Mark a waste record as CANCELLED. Only valid for PENDING records.
   * @param {string} id
   * @param {string} tenantId
   * @param {Object} tx - Optional transaction handle
   */
  async cancelWaste(id, tenantId, tx = dbAdapter) {
    const sql = `
      UPDATE WasteRecords
      SET status = 'CANCELLED', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND tenantId = ? AND status = 'PENDING'
    `;
    return await tx.run(sql, [id, tenantId]);
  }
}

module.exports = new WasteRepository();
