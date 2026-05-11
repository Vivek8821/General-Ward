const PDFDocument = require('pdfkit');
const statisticsService = require('./StatisticsService');

class StatisticsReportService {
  async generateReport(tenantId, period, filters = {}) {
    const [summary, diseases, demographics, medications, admissions, outcomes] = await Promise.all([
      statisticsService.getSummary(tenantId, period, filters),
      statisticsService.getDiseaseDistribution(tenantId, period, filters),
      statisticsService.getDemographicBreakdown(tenantId, period, filters),
      statisticsService.getMedicationStats(tenantId, period, filters),
      statisticsService.getAdmissionTrend(tenantId, period, filters),
      statisticsService.getClinicalOutcomes(tenantId, period, filters),
    ]);

    const reportData = { summary, diseases, demographics, medications, admissions, outcomes, period, filters };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const sectionPages = {};

      this._coverPage(doc, reportData);
      sectionPages.summary = this._executiveSummary(doc, reportData);
      sectionPages.diseases = this._diseaseDistribution(doc, reportData);
      sectionPages.demographics = this._demographics(doc, reportData);
      sectionPages.medications = this._medicationUtilization(doc, reportData);
      sectionPages.admissions = this._admissionTrends(doc, reportData);
      sectionPages.outcomes = this._clinicalOutcomes(doc, reportData);
      this._indexPage(doc, reportData, sectionPages);

      doc.flushPages();
      this._addFooters(doc, reportData);
      doc.end();
    });
  }

  _addFooters(doc, data) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footerText = `General Ward — Hospital Statistics Report | Generated: ${new Date().toISOString().slice(0, 10)} | Page ${i + 1} of ${range.count}`;
      doc.fontSize(7).fillColor('#888')
        .text(footerText, 50, doc.page.height - 30, { align: 'center', width: doc.page.width - 100 });
    }
  }

  _currentPage(doc) {
    const range = doc.bufferedPageRange();
    return range.count > 0 ? range.start + range.count - 1 : 0;
  }

  _indexPage(doc, data, pages) {
    doc.addPage();
    doc.fontSize(18).fillColor('#1e3a5f').text('Index', { align: 'center' });
    doc.moveDown(1);

    const sections = [
      { num: '1', title: 'Executive Summary', page: (pages.summary || 0) + 1 },
      { num: '2', title: 'Disease Distribution by Category', page: (pages.diseases || 0) + 1 },
      { num: '3', title: 'Demographic Breakdown', page: (pages.demographics || 0) + 1 },
      { num: '4', title: 'Medication Utilization', page: (pages.medications || 0) + 1 },
      { num: '5', title: 'Admission & Discharge Trends', page: (pages.admissions || 0) + 1 },
      { num: '6', title: 'Clinical Outcomes', page: (pages.outcomes || 0) + 1 },
    ];

    doc.fontSize(11);
    for (const s of sections) {
      const label = `${s.num}.  ${s.title}`;
      doc.fillColor('#1f2937').text(label, 70, doc.y, { continued: true });
      doc.fillColor('#3b82f6').text(`  → page ${s.page}`, { continued: false });
      doc.moveDown(0.4);
    }

    doc.moveDown(1);
    const range = doc.bufferedPageRange();
    doc.fontSize(8).fillColor('#9ca3af');
    doc.text(`Cover page is page 1. Report generated: ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
  }

  _coverPage(doc, data) {
    const periodLabel = { week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Yearly' }[data.period] || 'Periodic';
    doc.fontSize(24).fillColor('#1a1a2e').text('General Ward Hospital', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor('#3b82f6').text(`${periodLabel} Statistics Report`, { align: 'center' });
    doc.moveDown(1.5);

    const from = data.summary?.period?.from ? new Date(data.summary.period.from).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const to = data.summary?.period?.to ? new Date(data.summary.period.to).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

    doc.fontSize(11).fillColor('#444');
    doc.text(`Period: ${from}  –  ${to}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'center' });
    doc.moveDown(1);

    const activeFilters = [];
    if (data.filters.residence) activeFilters.push(`Residence: ${data.filters.residence}`);
    if (data.filters.gender) activeFilters.push(`Gender: ${data.filters.gender}`);
    if (data.filters.ageMin) activeFilters.push(`Min Age: ${data.filters.ageMin}`);
    if (data.filters.ageMax) activeFilters.push(`Max Age: ${data.filters.ageMax}`);
    if (activeFilters.length > 0) {
      doc.fontSize(9).fillColor('#666');
      doc.text('Filters applied: ' + activeFilters.join(', '), { align: 'center' });
    }

    doc.moveDown(3);
    doc.fontSize(8).fillColor('#999');
    doc.text('CONFIDENTIAL — For authorized clinical staff only', { align: 'center' });
  }

  _h1(doc, title) {
    doc.fontSize(14).fillColor('#1e40af').text(title, { underline: true });
    doc.moveDown(0.5);
  }

  _h2(doc, title) {
    doc.fontSize(11).fillColor('#374151').text(title);
    doc.moveDown(0.3);
  }

  _kv(doc, label, value, indent = 0) {
    doc.fontSize(10);
    const x = 50 + indent;
    doc.fillColor('#6b7280').text(label + ':', x, doc.y, { width: 220, continued: true });
    doc.fillColor('#111827').text(` ${value}`, { continued: false });
    doc.moveDown(0.15);
  }

  _simpleTable(doc, headers, rows, colWidths) {
    const startX = 50;
    const rowH = 20;
    const headerH = 22;
    let y = doc.y + 4;
    const totalW = colWidths.reduce((a, b) => a + b, 0);

    // Check page space
    if (y + headerH + (rows.length * rowH) > doc.page.height - 60) {
      doc.addPage();
      y = 50;
    }

    // Header row
    doc.rect(startX, y, totalW, headerH).fill('#1e3a5f');
    doc.fillColor('#ffffff').fontSize(9);
    let hx = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], hx + 4, y + 4, { width: colWidths[i] - 8, height: headerH - 4 });
      hx += colWidths[i];
    }
    doc.fillColor('#111827');
    y += headerH;

    // Data rows
    for (let ri = 0; ri < rows.length; ri++) {
      if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 50; }
      // Alternating row background
      if (ri % 2 === 0) {
        doc.rect(startX, y, totalW, rowH).fill('#f1f5f9');
      }
      doc.fontSize(9);
      let rx = startX;
      for (let ci = 0; ci < rows[ri].length; ci++) {
        doc.fillColor('#1f2937').text(
          String(rows[ri][ci] || '-'), rx + 4, y + 4,
          { width: colWidths[ci] - 8, height: rowH - 4 }
        );
        rx += colWidths[ci];
      }
      y += rowH;
    }

    doc.y = y + 6;
  }

  _executiveSummary(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    const s = data.summary || {};
    this._h1(doc, '1. Executive Summary');
    this._kv(doc, 'Total Patients', s.totalPatients);
    this._kv(doc, 'Currently Active', s.currentlyActive);
    this._kv(doc, 'Total Discharged', s.totalDischarged);
    this._kv(doc, 'Average Length of Stay', `${s.avgLengthOfStay} days`);
    this._kv(doc, 'Medication Administrations', s.totalMedicationAdministrations);
    if (s.topDisease) {
      this._kv(doc, 'Top Disease Category', `${s.topDisease.category} (${s.topDisease.count} patients)`);
    }
    doc.moveDown(1);
    return startPage;
  }

  _diseaseDistribution(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '2. Disease Distribution by Category');
    const cats = data.diseases?.categories || [];
    if (cats.length > 0) {
      this._simpleTable(doc, ['Category', 'Count', 'Percentage'],
        cats.map(c => [c.category, String(c.count), `${c.percentage}%`]),
        [280, 80, 80]);
    }

    const topDiags = data.diseases?.topDiagnoses || [];
    if (topDiags.length > 0) {
      doc.moveDown(0.5);
      this._h2(doc, 'Top Individual Diagnoses');
      this._simpleTable(doc, ['Diagnosis', 'Count'],
        topDiags.slice(0, 12).map(d => [d.name, String(d.count)]),
        [370, 70]);
    }
    if (!cats.length && !topDiags.length) {
      doc.text('No disease data available for this period.');
    }
    return startPage;
  }

  _demographics(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '3. Demographic Breakdown');
    const d = data.demographics || {};
    const total = d.total || 1;

    if (d.gender?.length) {
      this._h2(doc, 'Gender Distribution');
      this._simpleTable(doc, ['Gender', 'Count', 'Percentage'],
        d.gender.map(g => [g.label, String(g.count), `${Math.round((g.count / total) * 100)}%`]),
        [180, 80, 80]);
      doc.moveDown(0.5);
    }

    if (d.residence?.length) {
      this._h2(doc, 'Residence Distribution');
      this._simpleTable(doc, ['Residence', 'Count', 'Percentage'],
        d.residence.map(r => [r.label, String(r.count), `${Math.round((r.count / total) * 100)}%`]),
        [180, 80, 80]);
      doc.moveDown(0.5);
    }

    if (d.ageGroups?.length) {
      this._h2(doc, 'Age Group Distribution');
      const ageOrder = ['0-12', '13-18', '19-35', '36-50', '51-65', '66+'];
      const sorted = [...d.ageGroups].sort((a, b) => ageOrder.indexOf(a.group) - ageOrder.indexOf(b.group));
      this._simpleTable(doc, ['Age Group', 'Male', 'Female', 'Total'],
        sorted.map(a => [a.group, String(a.male || 0), String(a.female || 0), String((a.male || 0) + (a.female || 0))]),
        [120, 80, 80, 80]);
    }
    return startPage;
  }

  _medicationUtilization(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '4. Medication Utilization');
    const meds = data.medications?.medications || [];
    const totalAdm = data.medications?.totalAdministrations || 0;

    doc.fontSize(9).fillColor('#6b7280');
    doc.text(`${totalAdm} total administrations recorded across ${data.medications?.totalPatients || 0} patients`);
    doc.moveDown(0.5);

    if (meds.length > 0) {
      this._simpleTable(doc, ['Medication', 'Total', 'Given', 'Refused', 'Missed'],
        meds.map(m => [m.name, String(m.total), String(m.given), String(m.refused), String(m.missed)]),
        [220, 60, 60, 60, 60]);
    } else {
      doc.text('No medication administration data available.');
    }
    return startPage;
  }

  _admissionTrends(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '5. Admission & Discharge Trends');
    const a = data.admissions || {};

    doc.fontSize(10).fillColor('#1f2937');
    doc.text(`Total Admissions: ${a.totalAdmissions || 0}    |    Total Discharges: ${a.totalDischarges || 0}`);
    doc.moveDown(1);

    const timeline = a.timeline || [];
    if (timeline.length > 0) {
      this._simpleTable(doc, ['Date', 'Admitted', 'Discharged', 'Net Change'],
        timeline.map(t => [t.date, String(t.admitted || 0), String(t.discharged || 0), String((t.admitted || 0) - (t.discharged || 0))]),
        [160, 90, 90, 90]);
    } else {
      doc.fontSize(10).fillColor('#9ca3af').text('No admission or discharge events in this period.');
    }
    return startPage;
  }

  _clinicalOutcomes(doc, data) {
    doc.addPage();
    const startPage = this._currentPage(doc);
    this._h1(doc, '6. Clinical Outcomes');
    const o = data.outcomes || {};

    this._kv(doc, 'Average Length of Stay', `${o.avgLengthOfStay || 0} days`);
    this._kv(doc, 'Discharge Rate', `${o.dischargeRate || 0}%`);
    this._kv(doc, 'Escalation Rate', `${o.escalationRate || 0}%`);
    this._kv(doc, 'Total Escalations', o.totalEscalations || 0);
    this._kv(doc, 'Critical Case Rate', `${o.criticalRate || 0}%`);
    this._kv(doc, 'Patient Sample Size', o.totalPatients || 0);

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#9ca3af');
    doc.text('— End of Report —', { align: 'center' });
    return startPage;
  }
}

module.exports = new StatisticsReportService();
