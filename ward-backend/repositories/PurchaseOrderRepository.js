const dbAdapter = require('../db-adapter');

class PurchaseOrderRepository {
  async create(order, tx = dbAdapter) {
    const sql = `
      INSERT INTO PurchaseOrders (
        id, tenantId, stockId, quantity, status, 
        generatedAt, createdBy, notes
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `;
    return await tx.run(sql, [
      order.id, order.tenantId, order.stockId, order.quantity, order.status || 'pending',
      order.createdBy || 'system', order.notes || null
    ]);
  }

  async findPendingByStockId(stockId, tenantId) {
    const sql = `
      SELECT * FROM PurchaseOrders 
      WHERE stockId = ? AND tenantId = ? AND status IN ('pending', 'ordered')
      LIMIT 1
    `;
    return await dbAdapter.get(sql, [stockId, tenantId]);
  }

  async list(tenantId, limit = 50, cursor = null) {
    let sql = `SELECT * FROM PurchaseOrders WHERE tenantId = ?`;
    const params = [tenantId];

    if (cursor) {
      sql += ` AND generatedAt < ?`;
      params.push(cursor);
    }

    sql += ` ORDER BY generatedAt DESC LIMIT ?`;
    params.push(limit);

    return await dbAdapter.all(sql, params);
  }

  async updateStatus(id, tenantId, status, userId, tx = dbAdapter) {
    let sql = `UPDATE PurchaseOrders SET status = ?, updatedAt = CURRENT_TIMESTAMP`;
    const params = [status];

    if (status === 'ordered') {
      sql += `, orderedAt = CURRENT_TIMESTAMP`;
    } else if (status === 'received') {
      sql += `, receivedAt = CURRENT_TIMESTAMP`;
    }

    sql += ` WHERE id = ? AND tenantId = ?`;
    params.push(id, tenantId);

    return await tx.run(sql, params);
  }

  async findById(id, tenantId) {
    return await dbAdapter.get(`SELECT * FROM PurchaseOrders WHERE id = ? AND tenantId = ?`, [id, tenantId]);
  }
}

module.exports = new PurchaseOrderRepository();
