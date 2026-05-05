import React from 'react';
import { ChevronDown, ChevronRight, Check, X, Layers, Edit3, History, Trash2, Plus } from 'lucide-react';

const NOW = new Date();
const THIRTY_DAYS_LATER = new Date(Date.now() + 30 * 86400000);

export default function InventoryTable({
  filteredInventory,
  analyticsMap,
  expandedRow,
  setExpandedRow,
  editingId,
  setEditingId,
  editLevel,
  setEditLevel,
  updateMutation,
  deleteMutation,
  recallMutation,
  setAddingBatchFor,
  setShowHistory
}) {
  return (
    <div className="card p-0 overflow-hidden border border-border/50 shadow-xl bg-bg-tertiary">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg-secondary border-b border-border">
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted w-8"></th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted">Medicine & Composition</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted">Category</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">Type</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">Batches</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-right">Consumption</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-right">In Stock (Packs)</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-right">Total Units</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">Runway</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted">Nearest Expiry</th>
              <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filteredInventory.map(item => (
              <React.Fragment key={item.id}>
              <tr className="group hover:bg-bg-secondary/40 transition-colors cursor-pointer" onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}>
                <td className="p-4 w-8">
                  {expandedRow === item.id ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                </td>
                <td className="p-4">
                  <div className="font-black text-text-primary text-sm tracking-tight">{item.name}</div>
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">{item.composition}</div>
                </td>
                <td className="p-4"><span className="text-xs font-bold text-text-secondary">{item.category || 'N/A'}</span></td>
                <td className="p-4 text-center">
                  <span className="text-[9px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/10 uppercase">{item.type}</span>
                </td>
                <td className="p-4 text-center">
                  <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{item.batchCount || 0}</span>
                </td>
                <td className="p-4 text-right">
                  <div className="text-xs font-black text-text-primary">
                    {analyticsMap[item.id]?.dailyBurnRate || 0} <span className="text-[10px] text-text-muted">/ day</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  {editingId === item.id ? (
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <input type="number" className="w-16 !py-1 text-right font-black border border-primary rounded text-sm bg-bg-secondary" value={editLevel} onChange={e => setEditLevel(parseInt(e.target.value))} autoFocus />
                      <button onClick={() => updateMutation.mutate({ id: item.id, totalUnits: editLevel })} className="p-1 text-success hover:bg-success/10 rounded"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-text-muted hover:bg-bg-tertiary rounded"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className={`font-black text-lg ${item.totalUnits <= 5 ? 'text-warning' : 'text-text-primary'}`}>
                      {item.totalUnits} <span className="text-[10px] font-bold text-text-muted">{item.unit}</span>
                    </div>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className={`text-xl font-black ${item.totalQuantity === 0 ? 'text-danger' : item.isLowStock ? 'text-warning' : 'text-primary'}`}>{item.totalQuantity}</div>
                  <div className="text-[9px] font-black text-text-muted uppercase tracking-tighter">{item.itemUnit}</div>
                </td>
                <td className="p-4 text-center">
                  {analyticsMap[item.id]?.runwayDays !== null ? (
                    <div className={`text-sm font-black px-2 py-1 rounded-lg inline-block min-w-[60px] ${
                      analyticsMap[item.id]?.status === 'critical' ? 'bg-danger text-white' :
                      analyticsMap[item.id]?.status === 'warning' ? 'bg-warning/20 text-warning border border-warning/30' :
                      'bg-success/10 text-success'
                    }`}>
                      {analyticsMap[item.id]?.runwayDays != null ? (analyticsMap[item.id].runwayDays >= 999 ? 'Inf' : `${analyticsMap[item.id].runwayDays}d`) : 'N/A'}
                    </div>
                  ) : <span className="text-text-muted">-</span>}
                </td>
                <td className="p-4">
                  {item.nearestExpiry ? (
                    <div className={`text-xs font-black ${new Date(item.nearestExpiry) < NOW ? 'text-danger animate-pulse' : new Date(item.nearestExpiry) < THIRTY_DAYS_LATER ? 'text-warning' : 'text-text-secondary'}`}>
                      {new Date(item.nearestExpiry).toLocaleDateString()}
                    </div>
                  ) : <span className="text-[10px] text-text-muted">N/A</span>}
                </td>
                <td className="p-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setAddingBatchFor(item.id)} className="p-1.5 text-text-muted hover:text-success hover:bg-success/10 rounded-lg transition-colors" title="Add Batch"><Layers className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingId(item.id); setEditLevel(item.totalUnits); }} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit Stock"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => setShowHistory(item.id)} className="p-1.5 text-text-muted hover:text-info hover:bg-info/10 rounded-lg transition-colors" title="View Audit"><History className="w-4 h-4" /></button>
                    <button onClick={() => deleteMutation.mutate(item.id)} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Delete Item"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
              {expandedRow === item.id && (
                <tr><td colSpan="11" className="p-0 bg-bg-secondary/30">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Batch / Lot Details</span>
                      <button onClick={() => setAddingBatchFor(item.id)} className="text-[10px] font-black uppercase text-success hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add Batch</button>
                    </div>
                    {(item.batches || []).length === 0 ? (
                      <div className="text-xs text-text-muted italic p-4 text-center">No batches recorded for this item (legacy stock).</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead><tr className="text-[9px] font-black uppercase text-text-muted tracking-widest">
                          <th className="p-2 text-left">Lot #</th><th className="p-2 text-left">Expiry</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Cost/Unit</th><th className="p-2">Manufacturer</th><th className="p-2 text-center">Status</th><th className="p-2 text-center">Actions</th>
                        </tr></thead>
                        <tbody>{(item.batches || []).map(b => (
                          <tr key={b.id} className="border-t border-border/20 hover:bg-bg-tertiary/50">
                            <td className="p-2 font-bold text-text-primary">{b.batchNumber}</td>
                            <td className={`p-2 font-bold ${new Date(b.expiryDate) < new Date() ? 'text-danger' : new Date(b.expiryDate) < new Date(Date.now()+30*86400000) ? 'text-warning' : 'text-text-secondary'}`}>{new Date(b.expiryDate).toLocaleDateString()}</td>
                            <td className="p-2 text-right font-black text-text-primary">{b.quantity}</td>
                            <td className="p-2 text-right text-text-muted">₹{Number(b.costPerUnit).toFixed(2)}</td>
                            <td className="p-2 text-text-muted">{b.manufacturer || '—'}</td>
                            <td className="p-2 text-center"><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                              b.status === 'active' ? 'bg-success/10 text-success border border-success/20' :
                              b.status === 'recalled' ? 'bg-danger/10 text-danger border border-danger/20 animate-pulse' :
                              b.status === 'expired' ? 'bg-warning/10 text-warning border border-warning/20' :
                              'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                            }`}>{b.status}</span></td>
                            <td className="p-2 text-center">{b.status === 'active' && (
                              <button onClick={() => { if(window.confirm(`Recall batch ${b.batchNumber}? This will waste ${b.quantity} remaining units.`)) recallMutation.mutate({ batchId: b.id, reason: window.prompt('Enter recall reason:') || 'Recalled' }); }} className="text-[9px] font-black text-danger hover:underline">RECALL</button>
                            )}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                </td></tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filteredInventory.length === 0 && (
          <div className="p-20 text-center text-text-muted italic border-t border-border">
             No inventory matches your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
