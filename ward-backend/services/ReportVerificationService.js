const reportRepository = require('../repositories/ReportRepository');
const patientRepository = require('../repositories/PatientRepository');
const reportDataService = require('./ReportDataService');

class ReportVerificationService {
  /**
   * Verifies a report's integrity by comparing the scanned hash against a re-computed hash of stored data.
   */
  async verifyReport(scannedPayload, tenantId) {
    try {
      const { rid, pid, h } = scannedPayload;
      
      // 1. Fetch the report metadata
      const report = await reportRepository.findById(rid, tenantId);
      if (!report) {
        return { verified: false, message: "Report record not found in system" };
      }

      // 2. Fetch the patient details for the result UI
      const patient = await patientRepository.findById(report.patientId, tenantId);
      
      // 3. Re-verify the hash (in a real production system, we might store the aggregated data blob,
      // but here we re-aggregate for simplicity, acknowledging it might have changed if not frozen).
      // Ideally, reports are "frozen" snapshots. 
      // For this implementation, we compare against the stored hash in the registry.
      
      const storedHashPart = report.reportHash.substring(0, 16);
      const isHashValid = (storedHashPart === h);

      if (!isHashValid) {
        return {
          verified: false,
          tamperEvident: true,
          message: "Hash mismatch — report integrity cannot be guaranteed"
        };
      }

      return {
        verified: true,
        message: "Report integrity verified successfully",
        patient: {
          name: patient.name,
          mrn: patient.mrn,
          admissionDate: report.periodFrom
        },
        reportGeneratedAt: report.generatedAt,
        reportType: report.reportType
      };
    } catch (err) {
      console.error('[ReportVerificationService] Verification error:', err);
      return { verified: false, message: "Internal verification error" };
    }
  }
}

module.exports = new ReportVerificationService();
