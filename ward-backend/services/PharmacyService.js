const crypto = require('crypto');
const pharmacyRepository = require('../repositories/PharmacyRepository');
const dbAdapter = require('../dbAdapter');

class PharmacyService {
  /**
   * Get full inventory with batch details for each stock item.
   * Adds computed fields: batches[], batchCount, nearestExpiry, inStock, isLowStock.
   */
  async getInventory(tenantId) {
    const items = await pharmacyRepository.listStock(tenantId);
    const enriched = [];

    for (const item of items) {
      const batches = await pharmacyRepository.listBatches(item.id, tenantId);
      const activeBatches = batches.filter(b => b.status === 'active');
      const nearestExpiry = activeBatches.length > 0 ? activeBatches[0].expiryDate : item.expiryDate;

      enriched.push({
        ...item,
        batches,
        batchCount: batches.length,
        activeBatchCount: activeBatches.length,
        nearestExpiry,
        inStock: item.totalQuantity > 0,
        isLowStock: item.totalQuantity <= item.minThreshold && item.totalQuantity > 0
      });
    }

    return enriched;
  }

  /**
   * Add a new medication to inventory.
   * Optionally creates an initial batch if batch fields are provided.
   */
  async addMedication(tenantId, payload) {
    const { 
      name, composition, type, category, quantityPerUnit, totalUnits,
      unit, itemUnit, costPerUnit, expiryDate, manufacturer, minThreshold,
      // Optional batch fields
      batchNumber, batchExpiryDate, batchQuantity, batchCostPerUnit, receivedDate
    } = payload;
    
    if (!name) throw new Error('Medication name is required');

    const id = crypto.randomUUID();
    const qpu = parseInt(quantityPerUnit) || 1;
    const units = parseInt(totalUnits) || 0;
    const totalQty = units * qpu;

    await pharmacyRepository.create({
      id,
      tenantId,
      name,
      composition,
      type,
      category,
      quantityPerUnit: qpu,
      totalUnits: units,
      totalQuantity: totalQty,
      unit: unit || 'Strips',
      itemUnit: itemUnit || 'Tablets',
      costPerUnit,
      expiryDate,
      manufacturer,
      minThreshold: minThreshold || 10
    });

    // If batch info is provided, create the initial batch
    let batchId = null;
    if (batchNumber && batchExpiryDate) {
      batchId = crypto.randomUUID();
      const batchQty = parseInt(batchQuantity) || totalQty;

      await pharmacyRepository.createBatch({
        id: batchId,
        tenantId,
        stockId: id,
        batchNumber,
        expiryDate: batchExpiryDate,
        quantity: batchQty,
        costPerUnit: batchCostPerUnit || costPerUnit || 0,
        manufacturer: manufacturer || null,
        receivedDate: receivedDate || new Date().toISOString().split('T')[0],
        status: 'active'
      });

      // If batch quantity differs from stock total, sync stock to match batch
      if (batchQty !== totalQty) {
        const newTotalUnits = Math.floor(batchQty / qpu);
        await pharmacyRepository.updateStock(id, tenantId, newTotalUnits);
      }
    }

    return { id, name, batchId };
  }

