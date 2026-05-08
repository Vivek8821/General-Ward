import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE, getCsrfHeaders } from '../utils/api';
import toast from 'react-hot-toast';
import { Download, Trash2, Search, ClipboardList, Shield, RefreshCw } from 'lucide-react';

// ── DPDPA sub-panel: Correction Requests ─────────────────────────────────────
function CorrectionRequestsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ patientId: '', requestedBy: '', requestType: 'correction', fieldsAffected: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/dpdpa/correction-requests');
      setItems(data.items || []);
    } catch (e) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/dpdpa/correction-requests', form);
      toast.success('Correction request submitted');
      setForm({ patientId: '', requestedBy: '', requestType: 'correction', fieldsAffected: '', description: '' });
      load();
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  const updateStatus = async (id, status) => {
    const notes = prompt('Resolution notes (optional):');
    try {
      await api.put(`/admin/dpdpa/correction-requests/${id}`, { status, resolutionNotes: notes || undefined });
      toast.success(`Marked as ${status}`);
      load();
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-base">Log Correction / Erasure Request</h3>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Patient ID *</label>
            <input className="input-field" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Requested By *</label>
            <input className="input-field" placeholder="Patient name or staff" value={form.requestedBy} onChange={e => setForm({...form, requestedBy: e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Request Type *</label>
            <select className="input-field" value={form.requestType} onChange={e => setForm({...form, requestType: e.target.value})}>
              <option value="correction">Correction</option>
              <option value="erasure">Erasure</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Fields Affected</label>
            <input className="input-field" placeholder="e.g. diagnosis, dob" value={form.fieldsAffected} onChange={e => setForm({...form, fieldsAffected: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Description *</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn btn-primary text-sm">Submit Request</button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-bg-tertiary px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">All Requests ({items.length})</h3>
          <button type="button" onClick={load} className="btn btn-secondary text-xs"><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
        {loading ? <div className="p-6 text-center text-text-muted">Loading…</div> : items.length === 0 ? (
          <div className="p-6 text-center text-text-muted">No requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-3">Date</th><th className="p-3">Patient</th><th className="p-3">By</th>
                  <th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-bg-tertiary/50">
                    <td className="p-3 text-xs font-mono whitespace-nowrap">{r.requestedAt?.slice(0,10)}</td>
                    <td className="p-3">{r.patientId}</td>
                    <td className="p-3">{r.requestedBy}</td>
                    <td className="p-3 capitalize">{r.requestType}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        r.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        r.status === 'under_review' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>{r.status}</span>
                    </td>
                    <td className="p-3">
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatus(r.id, 'under_review')} className="btn btn-secondary text-xs !py-0.5 !px-2">Review</button>
                          <button onClick={() => updateStatus(r.id, 'resolved')} className="btn btn-primary text-xs !py-0.5 !px-2">Resolve</button>
                          <button onClick={() => updateStatus(r.id, 'rejected')} className="btn text-xs !py-0.5 !px-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200">Reject</button>
                        </div>
                      )}
                      {r.status === 'under_review' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatus(r.id, 'resolved')} className="btn btn-primary text-xs !py-0.5 !px-2">Resolve</button>
                          <button onClick={() => updateStatus(r.id, 'rejected')} className="btn text-xs !py-0.5 !px-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DPDPA sub-panel: Grievances ───────────────────────────────────────────────
function GrievancesPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ patientId: '', complainantName: '', complainantContact: '', description: '', category: 'other' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/dpdpa/grievances');
      setItems(data.items || []);
    } catch (e) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/dpdpa/grievances', form);
      toast.success('Grievance logged');
      setForm({ patientId: '', complainantName: '', complainantContact: '', description: '', category: 'other' });
      load();
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  const updateStatus = async (id, status) => {
    const assignedTo = status === 'in_progress' ? prompt('Assign to (name):') : undefined;
    const notes = status === 'resolved' ? prompt('Resolution notes:') : undefined;
    try {
      await api.put(`/admin/dpdpa/grievances/${id}`, { status, assignedTo: assignedTo || undefined, resolutionNotes: notes || undefined });
      toast.success(`Status updated to ${status}`);
      load();
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-base">Log Grievance</h3>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Complainant Name *</label>
            <input className="input-field" value={form.complainantName} onChange={e => setForm({...form, complainantName: e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Complainant Contact</label>
            <input className="input-field" value={form.complainantContact} onChange={e => setForm({...form, complainantContact: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Patient ID (if applicable)</label>
            <input className="input-field" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Category</label>
            <select className="input-field" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="data_access">Data Access</option>
              <option value="correction_delay">Correction Delay</option>
              <option value="breach">Breach</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Description *</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn btn-primary text-sm">Log Grievance</button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-bg-tertiary px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">All Grievances ({items.length})</h3>
          <button type="button" onClick={load} className="btn btn-secondary text-xs"><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
        {loading ? <div className="p-6 text-center text-text-muted">Loading…</div> : items.length === 0 ? (
          <div className="p-6 text-center text-text-muted">No grievances logged.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-3">Date</th><th className="p-3">Complainant</th><th className="p-3">Category</th>
                  <th className="p-3">Status</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-bg-tertiary/50">
                    <td className="p-3 text-xs font-mono whitespace-nowrap">{r.filedAt?.slice(0,10)}</td>
                    <td className="p-3">{r.complainantName}</td>
                    <td className="p-3 text-xs capitalize">{r.category?.replace('_', ' ')}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        r.status === 'escalated' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        r.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>{r.status}</span>
                    </td>
                    <td className="p-3">
                      {r.status === 'open' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatus(r.id, 'in_progress')} className="btn btn-secondary text-xs !py-0.5 !px-2">Assign</button>
                          <button onClick={() => updateStatus(r.id, 'escalated')} className="btn text-xs !py-0.5 !px-2 bg-red-100 dark:bg-red-900/30 text-red-700 border border-red-200">Escalate</button>
                        </div>
                      )}
                      {r.status === 'in_progress' && (
                        <button onClick={() => updateStatus(r.id, 'resolved')} className="btn btn-primary text-xs !py-0.5 !px-2">Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DPDPA sub-panel: Data Sharing Log ────────────────────────────────────────
function DataSharingPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ patientId: '', sharedWith: '', purposeOfSharing: '', dataCategories: '', legalBasis: 'care_referral', consentReference: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/dpdpa/data-sharing');
      setItems(data.items || []);
    } catch (e) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/dpdpa/data-sharing', form);
      toast.success('Data sharing entry logged');
      setForm({ patientId: '', sharedWith: '', purposeOfSharing: '', dataCategories: '', legalBasis: 'care_referral', consentReference: '' });
      load();
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-base">Log Data Sharing Event</h3>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Patient ID *</label>
            <input className="input-field" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Shared With *</label>
            <input className="input-field" placeholder="Institution or system name" value={form.sharedWith} onChange={e => setForm({...form, sharedWith: e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Purpose *</label>
            <input className="input-field" placeholder="e.g. Specialist referral" value={form.purposeOfSharing} onChange={e => setForm({...form, purposeOfSharing: e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Legal Basis</label>
            <select className="input-field" value={form.legalBasis} onChange={e => setForm({...form, legalBasis: e.target.value})}>
              <option value="care_referral">Care Referral</option>
              <option value="legal_obligation">Legal Obligation</option>
              <option value="consent">Consent</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Data Categories Shared *</label>
            <input className="input-field" placeholder="e.g. clinical records, medications" value={form.dataCategories} onChange={e => setForm({...form, dataCategories: e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn btn-primary text-sm">Log Sharing Event</button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-bg-tertiary px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Sharing Log ({items.length})</h3>
          <button type="button" onClick={load} className="btn btn-secondary text-xs"><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
        {loading ? <div className="p-6 text-center text-text-muted">Loading…</div> : items.length === 0 ? (
          <div className="p-6 text-center text-text-muted">No sharing events logged.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-3">Date</th><th className="p-3">Patient</th><th className="p-3">Shared With</th>
                  <th className="p-3">Purpose</th><th className="p-3">Legal Basis</th><th className="p-3">By</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-bg-tertiary/50">
                    <td className="p-3 text-xs font-mono whitespace-nowrap">{r.sharedAt?.slice(0,10)}</td>
                    <td className="p-3">{r.patientId}</td>
                    <td className="p-3">{r.sharedWith}</td>
                    <td className="p-3 max-w-[160px] truncate" title={r.purposeOfSharing}>{r.purposeOfSharing}</td>
                    <td className="p-3 text-xs capitalize">{r.legalBasis?.replace('_', ' ')}</td>
                    <td className="p-3 text-xs">{r.sharedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DPDPA sub-panel: Breach Report ───────────────────────────────────────────
function BreachReportPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!from || !to) { toast.error('Select a date range'); return; }
    setLoading(true);
    try {
      const data = await api.get(`/admin/dpdpa/breach-report?from=${from}T00:00:00Z&to=${to}T23:59:59Z`);
      setReport(data);
    } catch (e) { toast.error(e.message || 'Failed to generate'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-base">Generate Breach Notification Report</h3>
        <p className="text-sm text-text-muted">Produces a structured report covering all data access and clinical changes in the selected window. Use this as the basis for DPDPA Section 8 breach notification to the Data Protection Board of India.</p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">From</label>
            <input type="date" className="input-field !py-2" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">To</label>
            <input type="date" className="input-field !py-2" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button type="button" onClick={generate} disabled={loading} className="btn btn-primary text-sm">
            {loading ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {report && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Breach Report — {report.reportingPeriod?.from?.slice(0,10)} to {report.reportingPeriod?.to?.slice(0,10)}</h3>
            <span className="text-xs text-text-muted">Generated: {report.generatedAt?.slice(0,19)?.replace('T',' ')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Affected Individuals', value: report.approximateAffectedIndividuals },
              { label: 'Total Audit Events', value: report.totalAuditEvents },
              { label: 'Clinical Changes', value: report.totalClinicalChanges },
              { label: 'Accessing Users', value: report.accessingUsers?.length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-bg-tertiary rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-primary">{value ?? 0}</div>
                <div className="text-xs text-text-muted mt-1">{label}</div>
              </div>
            ))}
          </div>
          {report.affectedPatientIds?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">Affected Patient IDs</p>
              <p className="text-sm font-mono">{report.affectedPatientIds.join(', ')}</p>
            </div>
          )}
          {report.dataCategories?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">Data Categories Accessed</p>
              <ul className="text-sm list-disc list-inside space-y-0.5">
                {report.dataCategories.map(c => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Required before submitting to DPBI:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-400">
              <li>{report.breachNaturePlaceholder}</li>
              <li>{report.measuresBeingTakenPlaceholder}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DPDPA sub-panel: Retention Review ────────────────────────────────────────
function RetentionReviewPanel() {
  const [result, setResult] = useState(null);
  const [daysAhead, setDaysAhead] = useState('365');
  const [loading, setLoading] = useState(false);

  const review = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/dpdpa/retention-review?daysAhead=${daysAhead}`);
      setResult(data);
    } catch (e) { toast.error(e.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-base">Retention Review (Rule 8)</h3>
        <p className="text-sm text-text-muted">Lists discharged patients whose medical records are approaching or past their 5-year NMC retention deadline. Records must be reviewed and formally disposed of per hospital policy before the deadline.</p>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Look-ahead (days)</label>
            <input type="number" min={1} max={365} className="input-field !py-2 w-28" value={daysAhead} onChange={e => setDaysAhead(e.target.value)} />
          </div>
          <button type="button" onClick={review} disabled={loading} className="btn btn-primary text-sm">
            {loading ? 'Checking…' : 'Run Review'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card overflow-hidden">
          <div className="bg-bg-tertiary px-5 py-3 border-b border-border">
            <h3 className="font-semibold">
              {result.count === 0
                ? `No records due within ${result.daysAhead} days`
                : `${result.count} record(s) due within ${result.daysAhead} days`}
            </h3>
          </div>
          {result.count > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-3">Patient</th><th className="p-3">MRN</th><th className="p-3">Status</th>
                    <th className="p-3">Retention Due</th><th className="p-3">Overdue?</th>
                  </tr>
                </thead>
                <tbody>
                  {result.patients.map(p => (
                    <tr key={p.id} className={`border-b border-border/60 ${p.isOverdue ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-bg-tertiary/50'}`}>
                      <td className="p-3">{p.name}</td>
                      <td className="p-3 font-mono text-xs">{p.mrn}</td>
                      <td className="p-3 capitalize">{p.status}</td>
                      <td className="p-3 font-mono text-xs">{p.retention_due_at}</td>
                      <td className="p-3">
                        {p.isOverdue
                          ? <span className="text-xs font-medium text-red-600 dark:text-red-400">OVERDUE</span>
                          : <span className="text-xs text-text-muted">Upcoming</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main AdminAudit component ─────────────────────────────────────────────────
export default function AdminAudit() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('audit');
  const [dpdpaSection, setDpdpaSection] = useState('correction-requests');
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [successFilter, setSuccessFilter] = useState('');
  const [olderThanDays, setOlderThanDays] = useState('365');
  const [purgeBusy, setPurgeBusy] = useState(false);

  const loadPage = useCallback(
    async (cursor = null, append = false) => {
      try {
        setLoading(true);
        setLoadError(false);
        const params = new URLSearchParams({ limit: '50' });
        if (successFilter === '0' || successFilter === '1') params.set('success', successFilter);
        if (cursor) params.set('cursor', cursor);
        const q = params.toString();
        const data = await api.get(`/admin/audit-logs?${q}`);
        if (!data) return;
        setItems((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []));
        setNextCursor(data.nextCursor || null);
      } catch (e) {
        setLoadError(true);
        toast.error(e.message || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    },
    [successFilter]
  );

  useEffect(() => {
    if (activeTab === 'audit') loadPage(null, false);
  }, [loadPage, activeTab]);

  const downloadCsv = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (successFilter === '0' || successFilter === '1') params.set('success', successFilter);
      const res = await fetch(`${API_BASE}/admin/audit-logs/export.csv?${params}`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) { toast.error('Not authorized'); return; }
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || 'Export failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-logs.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (e) { toast.error(e.message || 'Export failed'); }
  };

  const runPurge = async (dryRun) => {
    const days = Number(olderThanDays);
    if (!Number.isFinite(days) || days <= 0) { toast.error('Enter a positive number of days'); return; }
    if (!dryRun) {
      const ok = window.confirm(`Permanently delete audit log rows older than ${days} day(s) for this tenant? This cannot be undone.`);
      if (!ok) return;
    }
    try {
      setPurgeBusy(true);
      const res = await fetch(`${API_BASE}/admin/audit/purge`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ dryRun, olderThanDays: days }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error || 'Purge request failed'); return; }
      if (dryRun) {
        toast.success(`Dry run: ${body.wouldDelete ?? 0} row(s) would be deleted`);
      } else {
        toast.success(`Deleted ${body.deleted ?? 0} row(s)`);
        loadPage(null, false);
      }
    } catch (e) { toast.error(e.message || 'Purge failed'); }
    finally { setPurgeBusy(false); }
  };

  if (user?.role !== 'admin') {
    return <div className="p-8 text-center text-danger font-semibold">Access denied. Administrator role required.</div>;
  }

  const dpdpaSections = [
    { id: 'correction-requests', label: 'Correction Requests' },
    { id: 'grievances', label: 'Grievances' },
    { id: 'data-sharing', label: 'Data Sharing Log' },
    { id: 'breach-report', label: 'Breach Report' },
    { id: 'retention-review', label: 'Retention Review' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-slate-600 dark:text-slate-500" />
            Audit &amp; Compliance
          </h1>
          <p className="text-sm text-text-muted mt-1">Audit logs and DPDPA 2023 compliance controls.</p>
        </div>
        {activeTab === 'audit' && (
          <button type="button" onClick={downloadCsv} className="btn btn-secondary text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'audit', label: 'Audit Logs', icon: <ClipboardList className="w-4 h-4" /> },
          { id: 'dpdpa', label: 'DPDPA Compliance', icon: <Shield className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Audit Logs tab */}
      {activeTab === 'audit' && (
        <div className="space-y-8">
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-1">Success</label>
                <select className="input-field !py-2" value={successFilter} onChange={(e) => setSuccessFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="1">Success (2xx–3xx)</option>
                  <option value="0">Failed (4xx+)</option>
                </select>
              </div>
              <button type="button" onClick={() => loadPage(null, false)} className="btn btn-primary text-sm">
                <Search className="w-4 h-4" /> Apply
              </button>
            </div>
          </div>

          <div className="card p-6 space-y-4 border border-red-200 dark:border-red-500/20">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Retention</h2>
            <p className="text-sm text-text-muted">
              Delete audit rows older than the given number of days for <strong>this tenant only</strong>. Use dry run first. You can also set <code className="text-xs bg-bg-tertiary px-1 rounded">AUDIT_RETENTION_DAYS</code> on the server.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-1">Older than (days)</label>
                <input type="number" min={1} className="input-field !py-2 w-32" value={olderThanDays} onChange={(e) => setOlderThanDays(e.target.value)} />
              </div>
              <button type="button" disabled={purgeBusy} onClick={() => runPurge(true)} className="btn btn-secondary text-sm">Dry run</button>
              <button type="button" disabled={purgeBusy} onClick={() => runPurge(false)} className="btn bg-red-700 dark:bg-red-800 text-white hover:bg-red-800 dark:hover:bg-red-900 border border-red-800 dark:border-red-900 text-sm">
                <Trash2 className="w-4 h-4" /> Purge
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="bg-bg-tertiary px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Recent entries</h2>
            </div>
            {loading && items.length === 0 ? (
              <div className="p-10 text-center text-text-muted">Loading…</div>
            ) : loadError && items.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-danger font-semibold">Failed to load audit logs.</p>
                <button type="button" onClick={() => loadPage(null, false)} className="btn btn-secondary text-sm">Retry</button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center text-text-muted">No audit rows for this tenant.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-slate-600 dark:text-slate-500">
                      <th className="p-3 font-medium">Time</th>
                      <th className="p-3 font-medium">User</th>
                      <th className="p-3 font-medium">Role</th>
                      <th className="p-3 font-medium">Action</th>
                      <th className="p-3 font-medium">Resource</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 hover:bg-bg-tertiary/50">
                        <td className="p-3 whitespace-nowrap font-mono text-xs">{row.timestamp}</td>
                        <td className="p-3">{row.userId}</td>
                        <td className="p-3">{row.userRole}</td>
                        <td className="p-3">{row.action}</td>
                        <td className="p-3 max-w-[240px] truncate" title={row.resource}>{row.resource}</td>
                        <td className="p-3">{row.statusCode}</td>
                        <td className="p-3">{row.success ? 'yes' : 'no'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {nextCursor && (
              <div className="p-4 border-t border-border flex justify-center">
                <button type="button" disabled={loading} onClick={() => loadPage(nextCursor, true)} className="btn btn-secondary text-sm">
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DPDPA Compliance tab */}
      {activeTab === 'dpdpa' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {dpdpaSections.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDpdpaSection(s.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  dpdpaSection === s.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-bg-secondary border-border text-text-secondary hover:border-primary hover:text-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {dpdpaSection === 'correction-requests' && <CorrectionRequestsPanel />}
          {dpdpaSection === 'grievances' && <GrievancesPanel />}
          {dpdpaSection === 'data-sharing' && <DataSharingPanel />}
          {dpdpaSection === 'breach-report' && <BreachReportPanel />}
          {dpdpaSection === 'retention-review' && <RetentionReviewPanel />}
        </div>
      )}
    </div>
  );
}
