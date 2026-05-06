const crypto = require('crypto');
const stockRepo = require('../../repositories/pharmacy/StockRepository');
const batchRepo = require('../../repositories/pharmacy/BatchRepository');
const txRepo = require('../../repositories/pharmacy/TransactionRepository');
const dbAdapter = require('../../db-adapter');

class BatchService {
  async addBatch(stockId, tenantId, batchData, user) {
    const item = await stockRepo.findById(stockId, tenantId);
    if (!item) throw new Error('Stock item not found');

    if (!batchData.batchNumber) throw new Error('Batch number is required');
    if (!batchData.expiryDate) throw new Error('Expiry date is required');

    const batchQty = parseInt(batchData.quantity) || 0;
    if (batchQty <= 0) throw new Error('Batch quantity must be positive');

    const batchId = crypto.randomUUID();

    return await dbAdapter.withTransaction(async (tx) => {
      // Create the batch
      await tx.run(`
        INSERT INTO PharmacyBatches (
          id, tenantId, stockId, batchNumber, expiryDate,
          quantity, costPerUnit, manufacturer, receivedDate,
          status, notes, createdAt, lastUpdated
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        batchId, tenantId, stockId, batchData.batchNumber, batchData.expiryDate,
        batchQty, batchData.costPerUnit || 0, batchData.manufacturer || null,
        batchData.receivedDate || new Date().toISOString().split('T')[0],
        batchData.notes || null
      ]);

      // Update aggregate stock totals atomically
      await tx.runAsync(`
        UPDATE PharmacyStock
        SET totalQuantity = totalQuantity + ?, 
            lastUpdated = CURRENT_TIMESTAMP
        WHERE id = ? AND tenantId = ?
      `, [batchQty, stockId, tenantId]);

      // Re-fetch to sync totalUnits
      const updatedItem = await tx.getAsync(`SELECT totalQuantity, quantityPerUnit FROM PharmacyStock WHERE id = ?`, [stockId]);
      const newTotalQuantity = updatedItem.totalQuantity;
      const newTotalUnits = Math.floor(updatedItem.totalQuantity / (updatedItem.quantityPerUnit || 1));
      
      await tx.runAsync(`
        UPDATE PharmacyStock
        SET totalUnits = ?
        WHERE id = ? AND tenantId = ?
      `, [newTotalUnits, stockId, tenantId]);

      // Record restock transaction
      await txRepo.recordTransaction({
        id: crypto.randomUUID(),
        tenantId,
        medicationId: stockId,
        type: 'restock',
        quantity: batchQty,
        userId: user.id || 'system',
        userName: user.name || 'System',
        notes: `Batch restock: ${batchData.batchNumber} (batchId:${batchId})`
      }, tx);

      return { batchId, stockId, newTotalQuantity };
    });
  }

  async getBatches(stockId, tenantId) {
    const item = await stockRepo.findById(stockId, tenantId);
    if (!item) throw new Error('Stock item not found');
    return await batchRepo.listBatches(stockId, tenantId);
  }

  async recallBatch(batchId, tenantId, user, reason) {
    if (!reason) throw new Error('Recall reason is required');

    const batch = await batchRepo.findBatchById(batchId, tenantId);
    if (!batch) throw new Error('Batch not found');

    const item = await stockRepo.findById(batch.stockId, tenantId);
    if (!item) throw new Error('Associated stock item not found');

    return await dbAdapter.withTransaction(async (tx) => {
      const remainingQty = batch.quantity;

      // Mark batch as recalled
      await batchRepo.updateBatchStatus(batchId, tenantId, 'recalled', tx);

      // If there was remaining stock, record it as waste
      if (remainingQty > 0) {
        const newTotalQuantity = item.totalQuantity - remainingQty;
        const newTotalUnits = Math.floor(Math.max(0, newTotalQuantity) / (item.quantityPerUnit || 1));
        await tx.run(`
          UPDATE PharmacyStock
          SET totalUnits = ?, totalQuantity = ?, lastUpdated = CURRENT_TIMESTAMP
          WHERE id = ? AND tenantId = ?
        `, [newTotalUnits, newTotalQuantity, batch.stockId, tenantId]);

        await txRepo.recordTransaction({
          id: crypto.randomUUID(),
          tenantId,
          medicationId: batch.stockId,
          type: 'waste',
          quantity: -remainingQty,
          userId: user.id || 'system',
          userName: user.name || 'System',
          notes: `RECALL: ${reason}. Batch: ${batch.batchNumber} (batchId:${batchId}). ${remainingQty} units wasted.`
        }, tx);
      }

      return {
        recalled: true,
        batchNumber: batch.batchNumber,
        drugName: item.name,
        quantityWasted: remainingQty,
        reason
      };
    });
  }

  async getRecallTrace(batchId, tenantId) {
    const batch = await batchRepo.findBatchById(batchId, tenantId);
    if (!batch) throw new Error('Batch not found');

    const transactions = await batchRepo.getDispenseTransactionsForBatch(batchId, tenantId);
    return {
      batch,
      affectedTransactions: transactions,
      affectedPatientIds: [...new Set(transactions.filter(t => t.patientId).map(t => t.patientId))]
    };
  }

  async syncStockTotals(stockId, tenantId) {
    const item = await stockRepo.findById(stockId, tenantId);
    if (!item) throw new Error('Stock item not found');

    const batchTotal = await batchRepo.sumActiveBatchQuantity(stockId, tenantId);
    
    const allBatches = await batchRepo.listBatches(stockId, tenantId);
    if (allBatches.length === 0) {
      return { synced: false, reason: 'no_batches', currentTotal: item.totalQuantity };
    }

    const newTotalUnits = Math.floor(batchTotal / (item.quantityPerUnit || 1));
    await stockRepo.updateStock(stockId, tenantId, newTotalUnits);

    return { 
      synced: true, 
      previousTotal: item.totalQuantity, 
      newTotal: batchTotal,
      delta: batchTotal - item.totalQuantity
    };
  }

  async searchByLotNumber(batchNumber, tenantId) {
    return await batchRepo.findBatchByLot(batchNumber, tenantId);
  }
}

module.exports = new BatchService();
