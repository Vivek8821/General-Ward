const express = require('express');
const router = express.Router();
const reportController = require('../controllers/ReportController');
const { authenticateToken } = require('../middleware/auth');

// Public Verification Endpoint
router.get('/verify', (req, res) => reportController.verifyReport(req, res));

// Protected Endpoints
router.post('/patient/:patientId/generate', authenticateToken, (req, res) => reportController.generateReport(req, res));
router.get('/patient/:patientId/history', authenticateToken, (req, res) => reportController.getHistory(req, res));

module.exports = router;
