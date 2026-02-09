// ==========================================
// API FUNCTIONS
// ==========================================

async function testConnection() {
    if (!API_CONFIG.baseUrl) {
        showToast('Please configure API URL first', 'error');
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/health`, {
            headers: { 'Authorization': `Bearer ${API_CONFIG.apiKey}` }
        });

        if (response.ok) {
            showToast('Connection successful!', 'success');
            isOnline = true;
            API_CONFIG.enabled = true;
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        showToast('Connection failed: ' + error.message, 'error');
        isOnline = false;
    } finally {
        showLoading(false);
        updateConnectionStatus();
    }
}

async function syncAllData() {
    if (!API_CONFIG.enabled || !isOnline) {
        showToast('Cannot sync - offline or not configured', 'warning');
        return;
    }

    showLoading(true);
    let syncCount = 0;

    try {
        // Sync patients
        const unsyncedPatients = patients.filter(p => !p.synced);
        for (const patient of unsyncedPatients) {
            await syncPatient(patient);
            syncCount++;
        }

        // Sync vitals
        const unsyncedVitals = vitals.filter(v => !v.synced);
        for (const vital of unsyncedVitals) {
            await syncVital(vital);
            syncCount++;
        }

        // Sync medications
        const unsyncedMeds = medications.filter(m => !m.synced);
        for (const med of unsyncedMeds) {
            await syncMedication(med);
            syncCount++;
        }

        pendingSync = [];
        saveData();
        updateStats();
        showToast(`Synced ${syncCount} items successfully`, 'success');
    } catch (error) {
        showToast('Sync error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function syncPatient(patient) {
    const response = await fetch(`${API_CONFIG.baseUrl}/patients`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify(patient)
    });

    if (response.ok) {
        patient.synced = true;
    }
}

async function syncVital(vital) {
    const response = await fetch(`${API_CONFIG.baseUrl}/vitals`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify(vital)
    });

    if (response.ok) {
        vital.synced = true;
    }
}

async function syncMedication(med) {
    const response = await fetch(`${API_CONFIG.baseUrl}/medications`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify(med)
    });

    if (response.ok) {
        med.synced = true;
    }
}

async function fetchPatientsFromServer() {
    if (!API_CONFIG.enabled || !isOnline) return;

    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/patients`, {
            headers: { 'Authorization': `Bearer ${API_CONFIG.apiKey}` }
        });

        if (response.ok) {
            const serverPatients = await response.json();
            // Merge with local data
            patients = [...patients, ...serverPatients.filter(sp => !patients.find(lp => lp.id === sp.id))];
            saveData();
            renderPatientList();
        }
    } catch (error) {
        console.error('Failed to fetch patients:', error);
    }
}

function saveApiConfig() {
    API_CONFIG.baseUrl = document.getElementById('apiUrl').value;
    API_CONFIG.apiKey = document.getElementById('apiKey').value;
    API_CONFIG.enabled = !!(API_CONFIG.baseUrl && API_CONFIG.apiKey);

    localStorage.setItem('api_baseUrl', API_CONFIG.baseUrl);
    localStorage.setItem('api_apiKey', API_CONFIG.apiKey);

    showToast('API configuration saved', 'success');
    updateConnectionStatus();

    if (API_CONFIG.enabled) {
        testConnection();
    }
}
