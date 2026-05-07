const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

class PDFReportService {
  /**
   * Generates a PDF buffer for the patient treatment report.
   */
  async generateTreatmentReport(data, reportId, hash) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // 1. Cover Page
        await this._drawCoverPage(doc, data, reportId, hash);

        // 2. Patient Demographics
        this._drawSectionHeader(doc, 'Section 1: Patient Demographics');
        this._drawDemographics(doc, data.patient);

        // 3. Clinical Observations Timeline
        doc.addPage();
        this._drawSectionHeader(doc, 'Section 2: Clinical Observations Timeline');
        this._drawObservationsTable(doc, data.vitals, data.scoring);

        // 4. Medication Administration Record (MAR)
        doc.addPage();
        this._drawSectionHeader(doc, 'Section 3: Medication Administration Record (MAR)');
        this._drawMARTable(doc, data.administrations);

        // 5. Diet & Sleep Records
        doc.addPage();
        this._drawSectionHeader(doc, 'Section 4: Diet & Nutrition');
        this._drawGenericTable(doc, data.diet, ['Date/Time', 'Meal', 'Intake', 'Notes'], d => [
          d.timestamp,
          d.data.mealType || '-',
          d.data.intakePercentage ? `${d.data.intakePercentage}%` : '-',
          d.notes || '-'
        ]);

        doc.moveDown();
        this._drawSectionHeader(doc, 'Section 5: Sleep Pattern');
        this._drawGenericTable(doc, data.sleep, ['Date/Time', 'Duration', 'Quality', 'Notes'], s => [
          s.timestamp,
          s.data.hours ? `${s.data.hours}h` : '-',
          s.data.quality || '-',
          s.notes || '-'
        ]);

        // 6. Clinical Notes & Handover
        doc.addPage();
        this._drawSectionHeader(doc, 'Section 6: Clinical Notes & Handover History');
        this._drawNotes(doc, data.notes);

        // 7. Escalations & Critical Events
        doc.moveDown();
        this._drawSectionHeader(doc, 'Section 7: Escalations & Critical Events');
        this._drawEscalations(doc, data.escalations);

        // 8. Discharge Summary (if available)
        if (data.discharge) {
          doc.addPage();
          this._drawSectionHeader(doc, 'Section 8: Discharge Summary');
          this._drawDischargeSummary(doc, data.discharge);
        }

