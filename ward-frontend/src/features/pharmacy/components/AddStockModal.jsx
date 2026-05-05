import React from 'react';
import { Plus, X } from 'lucide-react';

export default function AddStockModal({ isAdding, setIsAdding, newItem, setNewItem, addMutation }) {
  if (!isAdding) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
      <div className="relative w-full max-w-2xl bg-bg-tertiary rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-300">
         <div className="p-6 border-b border-border bg-bg-secondary flex justify-between items-center">
            <h2 className="text-xl font-black text-text-primary flex items-center gap-2">
              <Plus className="w-6 h-6 text-primary" /> New EDL Entry
            </h2>
            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-bg-tertiary rounded-full transition-colors">
              <X className="w-5 h-5 text-text-muted" />
            </button>
         </div>
         <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="label-enterprise">Medicine Name</label>
                <input className="input-field-enterprise" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Paracetamol" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label-enterprise">Composition</label>
                <input className="input-field-enterprise" value={newItem.composition} onChange={e => setNewItem({...newItem, composition: e.target.value})} placeholder="e.g. 500mg" />
              </div>
              <div>
                <label className="label-enterprise">Type</label>
                <select className="input-field-enterprise" value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})}>
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Injection">Injection</option>
                  <option value="Ointment">Ointment</option>
                </select>
              </div>
              <div>
                <label className="label-enterprise">Category</label>
                <input className="input-field-enterprise" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="Analgesics" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-bg-secondary/30 rounded-xl border border-border/50">
              <div>
                <label className="label-enterprise">Qty/Pack</label>
                <input type="number" className="input-field-enterprise" value={newItem.quantityPerUnit} onChange={e => setNewItem({...newItem, quantityPerUnit: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="label-enterprise">Pack Unit</label>
                <input className="input-field-enterprise" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="Strip" />
              </div>
              <div>
                <label className="label-enterprise">Init Packs</label>
                <input type="number" className="input-field-enterprise !text-primary font-black" value={newItem.totalUnits} onChange={e => setNewItem({...newItem, totalUnits: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="label-enterprise">Item Unit</label>
                <input className="input-field-enterprise" value={newItem.itemUnit} onChange={e => setNewItem({...newItem, itemUnit: e.target.value})} placeholder="Tabs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-enterprise">Cost per Item</label>
                <input type="number" step="0.01" className="input-field-enterprise" value={newItem.costPerUnit} onChange={e => setNewItem({...newItem, costPerUnit: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label-enterprise">Expiry Date</label>
                <input type="date" className="input-field-enterprise" value={newItem.expiryDate} onChange={e => setNewItem({...newItem, expiryDate: e.target.value})} />
              </div>
            </div>
         </div>
         <div className="p-6 bg-bg-secondary border-t border-border flex justify-end gap-3">
            <button onClick={() => setIsAdding(false)} className="btn btn-secondary px-8 font-black">Cancel</button>
            <button onClick={() => addMutation.mutate(newItem)} className="btn btn-primary px-10 font-black">Confirm Stock Entry</button>
         </div>
      </div>
    </div>
  );
}
