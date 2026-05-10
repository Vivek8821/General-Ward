const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const reportController = require('../controllers/ReportController');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');

const reportLimiter = rateLimit({
  windowMs: 60_000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many report generation requests, please try again later.' },
});

const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification requests, please try again later.' },
});

// Public Verification Endpoint
router.get('/verify', verifyLimiter, (req, res) => reportController.verifyReport(req, res));

// Protected Endpoints
router.post('/patient/:patientId/generate', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), reportLimiter, (req, res) => reportController.generateReport(req, res));
router.get('/patient/:patientId/history', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), (req, res) => reportController.getHistory(req, res));

module.exports = router;
