import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Archive, HeartPulse, Pill, CalendarClock, Activity } from 'lucide-react';

export default function DischargeSummaryTab({ patientId }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const data = await api.get(`/patients/${patientId}/discharge-summary`);
                if (data.dischargeVitals) {
                    data.dischargeVitals = JSON.parse(data.dischargeVitals);
                }
                setSummary(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [patientId]);

    return (
        <div className="space-y-6 mt-4 animate-in fade-in duration-500">
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-text-muted animate-pulse">
                    <div className="w-8 h-8 border-4 border-warning border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-medium">Loading discharge summary...</p>
                </div>
            ) : !summary ? (
                <div className="p-10 text-center text-text-muted flex flex-col items-center justify-center gap-3 bg-bg-tertiary rounded-2xl border-2 border-dashed border-border mt-4">
                    <Archive size={48} className="opacity-20 flex-shrink-0" />
                    <p className="font-semibold">No discharge summary found for this patient.</p>
                </div>
            ) : (
                <>
                    <div className="bg-warning/10 border-l-4 border-warning p-5 rounded-r-xl shadow-sm mb-6">
                        <h3 className="text-warning font-black text-lg flex items-center gap-2 mb-2">
                            <Archive className="w-5 h-5" /> Official Discharge Summary
                        </h3>
                        <p className="text-sm font-semibold text-text-primary">Discharged by: {summary.dischargedBy}</p>
                        <p className="text-xs text-text-muted mt-1">Date: {new Date(summary.timestamp).toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="card p-6 border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow group">
                            <h4 className="font-black text-xs uppercase text-text-muted mb-4 tracking-wider flex items-center gap-2">
                                <Activity className="w-4 h-4 text-primary" /> Admission Check
                            </h4>
                            <p className="font-semibold text-text-primary mb-2"><strong>Reason:</strong> {summary.reasonForAdmission}</p>
                            <p className="font-semibold text-text-primary"><strong>Duration:</strong> {summary.duration}</p>
                        </div>

                        <div className="card p-6 border-t-4 border-t-secondary shadow-sm hover:shadow-md transition-shadow group">
                            <h4 className="font-black text-xs uppercase text-text-muted mb-4 tracking-wider flex items-center gap-2">
                                <Pill className="w-4 h-4 text-secondary" /> Final Recommendations
                            </h4>
                            <p className="text-sm font-medium text-text-primary whitespace-pre-wrap">{summary.dischargeRecommendations}</p>
                        </div>

                        <div className="card p-6 border-t-4 border-t-info shadow-sm md:col-span-2 group">
                            <h4 className="font-black text-xs uppercase text-text-muted mb-4 tracking-wider flex items-center gap-2">
                                <CalendarClock className="w-4 h-4 text-info" /> Medication History (During Stay)
                            </h4>
                            <p className="text-sm font-medium text-text-primary whitespace-pre-wrap">{summary.medicationsDuringAdmission || 'None recorded'}</p>
                        </div>

                        <div className="card p-6 bg-bg-tertiary md:col-span-2 shadow-inner border border-border group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <HeartPulse className="w-48 h-48 text-danger" />
                            </div>
                            <h4 className="font-black text-sm uppercase text-text-muted mb-4 tracking-wider relative z-10">
                                Vitals at Discharge
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-10">
                                <div className="bg-bg-primary p-3 rounded-xl border border-border shadow-sm text-center">
                                    <span className="block text-xs font-bold text-text-muted mb-1">Heart Rate</span>
                                    <span className="text-lg font-black text-text-primary">{summary.dischargeVitals.hr || '--'}</span>
                                </div>
                                <div className="bg-bg-primary p-3 rounded-xl border border-border shadow-sm text-center">
                                    <span className="block text-xs font-bold text-text-muted mb-1">Blood Pressure</span>
                                    <span className="text-lg font-black text-text-primary">{summary.dischargeVitals.bp || '--'}</span>
                                </div>
                                <div className="bg-bg-primary p-3 rounded-xl border border-border shadow-sm text-center">
                                    <span className="block text-xs font-bold text-text-muted mb-1">SpO2</span>
                                    <span className="text-lg font-black text-text-primary">{summary.dischargeVitals.o2 || '--'}</span>
                                </div>
                                <div className="bg-bg-primary p-3 rounded-xl border border-border shadow-sm text-center">
                                    <span className="block text-xs font-bold text-text-muted mb-1">Temperature</span>
                                    <span className="text-lg font-black text-text-primary">{summary.dischargeVitals.temp || '--'}</span>
                                </div>
                                {summary.dischargeVitals.lipids && (
                                    <div className="bg-bg-primary p-3 rounded-xl border border-border shadow-sm text-center col-span-2 md:col-span-4 lg:col-span-1">
                                        <span className="block text-xs font-bold text-text-muted mb-1">Lipid/Labs</span>
                                        <span className="text-lg font-black text-text-primary truncate" title={summary.dischargeVitals.lipids}>{summary.dischargeVitals.lipids}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
