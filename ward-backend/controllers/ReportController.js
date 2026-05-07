const reportDataService = require('../services/ReportDataService');
const pdfReportService = require('../services/PDFReportService');
const reportVerificationService = require('../services/ReportVerificationService');
const reportRepository = require('../repositories/ReportRepository');
const patientRepository = require('../repositories/PatientRepository');
const clinicalAuditService = require('../services/ClinicalAuditService');

class ReportController {
  async generateReport(req, res) {
    try {
      const { patientId } = req.params;
      const tenantId = req.user.tenantId || 'tenant-default';

      // 1. Aggregate Data
      const data = await reportDataService.aggregatePatientData(patientId, tenantId);

      // 2. Compute Hash
      const hash = reportDataService.computeReportHash(data);

      // 3. Register Report in DB
      const reportId = await reportRepository.create({
        tenantId,
        patientId,
        reportType: 'FULL_TREATMENT',
        reportHash: hash,
        generatedByUserId: req.user.id,
        periodFrom: data.patient.admissionDate || new Date().toISOString().split('T')[0],
        periodTo: new Date().toISOString().split('T')[0],
        metadata: { sections: ['demographics', 'vitals', 'mar', 'notes'] }
      });

      // 3.5 Log Generation Event
      await clinicalAuditService.recordReportGeneration({
        tenantId,
        user: req.user,
        patientId,
        reportId,
        reportType: 'FULL_TREATMENT'
      });

      // 4. Generate PDF
      const pdfBuffer = await pdfReportService.generateTreatmentReport(data, reportId, hash);

      // 5. Stream to Client
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="PTR-${data.patient.mrn}-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);

    } catch (err) {
      console.error('[ReportController] Generation error:', err);
      if (err.message === 'Patient not found') {
        return res.status(404).json({ error: 'Patient not found or unauthorized' });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async getHistory(req, res) {
    try {
      const { patientId } = req.params;
      const tenantId = req.user.tenantId || 'tenant-default';
      const history = await reportRepository.findAllByPatientId(patientId, tenantId);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async verifyReport(req, res) {
    try {
      const { payload } = req.query;
      if (!payload) return res.status(400).json({ error: 'Payload missing' });

      const scannedData = JSON.parse(decodeURIComponent(payload));
      const tenantId = scannedData.t; // Extract tenant from payload for public lookup

      const result = await reportVerificationService.verifyReport(scannedData, tenantId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: 'Invalid payload format' });
    }
  }
}

module.exports = new ReportController();
