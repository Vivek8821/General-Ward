// ==========================================
// VIEW FUNCTIONS
// ==========================================

function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role.toUpperCase();

    // Hide doctor-only features for nurses
    document.querySelectorAll('.doctor-only').forEach(el => {
        el.style.display = currentUser.role === 'doctor' ? 'inline-flex' : 'none';
    });

    updateConnectionStatus();
    showDashboard();
}

function showDashboard() {
    document.getElementById('dashboardView').classList.remove('hidden');
    document.getElementById('patientDetailView').classList.add('hidden');
    renderPatientList();
    updateStats();
}

function showPatientDetail(patientId) {
    currentPatient = patients.find(p => p.id === patientId);
    if (!currentPatient) return;

    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('patientDetailView').classList.remove('hidden');

    document.getElementById('detailName').textContent = currentPatient.name;
    document.getElementById('detailBed').textContent = 'Bed ' + currentPatient.bedNumber;
    document.getElementById('detailMRN').textContent = 'MRN: ' + currentPatient.mrn;
    document.getElementById('detailAllergies').textContent = currentPatient.allergies || 'No Allergies';
    document.getElementById('detailDiagnosis').textContent = currentPatient.diagnosis;
    document.getElementById('detailDOB').textContent = currentPatient.dob;
    document.getElementById('detailAdmission').textContent = currentPatient.admissionDate;
    document.getElementById('detailStatus').textContent = currentPatient.status;

    renderVitals();
    renderMedications();
    switchTab('info', document.querySelector('.tab'));
}

function switchTab(tabName, tabElement) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tabElement) tabElement.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================

function renderPatientList(searchTerm = '') {
    const container = document.getElementById('patientListContainer');
    let filtered = patients;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = patients.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.bedNumber.toLowerCase().includes(term) ||
            p.mrn.toLowerCase().includes(term)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👤</div>
                <p>No patients found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(patient => `
        <div class="patient-item" onclick="showPatientDetail('${patient.id}')">
            <div class="patient-info">
                <h3>${patient.name}</h3>
                <div class="patient-meta">
                    MRN: ${patient.mrn} | ${patient.diagnosis}
                </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <span class="bed-badge">Bed ${patient.bedNumber}</span>
                <span class="status-badge status-active">${patient.status}</span>
                ${!patient.synced ? '<span style="color: var(--warning); font-size: 12px;">⏳</span>' : ''}
            </div>
        </div>
    `).join('');
}

function renderVitals() {
    const container = document.getElementById('vitalsContainer');
    const patientVitals = vitals
        .filter(v => v.patientId === currentPatient.id)
        .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

    if (patientVitals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>No vitals recorded yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="vitals-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>BP</th>
                    <th>Temp</th>
                    <th>Pulse</th>
                    <th>SpO2</th>
                    <th>Pain</th>
                </tr>
            </thead>
            <tbody>
                ${patientVitals.map(v => `
                    <tr>
                        <td>${new Date(v.recordedAt).toLocaleString()}</td>
                        <td>${v.bpSystolic}/${v.bpDiastolic}</td>
                        <td>${v.temp}°F</td>
                        <td>${v.pulse}</td>
                        <td>${v.spo2}%</td>
                        <td>${v.pain}/10</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderMedications() {
    const container = document.getElementById('medicationsContainer');
    const patientMeds = medications.filter(m => m.patientId === currentPatient.id);

    if (patientMeds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💊</div>
                <p>No medications prescribed</p>
            </div>
        `;
        return;
    }

    container.innerHTML = patientMeds.map(med => `
        <div class="medication-item">
            <h4>${med.name} ${med.prn ? '<span style="color: var(--warning);">(PRN)</span>' : ''}</h4>
            <div class="medication-details">
                <strong>${med.dosage}</strong> | ${med.route} | ${med.frequency}
                ${med.scheduledTimes ? '<br>Scheduled: ' + med.scheduledTimes : ''}
                ${!med.synced ? '<br><span style="color: var(--warning); font-size: 12px;">⏳ Pending sync</span>' : ''}
            </div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('totalPatients').textContent = patients.length;
    document.getElementById('activeBeds').textContent = patients.filter(p => p.status === 'active').length;

    const today = new Date().toDateString();
    const todayCount = vitals.filter(v => new Date(v.recordedAt).toDateString() === today).length;
    document.getElementById('todayVitals').textContent = todayCount;

    const pendingCount = patients.filter(p => !p.synced).length +
        vitals.filter(v => !v.synced).length +
        medications.filter(m => !m.synced).length;
    document.getElementById('pendingSync').textContent = pendingCount;
}

function searchPatients(term) {
    renderPatientList(term);
}
