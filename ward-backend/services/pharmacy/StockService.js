const crypto = require('crypto');
const stockRepo = require('../../repositories/pharmacy/StockRepository');
const batchRepo = require('../../repositories/pharmacy/BatchRepository');
const dbAdapter = require('../../db-adapter');

class StockService {
  async getInventory(tenantId) {
    const items = await stockRepo.listStock(tenantId);
    const enriched = [];

    for (const item of items) {
      const batches = await batchRepo.listBatches(item.id, tenantId);
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

  async getStockById(id, tenantId) {
    return await stockRepo.findById(id, tenantId);
  }

  async addMedication(tenantId, payload) {
    const { 
      name, composition, type, category, quantityPerUnit, totalUnits,
      unit, itemUnit, costPerUnit, expiryDate, manufacturer, minThreshold,
      batchNumber, batchExpiryDate, batchQuantity, batchCostPerUnit, receivedDate
    } = payload;
    
    if (!name) throw new Error('Medication name is required');

    const id = crypto.randomUUID();
    const qpu = parseInt(quantityPerUnit) || 1;
    const units = parseInt(totalUnits) || 0;
    const totalQty = units * qpu;

    await stockRepo.create({
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

    let batchId = null;
    if (batchNumber && batchExpiryDate) {
      batchId = crypto.randomUUID();
      const batchQty = parseInt(batchQuantity) || totalQty;

      await batchRepo.createBatch({
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

      if (batchQty !== totalQty) {
        const newTotalUnits = Math.floor(batchQty / qpu);
        await stockRepo.updateStock(id, tenantId, newTotalUnits);
      }
    }

    return { id, name, batchId };
  }

  async updateStockLevel(id, tenantId, totalUnits) {
    const result = await stockRepo.updateStock(id, tenantId, totalUnits);
    if (result.changes === 0) throw new Error('Medication not found or tenant mismatch');
    return { success: true };
  }

  async removeMedication(id, tenantId) {
    const result = await stockRepo.delete(id, tenantId);
    if (result.changes === 0) throw new Error('Medication not found or tenant mismatch');
    return { success: true };
  }
}

module.exports = new StockService();
