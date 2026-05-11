const PDFDocument = require('pdfkit');

const MODALITY_LABELS = {
  ecg: 'ECG', xray: 'X-Ray', usg: 'Ultrasonography', ct: 'CT Scan',
  mri: 'MRI', pet: 'PET Scan', echo: 'Echocardiography',
  spirometry: 'Spirometry', other: 'Other',
};

class ClinicalDischargeReportService {
  async generateReport(data, reportId, hash) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const sectionPages = {};

      this._coverPage(doc, data, reportId, hash);
      sectionPages.s1 = this._patientIdentification(doc, data);
      sectionPages.s2 = this._clinicalPresentation(doc, data);
      sectionPages.s3 = this._vitalSigns(doc, data);
      sectionPages.s4 = this._labInvestigations(doc, data);
      if (data.toxicologyScreen) {
        sectionPages.s5 = this._toxicologyScreen(doc, data);
      }
      sectionPages.s6 = this._diagnosticImaging(doc, data);
      sectionPages.s7 = this._proceduresAndDischarge(doc, data);
      sectionPages.s8 = this._clinicalTeam(doc, data);
      sectionPages.s9 = this._clinicalNarrative(doc, data);
      sectionPages.s10 = this._declarations(doc, data);
      this._indexPage(doc, data, sectionPages);

