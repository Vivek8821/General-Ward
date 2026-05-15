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

  // Fetches the base row plus exactly one subtype-detail row (lab/imaging/procedure/consumable).
  // The subtype is determined by category, with category='misc' falling back to ServiceConsumable.
  async findFull(id, tenantId) {
    const base = await this.findById(id, tenantId);
    if (!base) return null;
    const detail = await this._fetchDetail(base.id, base.category);
    return { ...base, subtype: detail?.subtype || null, detail: detail?.row || null };
  }

  async _fetchDetail(serviceId, category) {
    const SUBTYPE_TABLE = {
      lab: 'ServiceLab',
      imaging: 'ServiceImaging',
      procedure: 'ServiceProcedure',
      misc: 'ServiceConsumable',
    };
    const table = SUBTYPE_TABLE[category];
    if (!table) return null;
    const row = await dbAdapter.get(`SELECT * FROM ${table} WHERE serviceId = ?`, [serviceId]);
    if (!row) return null;
    return { subtype: table, row };
  }

  // Full-text style search across code, name, description.
  // Returns up to 20 results ranked: exact-code > prefix-name > contains-anything.
  async search(query, tenantId) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim();
    const likeAny   = `%${q}%`;
    const likeStart = `${q}%`;
    return dbAdapter.all(
      `SELECT id, code, name, category, unitPrice, description
         FROM ServiceCatalog
        WHERE tenantId = ? AND active = 1
          AND (code LIKE ? OR name LIKE ? OR description LIKE ?)
        ORDER BY
          CASE
            WHEN code  LIKE ? THEN 0
            WHEN name  LIKE ? THEN 1
            ELSE 2
          END,
          name
        LIMIT 20`,
      [tenantId, likeAny, likeAny, likeAny, likeStart, likeStart]
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
