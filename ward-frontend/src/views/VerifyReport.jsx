import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, FileText, Calendar, User, Clock, ChevronLeft, Building2 } from 'lucide-react';

export default function VerifyReport() {
    const [searchParams] = useSearchParams();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const verify = async () => {
            const payload = searchParams.get('payload');
            if (!payload) {
                setError('No verification payload found in URL. Please scan the QR code on the printed report.');
                setLoading(false);
                return;
            }

            try {
                // Use absolute URL or local proxy
                const apiBase = import.meta.env.VITE_API_URL || '/api';
                const response = await fetch(`${apiBase}/reports/verify?payload=${encodeURIComponent(payload)}`);
                if (!response.ok) throw new Error('Verification request failed');
                const data = await response.json();
                setResult(data);
            } catch (err) {
                setError('Failed to verify report. The payload may be corrupted or the verification service is unavailable.');
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-black flex items-center justify-center gap-2 mb-2">
                        <Building2 className="text-primary w-8 h-8" /> General Ward
                    </h1>
                    <p className="text-text-muted text-sm font-medium">Digital Integrity Verification System</p>
                </div>

                <div className="card p-8 shadow-2xl border-2 border-border/50 relative overflow-hidden">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="font-bold text-text-primary">Authenticating Report...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 flex flex-col items-center text-center gap-4">
                            <div className="bg-danger/10 p-4 rounded-full">
                                <ShieldAlert className="w-12 h-12 text-danger" />
                            </div>
                            <h2 className="text-xl font-black text-text-primary">Verification Failed</h2>
                            <p className="text-sm text-text-muted">{error}</p>
                            <Link to="/login" className="btn btn-secondary mt-4 w-full flex items-center justify-center gap-2">
                                <ChevronLeft size={16} /> Return to Hospital Portal
                            </Link>
                        </div>
                    ) : result?.verified ? (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center text-center gap-2">
                                <div className="bg-success/10 p-4 rounded-full mb-2 animate-bounce">
                                    <ShieldCheck className="w-12 h-12 text-success" />
                                </div>
                                <h2 className="text-2xl font-black text-text-primary">Integrity Verified</h2>
                                <p className="text-xs font-black uppercase text-success tracking-widest bg-success/10 px-3 py-1 rounded-full">Authentic Clinical Document</p>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-border">
                                <div className="flex items-center gap-3">
                                    <User className="text-text-muted w-5 h-5" />
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-text-muted leading-none mb-1">Patient Name</p>
                                        <p className="font-bold text-text-primary">{result.patient.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <FileText className="text-text-muted w-5 h-5" />
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-text-muted leading-none mb-1">Patient ID (MRN)</p>
                                        <p className="font-bold text-text-primary">{result.patient.mrn}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="text-text-muted w-5 h-5" />
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-text-muted leading-none mb-1">Admission Date</p>
                                        <p className="font-bold text-text-primary">{result.patient.admissionDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Clock className="text-text-muted w-5 h-5" />
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-text-muted leading-none mb-1">Report Generated At</p>
                                        <p className="font-bold text-text-primary">{new Date(result.reportGeneratedAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-bg-tertiary p-4 rounded-xl text-xs text-text-muted italic border border-border">
                                Note: This verification confirms the content of the printed report matches the hospital's official records at the time of generation.
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 flex flex-col items-center text-center gap-4">
                            <div className="bg-danger/10 p-4 rounded-full">
                                <ShieldAlert className="w-12 h-12 text-danger" />
                            </div>
                            <h2 className="text-xl font-black text-danger">Tamper Warning</h2>
                            <p className="text-sm font-medium text-text-primary">{result.message}</p>
                            <p className="text-xs text-text-muted px-4">
                                The digital signature in this QR code does not match the clinical data stored on our servers. This report may have been altered after printing.
                            </p>
                            <div className="w-full h-px bg-border my-2"></div>
                            <p className="text-xs font-bold text-text-muted uppercase">Immediate Action Required</p>
                        </div>
                    )}
                </div>

                <p className="mt-8 text-center text-[10px] text-text-muted uppercase font-black tracking-widest opacity-50">
                    Secure Medical Reporting System • General Ward v2.4
                </p>
            </div>
        </div>
    );
}
