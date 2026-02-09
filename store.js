// ==========================================
// CONFIGURATION & DATA STORE
// ==========================================

const API_CONFIG = {
    baseUrl: localStorage.getItem('api_baseUrl') || '',
    apiKey: localStorage.getItem('api_apiKey') || '',
    enabled: false
};

const users = [
    { id: '1', name: 'Dr. Priya Sharma', role: 'doctor', pin: '1234' },
    { id: '2', name: 'Nurse Anita Verma', role: 'nurse', pin: '5678' },
    { id: '3', name: 'Dr. Rajesh Kumar', role: 'doctor', pin: '4321' }
];

let patients = JSON.parse(localStorage.getItem('ward_patients')) || [];
let vitals = JSON.parse(localStorage.getItem('ward_vitals')) || [];
let medications = JSON.parse(localStorage.getItem('ward_medications')) || [];
let pendingSync = JSON.parse(localStorage.getItem('ward_pendingSync')) || [];
let currentUser = null;
let currentPatient = null;
let enteredPin = '';
let isOnline = navigator.onLine;

// ==========================================
// DATA PERSISTENCE
// ==========================================

function saveData() {
    localStorage.setItem('ward_patients', JSON.stringify(patients));
    localStorage.setItem('ward_vitals', JSON.stringify(vitals));
    localStorage.setItem('ward_medications', JSON.stringify(medications));
    localStorage.setItem('ward_pendingSync', JSON.stringify(pendingSync));
}

