import React from 'react';

export function TelemetryMini({ label, value }) {
  return (
    <div className="flex-1 bg-bg-primary rounded-md p-1.5 border border-border/50 text-center">
      <div className="text-[8px] font-black text-text-muted uppercase tracking-tighter leading-none mb-1">{label}</div>
      <div className="text-[11px] font-bold text-text-primary leading-none">{value}</div>
    </div>
  );
}

export default function PatientCard({ patient, viewMode }) {
  const ews = patient.ews;
  const riskColor = ews?.status === 'critical' ? 'border-red-500 bg-red-500/5' : 
                    ews?.status === 'warning' ? 'border-amber-500 bg-amber-500/5' : 
                    'border-border';
  const ewsBg = ews?.status === 'critical' ? 'bg-red-600 text-white' : 
                ews?.status === 'warning' ? 'bg-amber-500 text-white' : 
                'bg-emerald-500 text-white';

  return (
    <a
      href={
        viewMode === 'archived' && patient.archiveId
          ? `/archive/${patient.archiveId}`
          : `/patient/${patient.patientId || patient.id}`
      }
      className={`card p-5 cursor-pointer hover:-translate-y-1 flex flex-col justify-between h-full group transition-all duration-300 no-underline text-inherit border-2 ${riskColor} rounded-xl`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors truncate">
              {patient.name}
            </h3>
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <span className="bg-bg-tertiary px-1.5 py-0.5 rounded border border-border">Bed {patient.bedNumber}</span>
              <span className="font-mono">L{patient.careIntensity}</span>
            </div>
          </div>
          
          {viewMode === 'active' && ews && (
            <div className={`shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center ${ewsBg} shadow-sm`}>
              <span className="text-[10px] font-bold leading-none mb-0.5">EWS</span>
              <span className="text-lg font-black leading-none">{ews.score}</span>
            </div>
          )}
        </div>

        <div className="text-slate-500 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest font-mono mb-3">
          MRN {patient.mrn}
        </div>
        
        <div className="bg-bg-tertiary rounded-lg p-3 border border-border/60 mb-3">
           <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block mb-1">Diagnosis</span>
           <span className="text-xs font-medium text-text-primary line-clamp-2 leading-relaxed">{patient.diagnosis}</span>
        </div>

        {viewMode === 'active' && ews && !ews.warnings.includes('Respiration rate missing') && (
          <div className="flex gap-2 mb-1">
            <TelemetryMini label="HR" value={patient.ews.heartRate || '--'} />
            <TelemetryMini label="BP" value={patient.ews.systolicBP || '--'} />
            <TelemetryMini label="O2" value={patient.ews.spo2 ? `${patient.ews.spo2}%` : '--'} />
          </div>
        )}
      </div>
      
      <div className="mt-auto pt-3 border-t border-border/40 flex justify-between items-center">
        <span className={`text-[10px] font-black uppercase tracking-widest ${patient.status === 'escalated' || ews?.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-text-muted'}`}>
          {viewMode === 'archived' && patient.archivedAt
            ? new Date(patient.archivedAt).toLocaleDateString()
            : patient.status}
        </span>
        <span className="text-[10px] font-bold text-text-secondary group-hover:text-primary transition-colors">
          Profile &rarr;
        </span>
      </div>
    </a>
  );
}
