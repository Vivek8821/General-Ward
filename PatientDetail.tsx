import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db, User, Vital, Medication, Meal, Symptom, calculateAge } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Plus, Heart, Thermometer, Activity, Wind, AlertCircle, Pill, Utensils, Stethoscope, Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface PatientDetailProps {
    user: User
    onLogout: () => void
}

type TabType = 'vitals' | 'medications' | 'meals' | 'symptoms'

export default function PatientDetail({ user }: PatientDetailProps) {
    const { id } = useParams()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<TabType>('vitals')
    const [showVitalsModal, setShowVitalsModal] = useState(false)
    const [showMealModal, setShowMealModal] = useState(false)
    const [showSymptomModal, setShowSymptomModal] = useState(false)
    const [showMedicationModal, setShowMedicationModal] = useState(false)

    const patient = useLiveQuery(
        () => db.patients.get(Number(id)),
        [id]
    )

    const vitals = useLiveQuery(
        () => db.vitals.where('patientId').equals(Number(id)).reverse().toArray(),
        [id]
    ) ?? []

    const medications = useLiveQuery(
        () => db.medications.where('patientId').equals(Number(id)).toArray(),
        [id]
    ) ?? []

    const meals = useLiveQuery(
        () => db.meals.where('patientId').equals(Number(id)).reverse().toArray(),
        [id]
    ) ?? []

    const symptoms = useLiveQuery(
        () => db.symptoms.where('patientId').equals(Number(id)).reverse().toArray(),
        [id]
    ) ?? []

    const handleGiveMedication = async (medicationId: number) => {
        await db.medications.update(medicationId, {
            lastGiven: new Date().toISOString()
        })
    }

    if (!patient) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">
                Loading...
            </div>
        )
    }

    const tabs: { key: TabType; label: string; icon: any; count: number }[] = [
        { key: 'vitals', label: 'Vitals', icon: Heart, count: vitals.length },
        { key: 'medications', label: 'Medications', icon: Pill, count: medications.length },
        { key: 'meals', label: 'Meals', icon: Utensils, count: meals.length },
        { key: 'symptoms', label: 'Symptoms', icon: Stethoscope, count: symptoms.length },
    ]

    return (
        <div className="min-h-screen bg-black p-4">
            {/* Header */}
            <header className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white">{patient.name}</h1>
                    <p className="text-gray-400 text-sm">Bed {patient.bedNumber} • {patient.mrn}</p>
                </div>
            </header>

            {/* Patient Info Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-6">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">Age</p>
                        <p className="text-white font-medium">{calculateAge(patient.dob)} yrs</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Gender</p>
                        <p className="text-white font-medium capitalize">{patient.gender}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Weight</p>
                        <p className="text-white font-medium">{patient.weight ? `${patient.weight} kg` : 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Emergency Contact</p>
                        <p className="text-white font-medium">{patient.emergencyContact || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Allergies</p>
                        <p className={patient.allergies && patient.allergies !== 'None' ? 'text-red-400 font-medium' : 'text-gray-400'}>
                            {patient.allergies || 'None'}
                        </p>
                    </div>
                    <div>
                        <p className="text-gray-500">Diagnosis</p>
                        <p className="text-amber-400 font-medium">{patient.diagnosis}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-white/20' : 'bg-white/10'
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                {activeTab === 'vitals' && (
                    <VitalsSection
                        vitals={vitals}
                        onAdd={() => setShowVitalsModal(true)}
                    />
                )}
                {activeTab === 'medications' && (
                    <MedicationsSection
                        medications={medications}
                        onGive={handleGiveMedication}
                        isDoctor={user.role === 'doctor'}
                        onAdd={() => setShowMedicationModal(true)}
                    />
                )}
                {activeTab === 'meals' && (
                    <MealsSection
                        meals={meals}
                        onAdd={() => setShowMealModal(true)}
                    />
                )}
                {activeTab === 'symptoms' && (
                    <SymptomsSection
                        symptoms={symptoms}
                        onAdd={() => setShowSymptomModal(true)}
                    />
                )}
            </div>

            {/* Modals */}
            {showVitalsModal && (
                <AddVitalsModal
                    patientId={patient.id!}
                    userName={user.name}
                    onClose={() => setShowVitalsModal(false)}
                />
            )}
            {showMealModal && (
                <AddMealModal
                    patientId={patient.id!}
                    userName={user.name}
                    onClose={() => setShowMealModal(false)}
                />
            )}
            {showSymptomModal && (
                <AddSymptomModal
                    patientId={patient.id!}
                    userName={user.name}
                    onClose={() => setShowSymptomModal(false)}
                />
            )}
            {showMedicationModal && (
                <AddMedicationModal
                    patientId={patient.id!}
                    onClose={() => setShowMedicationModal(false)}
                />
            )}
        </div>
    )
}

