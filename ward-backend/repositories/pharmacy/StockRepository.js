const dbAdapter = require('../../dbAdapter');

class StockRepository {
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

  async delete(id, tenantId) {
    const sql = `DELETE FROM PharmacyStock WHERE id = ? AND tenantId = ?`;
    return await dbAdapter.run(sql, [id, tenantId]);
  }
}

module.exports = new StockRepository();
