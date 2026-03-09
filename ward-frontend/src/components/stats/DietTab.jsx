import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Apple, Plus, Save } from 'lucide-react';

export default function DietTab({ patientId }) {
  const [diets, setDiets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  
  // Form State
  const [formData, setFormData] = useState({
    mealType: 'Breakfast',
    consumedPercentage: '100',
    fluidIntakeMl: '',
    notes: ''
  });

  useEffect(() => {
    fetchDiets();
  }, [patientId]);

  const fetchDiets = async () => {
    try {
      const data = await api.get(`/patients/${patientId}/stats?type=diet`);
      setDiets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/patients/${patientId}/stats`, {
        type: 'diet',
        data: formData
      });
      
      setShowForm(false);
      setFormData({ mealType: 'Breakfast', consumedPercentage: '100', fluidIntakeMl: '', notes: '' });
      fetchDiets();
    } catch (err) {
      alert("Failed to save diet tracking: " + err.message);
    }
  };

  const renderDietCard = (diet) => {
    const d = diet.data;
    const date = new Date(diet.timestamp).toLocaleString();
    const isLowIntake = parseInt(d.consumedPercentage) <= 50;

    return (
      <div key={diet.id} className="bg-bg-tertiary p-5 rounded-xl border border-border mb-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-secondary mb-2">{date}</div>
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 rounded-full border-4 border-bg-secondary flex items-center justify-center font-bold text-lg bg-primary text-white">
                {d.consumedPercentage}%
             </div>
             <div>
                <h4 className="font-bold text-lg">{d.mealType}</h4>
                <div className="text-sm text-text-secondary mt-1">
                   Fluid Intake: <strong>{d.fluidIntakeMl || 0} mL</strong>
                </div>
                {d.notes && <p className="text-sm italic text-text-muted mt-2">&quot;{d.notes}&quot;</p>}
             </div>
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end gap-2">
           <div className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">{diet.recordedBy}</div>
           {isLowIntake && (
              <span className="text-xs bg-warning text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider">Low Intake</span>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in pt-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2"><Apple className="text-success"/> Diet & Nutrition</h3>
        
        {(user.role === 'nurse' || user.role === 'doctor') && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-success !py-2 !px-4 text-sm">
            <Plus className="w-4 h-4" /> Log Meal
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-bg-tertiary p-6 rounded-xl border-2 border-success mb-8 animate-in slide-in-from-top-4">
          <h4 className="font-bold mb-4">New Meal Entry</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Meal Type</label>
              <select className="input-field !py-2" value={formData.mealType} onChange={e => setFormData({...formData, mealType: e.target.value})}>
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Snack</option>
                <option>Clear Liquids Only</option>
                <option>NPO (Nothing by Mouth)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Consumed Percentage (%)</label>
              <input type="number" min="0" max="100" required className="input-field !py-2" value={formData.consumedPercentage} onChange={e => setFormData({...formData, consumedPercentage: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-text-secondary">Total Fluid Intake (mL)</label>
              <input type="number" className="input-field !py-2" value={formData.fluidIntakeMl} onChange={e => setFormData({...formData, fluidIntakeMl: e.target.value})} placeholder="250" />
            </div>
            <div>
               <label className="block text-xs font-bold mb-1 text-text-secondary">Nurse Notes</label>
               <input type="text" className="input-field !py-2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Patient refused solid food..." />
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-6">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary !py-2 !px-4">Cancel</button>
            <button type="submit" className="btn btn-success !py-2 !px-4 hover:bg-green-600"><Save className="w-4 h-4"/> Save Entry</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center p-8 text-text-muted">Loading diet records...</div>
      ) : diets.length === 0 ? (
        <div className="text-center p-8 bg-bg-tertiary rounded-xl border border-dashed border-border text-text-muted">
          No meals recorded for this patient yet.
        </div>
      ) : (
        <div className="space-y-4">
          {diets.map(renderDietCard)}
        </div>
      )}
    </div>
  );
}
