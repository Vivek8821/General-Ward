import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { api, API_BASE } from '../../utils/api';
import { toast } from 'sonner';

export default function DischargeReportButton({ patientId, mrn }) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/reports/clinical-discharge/${patientId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate report');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CDR-${mrn || patientId}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Clinical Discharge Report downloaded.');
    } catch (e) {
      toast.error(e.message || 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="btn btn-primary flex items-center gap-2"
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {loading ? 'Generating…' : 'Clinical Discharge Report'}
    </button>
  );
}
