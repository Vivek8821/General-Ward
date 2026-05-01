const express = require('express');
const router = express.Router();
const pharmacyService = require('../services/PharmacyService');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');

// GET /api/pharmacy/inventory
router.get('/inventory', authenticateToken, authorizeAny([PERMISSIONS.READ_PATIENT, PERMISSIONS.WRITE_MEDICATIONS]), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const inventory = await pharmacyService.getInventory(tenantId);
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pharmacy/history
router.get('/history', authenticateToken, authorizeAny([PERMISSIONS.READ_PATIENT, PERMISSIONS.WRITE_MEDICATIONS]), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const history = await pharmacyService.getTransactionHistory(tenantId, req.query.medicationId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pharmacy/inventory
router.post('/inventory', authenticateToken, authorize(PERMISSIONS.PURGE_AUDIT), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await pharmacyService.addMedication(tenantId, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/pharmacy/inventory/:id
// Update stock level (Manual Adjustment)
router.patch('/inventory/:id', authenticateToken, authorize(PERMISSIONS.PURGE_AUDIT), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const { totalUnits, notes } = req.body;
    
    // We use adjustStock to record this manual adjustment
    const item = await pharmacyService.getInventory(tenantId).then(inv => inv.find(i => i.id === req.params.id));
    if (!item) return res.status(404).json({ error: 'Medication not found' });

    const diff = (parseInt(totalUnits) * item.quantityPerUnit) - item.totalQuantity;
    
    const result = await pharmacyService.adjustStock(
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
router.delete('/inventory/:id', authenticateToken, authorize(PERMISSIONS.PURGE_AUDIT), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await pharmacyService.removeMedication(req.params.id, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
