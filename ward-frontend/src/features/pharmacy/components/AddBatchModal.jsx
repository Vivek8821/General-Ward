import React from 'react';
import { Layers, X } from 'lucide-react';

export default function AddBatchModal({ addingBatchFor, setAddingBatchFor, newBatch, setNewBatch, addBatchMutation }) {
  if (!addingBatchFor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAddingBatchFor(null)}></div>
      <div className="relative w-full max-w-lg bg-bg-tertiary rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-border bg-bg-secondary flex justify-between items-center">
          <h2 className="text-xl font-black text-text-primary flex items-center gap-2"><Layers className="w-6 h-6 text-success" /> Add Batch</h2>
          <button onClick={() => setAddingBatchFor(null)} className="p-2 hover:bg-bg-tertiary rounded-full"><X className="w-5 h-5 text-text-muted" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-enterprise">Lot / Batch Number</label><input className="input-field-enterprise" value={newBatch.batchNumber} onChange={e => setNewBatch({...newBatch, batchNumber: e.target.value})} placeholder="e.g. AMX-2026-B01" /></div>
            <div><label className="label-enterprise">Expiry Date</label><input type="date" className="input-field-enterprise" value={newBatch.expiryDate} onChange={e => setNewBatch({...newBatch, expiryDate: e.target.value})} /></div>
            <div><label className="label-enterprise">Quantity (units)</label><input type="number" className="input-field-enterprise" value={newBatch.quantity} onChange={e => setNewBatch({...newBatch, quantity: parseInt(e.target.value) || 0})} /></div>
            <div><label className="label-enterprise">Cost per Unit</label><input type="number" step="0.01" className="input-field-enterprise" value={newBatch.costPerUnit} onChange={e => setNewBatch({...newBatch, costPerUnit: parseFloat(e.target.value) || 0})} /></div>
            <div className="col-span-2"><label className="label-enterprise">Manufacturer</label><input className="input-field-enterprise" value={newBatch.manufacturer} onChange={e => setNewBatch({...newBatch, manufacturer: e.target.value})} placeholder="e.g. Cipla Ltd" /></div>
          </div>
        </div>
        <div className="p-6 bg-bg-secondary border-t border-border flex justify-end gap-3">
          <button onClick={() => setAddingBatchFor(null)} className="btn btn-secondary px-8 font-black">Cancel</button>
          <button onClick={() => addBatchMutation.mutate({ stockId: addingBatchFor, data: newBatch })} className="btn btn-primary px-10 font-black">Add Batch</button>
        </div>
      </div>
    </div>
  );
}
