import React from 'react';
import { Link } from 'react-router-dom';
import { isPatientCritical, isPatientWarning } from '../../../utils/clinicalUtils';

export default function PatientCard({ patient, viewMode }) {
  const ews = patient.ews;
  const critical = isPatientCritical(patient);
  const warning = isPatientWarning(patient);

  const borderColor = critical ? 'border-red-500/60' : warning ? 'border-amber-400/50' : 'border-border';
  const ewsBg = critical ? 'bg-red-500 text-white' : warning ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white';
  const statusDot = patient.status === 'escalated' ? 'bg-red-500' : critical ? 'bg-orange-400' : 'bg-emerald-400';

  return (
    <Link
      to={
        viewMode === 'archived' && patient.archiveId
          ? `/archive/${patient.archiveId}`
          : `/patient/${patient.patientId || patient.id}`
      }
      className={`group flex flex-col gap-3 rounded-2xl border ${borderColor} bg-bg-secondary/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-bg-secondary hover:shadow-md no-underline text-inherit`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-text-primary group-hover:text-primary transition-colors truncate leading-tight">
            {patient.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-semibold text-text-muted bg-bg-tertiary border border-border px-1.5 py-0.5 rounded-md">
              Bed {patient.bedNumber}
            </span>
            <span className="text-[10px] font-semibold text-text-muted">L{patient.careIntensity}</span>
          </div>
        </div>

        {viewMode === 'active' && ews && (
          <div className={`shrink-0 w-9 h-9 rounded-xl flex flex-col items-center justify-center ${ewsBg}`}>
            <span className="text-[8px] font-bold leading-none opacity-80">EWS</span>
            <span className="text-sm font-black leading-tight">{ews.score}</span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-mono font-semibold text-text-muted">MRN {patient.mrn}</span>
        {patient.admittedAt && (
          <span className="text-[10px] text-text-muted">
            {new Date(patient.admittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Diagnosis */}
      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
        {patient.diagnosis}
      </p>

      {/* Vitals */}
      {viewMode === 'active' && ews && !ews.warnings?.includes('Respiration rate missing') && (
        <div className="flex gap-3 text-[10px] font-semibold text-text-muted">
          {ews.heartRate != null && <span>HR <span className="text-text-primary">{ews.heartRate}</span></span>}
          {ews.systolicBP != null && <span>BP <span className="text-text-primary">{ews.systolicBP}</span></span>}
          {ews.spo2 != null && <span>O₂ <span className="text-text-primary">{ews.spo2}%</span></span>}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
            {viewMode === 'archived' && patient.archivedAt
              ? new Date(patient.archivedAt).toLocaleDateString()
              : patient.status}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-text-muted group-hover:text-primary transition-colors">→</span>
      </div>
    </Link>
  );
}
