import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { FileText, Save, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HistoryTab({ patientId, readOnly }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    conditions: '',
    familyHistory: '',
    pastSurgeries: '',
    socialHistory: '',
    notes: ''
  });

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get(`/patients/${patientId}/history`);
      if (data) {
        setHistory(data);
        setFormData({
            conditions: data.conditions || '',
            familyHistory: data.familyHistory || '',
            pastSurgeries: data.pastSurgeries || '',
            socialHistory: data.socialHistory || '',
            notes: data.notes || ''
        });
      }
    } catch (err) {
      toast.error("Failed to load medical history: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/patients/${patientId}/history`, formData);
      setIsEditing(false);
      await fetchHistory();
      toast.success("Medical history updated");
    } catch (err) {
      toast.error("Failed to save history: " + err.message);
    }
  };

  const isDoctor = user.role === 'doctor';

  return (
    <div className="animate-in fade-in pt-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2"><FileText className="text-secondary"/> Extensive Medical History</h3>
        
        {isDoctor && !isEditing && !readOnly && (
          <button onClick={() => setIsEditing(true)} className="btn btn-secondary !py-2 !px-4 text-sm">
            <Edit2 className="w-4 h-4" /> {history ? 'Update History' : 'Create Profile'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-text-muted animate-pulse">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-medium">Loading medical history...</p>
        </div>
      ) : isEditing ? (
        <form onSubmit={handleSubmit} className="bg-bg-tertiary p-6 rounded-xl border border-border mt-4 animate-in fade-in">
          <h4 className="font-bold mb-4 text-primary flex items-center gap-2">
             <FileText className="w-5 h-5"/> Edit Medical History
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Pre-existing Conditions</label>
              <textarea className="input-field min-h-[80px]" value={formData.conditions} onChange={e => setFormData({...formData, conditions: e.target.value})} placeholder="Asthma, Type 2 Diabetes..." />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Past Surgeries / Operations</label>
              <textarea className="input-field min-h-[80px]" value={formData.pastSurgeries} onChange={e => setFormData({...formData, pastSurgeries: e.target.value})} placeholder="Appendectomy (2015)..." />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Family Medical History</label>
              <textarea className="input-field min-h-[80px]" value={formData.familyHistory} onChange={e => setFormData({...formData, familyHistory: e.target.value})} placeholder="Mother: Hypertension..." />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Social History</label>
              <textarea className="input-field min-h-[80px]" value={formData.socialHistory} onChange={e => setFormData({...formData, socialHistory: e.target.value})} placeholder="Smoker (1 pack/day), Occasional alcohol..." />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-text-secondary">Doctor&apos;s Notes</label>
              <textarea className="input-field min-h-[100px]" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-6">
            <button type="button" onClick={() => { setIsEditing(false); fetchHistory(); }} className="btn btn-secondary !py-2 !px-4">Cancel</button>
            <button type="submit" className="btn btn-primary !py-2 !px-4"><Save className="w-4 h-4"/> Save History</button>
          </div>
        </form>
      ) : !history ? (
        <div className="text-center p-10 bg-bg-tertiary rounded-2xl border-2 border-dashed border-border text-text-muted flex flex-col items-center justify-center gap-3 mt-4">
          <FileText size={48} className="opacity-20" />
          <p className="font-semibold">No extensive medical history profile has been established yet.</p>
          {isDoctor && <p className="text-sm">Click "Create Profile" to begin.</p>}
        </div>
      ) : (
        <div className="card p-6 border-l-4 border-l-secondary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-text-muted mb-2">Pre-existing Conditions</h4>
                <p className="whitespace-pre-wrap">{history.conditions || 'None declared.'}</p>
             </div>
             <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-text-muted mb-2">Past Surgeries</h4>
                <p className="whitespace-pre-wrap">{history.pastSurgeries || 'None declared.'}</p>
             </div>
             <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-text-muted mb-2">Family History</h4>
                <p className="whitespace-pre-wrap">{history.familyHistory || 'None declared.'}</p>
             </div>
             <div>
                <h4 className="text-sm uppercase tracking-wider font-bold text-text-muted mb-2">Social History</h4>
                <p className="whitespace-pre-wrap">{history.socialHistory || 'None declared.'}</p>
             </div>
             {history.notes && (
                 <div className="md:col-span-2 bg-warning/10 p-4 rounded-lg border border-warning/20">
                    <h4 className="text-sm uppercase tracking-wider font-bold text-warning mb-2">Physician Notes</h4>
                    <p className="whitespace-pre-wrap text-sm">{history.notes}</p>
                 </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