        // Global Footer
        this._drawGlobalFooters(doc, data.patient.name, reportId);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async _drawCoverPage(doc, data, reportId, hash) {
    doc.fontSize(24).text('General Ward Hospital', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text('Patient Treatment Record', { align: 'center', underline: true });
    doc.moveDown(2);

    doc.fontSize(12).text(`Report ID: ${reportId}`);
    doc.text(`Patient Name: ${data.patient.name}`);
    doc.text(`Patient ID: ${data.patient.mrn}`);
    doc.text(`Bed Number: ${data.patient.bedNumber}`);
    doc.moveDown();
    
    const admissionDate = data.patient.admissionDate || 'N/A';
    const periodTo = new Date().toISOString().split('T')[0];
    doc.text(`Clinical Period: ${admissionDate} to ${periodTo}`);
    doc.moveDown();
    
    doc.text(`Generated At: ${new Date().toLocaleString()}`);
    doc.moveDown(3);

    doc.fontSize(10).fillColor('gray').text('CONFIDENTIALITY NOTICE:', { underline: true });
    doc.text('This document contains sensitive clinical information. Unauthorized disclosure or reproduction is prohibited by hospital policy and data protection regulations.');
    doc.fillColor('black');

    // QR Code
    const qrPayload = JSON.stringify({
      rid: reportId,
      pid: data.patient.id,
      t: data.patient.tenantId,
      h: hash.substring(0, 16),
      v: 1
    });

    const qrBuffer = await QRCode.toBuffer(qrPayload, { margin: 1, width: 120 });
    doc.image(qrBuffer, doc.page.width - 170, doc.page.height - 200, { width: 120 });
    doc.fontSize(8).text('Verify report integrity by scanning this QR code', doc.page.width - 170, doc.page.height - 80, { width: 120, align: 'center' });
  }

  _drawSectionHeader(doc, title) {
    doc.fontSize(14).fillColor('#2c3e50').text(title, { underline: true });
    doc.moveDown(0.5).fillColor('black').fontSize(10);
  }

  _drawDemographics(doc, patient) {
    const startY = doc.y;
    doc.text(`MRN: ${patient.mrn}`, 50, startY);
    doc.text(`DOB: ${patient.dob}`, 200, startY);
    doc.text(`Gender: ${patient.gender || '-'}`, 350, startY);
    
    doc.moveDown();
    doc.text(`Diagnosis: ${patient.diagnosis || 'None recorded'}`);
    doc.text(`Allergies: ${patient.allergies || 'No known allergies'}`);
  }

  _drawObservationsTable(doc, vitals, scoring) {
    const tableTop = doc.y;
    const itemHeight = 20;
    
    // Headers
    doc.font('Helvetica-Bold');
    this._drawTableRow(doc, tableTop, ['Timestamp', 'BP', 'HR', 'Temp', 'SpO2', 'RR', 'NEWS2', 'Risk']);
    doc.font('Helvetica');
    doc.moveDown(0.5);

    vitals.slice(0, 25).forEach((v, i) => {
      const score = scoring.find(s => s.timestamp === v.timestamp);
      const riskColor = score?.riskLevel === 'HIGH' ? 'red' : (score?.riskLevel === 'MEDIUM' ? 'orange' : 'black');
      
      const y = doc.y;
      if (y > doc.page.height - 50) doc.addPage();
      
      doc.fillColor(riskColor);
      this._drawTableRow(doc, doc.y, [
        v.timestamp.substring(11, 16),
        `${v.data.bpSystolic}/${v.data.bpDiastolic}`,
        v.data.pulse,
        v.data.temp,
        v.data.spo2,
        v.data.respRate,
        score?.score || '-',
        score?.riskLevel || '-'
      ]);
      doc.fillColor('black');
    });
  }

  _drawMARTable(doc, admins) {
    doc.font('Helvetica-Bold');
    this._drawTableRow(doc, doc.y, ['Medication', 'Dose', 'Route', 'Admin At', 'By', 'Status']);
    doc.font('Helvetica');
    doc.moveDown(0.5);

    admins.slice(0, 30).forEach(a => {
      if (doc.y > doc.page.height - 50) doc.addPage();
      this._drawTableRow(doc, doc.y, [
        a.medName,
        a.doseActuallyGiven || a.dosage,
        a.route,
        a.timestamp.substring(5, 16),
        a.administeredBy,
        a.status.toUpperCase()
      ]);
    });
  }

  _drawGenericTable(doc, data, headers, rowFn) {
    doc.font('Helvetica-Bold');
    this._drawTableRow(doc, doc.y, headers);
    doc.font('Helvetica');
    doc.moveDown(0.5);

    data.slice(0, 20).forEach(item => {
      if (doc.y > doc.page.height - 50) doc.addPage();
      this._drawTableRow(doc, doc.y, rowFn(item));
    });
  }

  _drawNotes(doc, notes) {
    notes.slice(0, 15).forEach(n => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      doc.font('Helvetica-Bold').text(`${n.timestamp} - ${n.shift.toUpperCase()} (${n.createdBy})`);
      doc.font('Helvetica').text(n.note);
      doc.moveDown(0.5);
    });
  }

  _drawEscalations(doc, escalations) {
    if (escalations.length === 0) {
      doc.text('No escalations recorded.');
      return;
    }
    escalations.forEach(e => {
      if (doc.y > doc.page.height - 50) doc.addPage();
      doc.text(`${e.timestamp}: ${e.reason} (Status: ${e.status})`);
    });
  }

  _drawDischargeSummary(doc, ds) {
    doc.text(`Discharge Date: ${ds.dischargeDate}`);
    doc.text(`Condition: ${ds.conditionAtDischarge}`);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('Instructions:');
    doc.font('Helvetica').text(ds.dischargeInstructions);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('Follow-up:');
    doc.font('Helvetica').text(ds.followUpPlan);
  }

  _drawTableRow(doc, y, columns) {
    const colWidth = (doc.page.width - 100) / columns.length;
    columns.forEach((col, i) => {
      doc.text(String(col || '-'), 50 + (i * colWidth), y, { width: colWidth, truncate: true });
    });
  }

  _drawGlobalFooters(doc, patientName, reportId) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('gray').text(
        `Patient: ${patientName} | Report ID: ${reportId} | Page ${i + 1} of ${range.count}`,
        50,
        doc.page.height - 30,
        { align: 'center' }
      );
    }
  }
}

module.exports = new PDFReportService();
