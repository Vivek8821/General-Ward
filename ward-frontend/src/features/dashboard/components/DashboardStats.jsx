import React from 'react';
import { isPatientCritical } from '../../../utils/clinicalUtils';

function StatCard({ label, value, critical }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-secondary/40 px-6 py-5">
      <div className={`text-5xl font-black tracking-tight tabular-nums leading-none ${critical ? 'text-danger' : 'text-text-primary'}`}>
        {value}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mt-3">{label}</div>
    </div>
  );
}

export default function DashboardStats({ patients, activePatients }) {
  const clinicallyCritical = activePatients.filter(isPatientCritical).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard label="Total Patients" value={patients.length} />
      <StatCard label="Active Beds" value={activePatients.length} />
      <StatCard label="Clinically Critical" value={clinicallyCritical} critical={clinicallyCritical > 0} />
    </div>
  );
}
