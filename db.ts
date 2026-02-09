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
    emergencyContact?: string
    diagnosis: string
    allergies: string
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

// ============ DATABASE ============
class WardDatabase extends Dexie {
    users!: Table<User>
    patients!: Table<Patient>
    vitals!: Table<Vital>
    medications!: Table<Medication>
    meals!: Table<Meal>
    symptoms!: Table<Symptom>

    constructor() {
        super('WardDB')
        this.version(4).stores({
            users: '++id, name',
            patients: '++id, mrn, bedNumber',
            vitals: '++id, patientId, recordedAt',
            medications: '++id, patientId',
            meals: '++id, patientId, recordedAt',
            symptoms: '++id, patientId, recordedAt'
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
                    emergencyContact: '+91 98765 43210',
                    diagnosis: 'Community Acquired Pneumonia',
                    allergies: 'Penicillin',
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
                    emergencyContact: '+91 87654 32109',
                    diagnosis: 'Uncontrolled Hypertension',
                    allergies: 'None',
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
                    emergencyContact: '+91 76543 21098',
                    diagnosis: 'Diabetic Ketoacidosis',
                    allergies: 'Iodine contrast',
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
                    emergencyContact: '+91 65432 10987',
                    diagnosis: 'Acute Appendicitis - Post-Op',
                    allergies: 'Morphine',
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
                    emergencyContact: '+91 54321 09876',
                    diagnosis: 'Congestive Heart Failure',
                    allergies: 'ACE Inhibitors',
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
                    emergencyContact: '+91 43210 98765',
                    diagnosis: 'Acute Gastroenteritis',
                    allergies: 'None',
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
        }
    } catch (error) {
        console.error('Database initialization error:', error)
    }
}

// Initialize database on module load
seedDatabase()
