import Dexie, { Table } from 'dexie'
import bcrypt from 'bcryptjs'

// ============ TYPES ============
export interface User {
    id?: number
    name: string
    role: 'doctor' | 'nurse'
    passwordHash: string
}

export interface Patient {
    id?: number
    name: string
    mrn: string
    bedNumber: string
    dob: string
    gender: 'male' | 'female'
    weight?: number
    height?: number // cm
    bloodGroup?: string
    emergencyContact?: string
    address?: string
    insuranceProvider?: string
    insurancePolicyNumber?: string
    nextOfKinName?: string
    nextOfKinRelation?: string
    nextOfKinPhone?: string

    // Clinical Data
    diagnosis: string
    allergies: string
    chiefComplaint?: string
    historyPresentIllness?: string
    pastMedicalHistory?: string[]
    surgicalHistory?: string[]
    socialHistory?: string[] // smoking, alcohol, etc.
    familyHistory?: string[]

    status: 'active' | 'discharged'
    admissionDate: string
    photoUrl?: string
}

export interface Vital {
    id?: number
    patientId: number
    recordedAt: string
    recordedBy: string
    bpSystolic: number
    bpDiastolic: number
    temp: number
    pulse: number
    spo2: number
    pain: number
    notes: string
}

export interface Medication {
    id?: number
    patientId: number
    name: string
    dosage: string
    route: string
    frequency: string
    prn: boolean
    startDate: string
    lastGiven?: string
}

export interface Meal {
    id?: number
    patientId: number
    recordedAt: string
    recordedBy: string
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    description: string
    amountConsumed: 'none' | '25%' | '50%' | '75%' | '100%'
    notes: string
}

export interface Symptom {
    id?: number
    patientId: number
    recordedAt: string
    recordedBy: string
    symptom: string
    severity: 'mild' | 'moderate' | 'severe'
    notes: string
}

export interface ProgressNote {
    id?: number
    patientId: number
    date: string
    author: string
    type: 'Admission' | 'Daily' | 'Discharge' | 'Consult'
    note: string // SOAP format or free text
}

export interface LabResult {
    id?: number
    patientId: number
    date: string
    testName: string
    result: string
    units: string
    referenceRange: string
    flag?: 'High' | 'Low' | 'Normal' | 'Critical'
}

// ============ DATABASE ============
class WardDatabase extends Dexie {
    users!: Table<User>
    patients!: Table<Patient>
    vitals!: Table<Vital>
    medications!: Table<Medication>
    meals!: Table<Meal>
    symptoms!: Table<Symptom>
    progressNotes!: Table<ProgressNote>
    labResults!: Table<LabResult>

    constructor() {
        super('WardDB')
        this.version(5).stores({
            users: '++id, name',
            patients: '++id, mrn, bedNumber',
            vitals: '++id, patientId, recordedAt',
            medications: '++id, patientId',
            meals: '++id, patientId, recordedAt',
            symptoms: '++id, patientId, recordedAt',
            progressNotes: '++id, patientId, date',
            labResults: '++id, patientId, date'
        })
    }
}

export const db = new WardDatabase()

// ============ UTILITIES ============

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: string): number {
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
    }
    return age
}

/**
 * Generate gender-appropriate avatar URL using DiceBear API
 */
export function generateAvatarUrl(name: string, gender: 'male' | 'female'): string {
    const seed = encodeURIComponent(name)
    if (gender === 'male') {
        return `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4`
    } else {
        return `https://api.dicebear.com/7.x/lorelei/svg?seed=${seed}&backgroundColor=ffd5dc`
    }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10)
    return bcrypt.hash(password, salt)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

/**
 * Authenticate user by name and password
 */
export async function authenticateUser(name: string, password: string): Promise<User | null> {
    try {
        const users = await db.users.toArray()

        // Find user by name (case-insensitive partial match)
        for (const user of users) {
            if (user.name.toLowerCase().includes(name.toLowerCase())) {
                const isValid = await verifyPassword(password, user.passwordHash)
                if (isValid) {
                    return user
                }
            }
        }
        return null
    } catch (error) {
        console.error('Authentication error:', error)
        return null
    }
}

// ============ DATABASE INITIALIZATION ============