  /**
   * Add a new batch to an existing stock item (restock operation).
   * Updates the aggregate stock totals.
   */
  async addBatch(stockId, tenantId, batchData, user) {
    const item = await pharmacyRepository.findById(stockId, tenantId);
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

      // Update aggregate stock totals
      const newTotalQuantity = item.totalQuantity + batchQty;
      const newTotalUnits = Math.floor(newTotalQuantity / (item.quantityPerUnit || 1));
      await tx.run(`
        UPDATE PharmacyStock
        SET totalUnits = ?, totalQuantity = ?, lastUpdated = CURRENT_TIMESTAMP
        WHERE id = ? AND tenantId = ?
      `, [newTotalUnits, newTotalQuantity, stockId, tenantId]);

      // Record restock transaction
      await pharmacyRepository.recordTransaction({
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

  /**
   * Get all batches for a specific stock item.
   */
  async getBatches(stockId, tenantId) {
    const item = await pharmacyRepository.findById(stockId, tenantId);
    if (!item) throw new Error('Stock item not found');
    return await pharmacyRepository.listBatches(stockId, tenantId);
  }

  /**
   * Atomic stock adjustment with FEFO batch dispensing.
   * For dispense operations, uses First Expiry First Out strategy.
   * Falls back to aggregate-only adjustment if no batches exist (legacy compatibility).
   */
  async adjustStock(id, tenantId, amount, type, user, options = {}) {
    return await dbAdapter.withTransaction(async (tx) => {
      const item = await pharmacyRepository.findById(id, tenantId);
      if (!item) throw new Error('Medication not found');

      let batchId = null;
      let batchInfo = '';

      // For dispense operations, attempt FEFO batch deduction
      if (type === 'dispense' && amount < 0) {
        const absAmount = Math.abs(amount);
        
        if (options.batchId) {
          // Explicit batch specified
          const batch = await pharmacyRepository.findBatchById(options.batchId, tenantId);
          if (batch && batch.stockId === id && batch.status === 'active') {
            const newBatchQty = batch.quantity - absAmount;
            await pharmacyRepository.updateBatchQuantity(
              batch.id, tenantId, Math.max(0, newBatchQty), tx
            );
            if (newBatchQty <= 0) {
              await pharmacyRepository.updateBatchStatus(batch.id, tenantId, 'depleted', tx);
            }
            batchId = batch.id;
            batchInfo = ` [Batch: ${batch.batchNumber}, Exp: ${batch.expiryDate}]`;
          }
        } else {
          // FEFO: Find the batch closest to expiry with available stock
          // Use raw SQL within the transaction to get consistent read
          const fefoRow = await tx.get(`
            SELECT * FROM PharmacyBatches
            WHERE stockId = ? AND tenantId = ? AND status = 'active' AND quantity > 0
            ORDER BY expiryDate ASC
            LIMIT 1
          `, [id, tenantId]);

          if (fefoRow) {
            const newBatchQty = fefoRow.quantity - absAmount;
            await pharmacyRepository.updateBatchQuantity(
              fefoRow.id, tenantId, Math.max(0, newBatchQty), tx
            );
            if (newBatchQty <= 0) {
              await pharmacyRepository.updateBatchStatus(fefoRow.id, tenantId, 'depleted', tx);
            }
            batchId = fefoRow.id;
            batchInfo = ` [FEFO Batch: ${fefoRow.batchNumber}, Exp: ${fefoRow.expiryDate}]`;
          }
          // If no batches exist, fall through to aggregate-only adjustment (legacy)
        }
      } else if (type === 'restock' && options.batchId) {
        // Restock to a specific batch
        const batch = await pharmacyRepository.findBatchById(options.batchId, tenantId);
        if (batch && batch.stockId === id) {
          const newBatchQty = batch.quantity + amount;
          await pharmacyRepository.updateBatchQuantity(batch.id, tenantId, newBatchQty, tx);
          if (batch.status === 'depleted' && newBatchQty > 0) {
            await pharmacyRepository.updateBatchStatus(batch.id, tenantId, 'active', tx);
          }
          batchId = batch.id;
          batchInfo = ` [Batch: ${batch.batchNumber}]`;
        }
      }

      // Update aggregate PharmacyStock totals
      const newTotalQuantity = item.totalQuantity + amount;
      if (newTotalQuantity < 0 && type === 'dispense') {
        console.warn(`[Pharmacy] Negative stock for ${item.name} after dispense`);
      }

      const newTotalUnits = Math.floor(Math.max(0, newTotalQuantity) / (item.quantityPerUnit || 1));
      
      await tx.run(`
        UPDATE PharmacyStock 
        SET totalUnits = ?, totalQuantity = ?, lastUpdated = CURRENT_TIMESTAMP
        WHERE id = ? AND tenantId = ?
      `, [newTotalUnits, newTotalQuantity, id, tenantId]);

      // Record Transaction with batch traceability
      const txNotes = (options.notes || '') + (batchId ? ` (batchId:${batchId})` : '') + batchInfo;
      await pharmacyRepository.recordTransaction({
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
  }

  /**
   * Recall a batch — marks it as recalled, records waste transaction,
   * returns affected dispense transactions for patient tracing.
   */
  async recallBatch(batchId, tenantId, user, reason) {
    if (!reason) throw new Error('Recall reason is required');

    const batch = await pharmacyRepository.findBatchById(batchId, tenantId);
    if (!batch) throw new Error('Batch not found');

    const item = await pharmacyRepository.findById(batch.stockId, tenantId);
    if (!item) throw new Error('Associated stock item not found');

    return await dbAdapter.withTransaction(async (tx) => {
      const remainingQty = batch.quantity;

      // Mark batch as recalled
      await pharmacyRepository.updateBatchStatus(batchId, tenantId, 'recalled', tx);

      // If there was remaining stock, record it as waste
      if (remainingQty > 0) {
        // Deduct from aggregate
        const newTotalQuantity = item.totalQuantity - remainingQty;
        const newTotalUnits = Math.floor(Math.max(0, newTotalQuantity) / (item.quantityPerUnit || 1));
        await tx.run(`
          UPDATE PharmacyStock
          SET totalUnits = ?, totalQuantity = ?, lastUpdated = CURRENT_TIMESTAMP
          WHERE id = ? AND tenantId = ?
        `, [newTotalUnits, newTotalQuantity, batch.stockId, tenantId]);

        // Record waste transaction
        await pharmacyRepository.recordTransaction({
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

  /**
   * Get dispense transactions for a batch — used for tracing affected patients after recall.
   */
  async getRecallTrace(batchId, tenantId) {
    const batch = await pharmacyRepository.findBatchById(batchId, tenantId);
    if (!batch) throw new Error('Batch not found');

    const transactions = await pharmacyRepository.getDispenseTransactionsForBatch(batchId, tenantId);
    return {
      batch,
      affectedTransactions: transactions,
      affectedPatientIds: [...new Set(transactions.filter(t => t.patientId).map(t => t.patientId))]
    };
  }

  /**
   * Recalculate aggregate stock totals from batch quantities.
   * Safety net for data consistency.
   */
  async syncStockTotals(stockId, tenantId) {
    const item = await pharmacyRepository.findById(stockId, tenantId);
    if (!item) throw new Error('Stock item not found');

    const batchTotal = await pharmacyRepository.sumActiveBatchQuantity(stockId, tenantId);
    
    // Only sync if there are actual batches. If no batches, leave aggregate as-is (legacy).
    const allBatches = await pharmacyRepository.listBatches(stockId, tenantId);
    if (allBatches.length === 0) {
      return { synced: false, reason: 'no_batches', currentTotal: item.totalQuantity };
    }

    const newTotalUnits = Math.floor(batchTotal / (item.quantityPerUnit || 1));
    await pharmacyRepository.updateStock(stockId, tenantId, newTotalUnits);

    return { 
      synced: true, 
      previousTotal: item.totalQuantity, 
      newTotal: batchTotal,
      delta: batchTotal - item.totalQuantity
    };
  }

  /**
   * Search batches by lot number across all stock items in a tenant.
   */
  async searchByLotNumber(batchNumber, tenantId) {
    return await pharmacyRepository.findBatchByLot(batchNumber, tenantId);
  }

  async getTransactionHistory(tenantId, medicationId = null) {
    return await pharmacyRepository.listTransactions(tenantId, medicationId);
  }

  async updateStockLevel(id, tenantId, totalUnits) {
    // Legacy support or direct unit adjustment
    const result = await pharmacyRepository.updateStock(id, tenantId, totalUnits);
    if (result.changes === 0) throw new Error('Medication not found or tenant mismatch');
    return { success: true };
  }

  async removeMedication(id, tenantId) {
    const result = await pharmacyRepository.delete(id, tenantId);
    if (result.changes === 0) throw new Error('Medication not found or tenant mismatch');
    return { success: true };
  }
}

module.exports = new PharmacyService();
