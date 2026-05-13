import React from 'react';
import PatientCard from './PatientCard';

export default function PatientGrid({ filteredPatients, viewMode, highlightCritical = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-stretch stagger-slide-up">
      {filteredPatients.map(patient => (
        <PatientCard
          key={patient.archiveId || patient.patientId || patient.id}
          patient={patient}
          viewMode={viewMode}
          highlightCritical={highlightCritical}
        />
      ))}
    </div>
  );
}
