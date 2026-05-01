const crypto = require('crypto');
const pharmacyRepository = require('../repositories/PharmacyRepository');
const dbAdapter = require('../dbAdapter');

class PharmacyService {
  async getInventory(tenantId) {
    const items = await pharmacyRepository.listStock(tenantId);
    return items.map(item => ({
      ...item,
      inStock: item.totalQuantity > 0,
      isLowStock: item.totalQuantity <= item.minThreshold && item.totalQuantity > 0
    }));
  }

  async addMedication(tenantId, payload) {
    const { 
      name, composition, type, category, quantityPerUnit, totalUnits,
      unit, itemUnit, costPerUnit, expiryDate, manufacturer, minThreshold 
    } = payload;
    
    if (!name) throw new Error('Medication name is required');

    const id = crypto.randomUUID();
    const qpu = parseInt(quantityPerUnit) || 1;
    const units = parseInt(totalUnits) || 0;

    await pharmacyRepository.create({
      id,
      tenantId,
      name,
      composition,
      type,
      category,
      quantityPerUnit: qpu,
      totalUnits: units,
      totalQuantity: units * qpu,
      unit: unit || 'Strips',
      itemUnit: itemUnit || 'Tablets',
      costPerUnit,
      expiryDate,
      manufacturer,
      minThreshold: minThreshold || 10
    });

    return { id, name };
  }

  /**
   * Atomic stock adjustment with transaction audit logging
   */
  async adjustStock(id, tenantId, amount, type, user, options = {}) {
    return await dbAdapter.withTransaction(async (tx) => {
      const item = await pharmacyRepository.findById(id, tenantId);
      if (!item) throw new Error('Medication not found');

      // For 'dispense', amount is usually -1 (one item/tablet)
      // We deduct from totalQuantity.
      const newTotalQuantity = item.totalQuantity + amount;
      if (newTotalQuantity < 0 && type === 'dispense') {
        // We allow it but log a warning (clinical reality)
        console.warn(`[Pharmacy] Negative stock for ${item.name} after dispense`);
      }

      // Update PharmacyStock
      // In a real enterprise system, we'd also handle partial units (strips/pills)
      // For now, we update totalQuantity and re-calculate totalUnits (floor)
      const newTotalUnits = Math.floor(newTotalQuantity / (item.quantityPerUnit || 1));
      
      const sql = `
        UPDATE PharmacyStock 
        SET totalUnits = ?, totalQuantity = ?, lastUpdated = CURRENT_TIMESTAMP
        WHERE id = ? AND tenantId = ?
      `;
      await tx.run(sql, [newTotalUnits, newTotalQuantity, id, tenantId]);

      // Record Transaction
      await pharmacyRepository.recordTransaction({
        id: crypto.randomUUID(),
        tenantId,
        medicationId: id,
        type,
        quantity: amount,
        userId: user.id || 'system',
        userName: user.name || 'System',
        patientId: options.patientId,
        notes: options.notes
      }, tx);

      return { success: true, newTotalQuantity };
    });
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
