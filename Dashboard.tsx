import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db, User, Patient, Medication, calculateAge, generateAvatarUrl } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Users, Bed, LogOut, Plus, Clock, Pill, AlertTriangle, Utensils, Bell, X } from 'lucide-react'
import { formatDistanceToNow, differenceInHours } from 'date-fns'

interface DashboardProps {
    user: User
    onLogout: () => void
}

interface Reminder {
    id: string
    type: 'medication' | 'meal'
    patientId: number
    patientName: string
    bedNumber: string
    title: string
    detail: string
    isOverdue: boolean
    time: Date
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
    const patients = useLiveQuery(() => db.patients.toArray()) ?? []
    const medications = useLiveQuery(() => db.medications.toArray()) ?? []
    const meals = useLiveQuery(() => db.meals.toArray()) ?? []
    const [showAddModal, setShowAddModal] = useState(false)
    const [showReminders, setShowReminders] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

    // Update time every minute for reminder calculations
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(interval)
    }, [])

    const activePatients = patients.filter(p => p.status === 'active')

    // Generate reminders
    const generateReminders = (): Reminder[] => {
        const reminders: Reminder[] = []
        const now = currentTime

        // Medication reminders - check if medication is due based on frequency
        medications.forEach(med => {
            const patient = patients.find(p => p.id === med.patientId)
            if (!patient || patient.status !== 'active') return

            const lastGiven = med.lastGiven ? new Date(med.lastGiven) : null
            let hoursThreshold = 24 // default

            // Parse frequency to determine threshold
            if (med.frequency.includes('Q4H')) hoursThreshold = 4
            else if (med.frequency.includes('Q6H')) hoursThreshold = 6
            else if (med.frequency.includes('Q8H')) hoursThreshold = 8
            else if (med.frequency.includes('BID')) hoursThreshold = 12
            else if (med.frequency.includes('TID')) hoursThreshold = 8
            else if (med.frequency.includes('daily')) hoursThreshold = 24

            if (!med.prn) {
                const hoursSinceGiven = lastGiven ? differenceInHours(now, lastGiven) : hoursThreshold + 1
                const isOverdue = hoursSinceGiven >= hoursThreshold

                if (isOverdue || hoursSinceGiven >= hoursThreshold - 1) {
                    reminders.push({
                        id: `med-${med.id}`,
                        type: 'medication',
                        patientId: patient.id!,
                        patientName: patient.name,
                        bedNumber: patient.bedNumber,
                        title: med.name,
                        detail: `${med.dosage} • ${med.route}`,
                        isOverdue,
                        time: lastGiven || new Date(med.startDate)
                    })
                }
            }
        })

        // Meal reminders based on time of day
        const hour = now.getHours()
        const mealSchedule = [
            { type: 'breakfast', start: 7, end: 9 },
            { type: 'lunch', start: 12, end: 14 },
            { type: 'dinner', start: 18, end: 20 }
        ]

        const currentMeal = mealSchedule.find(m => hour >= m.start && hour <= m.end)

        if (currentMeal) {
            activePatients.forEach(patient => {
                // Check if meal was already logged today
                const todayMeals = meals.filter(m => {
                    const mealDate = new Date(m.recordedAt)
                    return m.patientId === patient.id &&
                        m.type === currentMeal.type &&
                        mealDate.toDateString() === now.toDateString()
                })

                if (todayMeals.length === 0) {
                    reminders.push({
                        id: `meal-${patient.id}-${currentMeal.type}`,
                        type: 'meal',
                        patientId: patient.id!,
                        patientName: patient.name,
                        bedNumber: patient.bedNumber,
                        title: currentMeal.type.charAt(0).toUpperCase() + currentMeal.type.slice(1),
                        detail: 'Meal not logged',
                        isOverdue: hour > currentMeal.start + 1,
                        time: now
                    })
                }
            })
        }

        // Sort: overdue first, then by time
        return reminders.sort((a, b) => {
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
            return b.time.getTime() - a.time.getTime()
        })
    }

    const reminders = generateReminders()
    const overdueCount = reminders.filter(r => r.isOverdue).length

    // Get last medication for a patient
    const getLastMedication = (patientId: number): Medication | undefined => {
        const patientMeds = medications
            .filter(m => m.patientId === patientId && m.lastGiven)
            .sort((a, b) => new Date(b.lastGiven!).getTime() - new Date(a.lastGiven!).getTime())
        return patientMeds[0]
    }

    return (
        <div className="min-h-screen p-4 md:p-6 pb-20">
            {/* Header */}
            {/* Header */}
            <header className="header">
                <div>
                    <h1 className="flex items-center gap-2">
                        🏥 Open Ward
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">General Ward Dashboard</p>
                </div>
                <div className="user-info">
                    <div className="text-right hidden sm:block">
                        <p className="user-name">{user.name}</p>
                        <p className="user-role">{user.role}</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-all"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Reminders Panel */}
            {reminders.length > 0 && showReminders && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-amber-400" />
                            <h3 className="text-white font-semibold">
                                Reminders
                                {overdueCount > 0 && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                        {overdueCount} overdue
                                    </span>
                                )}
                            </h3>
                        </div>
                        <button
                            onClick={() => setShowReminders(false)}
                            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {reminders.slice(0, 6).map(reminder => (
                            <Link
                                key={reminder.id}
                                to={`/patient/${reminder.patientId}`}
                                className={`flex items-start gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] ${reminder.isOverdue
                                    ? 'bg-red-500/20 border border-red-500/30'
                                    : 'bg-white/5 border border-white/10'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${reminder.type === 'medication'
                                    ? 'bg-indigo-500/20 text-indigo-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                    }`}>
                                    {reminder.type === 'medication' ? <Pill className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium text-sm truncate">{reminder.title}</span>
                                        {reminder.isOverdue && (
                                            <span className="text-red-400 text-xs font-medium">OVERDUE</span>
                                        )}
                                    </div>
                                    <p className="text-gray-400 text-xs truncate">{reminder.detail}</p>
                                    <p className="text-gray-500 text-xs mt-1">
                                        {reminder.patientName} • Bed {reminder.bedNumber}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                    {reminders.length > 6 && (
                        <p className="text-gray-500 text-sm text-center mt-3">
                            +{reminders.length - 6} more reminders
                        </p>
                    )}
                </div>
            )
            }

            {/* Collapsed reminder indicator */}
            {
                reminders.length > 0 && !showReminders && (
                    <button
                        onClick={() => setShowReminders(true)}
                        className="mb-6 flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-all"
                    >
                        <Bell className="w-4 h-4" />
                        {reminders.length} reminder{reminders.length > 1 ? 's' : ''}
                        {overdueCount > 0 && <span className="text-red-400">({overdueCount} overdue)</span>}
                    </button>
                )
            }

            {/* Stats Row */}
            <div className="stats-grid">
                <StatCard icon={Users} label="Total Patients" value={patients.length} />
                <StatCard icon={Bed} label="Active Beds" value={activePatients.length} />
                <StatCard icon={Pill} label="Med Reminders" value={reminders.filter(r => r.type === 'medication').length} />
                <StatCard icon={AlertTriangle} label="Overdue" value={overdueCount} />
            </div>

            {/* Section Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Patients</h2>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary"
                >
                    <Plus className="w-4 h-4" />
                    Add Patient
                </button>
            </div>

            {/* Patient Grid */}
            <div className="patient-list">
                <div className="list-header">
                    <h2>Current Inpatients</h2>
                </div>
                {patients.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👤</div>
                        <p>No patients yet. Add your first patient.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {patients.map(patient => {
                            const lastMed = getLastMedication(patient.id!)
                            return (
                                <PatientGridCard
                                    key={patient.id}
                                    patient={patient}
                                    lastMedication={lastMed}
                                />
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Add Patient Modal */}
            {
                showAddModal && (
                    <AddPatientModal onClose={() => setShowAddModal(false)} />
                )
            }
        </div >
    )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
    return (
        <div className="stat-card">
            <h3>
                <Icon className="w-3 h-3 inline-block mr-1 mb-0.5" />
                {label}
            </h3>
            <div className="stat-value">{value}</div>
        </div>
    )
}

function PatientGridCard({ patient, lastMedication }: { patient: Patient; lastMedication?: Medication }) {
    const age = calculateAge(patient.dob)

    return (
        <Link
            to={`/patient/${patient.id}`}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all hover:scale-[1.02] flex flex-col gap-4 overflow-hidden"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        {patient.photoUrl ? (
                            <img
                                src={patient.photoUrl}
                                alt={patient.name}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                                {patient.name.charAt(0)}
                            </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-[#1e293b]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white truncate max-w-[140px]">{patient.name}</h3>
                        <p className="text-xs text-gray-400">{age} yrs • {patient.gender}</p>
                    </div>
                </div>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-medium px-2 py-1 rounded-lg border border-indigo-500/20">
                    Bed {patient.bedNumber}
                </span>
            </div>

            <div>
                <p className="text-xs text-gray-500 mb-1">Diagnosis</p>
                <p className="text-sm text-gray-300 truncate">{patient.diagnosis}</p>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="text-xs">
                    {lastMedication ? (
                        <>
                            <span className="text-gray-500">Last Med: </span>
                            <span className="text-indigo-400">{formatDistanceToNow(new Date(lastMedication.lastGiven!), { addSuffix: true })}</span>
                        </>
                    ) : (
                        <span className="text-gray-500">No meds recorded</span>
                    )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50">
                    →
                </div>
            </div>
        </Link>
    )
}

function AddPatientModal({ onClose }: { onClose: () => void }) {
    const [form, setForm] = useState({
        name: '',
        mrn: '',
        bedNumber: '',
        dob: '',
        gender: 'male' as 'male' | 'female',
        weight: '',
        emergencyContact: '',
        diagnosis: '',
        allergies: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError('')

        try {
            await db.patients.add({
                ...form,
                weight: form.weight ? Number(form.weight) : undefined,
                status: 'active',
                admissionDate: new Date().toISOString().split('T')[0],
                photoUrl: generateAvatarUrl(form.name, form.gender)
            })
            onClose()
        } catch (err) {
            console.error('Failed to add patient:', err)
            setError('Failed to add patient. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-6">Add New Patient</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Full Name"
                        required
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="MRN"
                            required
                            value={form.mrn}
                            onChange={e => setForm({ ...form, mrn: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                            type="text"
                            placeholder="Bed Number"
                            required
                            value={form.bedNumber}
                            onChange={e => setForm({ ...form, bedNumber: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="date"
                            placeholder="Date of Birth"
                            required
                            value={form.dob}
                            onChange={e => setForm({ ...form, dob: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <select
                            value={form.gender}
                            onChange={e => setForm({ ...form, gender: e.target.value as 'male' | 'female' })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            placeholder="Weight (kg)"
                            value={form.weight}
                            onChange={e => setForm({ ...form, weight: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                            type="tel"
                            placeholder="Emergency Contact"
                            value={form.emergencyContact}
                            onChange={e => setForm({ ...form, emergencyContact: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Diagnosis"
                        required
                        value={form.diagnosis}
                        onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                        type="text"
                        placeholder="Allergies (optional)"
                        value={form.allergies}
                        onChange={e => setForm({ ...form, allergies: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-medium hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white font-medium transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Adding...' : 'Add Patient'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
