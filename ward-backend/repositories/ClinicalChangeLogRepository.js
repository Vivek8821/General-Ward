const crypto = require('crypto');
const { runAsync } = require('../db');

/**
 * @param {object} row
 * @param {string} row.tenantId
 * @param {string} row.userId
 * @param {string} row.userRole
 * @param {string} row.entityType
 * @param {string} row.entityId
 * @param {string} row.action
 * @param {string} [row.summary]
 */
async function insert(row) {
  const id = crypto.randomUUID();
  const tenantId = row.tenantId || 'tenant-default';
  await runAsync(
    `INSERT INTO ClinicalChangeLog (id, tenantId, userId, userRole, entityType, entityId, action, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      row.userId,
      row.userRole,
      row.entityType,
      row.entityId,
      row.action,
      row.summary ?? null,
    ]
  );
  return id;
}

module.exports = { insert };
