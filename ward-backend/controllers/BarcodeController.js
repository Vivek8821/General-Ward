const express = require('express');
const router = express.Router();
const barcodeService = require('../services/BarcodeService');
const { validateBarcodeRegister, bad } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const rateLimit = require('express-rate-limit');

const scanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Too many scans, please slow down' }
});

router.get('/scan/:barcode', authenticateToken, authorize(PERMISSIONS.READ_PHARMACY), scanLimiter, async (req, res, next) => {
  try {
    const { barcode } = req.params;
    const result = await barcodeService.resolveScan(req.user.tenantId, decodeURIComponent(barcode));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/register', authenticateToken, authorize(PERMISSIONS.MANAGE_PHARMACY), async (req, res, next) => {
  const errors = validateBarcodeRegister(req.body || {});
  if (errors.length > 0) return bad(res, errors);

  try {
    const result = await barcodeService.registerBarcode(req.user.tenantId, req.body, req.user);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('already registered')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/qr/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const drugName = req.query.name || 'Drug';
    const result = await barcodeService.generateQRCode(req.user.tenantId, id, drugName);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/history/:barcode', authenticateToken, authorizeAny([PERMISSIONS.MANAGE_PHARMACY, PERMISSIONS.VIEW_AUDIT]), async (req, res, next) => {
  try {
    const { barcode } = req.params;
    const history = await barcodeService.getHistory(req.user.tenantId, decodeURIComponent(barcode));
    res.json(history);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