// Comprehensive mock data
function initializeSampleData() {
    if (patients.length === 0) {
        const today = new Date();
        const formatDate = (daysAgo) => {
            const d = new Date(today);
            d.setDate(d.getDate() - daysAgo);
            return d.toISOString().split('T')[0];
        };

        patients = [
            { id: '1', name: 'Ramesh Patel', mrn: 'MRN001', bedNumber: 'A1', dob: '1965-03-15', diagnosis: 'Community Acquired Pneumonia', allergies: 'Penicillin, Sulfa', status: 'active', admissionDate: formatDate(3), synced: true },
            { id: '2', name: 'Sunita Devi', mrn: 'MRN002', bedNumber: 'A2', dob: '1972-08-22', diagnosis: 'Uncontrolled Hypertension', allergies: 'None', status: 'active', admissionDate: formatDate(5), synced: true },
            { id: '3', name: 'Mohammed Hussain', mrn: 'MRN003', bedNumber: 'A3', dob: '1958-11-10', diagnosis: 'Diabetic Ketoacidosis', allergies: 'Iodine contrast', status: 'active', admissionDate: formatDate(2), synced: true },
            { id: '4', name: 'Lakshmi Narayanan', mrn: 'MRN004', bedNumber: 'B1', dob: '1980-05-28', diagnosis: 'Acute Appendicitis - Post-Op Day 1', allergies: 'Morphine', status: 'active', admissionDate: formatDate(1), synced: true },
            { id: '5', name: 'Vikram Singh', mrn: 'MRN005', bedNumber: 'B2', dob: '1945-12-03', diagnosis: 'Congestive Heart Failure (NYHA III)', allergies: 'ACE Inhibitors', status: 'active', admissionDate: formatDate(7), synced: true },
            { id: '6', name: 'Fatima Begum', mrn: 'MRN006', bedNumber: 'B3', dob: '1990-02-14', diagnosis: 'Acute Gastroenteritis with Dehydration', allergies: 'None', status: 'active', admissionDate: formatDate(1), synced: true },
            { id: '7', name: 'Arun Kumar', mrn: 'MRN007', bedNumber: 'C1', dob: '1978-07-19', diagnosis: 'Cellulitis - Left Lower Limb', allergies: 'Cephalosporins', status: 'active', admissionDate: formatDate(4), synced: true },
            { id: '8', name: 'Meera Krishnan', mrn: 'MRN008', bedNumber: 'C2', dob: '1955-09-30', diagnosis: 'Acute Exacerbation of COPD', allergies: 'Aspirin', status: 'active', admissionDate: formatDate(2), synced: true },
            { id: '9', name: 'Suresh Yadav', mrn: 'MRN009', bedNumber: 'C3', dob: '1968-04-05', diagnosis: 'Chronic Kidney Disease Stage 4', allergies: 'NSAIDs, Metformin', status: 'active', admissionDate: formatDate(10), synced: true },
            { id: '10', name: 'Anjali Gupta', mrn: 'MRN010', bedNumber: 'D1', dob: '1985-01-25', diagnosis: 'Severe Preeclampsia - 34 weeks', allergies: 'Latex', status: 'active', admissionDate: formatDate(0), synced: true }
        ];

        // Generate vitals for each patient
        vitals = [];
        patients.forEach(patient => {
            const numReadings = Math.floor(Math.random() * 5) + 3;
            for (let i = 0; i < numReadings; i++) {
                const hoursAgo = i * 6 + Math.floor(Math.random() * 3);
                const recordedAt = new Date(today);
                recordedAt.setHours(recordedAt.getHours() - hoursAgo);

                vitals.push({
                    id: `v${patient.id}-${i}`,
                    patientId: patient.id,
                    recordedAt: recordedAt.toISOString(),
                    recordedBy: i % 2 === 0 ? 'Nurse Anita Verma' : 'Dr. Priya Sharma',
                    bpSystolic: 110 + Math.floor(Math.random() * 40),
                    bpDiastolic: 65 + Math.floor(Math.random() * 25),
                    temp: (97.5 + Math.random() * 3).toFixed(1),
                    pulse: 65 + Math.floor(Math.random() * 35),
                    spo2: 94 + Math.floor(Math.random() * 6),
                    pain: Math.floor(Math.random() * 6),
                    notes: '',
                    synced: true
                });
            }
        });

        // Add medications for patients
        medications = [
            // Ramesh Patel - Pneumonia
            { id: 'm1', patientId: '1', name: 'Azithromycin', dosage: '500mg', route: 'IV', frequency: 'Once daily', scheduledTimes: '10:00', prn: false, startDate: formatDate(3), synced: true },
            { id: 'm2', patientId: '1', name: 'Paracetamol', dosage: '650mg', route: 'Oral', frequency: 'Q6H', scheduledTimes: '06:00, 12:00, 18:00, 00:00', prn: false, startDate: formatDate(3), synced: true },
            { id: 'm3', patientId: '1', name: 'Salbutamol Nebulization', dosage: '2.5mg', route: 'Inhalation', frequency: 'Q8H', scheduledTimes: '08:00, 16:00, 00:00', prn: false, startDate: formatDate(3), synced: true },

            // Sunita Devi - Hypertension
            { id: 'm4', patientId: '2', name: 'Amlodipine', dosage: '10mg', route: 'Oral', frequency: 'Once daily', scheduledTimes: '08:00', prn: false, startDate: formatDate(5), synced: true },
            { id: 'm5', patientId: '2', name: 'Telmisartan', dosage: '40mg', route: 'Oral', frequency: 'Once daily', scheduledTimes: '08:00', prn: false, startDate: formatDate(5), synced: true },

            // Mohammed Hussain - DKA
            { id: 'm6', patientId: '3', name: 'Insulin Regular', dosage: 'Per sliding scale', route: 'Subcutaneous', frequency: 'Q6H', scheduledTimes: '06:00, 12:00, 18:00, 00:00', prn: false, startDate: formatDate(2), synced: true },
            { id: 'm7', patientId: '3', name: 'Normal Saline', dosage: '1000ml', route: 'IV', frequency: 'Q8H', scheduledTimes: '08:00, 16:00, 00:00', prn: false, startDate: formatDate(2), synced: true },
            { id: 'm8', patientId: '3', name: 'Potassium Chloride', dosage: '20mEq', route: 'IV', frequency: 'BID', scheduledTimes: '08:00, 20:00', prn: false, startDate: formatDate(2), synced: true },

            // Lakshmi Narayanan - Post-Op
            { id: 'm9', patientId: '4', name: 'Ceftriaxone', dosage: '1g', route: 'IV', frequency: 'BID', scheduledTimes: '08:00, 20:00', prn: false, startDate: formatDate(1), synced: true },
            { id: 'm10', patientId: '4', name: 'Tramadol', dosage: '50mg', route: 'IV', frequency: 'Q8H PRN', scheduledTimes: '', prn: true, startDate: formatDate(1), synced: true },
            { id: 'm11', patientId: '4', name: 'Pantoprazole', dosage: '40mg', route: 'IV', frequency: 'Once daily', scheduledTimes: '08:00', prn: false, startDate: formatDate(1), synced: true },

            // Vikram Singh - CHF
            { id: 'm12', patientId: '5', name: 'Furosemide', dosage: '40mg', route: 'IV', frequency: 'BID', scheduledTimes: '08:00, 14:00', prn: false, startDate: formatDate(7), synced: true },
            { id: 'm13', patientId: '5', name: 'Digoxin', dosage: '0.25mg', route: 'Oral', frequency: 'Once daily', scheduledTimes: '10:00', prn: false, startDate: formatDate(7), synced: true },
            { id: 'm14', patientId: '5', name: 'Carvedilol', dosage: '6.25mg', route: 'Oral', frequency: 'BID', scheduledTimes: '08:00, 20:00', prn: false, startDate: formatDate(7), synced: true },

            // Fatima Begum - Gastroenteritis
            { id: 'm15', patientId: '6', name: 'Ondansetron', dosage: '4mg', route: 'IV', frequency: 'Q8H PRN', scheduledTimes: '', prn: true, startDate: formatDate(1), synced: true },
            { id: 'm16', patientId: '6', name: 'Ringer Lactate', dosage: '1000ml', route: 'IV', frequency: 'Q6H', scheduledTimes: '06:00, 12:00, 18:00, 00:00', prn: false, startDate: formatDate(1), synced: true },
            { id: 'm17', patientId: '6', name: 'Zinc Acetate', dosage: '20mg', route: 'Oral', frequency: 'Once daily', scheduledTimes: '10:00', prn: false, startDate: formatDate(1), synced: true },

            // Arun Kumar - Cellulitis
            { id: 'm18', patientId: '7', name: 'Clindamycin', dosage: '600mg', route: 'IV', frequency: 'Q8H', scheduledTimes: '08:00, 16:00, 00:00', prn: false, startDate: formatDate(4), synced: true },
            { id: 'm19', patientId: '7', name: 'Ibuprofen', dosage: '400mg', route: 'Oral', frequency: 'TID', scheduledTimes: '08:00, 14:00, 20:00', prn: false, startDate: formatDate(4), synced: true },

            // Meera Krishnan - COPD
            { id: 'm20', patientId: '8', name: 'Methylprednisolone', dosage: '40mg', route: 'IV', frequency: 'Q12H', scheduledTimes: '08:00, 20:00', prn: false, startDate: formatDate(2), synced: true },
            { id: 'm21', patientId: '8', name: 'Ipratropium Nebulization', dosage: '500mcg', route: 'Inhalation', frequency: 'Q6H', scheduledTimes: '06:00, 12:00, 18:00, 00:00', prn: false, startDate: formatDate(2), synced: true },
            { id: 'm22', patientId: '8', name: 'Oxygen', dosage: '2L/min', route: 'Inhalation', frequency: 'Continuous', scheduledTimes: '', prn: false, startDate: formatDate(2), synced: true },

            // Suresh Yadav - CKD
            { id: 'm23', patientId: '9', name: 'Erythropoietin', dosage: '4000 IU', route: 'Subcutaneous', frequency: 'Twice weekly', scheduledTimes: 'Mon, Thu 10:00', prn: false, startDate: formatDate(10), synced: true },
            { id: 'm24', patientId: '9', name: 'Calcium Carbonate', dosage: '500mg', route: 'Oral', frequency: 'TID with meals', scheduledTimes: '08:00, 13:00, 19:00', prn: false, startDate: formatDate(10), synced: true },
            { id: 'm25', patientId: '9', name: 'Sodium Bicarbonate', dosage: '650mg', route: 'Oral', frequency: 'TID', scheduledTimes: '08:00, 14:00, 20:00', prn: false, startDate: formatDate(10), synced: true },

            // Anjali Gupta - Preeclampsia
            { id: 'm26', patientId: '10', name: 'Labetalol', dosage: '200mg', route: 'Oral', frequency: 'TID', scheduledTimes: '08:00, 14:00, 20:00', prn: false, startDate: formatDate(0), synced: true },
            { id: 'm27', patientId: '10', name: 'Magnesium Sulfate', dosage: '2g/hr', route: 'IV', frequency: 'Continuous infusion', scheduledTimes: '', prn: false, startDate: formatDate(0), synced: true },
            { id: 'm28', patientId: '10', name: 'Betamethasone', dosage: '12mg', route: 'IM', frequency: 'Q24H x 2 doses', scheduledTimes: '10:00', prn: false, startDate: formatDate(0), synced: true }
        ];

        saveData();
    }
}
