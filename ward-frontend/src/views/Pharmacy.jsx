import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { 
  Package, AlertCircle, Plus, Trash2, Edit3, Check, X, 
  History, TrendingDown, ArrowRightLeft, Info, Search,
  Filter, MoreHorizontal
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Pharmacy() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [showHistory, setShowHistory] = useState(null);
  const [search, setSearch] = useState('');
  
  const [newItem, setNewItem] = useState({ 
    name: '', 
    composition: '', 
    type: 'Tablet', 
    category: '', 
    quantityPerUnit: 10,
    totalUnits: 0, 
    unit: 'Strips', 
    itemUnit: 'Tablets',
    costPerUnit: 0, 
    expiryDate: '', 
    manufacturer: '', 
    minThreshold: 10 
  });
  
  const [editingId, setEditingId] = useState(null);
  const [editLevel, setEditLevel] = useState(0);

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['pharmacy', 'inventory'],
    queryFn: () => api.get('/pharmacy/inventory'),
  });

  const { data: history = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['pharmacy', 'history', showHistory],
    queryFn: () => api.get(`/pharmacy/history${showHistory && showHistory !== true ? `?medicationId=${showHistory}` : ''}`),
    enabled: !!showHistory,
  });

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/pharmacy/inventory', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      setIsAdding(false);
      toast.success('Medication added to inventory');
    },
    onError: (err) => toast.error('Failed to add: ' + (err.message || 'Error')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, totalUnits }) => api.patch(`/pharmacy/inventory/${id}`, { totalUnits }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'history'] });
      setEditingId(null);
      toast.success('Stock updated');
    },
    onError: (err) => toast.error('Update failed: ' + (err.message || 'Error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/pharmacy/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      toast.success('Removed from inventory');
    },
    onError: (err) => toast.error('Delete failed'),
  });

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.composition.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="p-10 text-center text-text-muted animate-pulse">Loading enterprise inventory...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-tertiary p-4 rounded-xl border border-border/50 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
            <Package className="w-8 h-8 text-primary" /> Pharmacy Inventory
          </h1>
          <p className="text-text-muted text-[10px] uppercase font-black tracking-widest ml-10">Central Essential Drug List (EDL)</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              placeholder="Filter by name, composition or category..." 
              className="input-field pl-10 !bg-bg-secondary/50 !text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAdding(true)} 
            className="btn btn-primary flex items-center gap-2 whitespace-nowrap shadow-lg shadow-primary/20 px-6"
          >
            <Plus className="w-5 h-5" /> Add Stock
          </button>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        <div className="flex-1 min-w-[200px] bg-bg-tertiary p-3 rounded-lg border border-border/50 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase text-text-muted">Total Items</span>
           <span className="text-xl font-black text-text-primary">{inventory.length}</span>
        </div>
        <div className="flex-1 min-w-[200px] bg-warning/5 p-3 rounded-lg border border-warning/20 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase text-warning">Low Stock</span>
           <span className="text-xl font-black text-warning">{inventory.filter(i => i.isLowStock).length}</span>
        </div>
        <div className="flex-1 min-w-[200px] bg-danger/5 p-3 rounded-lg border border-danger/20 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase text-danger">Out of Stock</span>
           <span className="text-xl font-black text-danger">{inventory.filter(i => i.totalQuantity === 0).length}</span>
        </div>
        <button 
          onClick={() => setShowHistory(true)}
          className="flex-1 min-w-[200px] bg-primary/5 p-3 rounded-lg border border-primary/20 flex items-center justify-between hover:bg-primary/10 transition-colors group"
        >
           <span className="text-[10px] font-black uppercase text-primary">Master Audit</span>
           <History className="w-5 h-5 text-primary group-hover:rotate-12 transition-transform" />
        </button>
      </div>

      {/* Inventory Table */}
      <div className="card p-0 overflow-hidden border border-border/50 shadow-xl bg-bg-tertiary">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-secondary border-b border-border">
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted">Medicine & Composition</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted">Category</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">Type</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted">Pack Config</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-right">In Stock (Packs)</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-right">Total Units</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted">Expiry</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredInventory.map(item => (
                <tr key={item.id} className="group hover:bg-bg-secondary/40 transition-colors">
                  <td className="p-4">
                    <div className="font-black text-text-primary text-sm tracking-tight">{item.name}</div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">{item.composition}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-bold text-text-secondary">{item.category || 'N/A'}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-[9px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/10 uppercase">
                      {item.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-text-primary font-bold">
                      {item.quantityPerUnit} {item.itemUnit} <span className="text-text-muted font-normal text-[10px]">per {item.unit}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    {editingId === item.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input 
                          type="number" 
                          className="w-16 !py-1 text-right font-black border border-primary rounded text-sm bg-bg-secondary" 
                          value={editLevel} 
                          onChange={e => setEditLevel(parseInt(e.target.value))} 
                          autoFocus
                        />
                        <button onClick={() => updateMutation.mutate({ id: item.id, totalUnits: editLevel })} className="p-1 text-success hover:bg-success/10 rounded">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-text-muted hover:bg-bg-tertiary rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className={`font-black text-lg ${item.totalUnits <= 5 ? 'text-warning' : 'text-text-primary'}`}>
                        {item.totalUnits} <span className="text-[10px] font-bold text-text-muted">{item.unit}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className={`text-xl font-black ${item.totalQuantity === 0 ? 'text-danger' : item.isLowStock ? 'text-warning' : 'text-primary'}`}>
                      {item.totalQuantity}
                    </div>
                    <div className="text-[9px] font-black text-text-muted uppercase tracking-tighter">{item.itemUnit}</div>
                  </td>
                  <td className="p-4">
                    {item.expiryDate ? (
                      <div className={`text-xs font-black ${new Date(item.expiryDate) < new Date() ? 'text-danger animate-pulse' : 'text-text-secondary'}`}>
                        {new Date(item.expiryDate).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-[10px] text-text-muted">N/A</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingId(item.id); setEditLevel(item.totalUnits); }} 
                        className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit Stock"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setShowHistory(item.id)}
                        className="p-1.5 text-text-muted hover:text-info hover:bg-info/10 rounded-lg transition-colors"
                        title="View Audit"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteMutation.mutate(item.id)} 
                        className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
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

      {/* Add Item Modal (Overlay instead of inline for tabular view) */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAdding(false)} />
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
      )}

      {/* History Slide-over */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowHistory(null)} />
          <div className="relative w-full max-w-xl bg-bg-tertiary h-full shadow-2xl border-l border-border animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b border-border flex justify-between items-center bg-bg-secondary">
              <div>
                <h2 className="text-xl font-black text-text-primary flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary" /> Audit Ledger
                </h2>
                <p className="text-xs text-text-muted font-medium">Immutable transaction history</p>
              </div>
              <button onClick={() => setShowHistory(null)} className="p-2 hover:bg-bg-tertiary rounded-full transition-colors">
                <X className="w-6 h-6 text-text-muted" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto h-[calc(100%-88px)] space-y-4">
              {isHistoryLoading ? (
                <div className="p-10 text-center text-text-muted animate-pulse font-black uppercase text-[10px] tracking-widest">Loading Ledger...</div>
              ) : history.length === 0 ? (
                <div className="p-20 text-center text-text-muted italic opacity-50">No transactions recorded for this entry.</div>
              ) : (
                history.map((tx) => (
                  <div key={tx.id} className="bg-bg-secondary/50 p-4 rounded-xl border border-border/50 flex justify-between gap-4 group hover:border-primary/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          tx.type === 'restock' ? 'bg-success/10 text-success border border-success/20' :
                          tx.type === 'dispense' ? 'bg-primary/10 text-primary border border-primary/20' :
                          tx.type === 'waste' ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-warning/10 text-warning border border-warning/20'
                        }`}>
                          {tx.type}
                        </span>
                        <span className="text-[10px] text-text-muted font-black uppercase tracking-tighter">{new Date(tx.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-black text-text-primary mt-1">{tx.notes || 'Manual stock adjustment'}</p>
                      <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mt-2">Operator: <span className="text-primary">{tx.userName}</span></p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-black ${tx.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </div>
                      <div className="text-[9px] font-black text-text-muted uppercase tracking-tighter">Units Modified</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .label-enterprise {
          @apply block text-[10px] font-black uppercase tracking-widest mb-1.5 text-text-muted;
        }
        .input-field-enterprise {
          @apply input-field !bg-bg-secondary !border-border/50 focus:!border-primary/50 text-sm font-semibold;
        }
      `}} />
    </div>
  );
}
