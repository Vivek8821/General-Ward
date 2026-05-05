const crypto = require('crypto');
const stockRepo = require('../repositories/pharmacy/StockRepository');
const purchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const pharmacyAnalyticsService = require('./PharmacyAnalyticsService');

class PharmacyReorderService {
  /**
   * Checks if a specific medication needs a reorder and generates a PO if necessary.
   * Prevents duplicate pending/ordered POs for the same item.
   */
  async triggerReorderCheck(tenantId, stockId) {
    try {
      const item = await stockRepo.findById(stockId, tenantId);
      if (!item) return;

      // Check if stock is below threshold
      if (item.totalQuantity > item.minThreshold) {
        return; // Stock is still healthy
      }

      // Check for existing pending or ordered POs to avoid duplicates
      const existingOrder = await purchaseOrderRepository.findPendingByStockId(stockId, tenantId);
      if (existingOrder) {
        return; // Already being handled
      }

      // Calculate suggested order quantity
      const replenishmentPlan = await pharmacyAnalyticsService.getReplenishmentPlan(tenantId);
      const planItem = replenishmentPlan.find(p => p.medicationId === stockId);
      
      // Default to 2x threshold if burn rate is 0 or no plan found
      let suggestedQty = planItem ? planItem.suggestedOrder : (item.minThreshold * 2);
      if (suggestedQty <= 0) suggestedQty = item.minThreshold * 2;

      const orderId = crypto.randomUUID();
      await purchaseOrderRepository.create({
        id: orderId,
        tenantId,
        stockId,
        quantity: suggestedQty,
        status: 'pending',
        createdBy: 'system',
        notes: `Auto-generated: Stock level (${item.totalQuantity}) fell below threshold (${item.minThreshold}).`
      });

      console.log(`[PharmacyReorder] Auto-generated PO ${orderId} for ${item.name} (${suggestedQty} units)`);
      return orderId;
    } catch (error) {
      console.error('[PharmacyReorder] Error in triggerReorderCheck:', error);
    }
  }

  async getOrders(tenantId, limit, cursor) {
    return await purchaseOrderRepository.list(tenantId, limit, cursor);
  }

  async updateOrderStatus(id, tenantId, status, user) {
    const order = await purchaseOrderRepository.findById(id, tenantId);
    if (!order) throw new Error('Purchase order not found');

    return await purchaseOrderRepository.updateStatus(id, tenantId, status, user.id);
  }

  /**
   * Scans all inventory for the tenant and generates POs for everything below threshold.
   */
  async checkAllInventory(tenantId) {
    const items = await stockRepo.listStock(tenantId);
    const results = [];
    for (const item of items) {
      const orderId = await this.triggerReorderCheck(tenantId, item.id);
      if (orderId) results.push({ stockId: item.id, name: item.name, orderId });
    }
    return results;
  }
}

module.exports = new PharmacyReorderService();
