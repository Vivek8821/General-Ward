const express = require('express');
const router = express.Router();
const stockService = require('../services/pharmacy/StockService');
const stockRepo = require('../repositories/pharmacy/StockRepository');
const batchService = require('../services/pharmacy/BatchService');
const txService = require('../services/pharmacy/TransactionService');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');

const {
    requireTenantPharmacyStock,
    requireTenantPharmacyBatch,
} = require('../middleware/tenant');
const { validateInventoryPayload, validateWastePayload, bad } = require('../utils/validation');

// ── Input Validators ────────────────────────────────────────────────

function validateBatchPayload(body) {
  const errors = [];
  if (!body.batchNumber || typeof body.batchNumber !== 'string' || body.batchNumber.trim().length === 0) {
    errors.push('batchNumber is required (non-empty string)');
  }
  if (body.batchNumber && body.batchNumber.length > 100) {
    errors.push('batchNumber must be 100 characters or less');
  }
  if (!body.expiryDate || isNaN(Date.parse(body.expiryDate))) {
    errors.push('expiryDate is required (valid ISO date)');
  }
  if (!body.quantity || parseInt(body.quantity) <= 0) {
    errors.push('quantity must be a positive integer');
  }
  if (body.costPerUnit !== undefined && (isNaN(body.costPerUnit) || Number(body.costPerUnit) < 0)) {
    errors.push('costPerUnit must be a non-negative number');
  }
  return errors;
}

// ── Existing Inventory Endpoints ────────────────────────────────────

// GET /api/pharmacy/inventory
router.get('/inventory', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const inventory = await stockService.getInventory(tenantId);
    res.json(inventory);
  } catch (err) {
    next(err);
  }
});

// GET /api/pharmacy/history
router.get('/history', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const history = await txService.getTransactionHistory(tenantId, req.query.medicationId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// POST /api/pharmacy/inventory
router.post('/inventory', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), async (req, res) => {
  const errors = validateInventoryPayload(req.body || {});
  if (errors.length > 0) return bad(res, errors);

  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await stockService.addMedication(tenantId, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/pharmacy/inventory/:id
// Update stock level (Manual Adjustment)
router.patch('/inventory/:id', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), requireTenantPharmacyStock('id'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const { totalUnits, notes } = req.body;
    
    const item = await stockRepo.findById(req.params.id, tenantId);
    if (!item) return res.status(404).json({ error: 'Medication not found' });

    const diff = (parseInt(totalUnits) * item.quantityPerUnit) - item.totalQuantity;
    
    const result = await txService.adjustStock(
      req.params.id, 
      tenantId, 
      diff, 
      'adjustment', 
      req.user, 
      { notes: notes || 'Manual stock update' }
    );
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/pharmacy/inventory/:id
router.delete('/inventory/:id', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), requireTenantPharmacyStock('id'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await stockService.removeMedication(req.params.id, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Batch / Lot Tracking Endpoints ──────────────────────────────────

// GET /api/pharmacy/inventory/:stockId/batches
router.get('/inventory/:stockId/batches', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), requireTenantPharmacyStock('stockId'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const batches = await batchService.getBatches(req.params.stockId, tenantId);
    res.json(batches);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// POST /api/pharmacy/inventory/:stockId/batches
router.post('/inventory/:stockId/batches', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), requireTenantPharmacyStock('stockId'), async (req, res) => {
  const errors = validateBatchPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors, code: 'VALIDATION_ERROR' });
  }

  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await batchService.addBatch(req.params.stockId, tenantId, req.body, req.user);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    if (err.message.includes('UNIQUE constraint')) return res.status(409).json({ error: 'A batch with this lot number already exists for this medication', code: 'DUPLICATE_BATCH' });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/pharmacy/batches/:batchId/recall
router.post('/batches/:batchId/recall', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), requireTenantPharmacyBatch('batchId'), async (req, res, next) => {
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({ error: 'Recall reason is required', code: 'VALIDATION_ERROR' });
  }

  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await batchService.recallBatch(req.params.batchId, tenantId, req.user, reason.trim());
    res.json(result);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// GET /api/pharmacy/recall-trace/:batchId
router.get('/recall-trace/:batchId', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), requireTenantPharmacyBatch('batchId'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const trace = await batchService.getRecallTrace(req.params.batchId, tenantId);
    res.json(trace);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// GET /api/pharmacy/batches/search?lotNumber=XXX
router.get('/batches/search', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  const { lotNumber } = req.query;
  if (!lotNumber || lotNumber.trim().length === 0) {
    return res.status(400).json({ error: 'lotNumber query parameter is required', code: 'VALIDATION_ERROR' });
  }

  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const results = await batchService.searchByLotNumber(lotNumber.trim(), tenantId);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// POST /api/pharmacy/inventory/:stockId/sync
// Safety endpoint to recalculate aggregate stock from batch totals
router.post('/inventory/:stockId/sync', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), requireTenantPharmacyStock('stockId'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await batchService.syncStockTotals(req.params.stockId, tenantId);
    res.json(result);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

const pharmacyAnalyticsService = require('../services/PharmacyAnalyticsService');

// ... (validators remain same) ...

// GET /api/pharmacy/analytics/consumption
router.get('/analytics/consumption', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const days = parseInt(req.query.days) || 7;
    const stats = await pharmacyAnalyticsService.getConsumptionStats(tenantId, days);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/pharmacy/analytics/financial
router.get('/analytics/financial', authenticateToken, authorizeAny([PERMISSIONS.MANAGE_PHARMACY, PERMISSIONS.VIEW_AUDIT]), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await pharmacyAnalyticsService.getFinancialAnalytics(tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/pharmacy/analytics/replenishment
router.get('/analytics/replenishment', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await pharmacyAnalyticsService.getReplenishmentPlan(tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const reorderService = require('../services/PharmacyReorderService');

// GET /api/pharmacy/orders - List POs
router.get('/orders', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const orders = await reorderService.getOrders(tenantId);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/pharmacy/orders/:id/status - Update PO status
router.patch('/orders/:id/status', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), async (req, res, next) => {
  try {
    const { status } = req.body;
    const tenantId = req.user.tenantId || 'tenant-default';
    await reorderService.updateOrderStatus(req.params.id, tenantId, status, req.user);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/pharmacy/orders/check-all - Manual reorder trigger
router.post('/orders/check-all', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const results = await reorderService.checkAllInventory(tenantId);
    res.json({ success: true, ordersGenerated: results });
  } catch (error) {
    next(error);
  }
});

// ── Waste & Spillage Management (Phase 9) ─────────────────────────

const wasteService = require('../services/WasteService');

// POST /api/pharmacy/waste
router.post('/waste', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), async (req, res) => {
  const errors = validateWastePayload(req.body || {});
  if (errors.length > 0) return bad(res, errors);

  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await wasteService.initiateWaste(tenantId, req.body, req.user);
    res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/pharmacy/waste/pending
router.get('/waste/pending', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const records = await wasteService.listPending(tenantId);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

// GET /api/pharmacy/waste
router.get('/waste', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const limit = parseInt(req.query.limit) || 50;
    const cursor = req.query.cursor || null;
    const records = await wasteService.listAll(tenantId, limit, cursor);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

// POST /api/pharmacy/waste/:id/confirm
router.post('/waste/:id/confirm', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await wasteService.confirmWaste(req.params.id, tenantId, req.user);
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/pharmacy/waste/:id/cancel
router.post('/waste/:id/cancel', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await wasteService.cancelWaste(req.params.id, tenantId, req.user);
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
