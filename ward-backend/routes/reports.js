const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const reportController = require('../controllers/ReportController');
const clinicalDischargeReportService = require('../services/ClinicalDischargeReportService');
const reportDataService = require('../services/ReportDataService');
const reportRepository = require('../repositories/ReportRepository');
const clinicalAuditService = require('../services/ClinicalAuditService');
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

// Clinical Discharge Report
router.post('/clinical-discharge/:patientId',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), reportLimiter,
  async (req, res, next) => {
    try {
      const { patientId } = req.params;
      const tenantId = req.user.tenantId || 'tenant-default';

      const data = await reportDataService.aggregateDischargeReportData(patientId, tenantId);
      const hash = reportDataService.computeReportHash(data);

      const reportId = await reportRepository.create({
        tenantId,
        patientId,
        reportType: 'CLINICAL_DISCHARGE_REPORT',
        reportHash: hash,
        generatedByUserId: req.user.id,
        periodFrom: data.patient?.admittedAt
          ? data.patient.admittedAt.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        periodTo: new Date().toISOString().slice(0, 10),
        metadata: { sections: ['identification', 'presentation', 'vitals', 'labs', 'toxicology', 'imaging', 'procedures', 'team', 'narrative'] },
      });

      await clinicalAuditService.recordReportGeneration({
        tenantId, user: req.user, patientId, reportId, reportType: 'CLINICAL_DISCHARGE_REPORT',
      });

      const pdfBuffer = await clinicalDischargeReportService.generateReport(data, reportId, hash);
      const mrn = data.patient?.mrn || patientId;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="CDR-${mrn}-${new Date().toISOString().slice(0, 10)}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      if (err.message === 'Patient not found') return res.status(404).json({ error: 'Patient not found or unauthorized' });
      err.status = 500;
      next(err);
    }
  }
);

module.exports = router;