      doc.flushPages();
      this._addFooters(doc, data, reportId);
      doc.end();
    });
  }

  _currentPage(doc) {
    const range = doc.bufferedPageRange();
    return range.count > 0 ? range.start + range.count - 1 : 0;
  }

  _addFooters(doc, data, reportId) {
    const range = doc.bufferedPageRange();
    const patient = data.patient || {};
    const footerLeft = `${patient.name || 'Patient'} | Report: ${reportId}`;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor('#888')
        .text(
          `${footerLeft} | Page ${i + 1} of ${range.count}`,
          50, doc.page.height - 28,
          { align: 'center', width: doc.page.width - 100 }
        );
    }
  }

  _h1(doc, title) {
    doc.fontSize(13).fillColor('#1e40af').text(title, { underline: true });
    doc.moveDown(0.5);
  }

  _h2(doc, title) {
    doc.fontSize(10).fillColor('#374151').text(title);
    doc.moveDown(0.3);
  }

  _kv(doc, label, value, indent = 0) {
    doc.fontSize(9);
    const x = 50 + indent;
    doc.fillColor('#6b7280').text(label + ':', x, doc.y, { width: 200, continued: true });
    doc.fillColor('#111827').text(` ${value || '—'}`, { continued: false });
    doc.moveDown(0.15);
  }

  _simpleTable(doc, headers, rows, colWidths) {
    const startX = 50;
    const rowH = 18;
    const headerH = 20;
    let y = doc.y + 4;
    const totalW = colWidths.reduce((a, b) => a + b, 0);

    if (y + headerH + rows.length * rowH > doc.page.height - 60) {
      doc.addPage();
      y = 50;
    }

    doc.rect(startX, y, totalW, headerH).fill('#1e3a5f');
    doc.fillColor('#ffffff').fontSize(8);
    let hx = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], hx + 4, y + 4, { width: colWidths[i] - 8, height: headerH - 4 });
      hx += colWidths[i];
    }
    y += headerH;

    for (let ri = 0; ri < rows.length; ri++) {
      if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 50; }
      if (ri % 2 === 0) doc.rect(startX, y, totalW, rowH).fill('#f1f5f9');
      doc.fontSize(8);
      let rx = startX;
      for (let ci = 0; ci < rows[ri].length; ci++) {
        doc.fillColor('#1f2937').text(
          String(rows[ri][ci] ?? '—'), rx + 4, y + 4,
          { width: colWidths[ci] - 8, height: rowH - 4 }
        );
        rx += colWidths[ci];
      }
      y += rowH;
    }

    doc.y = y + 6;
  }

  _parseJson(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return null; }
  }

  _coverPage(doc, data, reportId, hash) {
    const patient = data.patient || {};
    const ds = data.dischargeSummary || {};

    doc.fontSize(20).fillColor('#1a1a2e').text('General Ward Hospital', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(14).fillColor('#3b82f6').text('Clinical Discharge Report', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11).fillColor('#374151');
    doc.text(`Patient: ${patient.name || '—'}`, { align: 'center' });
    doc.text(`UHID: ${patient.uhid || patient.mrn || '—'}  |  MRN: ${patient.mrn || '—'}`, { align: 'center' });
    doc.moveDown(0.5);

    const admittedAt = patient.admittedAt ? new Date(patient.admittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const dischargedAt = ds.timestamp ? new Date(ds.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    doc.fontSize(10).fillColor('#444');
    doc.text(`Admitted: ${admittedAt}    |    Discharged: ${dischargedAt}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.text(`Report ID: ${reportId}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(7).fillColor('#9ca3af');
    doc.text('CONFIDENTIAL — For authorized clinical staff only', { align: 'center' });
    doc.moveDown(0.3);
    doc.text('NMC Medical Records Retention: 5 years | DPDPA 2023 compliant', { align: 'center' });
    if (hash) {
      doc.moveDown(0.4);
      doc.fontSize(6).fillColor('#d1d5db');
      doc.text(`Integrity hash: ${hash}`, { align: 'center' });
    }
  }

  _patientIdentification(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    const p = data.patient || {};
    const ds = data.dischargeSummary || {};

    this._h1(doc, '1. Patient Identification & Admission Details');

    this._h2(doc, 'Demographics');
    this._kv(doc, 'Full Name', p.name);
    this._kv(doc, 'UHID', p.uhid || p.mrn);
    this._kv(doc, 'MRN', p.mrn);
    this._kv(doc, 'Date of Birth', p.dob ? new Date(p.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');
    this._kv(doc, 'Gender', p.gender);
    this._kv(doc, 'Blood Group', p.bloodGroup);
    this._kv(doc, 'Nationality', p.nationality);
    this._kv(doc, 'Occupation', p.occupation);
    this._kv(doc, 'Marital Status', p.maritalStatus);
    this._kv(doc, 'Residence', p.residence);
    this._kv(doc, 'Contact', p.contactNumber);
    this._kv(doc, 'Emergency Contact', p.emergencyContact);
    if (p.is_minor) {
      this._kv(doc, 'Guardian', p.guardian_name);
      this._kv(doc, 'Guardian Contact', p.guardian_contact);
    }
    doc.moveDown(0.5);

    this._h2(doc, 'Admission & Discharge');
    this._kv(doc, 'Admitted At', p.admittedAt ? new Date(p.admittedAt).toLocaleString('en-US') : '—');
    this._kv(doc, 'Discharged At', ds.timestamp ? new Date(ds.timestamp).toLocaleString('en-US') : '—');
    this._kv(doc, 'Duration', ds.duration);
    this._kv(doc, 'Ward / Bed', p.bedNumber);
    this._kv(doc, 'Code Status', p.codeStatus);
    this._kv(doc, 'Discharge Mode', ds.dischargeMode);
    this._kv(doc, 'Admission Diagnosis', ds.admissionDiagnosis || p.diagnosis);
    this._kv(doc, 'Discharge Diagnosis', ds.dischargeDiagnosis);
    this._kv(doc, 'Condition at Discharge', ds.conditionAtDischarge);
    doc.moveDown(0.5);

    this._h2(doc, 'Insurance & TPA');
    this._kv(doc, 'Insurance Provider', p.insuranceProvider);
    this._kv(doc, 'Policy No.', p.insurancePolicyNo);
    this._kv(doc, 'TPA Name', p.tpaName);
    this._kv(doc, 'TPA Claim No.', p.tpaClaimNo);
    doc.moveDown(0.5);

    // Medical History
    const mh = data.medicalHistory || {};
    this._h2(doc, 'Medical History');
    const comorbidities = this._parseJson(mh.comorbidities);
    if (Array.isArray(comorbidities) && comorbidities.length) {
      this._simpleTable(doc, ['Condition', 'On Medication', 'Notes'],
        comorbidities.map(c => [c.condition || c, c.onMedication ? 'Yes' : 'No', c.notes || '']),
        [240, 80, 130]);
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('No comorbidities recorded.');
    }
    doc.moveDown(0.3);
    if (mh.surgicalHistory) { this._kv(doc, 'Surgical History', mh.surgicalHistory); }
    if (mh.familyHistory) { this._kv(doc, 'Family History', mh.familyHistory); }
    const sh = this._parseJson(mh.socialHistory);
    if (sh) {
      doc.moveDown(0.3);
      this._h2(doc, 'Social History');
      if (sh.smoking) this._kv(doc, 'Smoking', `${sh.smoking.status || ''}${sh.smoking.packsPerDay ? `, ${sh.smoking.packsPerDay} packs/day` : ''}${sh.smoking.years ? `, ${sh.smoking.years} yrs` : ''}`, 10);
      if (sh.alcohol) this._kv(doc, 'Alcohol', `${sh.alcohol.status || ''}${sh.alcohol.frequency ? `, ${sh.alcohol.frequency}` : ''}`, 10);
      if (sh.drugs) this._kv(doc, 'Substance Use', `${sh.drugs.status || ''}${sh.drugs.details ? ` — ${sh.drugs.details}` : ''}`, 10);
    }
    doc.moveDown(0.5);

    // Allergies
    this._h2(doc, 'Allergy Profile');
    const allergies = data.structuredAllergies || [];
    if (allergies.length) {
      this._simpleTable(doc, ['Allergen', 'Category', 'Reaction', 'Severity', 'Verification'],
        allergies.map(a => [a.allergen, a.category, a.reaction, a.severity, a.verificationMethod || '']),
        [130, 80, 130, 60, 90]);
    } else if (data.patient?.allergies) {
      doc.fontSize(9).fillColor('#374151').text(data.patient.allergies);
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('NKDA — No known drug allergies.');
    }
    doc.moveDown(0.5);

    // Dietary Restrictions
    const diet = this._parseJson(ds.dietaryRestrictions);
    if (diet) {
      this._h2(doc, 'Dietary Restrictions');
      if (Array.isArray(diet)) {
        diet.forEach(d => { doc.fontSize(9).fillColor('#374151').text(`• ${d}`); });
      } else {
        doc.fontSize(9).fillColor('#374151').text(String(diet));
      }
      doc.moveDown(0.5);
    }

    return startPage;
  }

  _clinicalPresentation(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    const cp = data.clinicalPresentation || {};

    this._h1(doc, '2. Clinical Presentation');

    this._h2(doc, 'History of Presenting Illness');
    if (cp.historyOfPresentingIllness) {
      doc.fontSize(9).fillColor('#374151').text(cp.historyOfPresentingIllness, { lineGap: 2 });
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('No history recorded.');
    }
    doc.moveDown(0.8);

    const exam = this._parseJson(cp.physicalExamFindings);
    if (exam) {
      this._h2(doc, 'Physical Examination Findings');
      const examFields = [
        ['General Condition', exam.generalCondition],
        ['Temperature', exam.temperature],
        ['Pulse', exam.pulse],
        ['Blood Pressure', exam.bp],
        ['Respiratory Rate', exam.rr],
        ['SpO2', exam.spo2],
        ['Icterus', exam.icterus],
        ['Lymphadenopathy', exam.lymphadenopathy],
        ['Skin', exam.skin],
        ['Abdomen', exam.abdomen],
        ['Respiratory', exam.respiratory],
        ['Cardiovascular', exam.cardiovascular],
        ['Neurological', exam.neurological],
      ].filter(([, v]) => v);

      if (examFields.length) {
        this._simpleTable(doc, ['Parameter', 'Finding'],
          examFields.map(([k, v]) => [k, String(v)]),
          [200, 280]);
      }
    }

    if (cp.examinedBy) {
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor('#6b7280').text(`Examined by: ${cp.examinedBy}`);
    }

    return startPage;
  }

  _vitalSigns(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '3. Vital Signs & Clinical Monitoring');

    const vitals = (data.dailyStats || []).filter(s => s.type === 'vital');
    if (vitals.length) {
      const rows = vitals.slice(-30).map(v => {
        let d = v.data;
        try { d = JSON.parse(v.data); } catch {}
        return [
          v.timestamp ? v.timestamp.slice(0, 16).replace('T', ' ') : '—',
          d.temperature || '—',
          d.pulse || d.heartRate || '—',
          d.bloodPressure || (d.bp_systolic ? `${d.bp_systolic}/${d.bp_diastolic}` : '—'),
          d.respiratoryRate || d.rr || '—',
          d.spo2 || '—',
          v.recordedBy || '—',
        ];
      });
      this._simpleTable(doc,
        ['Date/Time', 'Temp (°C)', 'Pulse', 'BP (mmHg)', 'RR', 'SpO2 (%)', 'By'],
        rows, [105, 60, 50, 75, 40, 55, 100]);
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('No vital signs recorded.');
    }

    return startPage;
  }

  _labInvestigations(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '4. Laboratory Investigations');

    const labs = data.labInvestigations || [];
    if (!labs.length) {
      doc.fontSize(9).fillColor('#9ca3af').text('No laboratory investigations recorded.');
      return startPage;
    }

    for (const lab of labs) {
      const label = lab.dayLabel || lab.investigationDate;
      this._h2(doc, `${label} — ${lab.investigationDate}`);

      const results = this._parseJson(lab.results);
      if (results && typeof results === 'object' && !Array.isArray(results)) {
        const rows = Object.entries(results).map(([param, info]) => {
          if (typeof info === 'object' && info !== null) {
            return [param, String(info.value ?? '—'), info.unit || '', info.referenceRange || '', info.status || ''];
          }
          return [param, String(info), '', '', ''];
        });
        this._simpleTable(doc, ['Parameter', 'Value', 'Unit', 'Reference Range', 'Status'],
          rows, [170, 70, 50, 110, 70]);
      } else if (typeof results === 'string') {
        doc.fontSize(9).fillColor('#374151').text(results, { lineGap: 2 });
      }
      doc.moveDown(0.5);
    }

    return startPage;
  }

  _toxicologyScreen(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    const tox = data.toxicologyScreen;

    this._h1(doc, '5. Toxicology Screen');
    this._kv(doc, 'Screen Date', tox.screenDate);
    this._kv(doc, 'Recorded By', tox.recordedBy);
    doc.moveDown(0.5);

    const bac = this._parseJson(tox.bac);
    if (bac) {
      this._h2(doc, 'Blood Alcohol Content (BAC)');
      if (bac.venousBlood) this._kv(doc, 'Venous Blood', `${bac.venousBlood.result || '—'}  (${bac.venousBlood.method || ''})`, 10);
      if (bac.urine) this._kv(doc, 'Urine', `${bac.urine.result || '—'}  (${bac.urine.method || ''})`, 10);
      if (bac.interpretation) this._kv(doc, 'Interpretation', bac.interpretation, 10);
      doc.moveDown(0.3);
    }

    const drugs = this._parseJson(tox.drugScreen);
    if (Array.isArray(drugs) && drugs.length) {
      this._h2(doc, 'Drug Screen');
      this._simpleTable(doc, ['Substance', 'Result', 'Method', 'Flag'],
        drugs.map(d => [d.substance, d.result || '—', d.method || '', d.flag || '']),
        [180, 80, 100, 80]);
      doc.moveDown(0.3);
    }

    const poison = this._parseJson(tox.poisonScreen);
    if (Array.isArray(poison) && poison.length) {
      this._h2(doc, 'Poison Screen');
      this._simpleTable(doc, ['Substance', 'Result', 'Method', 'Status', 'Reference'],
        poison.map(p => [p.substance, p.result || '—', p.method || '', p.status || '', p.referenceRange || '']),
        [150, 80, 80, 60, 80]);
      doc.moveDown(0.3);
    }

    const metals = this._parseJson(tox.heavyMetals);
    if (Array.isArray(metals) && metals.length) {
      this._h2(doc, 'Heavy Metals Panel');
      this._simpleTable(doc, ['Element', 'Symbol', 'Result', 'Unit', 'Method', 'Status', 'Reference'],
        metals.map(m => [m.element, m.symbol || '', m.result || '—', m.unit || '', m.method || '', m.status || '', m.referenceRange || '']),
        [100, 50, 60, 40, 80, 60, 60]);
    }

    return startPage;
  }

  _diagnosticImaging(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '6. Diagnostic Imaging & Investigations');

    const images = data.imagingReports || [];
    if (!images.length) {
      doc.fontSize(9).fillColor('#9ca3af').text('No imaging reports recorded.');
      return startPage;
    }

    const byModality = {};
    for (const img of images) {
      const key = img.modalityType;
      if (!byModality[key]) byModality[key] = [];
      byModality[key].push(img);
    }

    for (const [modality, reports] of Object.entries(byModality)) {
      this._h2(doc, MODALITY_LABELS[modality] || modality);
      for (const r of reports) {
        doc.fontSize(9).fillColor('#374151');
        doc.text(`Date: ${r.investigationDate}${r.equipment ? `  |  Equipment: ${r.equipment}` : ''}${r.reportedBy ? `  |  Reported by: ${r.reportedBy}` : ''}`);
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor('#1f2937').text('Findings:', { continued: true });
        doc.fillColor('#374151').text(` ${r.findings}`);
        if (r.impression) {
          doc.fontSize(9).fillColor('#1f2937').text('Impression:', { continued: true });
          doc.fillColor('#374151').text(` ${r.impression}`);
        }
        doc.moveDown(0.5);
      }
    }

    return startPage;
  }

  _proceduresAndDischarge(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    const ds = data.dischargeSummary || {};

    // Procedures
    this._h1(doc, '7. Procedures, Discharge Prescription & Instructions');
    this._h2(doc, '7.1 Clinical Procedures Log');
    const procedures = data.clinicalProcedures || [];
    if (procedures.length) {
      this._simpleTable(doc, ['Date', 'Procedure', 'Performed By', 'Outcome'],
        procedures.map(p => [p.procedureDate, p.procedureName, p.performedBy, p.outcome || '']),
        [80, 200, 120, 80]);
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('No procedures recorded.');
    }
    doc.moveDown(0.8);

    // Discharge Prescription
    this._h2(doc, '7.2 Discharge Prescription');
    const rx = this._parseJson(ds.dischargePrescription);
    if (Array.isArray(rx) && rx.length) {
      this._simpleTable(doc, ['Medication', 'Dose', 'Route', 'Frequency', 'Duration', 'Instructions'],
        rx.map(r => [r.name || r.medication || '', r.dose || r.dosage || '', r.route || '', r.frequency || '', r.duration || '', r.instructions || '']),
        [130, 60, 55, 70, 60, 100]);
    } else if (typeof rx === 'string' && rx.trim()) {
      doc.fontSize(9).fillColor('#374151').text(rx, { lineGap: 2 });
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('No discharge prescription recorded.');
    }
    doc.moveDown(0.8);

    // Follow-Up Schedule
    this._h2(doc, '7.3 Follow-Up Schedule');
    const followUp = this._parseJson(ds.followUpSchedule);
    if (Array.isArray(followUp) && followUp.length) {
      this._simpleTable(doc, ['Date', 'Department / Specialist', 'Notes'],
        followUp.map(f => [f.date || '', f.department || f.specialist || '', f.notes || '']),
        [100, 200, 180]);
    } else if (typeof followUp === 'string' && followUp.trim()) {
      doc.fontSize(9).fillColor('#374151').text(followUp, { lineGap: 2 });
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('No follow-up schedule recorded.');
    }
    doc.moveDown(0.8);

    // Discharge Instructions
    this._h2(doc, '7.4 Discharge Instructions');
    if (ds.dischargeInstructions) {
      doc.fontSize(9).fillColor('#374151').text(ds.dischargeInstructions, { lineGap: 2 });
    } else if (ds.dischargeRecommendations) {
      doc.fontSize(9).fillColor('#374151').text(ds.dischargeRecommendations, { lineGap: 2 });
    } else {
      doc.fontSize(9).fillColor('#9ca3af').text('No discharge instructions recorded.');
    }

    return startPage;
  }

  _clinicalTeam(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '8. Clinical Team & Remarks');

    const team = data.clinicalTeam || [];
    if (!team.length) {
      doc.fontSize(9).fillColor('#9ca3af').text('No clinical team recorded.');
      return startPage;
    }

    for (const member of team) {
      this._h2(doc, `${member.role} — ${member.name}`);
      if (member.qualification) this._kv(doc, 'Qualification', member.qualification, 10);
      if (member.registrationNo) this._kv(doc, 'Registration No.', member.registrationNo, 10);
      if (member.clinicalRemarks) {
        doc.fontSize(9).fillColor('#1f2937').text('Clinical Remarks:', 60, doc.y);
        doc.fontSize(9).fillColor('#374151').text(member.clinicalRemarks, 60, doc.y, { lineGap: 2, indent: 10 });
        if (member.remarksDate) {
          doc.fontSize(8).fillColor('#6b7280').text(`  — ${member.remarksDate}`, { continued: false });
        }
      }
      doc.moveDown(0.5);
    }

    return startPage;
  }

  _clinicalNarrative(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '9. Day-by-Day Clinical Narrative');

    const notes = data.handoverNotes || [];
    if (!notes.length) {
      doc.fontSize(9).fillColor('#9ca3af').text('No handover notes recorded.');
      return startPage;
    }

    const byDate = {};
    for (const note of notes) {
      const day = (note.timestamp || '').slice(0, 10);
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(note);
    }

    for (const [day, dayNotes] of Object.entries(byDate).sort()) {
      this._h2(doc, day);
      for (const note of dayNotes) {
        doc.fontSize(8).fillColor('#6b7280')
          .text(`[${note.shift || 'shift'}] ${note.createdBy || ''}  ${note.timestamp ? note.timestamp.slice(11, 16) : ''}`);
        doc.fontSize(9).fillColor('#374151').text(note.note, { lineGap: 2, indent: 10 });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.3);
    }

    return startPage;
  }

  _declarations(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    const ds = data.dischargeSummary || {};
    this._h1(doc, '10. Declarations & Certification');

    doc.fontSize(9).fillColor('#374151');
    doc.text(
      'This Clinical Discharge Report has been prepared based on the medical records maintained during the patient\'s inpatient stay. ' +
      'The information contained herein is accurate to the best of our clinical knowledge and has been verified by the treating team.',
      { lineGap: 3 }
    );
    doc.moveDown(0.8);
    doc.text(
      'This document is generated under the National Medical Commission (NMC) regulations and is subject to the Digital Personal Data Protection Act (DPDPA) 2023. ' +
      'Unauthorized disclosure of this document is prohibited.',
      { lineGap: 3 }
    );
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor('#1f2937').text(`Discharged by: ${ds.dischargedBy || '—'}`);
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#6b7280').text(`Discharge timestamp: ${ds.timestamp ? new Date(ds.timestamp).toLocaleString('en-US') : '—'}`);
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#9ca3af').text('— End of Clinical Discharge Report —', { align: 'center' });

    return startPage;
  }

  _indexPage(doc, data, pages) {
    doc.addPage();
    doc.fontSize(16).fillColor('#1e3a5f').text('Index', { align: 'center' });
    doc.moveDown(1);

    const sections = [
      { num: '1', title: 'Patient Identification & Admission Details', key: 's1' },
      { num: '2', title: 'Clinical Presentation', key: 's2' },
      { num: '3', title: 'Vital Signs & Clinical Monitoring', key: 's3' },
      { num: '4', title: 'Laboratory Investigations', key: 's4' },
    ];
    if (pages.s5 !== undefined) {
      sections.push({ num: '5', title: 'Toxicology Screen', key: 's5' });
    }
    sections.push(
      { num: pages.s5 !== undefined ? '6' : '5', title: 'Diagnostic Imaging & Investigations', key: 's6' },
      { num: pages.s5 !== undefined ? '7' : '6', title: 'Procedures, Discharge Prescription & Instructions', key: 's7' },
      { num: pages.s5 !== undefined ? '8' : '7', title: 'Clinical Team & Remarks', key: 's8' },
      { num: pages.s5 !== undefined ? '9' : '8', title: 'Day-by-Day Clinical Narrative', key: 's9' },
      { num: pages.s5 !== undefined ? '10' : '9', title: 'Declarations & Certification', key: 's10' },
    );

    doc.fontSize(10);
    for (const s of sections) {
      const pg = pages[s.key];
      if (pg === undefined) continue;
      doc.fillColor('#1f2937').text(`${s.num}.  ${s.title}`, 70, doc.y, { continued: true });
      doc.fillColor('#3b82f6').text(`  → page ${pg + 1}`, { continued: false });
      doc.moveDown(0.4);
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#9ca3af');
    doc.text(`Cover page is page 1. Report generated: ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
  }
}

module.exports = new ClinicalDischargeReportService();