// Helper to group records by day
function groupByDay<T extends { recordedAt: string }>(records: T[]): Map<string, T[]> {
    const groups = new Map<string, T[]>()
    records.forEach(record => {
        const date = format(new Date(record.recordedAt), 'yyyy-MM-dd')
        if (!groups.has(date)) {
            groups.set(date, [])
        }
        groups.get(date)!.push(record)
    })
    return groups
}

function DayHeader({ date }: { date: string }) {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let label: string
    if (d.toDateString() === today.toDateString()) {
        label = 'Today'
    } else if (d.toDateString() === yesterday.toDateString()) {
        label = 'Yesterday'
    } else {
        label = format(d, 'EEEE, MMMM d, yyyy')
    }

    return (
        <div className="px-4 py-2 bg-white/5 border-b border-white/10">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">{label}</p>
        </div>
    )
}

// ========== VITALS SECTION ==========
function VitalsSection({ vitals, onAdd }: { vitals: Vital[]; onAdd: () => void }) {
    const groupedVitals = groupByDay(vitals)

    return (
        <>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Vitals</h2>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-white text-sm font-medium transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Record Vitals
                </button>
            </div>

            {vitals.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No vitals recorded yet. Add the first reading.
                </div>
            ) : (
                <div>
                    {Array.from(groupedVitals.entries()).map(([date, dayVitals]) => (
                        <div key={date}>
                            <DayHeader date={date} />
                            <div className="divide-y divide-white/5">
                                {dayVitals.map(vital => (
                                    <div key={vital.id} className="p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <p className="text-gray-400 text-sm">
                                                {format(new Date(vital.recordedAt), 'h:mm a')}
                                            </p>
                                            <p className="text-gray-500 text-xs">{vital.recordedBy}</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <VitalBadge icon={Heart} label="BP" value={`${vital.bpSystolic}/${vital.bpDiastolic}`} color="red" />
                                            <VitalBadge icon={Thermometer} label="Temp" value={`${vital.temp}°F`} color="orange" />
                                            <VitalBadge icon={Activity} label="Pulse" value={String(vital.pulse)} color="pink" />
                                            <VitalBadge icon={Wind} label="SpO2" value={`${vital.spo2}%`} color="blue" />
                                            <VitalBadge icon={AlertCircle} label="Pain" value={`${vital.pain}/10`} color="yellow" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

function VitalBadge({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    const colors: Record<string, string> = {
        red: 'bg-red-500/20 text-red-400',
        orange: 'bg-orange-500/20 text-orange-400',
        pink: 'bg-pink-500/20 text-pink-400',
        blue: 'bg-blue-500/20 text-blue-400',
        yellow: 'bg-yellow-500/20 text-yellow-400',
    }

    return (
        <div className={`rounded-xl p-3 ${colors[color]}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-xs opacity-70">{label}</span>
            </div>
            <p className="text-lg font-bold">{value}</p>
        </div>
    )
}

// ========== MEDICATIONS SECTION ==========
function MedicationsSection({ medications, onGive, isDoctor, onAdd }: {
    medications: Medication[];
    onGive: (id: number) => void;
    isDoctor: boolean;
    onAdd: () => void;
}) {
    return (
        <>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Medications</h2>
                {isDoctor && (
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-sm font-medium transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Prescribe Medication
                    </button>
                )}
            </div>

            {medications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No medications prescribed.
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {medications.map(med => (
                        <div key={med.id} className="p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-white font-semibold">{med.name}</h3>
                                        {med.prn && (
                                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                                                PRN
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-400 text-sm">{med.dosage} • {med.route} • {med.frequency}</p>
                                    {med.lastGiven && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                            <Clock className="w-3 h-3" />
                                            Last given {formatDistanceToNow(new Date(med.lastGiven), { addSuffix: true })}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => onGive(med.id!)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-white text-sm font-medium transition-all"
                                >
                                    Give Now
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

// ========== MEALS SECTION ==========
function MealsSection({ meals, onAdd }: { meals: Meal[]; onAdd: () => void }) {
    const groupedMeals = groupByDay(meals)

    const mealTypeColors: Record<string, string> = {
        breakfast: 'bg-amber-500/20 text-amber-400',
        lunch: 'bg-green-500/20 text-green-400',
        dinner: 'bg-purple-500/20 text-purple-400',
        snack: 'bg-blue-500/20 text-blue-400',
    }

    const amountColors: Record<string, string> = {
        'none': 'text-red-400',
        '25%': 'text-orange-400',
        '50%': 'text-yellow-400',
        '75%': 'text-green-400',
        '100%': 'text-emerald-400',
    }

    return (
        <>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Meals</h2>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl text-white text-sm font-medium transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Log Meal
                </button>
            </div>

            {meals.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No meals logged yet.
                </div>
            ) : (
                <div>
                    {Array.from(groupedMeals.entries()).map(([date, dayMeals]) => (
                        <div key={date}>
                            <DayHeader date={date} />
                            <div className="divide-y divide-white/5">
                                {dayMeals.map(meal => (
                                    <div key={meal.id} className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${mealTypeColors[meal.type]}`}>
                                                    {meal.type}
                                                </span>
                                                <span className="text-gray-400 text-sm">
                                                    {format(new Date(meal.recordedAt), 'h:mm a')}
                                                </span>
                                            </div>
                                            <span className={`text-sm font-medium ${amountColors[meal.amountConsumed]}`}>
                                                {meal.amountConsumed === 'none' ? 'Not eaten' : `${meal.amountConsumed} consumed`}
                                            </span>
                                        </div>
                                        <p className="text-white">{meal.description}</p>
                                        {meal.notes && <p className="text-gray-500 text-sm mt-1">{meal.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

// ========== SYMPTOMS SECTION ==========
function SymptomsSection({ symptoms, onAdd }: { symptoms: Symptom[]; onAdd: () => void }) {
    const groupedSymptoms = groupByDay(symptoms)

    const severityColors: Record<string, string> = {
        mild: 'bg-green-500/20 text-green-400',
        moderate: 'bg-yellow-500/20 text-yellow-400',
        severe: 'bg-red-500/20 text-red-400',
    }

    return (
        <>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Symptoms</h2>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-white text-sm font-medium transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Log Symptom
                </button>
            </div>

            {symptoms.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No symptoms logged yet.
                </div>
            ) : (
                <div>
                    {Array.from(groupedSymptoms.entries()).map(([date, daySymptoms]) => (
                        <div key={date}>
                            <DayHeader date={date} />
                            <div className="divide-y divide-white/5">
                                {daySymptoms.map(symptom => (
                                    <div key={symptom.id} className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-white font-semibold">{symptom.symptom}</h3>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${severityColors[symptom.severity]}`}>
                                                    {symptom.severity}
                                                </span>
                                            </div>
                                            <span className="text-gray-400 text-sm">
                                                {format(new Date(symptom.recordedAt), 'h:mm a')}
                                            </span>
                                        </div>
                                        {symptom.notes && <p className="text-gray-500 text-sm">{symptom.notes}</p>}
                                        <p className="text-gray-600 text-xs mt-2">Recorded by {symptom.recordedBy}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

// ========== MODALS ==========
function AddVitalsModal({ patientId, userName, onClose }: { patientId: number; userName: string; onClose: () => void }) {
    const [form, setForm] = useState({
        bpSystolic: '',
        bpDiastolic: '',
        temp: '',
        pulse: '',
        spo2: '',
        pain: '',
        notes: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await db.vitals.add({
            patientId,
            recordedAt: new Date().toISOString(),
            recordedBy: userName,
            bpSystolic: Number(form.bpSystolic),
            bpDiastolic: Number(form.bpDiastolic),
            temp: Number(form.temp),
            pulse: Number(form.pulse),
            spo2: Number(form.spo2),
            pain: Number(form.pain),
            notes: form.notes
        })
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-6">Record Vitals</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            placeholder="BP Systolic"
                            required
                            value={form.bpSystolic}
                            onChange={e => setForm({ ...form, bpSystolic: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                            type="number"
                            placeholder="BP Diastolic"
                            required
                            value={form.bpDiastolic}
                            onChange={e => setForm({ ...form, bpDiastolic: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Temp (°F)"
                            required
                            value={form.temp}
                            onChange={e => setForm({ ...form, temp: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                            type="number"
                            placeholder="Pulse"
                            required
                            value={form.pulse}
                            onChange={e => setForm({ ...form, pulse: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            placeholder="SpO2 (%)"
                            required
                            value={form.spo2}
                            onChange={e => setForm({ ...form, spo2: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="Pain (0-10)"
                            required
                            value={form.pain}
                            onChange={e => setForm({ ...form, pain: e.target.value })}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <textarea
                        placeholder="Notes (optional)"
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                        rows={2}
                    />
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
                            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white font-medium transition-all"
                        >
                            Save Vitals
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function AddMealModal({ patientId, userName, onClose }: { patientId: number; userName: string; onClose: () => void }) {
    const [form, setForm] = useState({
        type: 'breakfast' as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        description: '',
        amountConsumed: '100%' as 'none' | '25%' | '50%' | '75%' | '100%',
        notes: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await db.meals.add({
            patientId,
            recordedAt: new Date().toISOString(),
            recordedBy: userName,
            type: form.type,
            description: form.description,
            amountConsumed: form.amountConsumed,
            notes: form.notes
        })
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-6">Log Meal</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <select
                        value={form.type}
                        onChange={e => setForm({ ...form, type: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    >
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="snack">Snack</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Meal description"
                        required
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Amount Consumed</label>
                        <div className="grid grid-cols-5 gap-2">
                            {['none', '25%', '50%', '75%', '100%'].map(amount => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => setForm({ ...form, amountConsumed: amount as any })}
                                    className={`py-2 rounded-lg text-sm font-medium transition-all ${form.amountConsumed === amount
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                >
                                    {amount === 'none' ? '0%' : amount}
                                </button>
                            ))}
                        </div>
                    </div>
                    <textarea
                        placeholder="Notes (optional)"
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                        rows={2}
                    />
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
                            className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-white font-medium transition-all"
                        >
                            Log Meal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function AddSymptomModal({ patientId, userName, onClose }: { patientId: number; userName: string; onClose: () => void }) {
    const [form, setForm] = useState({
        symptom: '',
        severity: 'mild' as 'mild' | 'moderate' | 'severe',
        notes: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await db.symptoms.add({
            patientId,
            recordedAt: new Date().toISOString(),
            recordedBy: userName,
            symptom: form.symptom,
            severity: form.severity,
            notes: form.notes
        })
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-6">Log Symptom</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Symptom (e.g., Headache, Nausea)"
                        required
                        value={form.symptom}
                        onChange={e => setForm({ ...form, symptom: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Severity</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['mild', 'moderate', 'severe'] as const).map(severity => (
                                <button
                                    key={severity}
                                    type="button"
                                    onClick={() => setForm({ ...form, severity })}
                                    className={`py-2 rounded-lg text-sm font-medium capitalize transition-all ${form.severity === severity
                                        ? severity === 'mild' ? 'bg-green-600 text-white'
                                            : severity === 'moderate' ? 'bg-yellow-600 text-white'
                                                : 'bg-red-600 text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                >
                                    {severity}
                                </button>
                            ))}
                        </div>
                    </div>
                    <textarea
                        placeholder="Notes (optional)"
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                        rows={2}
                    />
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
                            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-medium transition-all"
                        >
                            Log Symptom
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function AddMedicationModal({ patientId, onClose }: { patientId: number; onClose: () => void }) {
    const [form, setForm] = useState({
        name: '',
        dosage: '',
        route: 'Oral' as string,
        frequency: 'Once daily' as string,
        prn: false
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    const routes = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation', 'Rectal', 'Sublingual']
    const frequencies = [
        'Once daily',
        'BID (twice daily)',
        'TID (three times daily)',
        'QID (four times daily)',
        'Q4H (every 4 hours)',
        'Q6H (every 6 hours)',
        'Q8H (every 8 hours)',
        'Q12H (every 12 hours)',
        'PRN (as needed)',
        'STAT (immediately)',
        'Weekly',
        'Monthly'
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            await db.medications.add({
                patientId,
                name: form.name,
                dosage: form.dosage,
                route: form.route,
                frequency: form.frequency,
                prn: form.prn || form.frequency.includes('PRN'),
                startDate: new Date().toISOString().split('T')[0]
            })
            onClose()
        } catch (error) {
            console.error('Failed to add medication:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white p-6 pb-4">Prescribe Medication</h2>
                <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 overflow-y-auto flex-1">
                    <input
                        type="text"
                        placeholder="Medication Name"
                        required
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                        type="text"
                        placeholder="Dosage (e.g., 500mg, 10ml, 2 tablets)"
                        required
                        value={form.dosage}
                        onChange={e => setForm({ ...form, dosage: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Route of Administration</label>
                        <div className="grid grid-cols-4 gap-2">
                            {routes.map(route => (
                                <button
                                    key={route}
                                    type="button"
                                    onClick={() => setForm({ ...form, route })}
                                    className={`py-2 rounded-lg text-xs font-medium transition-all ${form.route === route
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                >
                                    {route}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Frequency</label>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                            {frequencies.map(freq => (
                                <button
                                    key={freq}
                                    type="button"
                                    onClick={() => setForm({ ...form, frequency: freq })}
                                    className={`py-2 px-3 rounded-lg text-xs font-medium text-left transition-all ${form.frequency === freq
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                >
                                    {freq}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                        <input
                            type="checkbox"
                            checked={form.prn}
                            onChange={e => setForm({ ...form, prn: e.target.checked })}
                            className="w-5 h-5 rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                            <p className="text-white font-medium">PRN (As Needed)</p>
                            <p className="text-gray-500 text-xs">Patient can request this medication as needed</p>
                        </div>
                    </label>
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
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Prescribing...' : 'Prescribe'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
