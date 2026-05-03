const dbAdapter = require('../dbAdapter');

class BarcodeRepository {
  /**
   * Resolves a barcode to either a batch or stock record.
   * Batch match takes priority.
   */
  async resolveByBarcode(tenantId, barcode) {
    // 1. Try Batch match
    const batchMatch = await dbAdapter.get(`
      SELECT b.*, s.name, s.composition, s.type as stockType, s.category, s.unit, s.itemUnit, s.totalQuantity as aggregateStock
      FROM PharmacyBatches b
      JOIN PharmacyStock s ON b.stockId = s.id
      WHERE b.barcode = ? AND b.tenantId = ?
    `, [barcode, tenantId]);

    if (batchMatch) {
      return { matchType: 'BATCH', data: batchMatch };
    }

    // 2. Try Stock match
    const stockMatch = await dbAdapter.get(`
      SELECT * FROM PharmacyStock
      WHERE barcode = ? AND tenantId = ?
    `, [barcode, tenantId]);

    if (stockMatch) {
      // Get active batches for this stock in FEFO order
      const batches = await dbAdapter.all(`
        SELECT * FROM PharmacyBatches
        WHERE stockId = ? AND tenantId = ? AND status = 'active'
        ORDER BY expiryDate ASC
      `, [stockMatch.id, tenantId]);
      
      return { matchType: 'STOCK', data: { ...stockMatch, batches } };
    }

    return null;
  }

  async findConflict(barcode) {
    // Check stock
    const stock = await dbAdapter.get(`SELECT tenantId, name FROM PharmacyStock WHERE barcode = ?`, [barcode]);
    if (stock) return { targetType: 'STOCK', tenantId: stock.tenantId, name: stock.name };

    // Check batches
    const batch = await dbAdapter.get(`
      SELECT b.tenantId, s.name 
      FROM PharmacyBatches b
      JOIN PharmacyStock s ON b.stockId = s.id
      WHERE b.barcode = ?
    `, [barcode]);
    if (batch) return { targetType: 'BATCH', tenantId: batch.tenantId, name: batch.name };

    return null;
  }

  async registerStockBarcode(tenantId, stockId, barcode, userId, notes) {
    return dbAdapter.withTransaction(async (tx) => {
      await tx.runAsync(`UPDATE PharmacyStock SET barcode = ? WHERE id = ? AND tenantId = ?`, [barcode, stockId, tenantId]);
      await tx.runAsync(`
        INSERT INTO BarcodeRegistrations (tenantId, targetType, targetId, barcode, registeredBy, notes)
        VALUES (?, 'STOCK', ?, ?, ?, ?)
      `, [tenantId, stockId, barcode, userId, notes]);
    });
  }

  async registerBatchBarcode(tenantId, batchId, barcode, userId, notes) {
    return dbAdapter.withTransaction(async (tx) => {
      await tx.runAsync(`UPDATE PharmacyBatches SET barcode = ? WHERE id = ? AND tenantId = ?`, [barcode, batchId, tenantId]);
      await tx.runAsync(`
        INSERT INTO BarcodeRegistrations (tenantId, targetType, targetId, barcode, registeredBy, notes)
        VALUES (?, 'BATCH', ?, ?, ?, ?)
      `, [tenantId, batchId, barcode, userId, notes]);
    });
  }

  async getRegistrationHistory(tenantId, barcode) {
    return dbAdapter.all(`
      SELECT br.*, u.name as userName
      FROM BarcodeRegistrations br
      LEFT JOIN Users u ON br.registeredBy = u.id
      WHERE br.barcode = ? AND br.tenantId = ?
      ORDER BY br.registeredAt DESC
    `, [barcode, tenantId]);
  }
}

module.exports = new BarcodeRepository();
