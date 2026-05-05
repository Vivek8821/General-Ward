import React from 'react';
import PatientCard from './PatientCard';

export default function PatientGrid({ filteredPatients, viewMode }) {
  return (
    <div className="p-6 bg-bg-primary grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 stagger-slide-up">
      {filteredPatients.map(patient => (
        <PatientCard 
          key={patient.archiveId || patient.patientId || patient.id} 
          patient={patient} 
          viewMode={viewMode} 
        />
      ))}
    </div>
  );
}
