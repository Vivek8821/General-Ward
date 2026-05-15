import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { isPatientCritical, isPatientWarning } from '../../../utils/clinicalUtils';
import { fmtDate } from '../../../utils/dateFormat';

function ewsHaloColors(score, viewMode) {
  if (viewMode !== 'active' || score == null || score < 0)
    return { color: 'rgba(107,114,128,0.18)', fade: 'rgba(107,114,128,0.05)' };
  if (score >= 9) return { color: 'rgba(220,38,38,0.65)',  fade: 'rgba(220,38,38,0.22)'  };
  if (score >= 7) return { color: 'rgba(239,68,68,0.55)',  fade: 'rgba(239,68,68,0.18)'  };
  if (score >= 5) return { color: 'rgba(249,115,22,0.48)', fade: 'rgba(249,115,22,0.15)' };
  if (score >= 3) return { color: 'rgba(234,179,8,0.48)',  fade: 'rgba(234,179,8,0.15)'  };
  return           { color: 'rgba(34,197,94,0.32)',  fade: 'rgba(34,197,94,0.1)'   };
}

function ewsSolidColor(score) {
  if (score == null || score < 0) return '#6b7280';
  if (score >= 9) return '#dc2626';
  if (score >= 7) return '#ef4444';
  if (score >= 5) return '#f97316';
  if (score >= 3) return '#eab308';
  return '#22c55e';
}

function ewsBadgeClass(score) {
  if (score == null || score < 0) return 'bg-zinc-500 text-white';
  if (score >= 7) return 'bg-red-500 text-white';
  if (score >= 5) return 'bg-orange-500 text-white';
  if (score >= 3) return 'bg-yellow-500 text-white';
  return 'bg-green-500 text-white';
}

function hrColor(hr) {
  if (hr == null) return 'text-text-muted';
  if (hr < 50 || hr > 100) return 'text-red-500';
  if ((hr >= 50 && hr < 60) || (hr > 90 && hr <= 100)) return 'text-yellow-500';
  return 'text-green-500';
}

function sbpColor(sbp) {
  if (sbp == null) return 'text-text-muted';
  if (sbp < 90 || sbp > 160) return 'text-red-500';
  if ((sbp >= 90 && sbp < 100) || (sbp > 140 && sbp <= 160)) return 'text-yellow-500';
  return 'text-green-500';
}

function spo2Color(spo2) {
  if (spo2 == null) return 'text-text-muted';
  if (spo2 < 92) return 'text-red-500';
  if (spo2 < 95) return 'text-yellow-500';
  return 'text-green-500';
}

export default function PatientCard({ patient, viewMode, highlightCritical = false }) {
  const [hovered, setHovered] = useState(false);
  const ews = patient.ews;
  const score = ews?.score ?? null;
  const critical = isPatientCritical(patient);
  const isUrgent = score != null && score >= 9;

  const halo = ewsHaloColors(score, viewMode);
  const solid = ewsSolidColor(score);

  const statusDotClass =
    patient.status === 'escalated' ? 'bg-red-500' :
    critical                       ? 'bg-orange-500' :
                                     'bg-green-500';

  const hasAbnormalVitals =
    ews && (
      (ews.heartRate  != null && (ews.heartRate  < 50 || ews.heartRate  > 100)) ||
      (ews.systolicBP != null && (ews.systolicBP < 90 || ews.systolicBP > 160)) ||
      (ews.spo2       != null && ews.spo2 < 92)
    );

  const cardStyle = hovered
    ? {
        '--halo-color': halo.color,
        '--halo-fade':  halo.fade,
        boxShadow: `0 0 0 1.5px ${solid}, 0 8px 28px 6px ${solid}44`,
        backgroundColor: 'var(--color-bg-secondary)',
      }
    : {
        '--halo-color': halo.color,
        '--halo-fade':  halo.fade,
      };

  return (
    <Link
      to={
        viewMode === 'archived' && patient.archiveId
          ? `/archive/${patient.archiveId}`
          : `/patient/${patient.patientId || patient.id}`
      }
      style={cardStyle}
      className={`flex flex-col rounded-2xl border border-border/20 bg-bg-secondary/40 no-underline text-inherit min-h-[160px] transition-colors duration-200 ${isUrgent ? 'card-halo-urgent' : 'card-halo'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Zone 1 — Identity */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-text-primary truncate leading-tight">
            {patient.name}
          </h3>
          <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed mt-1.5">
            {patient.diagnosis || <span className="italic opacity-50">No diagnosis</span>}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] font-semibold text-text-muted bg-bg-tertiary border border-border px-1.5 py-0.5 rounded-md leading-none">
              Bed {patient.bedNumber}
            </span>
            <span className="text-[10px] font-semibold text-text-muted leading-none">
              L{patient.careIntensity}
            </span>
          </div>
        </div>

        {viewMode === 'active' && ews && score != null && (
          <div className={`shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center ${ewsBadgeClass(score)}`}>
            <span className="text-[8px] font-bold leading-none opacity-80 uppercase tracking-wide">EWS</span>
            <span className="text-sm font-black leading-tight tabular-nums">{score}</span>
          </div>
        )}
      </div>

      {/* Zone 2 — Vitals Strip */}
      {viewMode === 'active' && ews && (ews.heartRate != null || ews.systolicBP != null || ews.spo2 != null) && (
        <div className="px-4 py-1.5 border-t border-border/30 flex items-center gap-5">
          {ews.heartRate != null && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-bold uppercase text-text-muted tracking-wide leading-none">HR</span>
              <span className={`text-[26px] font-extrabold font-mono tabular-nums leading-none ${hrColor(ews.heartRate)}`}>
                {ews.heartRate}
              </span>
            </div>
          )}
          {ews.systolicBP != null && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-bold uppercase text-text-muted tracking-wide leading-none">SBP</span>
              <span className={`text-[26px] font-extrabold font-mono tabular-nums leading-none ${sbpColor(ews.systolicBP)}`}>
                {ews.systolicBP}
              </span>
            </div>
          )}
          {ews.spo2 != null && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-bold uppercase text-text-muted tracking-wide leading-none">SpO₂</span>
              <span className={`text-[26px] font-extrabold font-mono tabular-nums leading-none ${spo2Color(ews.spo2)}`}>
                {ews.spo2}%
              </span>
            </div>
          )}
          {hasAbnormalVitals && (
            <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-red-500 border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 rounded leading-none">
              ABNML
            </span>
          )}
        </div>
      )}

      {/* Zone 3 — Footer */}
      <div className="mt-auto px-4 pb-3 pt-2.5 border-t border-border/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass}`} />
          <span className="text-[10px] font-mono font-semibold text-text-muted truncate">
            {viewMode === 'archived' && patient.archivedAt
              ? fmtDate(patient.archivedAt)
              : `MRN ${patient.mrn}`}
          </span>
        </div>
        <span
          className="text-[11px] font-semibold shrink-0 transition-all duration-200"
          style={hovered
            ? { color: '#ffffff', transform: 'translateX(4px)' }
            : { color: 'var(--color-text-muted, #9ca3af)' }}
        >
          →
        </span>
      </div>
    </Link>
  );
}
