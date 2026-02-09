import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db, User, Vital, Medication, Meal, Symptom, ProgressNote, LabResult, calculateAge } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Plus, Heart, Thermometer, Activity, Wind, AlertCircle, Pill, Utensils, Stethoscope, Clock, FileText, FlaskConical, History } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface PatientDetailProps {
    user: User
    onLogout: () => void
}

type TabType = 'clinical' | 'vitals' | 'medications' | 'notes' | 'labs' | 'meals' | 'symptoms'

export default function PatientDetail({ user }: PatientDetailProps) {
    const { id } = useParams()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<TabType>('clinical')
    const [showVitalsModal, setShowVitalsModal] = useState(false)
    const [showMealModal, setShowMealModal] = useState(false)
    const [showSymptomModal, setShowSymptomModal] = useState(false)
    const [showMedicationModal, setShowMedicationModal] = useState(false)
    const [showNoteModal, setShowNoteModal] = useState(false)

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

    const notes = useLiveQuery(
        () => db.progressNotes.where('patientId').equals(Number(id)).reverse().toArray(),
        [id]
    ) ?? []

    const labs = useLiveQuery(
        () => db.labResults.where('patientId').equals(Number(id)).reverse().toArray(),
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

    const tabs: { key: TabType; label: string; icon: any; count?: number }[] = [
        { key: 'clinical', label: 'Clinical Info', icon: History },
        { key: 'vitals', label: 'Vitals', icon: Heart, count: vitals.length },
        { key: 'notes', label: 'Progress Notes', icon: FileText, count: notes.length },
        { key: 'labs', label: 'Lab Results', icon: FlaskConical, count: labs.length },
        { key: 'medications', label: 'Medications', icon: Pill, count: medications.length },
        { key: 'meals', label: 'Meals', icon: Utensils, count: meals.length },
        { key: 'symptoms', label: 'Symptoms', icon: Stethoscope, count: symptoms.length },
    ]

    const bmi = patient.weight && patient.height
        ? (patient.weight / ((patient.height / 100) * (patient.height / 100))).toFixed(1)
        : 'N/A'

    return (
        <div className="min-h-screen bg-black p-4">
            {/* Header */}
            <header className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all hover:bg-white/10"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1">{patient.name}</h1>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="bed-badge">Bed {patient.bedNumber}</span>
                                <span className="text-gray-400">MRN: {patient.mrn}</span>
                                {patient.bloodGroup && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium">
                                        Blood Group: {patient.bloodGroup}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${patient.status === 'active'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                }`}>
                                {patient.status}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Patient Info Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-8 shadow-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6 text-sm">
                    <div>
                        <p className="text-gray-500 mb-1">Age / Sex</p>
                        <p className="text-white font-medium text-lg capitalize">
                            {calculateAge(patient.dob)} <span className="text-sm text-gray-500">yrs</span> / {patient.gender === 'male' ? 'M' : 'F'}
                        </p>
                    </div>
                    <div>
                        <p className="text-gray-500 mb-1">Height</p>
                        <p className="text-white font-medium text-lg">{patient.height ? `${patient.height} cm` : 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 mb-1">Weight</p>
                        <p className="text-white font-medium text-lg">{patient.weight ? `${patient.weight} kg` : 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 mb-1">BMI</p>
                        <p className="text-white font-medium text-lg">{bmi}</p>
                    </div>
                    <div className="lg:col-span-2">
                        <p className="text-gray-500 mb-1">Diagnosis</p>
                        <p className="text-amber-400 font-medium truncate" title={patient.diagnosis}>{patient.diagnosis}</p>
                    </div>
                    <div className="lg:col-span-2">
                        <p className="text-gray-500 mb-1">Allergies</p>
                        <p className={`font-medium truncate ${patient.allergies && patient.allergies !== 'None' ? 'tag tag-allergy' : 'text-gray-400'}`}>
                            {patient.allergies || 'None'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs overflow-x-auto pb-2 mb-4 module-scroll">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`tab whitespace-nowrap ${activeTab === tab.key ? 'active' : ''}`}
                    >
                        <div className="flex items-center gap-2">
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs bg-white/10`}>
                                    {tab.count}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="pb-20">
                {activeTab === 'clinical' && (
                    <div className="patient-detail">
                        <ClinicalInfoSection patient={patient} />
                    </div>
                )}
                {activeTab === 'vitals' && (
                    <div className="patient-detail">
                        <VitalsSection
                            vitals={vitals}
                            onAdd={() => setShowVitalsModal(true)}
                        />
                    </div>
                )}
                {activeTab === 'notes' && (
                    <div className="patient-detail">
                        <ProgressNotesSection
                            notes={notes}
                            onAdd={() => setShowNoteModal(true)}
                        />
                    </div>
                )}
                {activeTab === 'labs' && (
                    <div className="patient-detail">
                        <LabResultsSection results={labs} />
                    </div>
                )}
                {activeTab === 'medications' && (
                    <div className="patient-detail">
                        <MedicationsSection
                            medications={medications}
                            onGive={handleGiveMedication}
                            isDoctor={user.role === 'doctor'}
                            onAdd={() => setShowMedicationModal(true)}
                        />
                    </div>
                )}
                {activeTab === 'meals' && (
                    <div className="patient-detail">
                        <MealsSection
                            meals={meals}
                            onAdd={() => setShowMealModal(true)}
                        />
                    </div>
                )}
                {activeTab === 'symptoms' && (
                    <div className="patient-detail">
                        <SymptomsSection
                            symptoms={symptoms}
                            onAdd={() => setShowSymptomModal(true)}
                        />
                    </div>
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
            {showNoteModal && (
                <AddProgressNoteModal
                    patientId={patient.id!}
                    userName={user.name}
                    onClose={() => setShowNoteModal(false)}
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
                    className="btn btn-success text-sm py-2 px-3"
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

            {/* Vitals History Table */}
            {vitals.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-white font-semibold mb-3">Vitals History</h3>
                    <div className="overflow-x-auto">
                        <table className="vitals-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>BP</th>
                                    <th>Pulse</th>
                                    <th>Temp</th>
                                    <th>SpO2</th>
                                    <th>Pain</th>
                                    <th>Recorded By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vitals.slice(0, 10).map(vital => (
                                    <tr key={vital.id}>
                                        <td>{format(new Date(vital.recordedAt), 'MMM d, h:mm a')}</td>
                                        <td>{vital.bpSystolic}/{vital.bpDiastolic}</td>
                                        <td>{vital.pulse} bpm</td>
                                        <td>{vital.temp}°F</td>
                                        <td>{vital.spo2}%</td>
                                        <td>{vital.pain}/10</td>
                                        <td className="text-gray-400 text-xs">{vital.recordedBy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                        className="btn btn-primary text-sm py-2 px-3"
                    >
                        <Plus className="w-4 h-4" />
                        Prescribe Item
                    </button>
                )}
            </div>

            {medications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No medications prescribed.
                </div>
            ) : (
                <div className="space-y-3">
                    {medications.map(med => (
                        <div key={med.id} className="medication-item">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4>{med.name}</h4>
                                        {med.prn && (
                                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full border border-amber-500/30">
                                                PRN
                                            </span>
                                        )}
                                    </div>
                                    <p className="medication-details">{med.dosage} • {med.route} • {med.frequency}</p>
                                    {med.lastGiven && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                            <Clock className="w-3 h-3" />
                                            Last given {formatDistanceToNow(new Date(med.lastGiven), { addSuffix: true })}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => onGive(med.id!)}
                                    className="btn btn-success text-xs py-2 px-3"
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
                    className="btn btn-warning text-sm py-2 px-3"
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
                    className="btn btn-danger text-sm py-2 px-3"
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

function ClinicalInfoSection({ patient }: { patient: any }) {
    if (!patient) return null

    return (
        <div className="space-y-6">
            {/* Presenting Complaint */}
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-500" />
                    Presenting Complaint
                </h3>
                <div className="space-y-4">
                    <div>
                        <p className="text-gray-400 text-sm mb-1">Chief Complaint</p>
                        <p className="text-white text-lg font-medium">{patient.chiefComplaint || 'Not recorded'}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm mb-1">History of Present Illness</p>
                        <p className="text-gray-300 leading-relaxed">{patient.historyPresentIllness || 'Not recorded'}</p>
                    </div>
                </div>
            </div>

            {/* Medical History Grid */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-3">Past Medical History</h3>
                    {patient.pastMedicalHistory && patient.pastMedicalHistory.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                            {patient.pastMedicalHistory.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 italic">No significant history recorded</p>
                    )}
                </div>

                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-3">Surgical History</h3>
                    {patient.surgicalHistory && patient.surgicalHistory.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                            {patient.surgicalHistory.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 italic">No surgeries recorded</p>
                    )}
                </div>

                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-3">Social History</h3>
                    {patient.socialHistory && patient.socialHistory.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                            {patient.socialHistory.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 italic">No social history recorded</p>
                    )}
                </div>

                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-3">Family History</h3>
                    {patient.familyHistory && patient.familyHistory.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                            {patient.familyHistory.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 italic">No family history recorded</p>
                    )}
                </div>
            </div>

            {/* Next of Kin & Insurance */}
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                <h3 className="text-lg font-semibold text-white mb-3">Administrative</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-indigo-400 font-medium mb-2 text-sm uppercase tracking-wide">Next of Kin</h4>
                        <div className="space-y-1 text-sm">
                            <p><span className="text-gray-500">Name:</span> <span className="text-white">{patient.nextOfKinName || 'N/A'}</span></p>
                            <p><span className="text-gray-500">Relation:</span> <span className="text-white">{patient.nextOfKinRelation || 'N/A'}</span></p>
                            <p><span className="text-gray-500">Phone:</span> <span className="text-white">{patient.nextOfKinPhone || 'N/A'}</span></p>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-indigo-400 font-medium mb-2 text-sm uppercase tracking-wide">Insurance</h4>
                        <div className="space-y-1 text-sm">
                            <p><span className="text-gray-500">Provider:</span> <span className="text-white">{patient.insuranceProvider || 'Self-pay'}</span></p>
                            <p><span className="text-gray-500">Policy #:</span> <span className="text-white">{patient.insurancePolicyNumber || 'N/A'}</span></p>
                            <p><span className="text-gray-500">Address:</span> <span className="text-white">{patient.address || 'N/A'}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ProgressNotesSection({ notes, onAdd }: { notes: ProgressNote[]; onAdd: () => void }) {
    return (
        <>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Progress Notes</h2>
                <button
                    onClick={onAdd}
                    className="btn btn-primary text-sm py-2 px-3"
                >
                    <Plus className="w-4 h-4" />
                    New Note
                </button>
            </div>

            {notes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No progress notes recorded.
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    {notes.map(note => (
                        <div key={note.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${note.type === 'Admission' ? 'bg-purple-500/20 text-purple-400' :
                                            note.type === 'Discharge' ? 'bg-green-500/20 text-green-400' :
                                                note.type === 'Consult' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                        }`}>
                                        {note.type}
                                    </span>
                                    <span className="text-gray-400 text-sm">
                                        {format(new Date(note.date), 'MMM d, yyyy h:mm a')}
                                    </span>
                                </div>
                                <span className="text-gray-500 text-xs italic">
                                    {note.author}
                                </span>
                            </div>
                            <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">{note.note}</p>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

function LabResultsSection({ results }: { results: LabResult[] }) {
    const groupedResults = groupByDay(results as any)

    return (
        <>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Lab Results</h2>
            </div>

            {results.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No lab results available.
                </div>
            ) : (
                <div>
                    {Array.from(groupedResults.entries()).map(([date, dayResults]) => (
                        <div key={date}>
                            <DayHeader date={date} />
                            <div className="divide-y divide-white/5">
                                {dayResults.map((result: any) => (
                                    <div key={result.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                        <div>
                                            <p className="text-white font-medium">{result.testName}</p>
                                            <p className="text-gray-500 text-xs">Ref: {result.referenceRange} {result.units}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className="text-xl font-bold text-white">{result.result}</span>
                                                <span className="text-gray-400 text-sm">{result.units}</span>
                                            </div>
                                            {result.flag && result.flag !== 'Normal' && (
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${result.flag === 'Critical' ? 'bg-red-500 text-white animate-pulse' :
                                                        result.flag === 'High' ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {result.flag.toUpperCase()}
                                                </span>
                                            )}
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

function AddProgressNoteModal({ patientId, userName, onClose }: { patientId: number; userName: string; onClose: () => void }) {
    const [form, setForm] = useState({
        type: 'Daily' as 'Admission' | 'Daily' | 'Discharge' | 'Consult',
        note: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await db.progressNotes.add({
            patientId,
            date: new Date().toISOString(),
            author: userName,
            type: form.type,
            note: form.note
        })
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-6">Add Progress Note</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Note Type</label>
                        <div className="flex gap-2">
                            {(['Admission', 'Daily', 'Consult', 'Discharge'] as const).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setForm({ ...form, type })}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${form.type === type
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                    <textarea
                        placeholder="Type your note here..."
                        required
                        value={form.note}
                        onChange={e => setForm({ ...form, note: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed"
                        rows={10}
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
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-all"
                        >
                            Save Note
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
