// ==========================================
// MODAL FUNCTIONS
// ==========================================

function showAddPatient() {
    document.getElementById('addPatientModal').classList.remove('hidden');
}

function hideAddPatient() {
    document.getElementById('addPatientModal').classList.add('hidden');
    document.querySelector('#addPatientModal form').reset();
}

function showAddVitals() {
    document.getElementById('addVitalsModal').classList.remove('hidden');
}

function hideAddVitals() {
    document.getElementById('addVitalsModal').classList.add('hidden');
    document.querySelector('#addVitalsModal form').reset();
}

function showAddMedication() {
    if (currentUser.role !== 'doctor') {
        showToast('Only doctors can add medications', 'error');
        return;
    }
    document.getElementById('addMedicationModal').classList.remove('hidden');
}

function hideAddMedication() {
    document.getElementById('addMedicationModal').classList.add('hidden');
    document.querySelector('#addMedicationModal form').reset();
}

// ==========================================
// FORM SUBMISSION HANDLERS
// ==========================================

function savePatient(event) {
    event.preventDefault();

    const patient = {
        id: Date.now().toString(),
        name: document.getElementById('newPatientName').value,
        bedNumber: document.getElementById('newPatientBed').value,
        mrn: document.getElementById('newPatientMRN').value,
        dob: document.getElementById('newPatientDOB').value,
        diagnosis: document.getElementById('newPatientDiagnosis').value,
        allergies: document.getElementById('newPatientAllergies').value || 'None',
        status: 'active',
        admissionDate: new Date().toISOString().split('T')[0],
        synced: false
    };

    patients.push(patient);
    saveData();
    hideAddPatient();
    renderPatientList();
    updateStats();
    showToast('Patient added successfully', 'success');

    // Try to sync if online
    if (API_CONFIG.enabled && isOnline) {
        syncPatient(patient).then(() => {
            saveData();
            updateStats();
        });
    }
}

function saveVitals(event) {
    event.preventDefault();

    const vital = {
        id: Date.now().toString(),
        patientId: currentPatient.id,
        recordedAt: new Date().toISOString(),
        recordedBy: currentUser.name,
        bpSystolic: parseInt(document.getElementById('vitalsBPsys').value),
        bpDiastolic: parseInt(document.getElementById('vitalsBPdia').value),
        temp: parseFloat(document.getElementById('vitalsTemp').value),
        pulse: parseInt(document.getElementById('vitalsPulse').value),
        spo2: parseInt(document.getElementById('vitalsSpO2').value),
        pain: parseInt(document.getElementById('vitalsPain').value),
        notes: document.getElementById('vitalsNotes').value,
        synced: false
    };

    vitals.push(vital);
    saveData();
    hideAddVitals();
    renderVitals();
    updateStats();
    showToast('Vitals recorded successfully', 'success');

    if (API_CONFIG.enabled && isOnline) {
        syncVital(vital).then(() => {
            saveData();
            updateStats();
        });
    }
}

function saveMedication(event) {
    event.preventDefault();

    const med = {
        id: Date.now().toString(),
        patientId: currentPatient.id,
        name: document.getElementById('medName').value,
        dosage: document.getElementById('medDosage').value,
        route: document.getElementById('medRoute').value,
        frequency: document.getElementById('medFrequency').value,
        scheduledTimes: document.getElementById('medTimes').value,
        prn: document.getElementById('medPRN').checked,
        startDate: new Date().toISOString().split('T')[0],
        synced: false
    };

    medications.push(med);
    saveData();
    hideAddMedication();
    renderMedications();
    updateStats();
    showToast('Medication added successfully', 'success');

    if (API_CONFIG.enabled && isOnline) {
        syncMedication(med).then(() => {
            saveData();
            updateStats();
        });
    }
}
