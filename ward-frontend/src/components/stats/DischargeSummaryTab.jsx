import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, API_BASE, getCsrfHeaders } from '../../utils/api';
import { Archive, HeartPulse, Pill, CalendarClock, Activity, FileText, Download, History, RefreshCcw } from 'lucide-react';
import { fmtDateTime } from '../../utils/dateFormat';
import toast from 'react-hot-toast';

export default function DischargeSummaryTab({ patientId }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const [reports, setReports] = useState([]);

    const fetchHistory = async () => {
        try {
            const data = await api.get(`/reports/patient/${patientId}/history`);
            setReports(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        api.get(`/patients/${patientId}/discharge-summary`, { signal: controller.signal })
            .then(data => {
                if (data.dischargeVitals) data.dischargeVitals = JSON.parse(data.dischargeVitals);
                setSummary(data);
            })
            .catch(err => { if (!controller.signal.aborted) console.error(err); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        fetchHistory();
        return () => controller.abort();
    }, [patientId]);

    const reportMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch(`${API_BASE}/reports/patient/${patientId}/generate`, {
                method: 'POST',
                credentials: 'include',
                headers: getCsrfHeaders(),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to generate report');
            }
            return response.blob();
        },
        onSuccess: (blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PTR-${patientId}-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Report generated successfully');
            fetchHistory();
        },
        onError: (err) => toast.error(err.message),
    });

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
                    <div className="bg-bg-tertiary p-6 rounded-2xl border border-border shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    <FileText className="text-primary w-5 h-5" /> Patient Treatment Reports
                                </h3>
                                <p className="text-xs text-text-muted">Generate a tamper-evident clinical summary with QR verification</p>
                            </div>
                            <button
                                onClick={() => reportMutation.mutate()}
                                disabled={reportMutation.isPending}
                                className="btn btn-primary flex items-center gap-2 py-3 px-6 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                {reportMutation.isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                {reportMutation.isPending ? 'Generating PDF...' : 'Generate Treatment Report'}
                            </button>
                        </div>

                        {reports.length > 0 ? (
                            <div className="overflow-hidden rounded-xl border border-border bg-bg-primary">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-bg-tertiary border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 font-bold text-xs uppercase text-text-muted tracking-wider">Date Generated</th>
                                            <th className="px-4 py-3 font-bold text-xs uppercase text-text-muted tracking-wider">Type</th>
                                            <th className="px-4 py-3 font-bold text-xs uppercase text-text-muted tracking-wider">Period Covered</th>
                                            <th className="px-4 py-3 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {reports.map(r => (
                                            <tr key={r.id} className="hover:bg-bg-tertiary/50 transition-colors group">
                                                <td className="px-4 py-3 font-medium text-text-primary">
                                                    {fmtDateTime(r.generatedAt)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="badge badge-info text-[10px] uppercase">{r.reportType.replace('_', ' ')}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-text-muted italic">
                                                    {r.periodFrom} to {r.periodTo}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        className="p-2 text-text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Re-generate this exact report"
                                                        onClick={() => reportMutation.mutate()}
                                                    >
                                                        <RefreshCcw size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-bg-primary/50 rounded-xl border border-dashed border-border flex flex-col items-center gap-2">
                                <History className="w-8 h-8 text-text-muted opacity-20" />
                                <p className="text-sm font-medium text-text-muted">No previous reports generated for this patient.</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-warning/10 border-l-4 border-warning p-5 rounded-r-xl shadow-sm mb-6">
                        <h3 className="text-warning font-black text-lg flex items-center gap-2 mb-2">
                            <Archive className="w-5 h-5" /> Official Discharge Summary
                        </h3>
                        <p className="text-sm font-semibold text-text-primary">Discharged by: {summary.dischargedBy}</p>
                        <p className="text-xs text-text-muted mt-1">Date: {fmtDateTime(summary.timestamp)}</p>
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
