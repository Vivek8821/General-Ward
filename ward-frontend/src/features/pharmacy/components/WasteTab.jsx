import React, { useState } from 'react';
import { ClipboardX, Plus, Layers, AlertOctagon, CheckSquare, Check, History } from 'lucide-react';
import BarcodeScanner from '../../../components/BarcodeScanner';

export default function WasteTab({
  inventory,
  pendingWaste,
  wasteHistory,
  initiateWasteMutation,
  confirmWasteMutation,
  cancelWasteMutation,
}) {
  const [wasteForm, setWasteForm] = useState({ stockId: '', batchId: '', quantityWasted: '', unit: '', reasonCode: 'EXPIRED', reasonNotes: '' });
  const [selectedStockForWaste, setSelectedStockForWaste] = useState(null);
  const [isScanningWaste, setIsScanningWaste] = useState(false);

  const handleStockSelectForWaste = (e) => {
    const id = e.target.value;
    const item = (Array.isArray(inventory) ? inventory : []).find(i => i.id === id);
    setSelectedStockForWaste(item);
    setWasteForm({ ...wasteForm, stockId: id, batchId: '', unit: item ? item.itemUnit : '' });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
      
      {/* Initiate Waste Form */}
      <div className="xl:col-span-1 space-y-4">
        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
          <ClipboardX className="w-5 h-5 text-danger" /> Report Waste
        </h2>
        <div className="card p-6 border-2 border-primary/20 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><Plus className="text-primary"/> Initiate Waste Report</h3>
            <button onClick={() => setIsScanningWaste(true)} className="btn btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"><Layers className="h-3 w-3" /> Scan Drug</button>
          </div>
          {isScanningWaste && (
            <div className="mb-4 animate-in fade-in zoom-in-95">
              <BarcodeScanner 
                onResolved={(res) => {
                  setIsScanningWaste(false);
                  const item = res.matchType === 'BATCH' ? (Array.isArray(inventory) ? inventory : []).find(i => i.id === res.record.stockId) : res.record;
                  setSelectedStockForWaste(item);
                  setWasteForm({...wasteForm, stockId: item.id, batchId: res.matchType === 'BATCH' ? res.record.id : '', unit: item.itemUnit});
                }}
                onUnregistered={() => alert('Barcode not found.')}
              />
              <button onClick={() => setIsScanningWaste(false)} className="mt-2 text-xs text-text-muted hover:underline">Cancel Scan</button>
            </div>
          )}
        </div>
        <form 
          className="card p-5 space-y-4 bg-danger/5 border-danger/20"
          onSubmit={(e) => {
            e.preventDefault();
            initiateWasteMutation.mutate({
              ...wasteForm,
              quantityWasted: parseInt(wasteForm.quantityWasted)
            }, {
              onSuccess: () => {
                setWasteForm({ stockId: '', batchId: '', quantityWasted: '', unit: '', reasonCode: 'EXPIRED', reasonNotes: '' });
                setSelectedStockForWaste(null);
              }
            });
          }}
        >
          <div>
            <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Medication</label>
            <select 
              className="input-field w-full text-sm font-bold"
              value={wasteForm.stockId}
              onChange={handleStockSelectForWaste}
              required
            >
              <option value="">Select Medication...</option>
              {(Array.isArray(inventory) ? inventory : []).map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.composition}) - {item.totalQuantity} {item.itemUnit} avail</option>
              ))}
            </select>
          </div>

          {selectedStockForWaste && (selectedStockForWaste.batches || []).filter(b => b.status === 'active').length > 0 && (
            <div>
              <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Batch (Optional - FEFO applied if empty)</label>
              <select 
                className="input-field w-full text-sm"
                value={wasteForm.batchId}
                onChange={e => setWasteForm({...wasteForm, batchId: e.target.value})}
              >
                <option value="">Auto-resolve via FEFO</option>
                {(selectedStockForWaste.batches || []).filter(b => b.status === 'active').map(b => (
                  <option key={b.id} value={b.id}>{b.batchNumber} (Exp: {b.expiryDate}, Qty: {b.quantity})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Quantity</label>
              <input 
                type="number" 
                min="1" 
                className="input-field w-full text-sm"
                value={wasteForm.quantityWasted}
                onChange={e => setWasteForm({...wasteForm, quantityWasted: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Unit</label>
              <input 
                type="text" 
                className="input-field w-full text-sm bg-bg-tertiary"
                value={wasteForm.unit}
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Reason Code</label>
            <select 
              className="input-field w-full text-sm"
              value={wasteForm.reasonCode}
              onChange={e => setWasteForm({...wasteForm, reasonCode: e.target.value})}
            >
              <option value="EXPIRED">Expired</option>
              <option value="DAMAGED">Damaged / Broken</option>
              <option value="CONTAMINATED">Contaminated</option>
              <option value="SPILL">Spillage</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {wasteForm.reasonCode === 'OTHER' && (
            <div>
              <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Detailed Reason</label>
              <textarea 
                className="input-field w-full text-sm min-h-[80px]"
                value={wasteForm.reasonNotes}
                onChange={e => setWasteForm({...wasteForm, reasonNotes: e.target.value})}
                required
              />
            </div>
          )}

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={initiateWasteMutation.isPending || !wasteForm.stockId || !wasteForm.quantityWasted}
              className="btn btn-primary w-full shadow-lg shadow-danger/20 !bg-danger hover:!bg-danger/90 flex justify-center items-center gap-2 py-3 font-black uppercase tracking-widest"
            >
              <AlertOctagon className="w-5 h-5" />
              Initiate Waste Record
            </button>
            <p className="text-[10px] text-center text-text-muted mt-3 font-bold px-2">
              Stock is NOT deducted until a second staff member confirms this record.
            </p>
          </div>
        </form>
      </div>

      {/* Pending & History Ledger */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* Pending Confirmation Queue */}
        <div className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-warning" /> Pending Witness Confirmation
          </h2>
          <div className="space-y-3">
            {(!Array.isArray(pendingWaste) || pendingWaste.length === 0) ? (
              <div className="card p-8 text-center border-dashed bg-bg-secondary">
                <p className="text-sm font-bold text-text-muted">No pending waste records awaiting witness.</p>
              </div>
            ) : (
              pendingWaste.map(record => (
                <div key={record.id} className="card p-4 border-warning/30 bg-warning/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-warning/20 text-warning text-[10px] px-2 py-0.5 rounded font-black uppercase">{record.reasonCode}</span>
                      <span className="text-[10px] text-text-muted font-bold">{new Date(record.initiatedAt).toLocaleString()}</span>
                    </div>
                    <h3 className="font-black text-text-primary text-base">{record.stockName}</h3>
                    <p className="text-xs font-bold text-text-secondary mt-1">
                      <span className="text-danger font-black">{record.quantityWasted} {record.unit}</span> 
                      {record.batchId && ` • Batch: ${record.batchId.slice(0,8)}`}
                    </p>
                    <p className="text-[10px] font-bold text-text-muted mt-2">Initiated by: {record.initiatedByUserName}</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => cancelWasteMutation.mutate(record.id)}
                      disabled={cancelWasteMutation.isPending}
                      className="btn btn-secondary flex-1 md:flex-none text-[10px] font-black uppercase tracking-widest px-4"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        if(window.confirm('Are you sure you want to witness and confirm this waste record? This will permanently deduct stock.')) {
                          confirmWasteMutation.mutate(record.id);
                        }
                      }}
                      disabled={confirmWasteMutation.isPending}
                      className="btn btn-primary flex-1 md:flex-none text-[10px] font-black uppercase tracking-widest px-4 flex justify-center items-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Witness & Confirm
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* History Ledger */}
        <div className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 mt-8">
            <History className="w-5 h-5 text-text-muted" /> Waste Ledger History
          </h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-bg-secondary border-b border-border/50 text-[10px] uppercase font-black text-text-muted tracking-widest">
                    <th className="p-4">Date</th>
                    <th className="p-4">Medication</th>
                    <th className="p-4">Qty</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Sign-Off (Init / Wit)</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold divide-y divide-border/30">
                  {(!Array.isArray(wasteHistory) || wasteHistory.length === 0) ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-text-muted">No historical waste records found.</td>
                    </tr>
                  ) : (
                    wasteHistory.map(record => (
                      <tr key={record.id} className="hover:bg-bg-secondary/30 transition-colors">
                        <td className="p-4 text-xs">{new Date(record.createdAt).toLocaleDateString()}<br/><span className="text-[9px] text-text-muted">{new Date(record.createdAt).toLocaleTimeString()}</span></td>
                        <td className="p-4">
                          <span className="text-text-primary block">{record.stockName}</span>
                          {record.batchId && <span className="text-[10px] text-text-muted block">Batch: {record.batchId.slice(0,8)}</span>}
                        </td>
                        <td className="p-4 text-danger">{record.quantityWasted} {record.unit}</td>
                        <td className="p-4">
                          <span className="text-xs">{record.reasonCode}</span>
                          {record.reasonNotes && <span className="block text-[10px] text-text-muted font-normal mt-0.5 truncate max-w-[150px]" title={record.reasonNotes}>{record.reasonNotes}</span>}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-text-secondary bg-bg-secondary px-2 py-0.5 rounded w-fit">I: {record.initiatedByUserName.split(' ')[0]}</span>
                            {record.witnessUserName && <span className="text-[10px] text-success bg-success/10 px-2 py-0.5 rounded w-fit">W: {record.witnessUserName?.split(' ')[0]}</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] px-2 py-1 rounded font-black tracking-widest ${
                            record.status === 'CONFIRMED' ? 'bg-danger/10 text-danger' : 
                            record.status === 'CANCELLED' ? 'bg-bg-secondary text-text-muted' : 
                            'bg-warning/10 text-warning'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
