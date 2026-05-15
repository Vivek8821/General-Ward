const dbAdapter = require('../../db-adapter');

class ServiceCatalogRepository {
  async findAll(tenantId, { category } = {}) {
    const params = [tenantId];
    let sql = `SELECT * FROM ServiceCatalog WHERE tenantId = ? AND active = 1`;
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY category, name`;
    return dbAdapter.all(sql, params);
  }

  async findById(id, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM ServiceCatalog WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }

  async findByCode(code, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM ServiceCatalog WHERE code = ? AND tenantId = ?`,
      [code, tenantId]
    );
  }

  async create({ id, tenantId, code, name, description, category, unitPrice }) {
    await dbAdapter.run(
      `INSERT INTO ServiceCatalog (id, tenantId, code, name, description, category, unitPrice)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, code, name, description ?? null, category, unitPrice]
    );
    return id;
  }

  async update(id, tenantId, { name, description, category, unitPrice, active }) {
    return dbAdapter.run(
      `UPDATE ServiceCatalog
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           category = COALESCE(?, category),
           unitPrice = COALESCE(?, unitPrice),
           active = COALESCE(?, active)
       WHERE id = ? AND tenantId = ?`,
      [name ?? null, description ?? null, category ?? null, unitPrice ?? null, active === undefined ? null : (active ? 1 : 0), id, tenantId]
    );
  }
}

module.exports = new ServiceCatalogRepository();
