const crypto = require('crypto');
const stockRepo = require('../../repositories/pharmacy/StockRepository');
const batchRepo = require('../../repositories/pharmacy/BatchRepository');
const txRepo = require('../../repositories/pharmacy/TransactionRepository');
const dbAdapter = require('../../db-adapter');

class TransactionService {
  async adjustStock(id, tenantId, amount, type, user, options = {}) {
    const result = await dbAdapter.withTransaction(async (tx) => {
      const item = await tx.getAsync(`SELECT * FROM PharmacyStock WHERE id = ? AND tenantId = ?`, [id, tenantId]);
      if (!item) throw new Error('Medication not found');

      let batchId = null;
      let batchInfo = '';

      if (type === 'dispense' && amount < 0) {
        const absAmount = Math.abs(amount);
        
        if (options.batchId) {
          const batch = await batchRepo.findBatchById(options.batchId, tenantId);
          if (batch && batch.stockId === id && batch.status === 'active') {
            const newBatchQty = batch.quantity - absAmount;
            await batchRepo.updateBatchQuantity(batch.id, tenantId, Math.max(0, newBatchQty), tx);
            if (newBatchQty <= 0) {
              await batchRepo.updateBatchStatus(batch.id, tenantId, 'depleted', tx);
            }
            batchId = batch.id;
            batchInfo = ` [Batch: ${batch.batchNumber}, Exp: ${batch.expiryDate}]`;
          }
        } else {
          const fefoRow = await tx.get(`
            SELECT * FROM PharmacyBatches
            WHERE stockId = ? AND tenantId = ? AND status = 'active' AND quantity > 0
            ORDER BY expiryDate ASC
            LIMIT 1
          `, [id, tenantId]);

          if (fefoRow) {
            const newBatchQty = fefoRow.quantity - absAmount;
            await batchRepo.updateBatchQuantity(fefoRow.id, tenantId, Math.max(0, newBatchQty), tx);
            if (newBatchQty <= 0) {
              await batchRepo.updateBatchStatus(fefoRow.id, tenantId, 'depleted', tx);
            }
            batchId = fefoRow.id;
            batchInfo = ` [FEFO Batch: ${fefoRow.batchNumber}, Exp: ${fefoRow.expiryDate}]`;
          }
        }
      } else if (type === 'restock' && options.batchId) {
        const batch = await batchRepo.findBatchById(options.batchId, tenantId);
        if (batch && batch.stockId === id) {
          const newBatchQty = batch.quantity + amount;
          await batchRepo.updateBatchQuantity(batch.id, tenantId, newBatchQty, tx);
          if (batch.status === 'depleted' && newBatchQty > 0) {
            await batchRepo.updateBatchStatus(batch.id, tenantId, 'active', tx);
          }
          batchId = batch.id;
          batchInfo = ` [Batch: ${batch.batchNumber}]`;
        }
      }

      await tx.runAsync(`
        UPDATE PharmacyStock 
        SET totalQuantity = totalQuantity + ?, 
            lastUpdated = CURRENT_TIMESTAMP
        WHERE id = ? AND tenantId = ?
      `, [amount, id, tenantId]);

      const updatedItem = await tx.getAsync(`SELECT totalQuantity, quantityPerUnit FROM PharmacyStock WHERE id = ?`, [id]);
      const newTotalQuantity = updatedItem.totalQuantity;
      
      if (newTotalQuantity < 0 && type === 'dispense') {
        console.warn(`[Pharmacy] Negative stock for ${item.name} after dispense`);
      }

      const newTotalUnits = Math.floor(Math.max(0, newTotalQuantity) / (item.quantityPerUnit || 1));
      
      await tx.runAsync(`
        UPDATE PharmacyStock 
        SET totalUnits = ?
        WHERE id = ? AND tenantId = ?
      `, [newTotalUnits, id, tenantId]);

      const txNotes = (options.notes || '') + (batchId ? ` (batchId:${batchId})` : '') + batchInfo;
      await txRepo.recordTransaction({
        id: crypto.randomUUID(),
        tenantId,
        medicationId: id,
        type,
        quantity: amount,
        userId: user.id || 'system',
        userName: user.name || 'System',
        patientId: options.patientId,
        notes: txNotes.trim()
      }, tx);

      return { success: true, newTotalQuantity, batchId };
    });

    if (amount < 0) {
      // NOTE: Using a relative require to PharmacyReorderService from the main services dir
      const pharmacyReorderService = require('../PharmacyReorderService');
      pharmacyReorderService.triggerReorderCheck(tenantId, id).catch(err => {
        console.error('[PharmacyService] Failed to trigger reorder check:', err);
      });
    }

    return result;
  }

  async getTransactionHistory(tenantId, medicationId = null) {
    return await txRepo.listTransactions(tenantId, medicationId);
  }
}

module.exports = new TransactionService();
