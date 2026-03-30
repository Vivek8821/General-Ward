import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';
import {
  Archive,
  ArrowLeft,
  HeartPulse,
  Activity,
  ClipboardList,
  AlertTriangle,
  FileText,
  Pill,
  CalendarClock,
  MessageSquare,
} from 'lucide-react';
import { allergiesHasRisk, formatAllergiesMutedLabel } from '../utils/patientDisplay';

function parseJsonField(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function Section({ title, icon, children }) {
  return (
    <details open className="card border border-border overflow-hidden group">
      <summary className="cursor-pointer list-none p-4 bg-bg-tertiary border-b border-border flex items-center gap-2 font-bold text-text-primary">
        <span className="shrink-0 opacity-80">{icon}</span>
        {title}
        <span className="ml-auto text-xs font-semibold text-text-muted group-open:hidden">Expand</span>
        <span className="ml-auto text-xs font-semibold text-text-muted hidden group-open:inline">Collapse</span>
      </summary>
      <div className="p-4 text-sm">{children}</div>
    </details>
  );
}

export default function HospitalArchiveDetail() {
  const { archiveId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get(`/patients/archives/${archiveId}`);
        if (!cancelled) setRecord(data);
      } catch (e) {
        if (!cancelled) {
          if (e?.status === 404) setError('Archive not found.');
          else setError(e?.message || 'Unable to load archive.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [archiveId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-text-muted animate-pulse font-medium">
        Loading hospital archive…
      </div>
    );
  }

  if (error || !record?.snapshot) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" aria-hidden /> Back to dashboard
        </button>
        <div className="card p-8 text-center text-danger font-semibold">{error || 'Invalid archive payload.'}</div>
      </div>
    );
  }

  const snap = record.snapshot;
  const patient = snap.patient;
  const summary = snap.dischargeSummary;
  const vitals =
    summary && summary.dischargeVitals
      ? parseJsonField(summary.dischargeVitals)
      : {};

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="btn bg-bg-tertiary border-border border-2 hover:border-primary !py-2"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" aria-hidden /> Dashboard
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-warning">
          <Archive className="w-3.5 h-3.5" aria-hidden /> Hospital archive
        </span>
      </div>

      <div className="card p-6 border-t-4 border-t-primary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{patient?.name}</h1>
            <p className="text-sm text-text-muted font-mono mt-1">MRN {patient?.mrn}</p>
            <p className="text-sm text-text-secondary mt-2">
              Bed at discharge: <span className="font-semibold text-text-primary">{patient?.bedNumber}</span> · DOB{' '}
              {patient?.dob}
            </p>
          </div>
          <div className="text-right text-sm text-text-secondary">
            <p>
              <span className="text-text-muted">Archived</span>{' '}
              <span className="font-semibold text-text-primary">
                {record.archivedAt ? new Date(record.archivedAt).toLocaleString() : '—'}
              </span>
            </p>
            <p className="mt-1">
              Discharged by <span className="font-semibold text-text-primary">{record.dischargedBy}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs font-bold uppercase text-text-muted">Diagnosis</span>
          <p className="w-full text-text-primary font-medium">{patient?.diagnosis}</p>
          {patient?.allergies ? (
            <p
              className={`w-full text-sm ${
                allergiesHasRisk(patient.allergies) ? 'text-danger font-semibold' : 'text-text-secondary'
              }`}
            >
              <span className="font-semibold text-text-primary">Allergies: </span>
              {formatAllergiesMutedLabel(patient.allergies)}
            </p>
          ) : null}
        </div>
      </div>

      {summary && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-text-primary">
            <FileText className="w-5 h-5 text-warning" aria-hidden /> Discharge summary
          </h2>
          <div className="bg-warning/10 border-l-4 border-warning p-5 rounded-r-xl">
            <p className="text-sm font-semibold text-text-primary">Recorded: {summary.timestamp}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h4 className="text-xs font-bold uppercase text-text-muted mb-2">Admission</h4>
              <p className="font-medium text-text-primary">
                <strong>Reason:</strong> {summary.reasonForAdmission}
              </p>
              <p className="font-medium text-text-primary mt-1">
                <strong>Duration:</strong> {summary.duration}
              </p>
            </div>
            <div className="card p-5">
              <h4 className="text-xs font-bold uppercase text-text-muted mb-2">Recommendations</h4>
              <p className="text-sm whitespace-pre-wrap text-text-primary">{summary.dischargeRecommendations}</p>
            </div>
            <div className="card p-5 md:col-span-2">
              <h4 className="text-xs font-bold uppercase text-text-muted mb-2 flex items-center gap-2">
                <Pill className="w-4 h-4" aria-hidden /> Medications during stay
              </h4>
              <p className="text-sm whitespace-pre-wrap text-text-primary">
                {summary.medicationsDuringAdmission || '—'}
              </p>
            </div>
            <div className="card p-5 md:col-span-2 bg-bg-tertiary">
              <h4 className="text-xs font-bold uppercase text-text-muted mb-3 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-danger" aria-hidden /> Vitals at discharge
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['hr', 'bp', 'o2', 'temp'].map((k) => (
                  <div key={k} className="bg-bg-primary p-3 rounded-lg border border-border text-center">
                    <span className="block text-xs font-bold text-text-muted mb-1">{k.toUpperCase()}</span>
                    <span className="text-lg font-bold">{vitals?.[k] || '—'}</span>
                  </div>
                ))}
                {vitals?.lipids ? (
                  <div className="col-span-2 md:col-span-4 bg-bg-primary p-3 rounded-lg border border-border">
                    <span className="block text-xs font-bold text-text-muted mb-1">Lipids / labs</span>
                    <span className="font-medium">{vitals.lipids}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <Section title="Clinical timeline & observations" icon={<Activity className="w-4 h-4 text-primary" />}>
        {snap.dailyStats?.length ? (
          <ul className="space-y-3">
            {snap.dailyStats.map((row) => {
              const data = parseJsonField(row.data);
              return (
                <li key={row.id} className="border border-border rounded-lg p-3 bg-bg-tertiary/50">
                  <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold text-text-muted">
                    <span className="uppercase">{row.type}</span>
                    <span>{row.timestamp}</span>
                  </div>
                  <p className="mt-1 text-text-primary font-medium">{row.recordedBy}</p>
                  <pre className="mt-2 text-xs whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                    {typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)}
                  </pre>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-text-muted">No observations in archive.</p>
        )}
      </Section>

      <Section title="Medications & MAR" icon={<ClipboardList className="w-4 h-4 text-secondary" />}>
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase text-text-muted mb-2">Prescriptions</h4>
            {snap.medications?.length ? (
              <ul className="space-y-2">
                {snap.medications.map((m) => (
                  <li key={m.id} className="border border-border rounded-lg p-3">
                    <span className="font-semibold text-text-primary">{m.name}</span>{' '}
                    <span className="text-text-secondary">
                      {m.dosage} · {m.route} · {m.frequency} ({m.status})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted">None.</p>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-text-muted mb-2">Administrations</h4>
            {snap.medicationAdministrations?.length ? (
              <ul className="space-y-2 text-text-secondary">
                {snap.medicationAdministrations.map((a) => (
                  <li key={a.id} className="border border-border rounded p-2 text-xs">
                    {a.timestamp} · {a.status} · {a.administeredBy}
                    {a.notes ? ` — ${a.notes}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted">None.</p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Escalations" icon={<AlertTriangle className="w-4 h-4 text-red-500" />}>
        {snap.escalations?.length ? (
          <ul className="space-y-2">
            {snap.escalations.map((e) => (
              <li key={e.id} className="border border-border rounded-lg p-3">
                <span className="text-xs text-text-muted">{e.timestamp}</span>
                <p className="font-medium text-text-primary">{e.reason}</p>
                <p className="text-xs text-text-secondary">
                  {e.escalatedBy} · {e.status}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">None.</p>
        )}
      </Section>

      <Section title="Tasks" icon={<CalendarClock className="w-4 h-4 text-info" />}>
        {snap.tasks?.length ? (
          <ul className="space-y-2 text-sm">
            {snap.tasks.map((t) => (
              <li key={t.id} className="border border-border rounded-lg p-3">
                <span className="font-semibold">{t.type}</span> · {t.status} · due {t.dueAt}
                {t.notes ? <p className="text-text-secondary mt-1">{t.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">None.</p>
        )}
      </Section>

      <Section title="Handover notes" icon={<MessageSquare className="w-4 h-4" />}>
        {snap.handoverNotes?.length ? (
          <ul className="space-y-3">
            {snap.handoverNotes.map((n) => (
              <li key={n.id} className="border border-border rounded-lg p-3">
                <div className="text-xs text-text-muted">
                  {n.timestamp} · Shift {n.shift} · {n.createdBy}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-text-primary">{n.note}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">None.</p>
        )}
      </Section>
    </div>
  );
}