/**
 * Initialize database with seed data
 */
export async function seedDatabase(): Promise<void> {
    try {
        // Migrate existing users without passwordHash
        const existingUsers = await db.users.toArray()
        for (const user of existingUsers) {
            if (!user.passwordHash) {
                const defaultPassword = user.role === 'doctor' ? 'doctor123' : 'nurse123'
                const hash = await hashPassword(defaultPassword)
                await db.users.update(user.id!, { passwordHash: hash })
            }
        }

        // Seed users if none exist
        const userCount = await db.users.count()
        if (userCount === 0) {
            const doctorHash = await hashPassword('doctor123')
            const nurseHash = await hashPassword('nurse123')

            await db.users.bulkAdd([
                { name: 'Dr. Priya Sharma', role: 'doctor', passwordHash: doctorHash },
                { name: 'Nurse Anita Verma', role: 'nurse', passwordHash: nurseHash }
            ])
        }

        // Seed patients if none exist
        const patientCount = await db.patients.count()
        if (patientCount === 0) {
            const today = new Date().toISOString().split('T')[0]

            await db.patients.bulkAdd([
                {
                    name: 'Ramesh Patel',
                    mrn: 'MRN001',
                    bedNumber: 'A1',
                    dob: '1965-03-15',
                    gender: 'male',
                    weight: 68,
                    height: 172,
                    bloodGroup: 'B+',
                    emergencyContact: '+91 98765 43210',
                    address: '123 MG Road, Mumbai',
                    insuranceProvider: 'HDFC Ergo',
                    insurancePolicyNumber: 'POL-123456789',
                    nextOfKinName: 'Suresh Patel',
                    nextOfKinRelation: 'Son',
                    nextOfKinPhone: '+91 98765 43210',
                    diagnosis: 'Community Acquired Pneumonia',
                    allergies: 'Penicillin',
                    chiefComplaint: 'Fever and shortness of breath for 3 days',
                    historyPresentIllness: '68-year-old male with 3-day history of high grade fever, productive cough with yellow sputum, and progressive dyspnea. No chest pain or palpitations.',
                    pastMedicalHistory: ['Hypertension (10 years)', 'Type 2 Diabetes Mellitus (5 years)'],
                    surgicalHistory: ['Appendectomy (1985)'],
                    socialHistory: ['Non-smoker', 'Occasional alcohol'],
                    familyHistory: ['Father died of MI at 60', 'Mother has diabetes'],
                    status: 'active',
                    admissionDate: today,
                    photoUrl: generateAvatarUrl('Ramesh Patel', 'male')
                },
                {
                    name: 'Sunita Devi',
                    mrn: 'MRN002',
                    bedNumber: 'A2',
                    dob: '1972-08-22',
                    gender: 'female',
                    weight: 55,
                    height: 160,
                    bloodGroup: 'O+',
                    emergencyContact: '+91 87654 32109',
                    address: '45 Park Street, Kolkata',
                    insuranceProvider: 'Star Health',
                    insurancePolicyNumber: 'POL-987654321',
                    nextOfKinName: 'Rajesh Kumar',
                    nextOfKinRelation: 'Husband',
                    nextOfKinPhone: '+91 87654 32109',
                    diagnosis: 'Uncontrolled Hypertension',
                    allergies: 'None',
                    chiefComplaint: 'Severe headache and dizziness',
                    historyPresentIllness: '52-year-old female presenting with sudden onset severe occipital headache and dizziness. BP recorded 180/110 at home.',
                    pastMedicalHistory: ['Hypertension (diagnosed 1 year ago, non-compliant)'],
                    surgicalHistory: ['C-Section x2'],
                    socialHistory: ['Teacher by profession', 'No tobacco/alcohol'],
                    familyHistory: ['Mother had stroke at 65'],
                    status: 'active',
                    admissionDate: today,
                    photoUrl: generateAvatarUrl('Sunita Devi', 'female')
                },
                {
                    name: 'Mohammed Hussain',
                    mrn: 'MRN003',
                    bedNumber: 'A3',
                    dob: '1958-11-10',
                    gender: 'male',
                    weight: 72,
                    height: 175,
                    bloodGroup: 'AB-',
                    emergencyContact: '+91 76543 21098',
                    address: '78 Mosque Road, Bangalore',
                    insuranceProvider: 'LIC',
                    insurancePolicyNumber: 'POL-456123789',
                    nextOfKinName: 'Aisha Hussain',
                    nextOfKinRelation: 'Wife',
                    nextOfKinPhone: '+91 76543 21098',
                    diagnosis: 'Diabetic Ketoacidosis',
                    allergies: 'Iodine contrast',
                    chiefComplaint: 'Abdominal pain, vomiting, and confusion',
                    historyPresentIllness: '65-year-old male with history of T2DM admitted with DKA. Presented with abdominal pain, vomiting, and altered sensorium.',
                    pastMedicalHistory: ['Type 2 Diabetes Mellitus (20 years)', 'Diabetic Neuropathy'],
                    surgicalHistory: ['Cataract surgery (2020)'],
                    socialHistory: ['Ex-smoker (quit 10 years ago)'],
                    familyHistory: ['Brother has renal failure'],
                    status: 'active',
                    admissionDate: today,
                    photoUrl: generateAvatarUrl('Mohammed Hussain', 'male')
                },
                {
                    name: 'Lakshmi Narayanan',
                    mrn: 'MRN004',
                    bedNumber: 'B1',
                    dob: '1980-05-28',
                    gender: 'female',
                    weight: 58,
                    height: 162,
                    bloodGroup: 'A+',
                    emergencyContact: '+91 65432 10987',
                    address: '90 Temple Street, Chennai',
                    insuranceProvider: 'None',
                    nextOfKinName: 'Narayanan K',
                    nextOfKinRelation: 'Husband',
                    nextOfKinPhone: '+91 65432 10987',
                    diagnosis: 'Acute Appendicitis - Post-Op',
                    allergies: 'Morphine',
                    chiefComplaint: 'RLQ abdominal pain',
                    historyPresentIllness: '44-year-old female post-op day 1 following laparoscopic appendectomy. Pain well controlled.',
                    pastMedicalHistory: ['None'],
                    surgicalHistory: ['Laparoscopic Appendectomy (yesterday)'],
                    socialHistory: ['Housewife', 'Vegetarian'],
                    familyHistory: ['No significant history'],
                    status: 'active',
                    admissionDate: today,
                    photoUrl: generateAvatarUrl('Lakshmi Narayanan', 'female')
                },
                {
                    name: 'Vikram Singh',
                    mrn: 'MRN005',
                    bedNumber: 'B2',
                    dob: '1945-12-03',
                    gender: 'male',
                    weight: 65,
                    height: 168,
                    bloodGroup: 'B-',
                    emergencyContact: '+91 54321 09876',
                    address: '12 Fort Road, Jaipur',
                    insuranceProvider: 'CGHS',
                    insurancePolicyNumber: 'CGHS-12345',
                    nextOfKinName: 'Rohan Singh',
                    nextOfKinRelation: 'Son',
                    nextOfKinPhone: '+91 54321 09876',
                    diagnosis: 'Congestive Heart Failure',
                    allergies: 'ACE Inhibitors (Cough)',
                    chiefComplaint: 'Worsening breathlessness and leg swelling',
                    historyPresentIllness: '78-year-old male known case of CHF presenting with decompensation. Orthopnea + PND present.',
                    pastMedicalHistory: ['CHF (EF 35%)', 'CAD (Post-PTCA 2015)', 'CKD Stage 3'],
                    surgicalHistory: ['PTCA to LAD (2015)', 'TURP (2018)'],
                    socialHistory: ['Chronic smoker'],
                    familyHistory: ['Father died of stroke'],
                    status: 'active',
                    admissionDate: today,
                    photoUrl: generateAvatarUrl('Vikram Singh', 'male')
                },
                {
                    name: 'Fatima Begum',
                    mrn: 'MRN006',
                    bedNumber: 'B3',
                    dob: '1990-02-14',
                    gender: 'female',
                    weight: 52,
                    height: 158,
                    bloodGroup: 'O-',
                    emergencyContact: '+91 43210 98765',
                    address: '34 Market Road, Hyderabad',
                    insuranceProvider: 'Corporate',
                    insurancePolicyNumber: 'C-98765',
                    nextOfKinName: 'Ahmed Khan',
                    nextOfKinRelation: 'Husband',
                    nextOfKinPhone: '+91 43210 98765',
                    diagnosis: 'Acute Gastroenteritis',
                    allergies: 'None',
                    chiefComplaint: 'Loose stools and vomiting',
                    historyPresentIllness: '34-year-old female with 1-day history of multiple episodes of watery diarrhea and vomiting. Signs of dehydration present.',
                    pastMedicalHistory: ['None'],
                    surgicalHistory: ['None'],
                    socialHistory: ['Works in IT'],
                    familyHistory: ['Diabetes in mother'],
                    status: 'active',
                    admissionDate: today,
                    photoUrl: generateAvatarUrl('Fatima Begum', 'female')
                }
            ])

            // Add medications
            await db.medications.bulkAdd([
                { patientId: 1, name: 'Azithromycin', dosage: '500mg', route: 'IV', frequency: 'Once daily', prn: false, startDate: today, lastGiven: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
                { patientId: 1, name: 'Paracetamol', dosage: '650mg', route: 'Oral', frequency: 'Q6H', prn: false, startDate: today, lastGiven: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
                { patientId: 2, name: 'Amlodipine', dosage: '10mg', route: 'Oral', frequency: 'Once daily', prn: false, startDate: today, lastGiven: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
                { patientId: 3, name: 'Insulin Regular', dosage: '10 units', route: 'SC', frequency: 'Q6H', prn: false, startDate: today, lastGiven: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
                { patientId: 4, name: 'Ceftriaxone', dosage: '1g', route: 'IV', frequency: 'BID', prn: false, startDate: today, lastGiven: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
                { patientId: 5, name: 'Furosemide', dosage: '40mg', route: 'IV', frequency: 'BID', prn: false, startDate: today, lastGiven: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
                { patientId: 6, name: 'Ondansetron', dosage: '4mg', route: 'IV', frequency: 'PRN', prn: true, startDate: today, lastGiven: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() }
            ])

            // Add Progress Notes
            await db.progressNotes.bulkAdd([
                { patientId: 1, date: new Date().toISOString(), author: 'Dr. Priya Sharma', type: 'Admission', note: 'Patient admitted with fever and cough. Started on IV antibiotics. Monitor vitals Q4H.' },
                { patientId: 2, date: new Date().toISOString(), author: 'Dr. Priya Sharma', type: 'Admission', note: 'Admitted for hypertensive urgency. BP control with oral meds attempted. Watch for signs of end-organ damage.' },
                { patientId: 3, date: new Date().toISOString(), author: 'Dr. Priya Sharma', type: 'Admission', note: 'DKA logic protocol started. Hourly RBS monitoring.' }
            ])

            // Add Lab Results
            await db.labResults.bulkAdd([
                { patientId: 1, date: new Date().toISOString(), testName: 'WBC', result: '14,000', units: '/µL', referenceRange: '4,000-11,000', flag: 'High' },
                { patientId: 1, date: new Date().toISOString(), testName: 'Hemoglobin', result: '13.5', units: 'g/dL', referenceRange: '13.5-17.5', flag: 'Normal' },
                { patientId: 1, date: new Date().toISOString(), testName: 'CRP', result: '45', units: 'mg/L', referenceRange: '<5', flag: 'High' },
                { patientId: 3, date: new Date().toISOString(), testName: 'Glucose (Random)', result: '450', units: 'mg/dL', referenceRange: '70-140', flag: 'Critical' },
                { patientId: 3, date: new Date().toISOString(), testName: 'pH', result: '7.25', units: '', referenceRange: '7.35-7.45', flag: 'Low' },
                { patientId: 5, date: new Date().toISOString(), testName: 'BNP', result: '1200', units: 'pg/mL', referenceRange: '<100', flag: 'High' },
                { patientId: 5, date: new Date().toISOString(), testName: 'Creatinine', result: '1.8', units: 'mg/dL', referenceRange: '0.7-1.3', flag: 'High' }
            ])
        }
    } catch (error) {
        console.error('Database initialization error:', error)
    }
}

// Initialize database on module load
seedDatabase()
