import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { 
  Package, AlertCircle, Plus, Trash2, Edit3, Check, X, 
  History, TrendingDown, ArrowRightLeft, Info, Search,
  Filter, MoreHorizontal, ChevronDown, ChevronRight, ShieldAlert, Layers, ShoppingCart, Truck, AlertTriangle, AlertOctagon, CheckSquare, ClipboardX,
  CheckCircle2
} from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';
import toast from 'react-hot-toast';


const NOW = new Date();
const THIRTY_DAYS_LATER = new Date(Date.now() + 30 * 86400000);

export default function Pharmacy() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [showHistory, setShowHistory] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [addingBatchFor, setAddingBatchFor] = useState(null);
  const [newBatch, setNewBatch] = useState({ batchNumber: '', expiryDate: '', quantity: 0, costPerUnit: 0, manufacturer: '' });
  const [lotSearch, setLotSearch] = useState('');
  const [lotResults, setLotResults] = useState(null);
  
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

  // Waste Tab State
  const [wasteForm, setWasteForm] = useState({ stockId: '', batchId: '', quantityWasted: '', unit: '', reasonCode: 'EXPIRED', reasonNotes: '' });
  const [selectedStockForWaste, setSelectedStockForWaste] = useState(null);
  const [isScanningWaste, setIsScanningWaste] = useState(false);

  // Barcode State
  const [scanResult, setScanResult] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registrationData, setRegistrationData] = useState({ barcode: '', targetType: 'STOCK', targetId: '', notes: '' });


  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['pharmacy', 'inventory'],
    queryFn: () => api.get('/pharmacy/inventory'),
  });

  const { data: replenishment = [] } = useQuery({
    queryKey: ['pharmacy', 'analytics', 'replenishment'],
    queryFn: () => api.get('/pharmacy/analytics/replenishment'),
    refetchInterval: 60000,
  });

  const { data: financial = { totalValuation: 0, totalDailyBurnValue: 0 } } = useQuery({
    queryKey: ['pharmacy', 'analytics', 'financial'],
    queryFn: () => api.get('/pharmacy/analytics/financial'),
  });

  const analyticsMap = (Array.isArray(replenishment) ? replenishment : []).reduce((acc, curr) => {
    acc[curr.medicationId] = curr;
    return acc;
  }, {});

  const highRiskItems = (Array.isArray(replenishment) ? replenishment : []).filter(s => s.status !== 'healthy' || s.totalQuantity === 0);

  const { data: orders = [] } = useQuery({
    queryKey: ['pharmacy', 'orders'],
    queryFn: () => api.get('/pharmacy/orders'),
    enabled: activeTab === 'procurement',
    refetchInterval: 30000,
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/pharmacy/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'orders'] });
      toast.success('Order status updated');
    },
    onError: (err) => toast.error('Failed: ' + (err.message || 'Error')),
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
    onError: () => toast.error('Delete failed'),
  });

  const addBatchMutation = useMutation({
    mutationFn: ({ stockId, data }) => api.post(`/pharmacy/inventory/${stockId}/batches`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      setAddingBatchFor(null);
      setNewBatch({ batchNumber: '', expiryDate: '', quantity: 0, costPerUnit: 0, manufacturer: '' });
      toast.success('Batch added successfully');
    },
    onError: (err) => toast.error('Failed: ' + (err.message || 'Error')),
  });

  const recallMutation = useMutation({
    mutationFn: ({ batchId, reason }) => api.post(`/pharmacy/batches/${batchId}/recall`, { reason }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      toast.success(`Recalled batch: ${data.batchNumber}. ${data.quantityWasted} units wasted.`);
    },
    onError: (err) => toast.error('Recall failed: ' + (err.message || 'Error')),
  });

  const handleLotSearch = async () => {
    if (!lotSearch.trim()) return;
    try {
      const results = await api.get(`/pharmacy/batches/search?lotNumber=${encodeURIComponent(lotSearch.trim())}`);
      setLotResults(results);
    } catch { setLotResults([]); }
  };

  // ── Waste & Spillage ─────────────────────────────────────────────

  const { data: pendingWaste = [] } = useQuery({
    queryKey: ['pharmacy', 'waste', 'pending'],
    queryFn: () => api.get('/pharmacy/waste/pending'),
    enabled: activeTab === 'waste',
    refetchInterval: 15000,
  });

  const { data: wasteHistory = [] } = useQuery({
    queryKey: ['pharmacy', 'waste', 'history'],
    queryFn: () => api.get('/pharmacy/waste'),
    enabled: activeTab === 'waste',
  });

  const initiateWasteMutation = useMutation({
    mutationFn: (data) => api.post('/pharmacy/waste', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'waste'] });
      toast.success('Waste record initiated, pending witness confirmation');
      setWasteForm({ stockId: '', batchId: '', quantityWasted: '', unit: '', reasonCode: 'EXPIRED', reasonNotes: '' });
      setSelectedStockForWaste(null);
    },
    onError: (err) => toast.error('Initiate failed: ' + (err.message || 'Error'))
  });

  const confirmWasteMutation = useMutation({
    mutationFn: (id) => api.post(`/pharmacy/waste/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'waste'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      toast.success('Waste confirmed and stock deducted');
    },
    onError: (err) => toast.error('Confirmation failed: ' + (err.message || 'Error'))
  });

  const cancelWasteMutation = useMutation({
    mutationFn: (id) => api.post(`/pharmacy/waste/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'waste'] });
      toast.success('Waste record cancelled');
    },
    onError: (err) => toast.error('Cancellation failed: ' + (err.message || 'Error'))
  });
  const handleStockSelectForWaste = (e) => {
    const id = e.target.value;
    const item = (Array.isArray(inventory) ? inventory : []).find(i => i.id === id);
    setSelectedStockForWaste(item);
    setWasteForm({ ...wasteForm, stockId: id, batchId: '', unit: item ? item.itemUnit : '' });
  };

  const registerBarcodeMutation = useMutation({
    mutationFn: (data) => api.post('/pharmacy/barcode/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      setShowRegisterModal(false);
      setScanResult(null);
      toast.success('Barcode registered successfully');
    },
    onError: (err) => toast.error('Registration failed: ' + (err.message || 'Error'))
  });



  // ─────────────────────────────────────────────────────────────────

  const filteredInventory = (Array.isArray(inventory) ? inventory : []).filter(item => 
    (item.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (item.composition || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="p-10 text-center text-text-muted animate-pulse">Loading enterprise inventory...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-bg-tertiary p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-text-primary tracking-tight">Pharmacy</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Automated Stock & Procurement</p>
          </div>
        </div>

        <div className="flex bg-bg-secondary p-1 rounded-xl border border-border/40">
           <button 
             onClick={() => setActiveTab('inventory')}
             className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'inventory' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
           >
             Inventory
           </button>
           <button 
             onClick={() => setActiveTab('procurement')}
             className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'procurement' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
           >
             Procurement
             {(Array.isArray(orders) ? orders : []).filter((o) => o.status === 'pending').length > 0 && (
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
             )}
           </button>
           <button 
             onClick={() => setActiveTab('waste')}
             className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'waste' ? 'bg-danger text-white shadow-md shadow-danger/20' : 'text-text-muted hover:text-text-primary'}`}
           >
             Waste & Spillage
             {(Array.isArray(pendingWaste) ? pendingWaste : []).length > 0 && (
               <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
             )}
           </button>
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

      {activeTab === 'inventory' ? (
        <>
      {/* Quick Stats Banner - Optimized for Widescreen */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-bg-tertiary p-4 rounded-xl border border-border/50 flex flex-col justify-between min-h-[100px]">
           <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Total Valuation</span>
           <span className="text-2xl font-black text-primary">₹{financial.totalValuation?.toLocaleString()}</span>
        </div>
        <div className="bg-bg-tertiary p-4 rounded-xl border border-border/50 flex flex-col justify-between min-h-[100px]">
           <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Daily Burn Value</span>
           <span className="text-2xl font-black text-warning">₹{financial.totalDailyBurnValue?.toLocaleString()}</span>
        </div>
        <div className="bg-warning/5 p-4 rounded-xl border border-warning/20 flex flex-col justify-between min-h-[100px]">
           <span className="text-[10px] font-black uppercase text-warning tracking-widest">Low Stock Items</span>
           <span className="text-2xl font-black text-warning">{(Array.isArray(inventory) ? inventory : []).filter(i => i.isLowStock).length}</span>
        </div>
        <div className="bg-danger/5 p-4 rounded-xl border border-border/50 flex flex-col justify-between min-h-[100px]">
           <span className="text-[10px] font-black uppercase text-danger tracking-widest">Stockout Risk</span>
           <span className="text-2xl font-black text-danger">{(Array.isArray(inventory) ? inventory : []).filter(i => i.totalQuantity === 0).length}</span>
        </div>
        <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/20 flex flex-col justify-between min-h-[100px]">
           <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Expiring Items</span>
           <span className="text-2xl font-black text-orange-500">{(Array.isArray(inventory) ? inventory : []).reduce((c, i) => c + (i.batches || []).filter(b => b.status === 'active' && new Date(b.expiryDate) <= THIRTY_DAYS_LATER).length, 0)}</span>
        </div>
        <button 
          onClick={() => setShowHistory(true)}
          className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex flex-col justify-between min-h-[100px] hover:bg-primary/10 transition-colors group text-left"
        >
           <span className="text-[10px] font-black uppercase text-primary tracking-widest">Master Audit Log</span>
           <History className="w-6 h-6 text-primary group-hover:rotate-12 transition-transform" />
        </button>
      </div>

      {/* Consumption & Replenishment Alert Banner */}
      {((highRiskItems || []).length > 0 || (replenishment || []).length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          {(highRiskItems || []).length > 0 && (
            <div className="bg-danger/10 border border-danger/20 p-4 rounded-xl flex items-center gap-4">
              <div className="bg-danger p-2 rounded-lg">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-danger uppercase tracking-wider">Supply Alerts</h3>
                <p className="text-xs text-text-primary font-bold">
                  {(highRiskItems || []).slice(0, 3).map(item => `${item.name} (${item.runwayDays || 0}d left)`).join(', ')}...
                </p>
              </div>
            </div>
          )}
          {replenishment.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center gap-4">
              <div className="bg-primary p-2 rounded-lg">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-primary uppercase tracking-wider">Replenishment Suggestions</h3>
                <p className="text-xs text-text-primary font-bold">
                  {(Array.isArray(replenishment) ? replenishment : []).slice(0, 2).map(r => `Order ${r.suggestedOrder} units of ${r.name}`).join('; ')}
                </p>
              </div>
              <button className="btn btn-primary py-1 text-[10px] px-4 font-black">Review Order</button>
            </div>
          )}
        </div>
      )}

      {/* Scan & Lookup Panel */}
      <div className="animate-in slide-in-from-top-2 duration-500">
        <BarcodeScanner 
          onResolved={(res) => setScanResult(res)}
          onUnregistered={(parsed) => {
            setScanResult({ status: 'UNREGISTERED', parsedFields: parsed });
            setRegistrationData(prev => ({ ...prev, barcode: parsed.raw }));
          }}
        />
        
        {scanResult && (
          <div className="mt-4 animate-in slide-in-from-top-2">
            {scanResult.status === 'RESOLVED' ? (
              <div className="card bg-success/5 border-success/20 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-success/10 text-success rounded-full">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{scanResult.record.name}</h4>
                    <p className="text-sm text-text-secondary">
                      {scanResult.matchType === 'BATCH' ? `Batch ${scanResult.record.batchNumber} • Expiry ${new Date(scanResult.record.expiryDate).toLocaleDateString()}` : 'Master Stock Record'}
                    </p>
                    <p className="text-xs font-bold text-primary mt-1">
                      Current Stock: {scanResult.matchType === 'BATCH' ? scanResult.record.quantity : scanResult.record.totalQuantity} {scanResult.record.itemUnit}
                    </p>
                  </div>
                </div>
                <button onClick={() => setScanResult(null)} className="text-text-muted hover:text-text-primary">
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="card bg-warning/5 border-warning/20 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-warning/10 text-warning rounded-full">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold">Unregistered Barcode</h4>
                    <p className="text-xs text-text-secondary font-mono">{scanResult.parsedFields.raw}</p>
                    {scanResult.parsedFields.gtin && (
                      <p className="text-[10px] text-text-muted mt-1">GTIN: {scanResult.parsedFields.gtin}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowRegisterModal(true)}
                    className="btn btn-primary !py-1.5 !px-3 text-xs"
                  >
                    Register to Drug
                  </button>
                  <button onClick={() => setScanResult(null)} className="text-text-muted hover:text-text-primary">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lot Number Search */}
      <div className="flex gap-2 items-center bg-bg-tertiary p-3 rounded-xl border border-border/50">
        <ShieldAlert className="w-5 h-5 text-warning" />
        <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Lot Lookup</span>
        <input placeholder="Enter lot/batch number..." className="input-field !bg-bg-secondary/50 !text-sm flex-1 max-w-xs" value={lotSearch} onChange={e => { setLotSearch(e.target.value); setLotResults(null); }} onKeyDown={e => e.key === 'Enter' && handleLotSearch()} />
        <button onClick={handleLotSearch} className="btn btn-secondary text-xs px-4">Search</button>
        {lotResults !== null && <span className="text-xs font-bold text-text-muted">{lotResults.length} result(s)</span>}
        {lotResults?.length > 0 && <div className="text-xs text-primary font-bold">{lotResults.map(r => `${r.drugName} - ${r.batchNumber} (${r.status})`).join(', ')}</div>}
      </div>

      {/* Inventory Table */}
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
                  <tr><td colSpan="9" className="p-0 bg-bg-secondary/30">
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
                                <button onClick={() => { if(confirm(`Recall batch ${b.batchNumber}? This will waste ${b.quantity} remaining units.`)) recallMutation.mutate({ batchId: b.id, reason: prompt('Enter recall reason:') || 'Recalled' }); }} className="text-[9px] font-black text-danger hover:underline">RECALL</button>
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

      {/* Add Batch Modal */}
      {addingBatchFor && (
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
      )}

      {/* Add Item Modal (Overlay instead of inline for tabular view) */}
      {isAdding && (
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
      )}

      {/* History Slide-over */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowHistory(null)}></div>
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

        </>
      ) : activeTab === 'procurement' ? (
        <ProcurementTab 
          orders={orders} 
          updateStatus={(id, status) => updateOrderStatusMutation.mutate({ id, status })}
          replenishment={replenishment}
        />
      ) : activeTab === 'waste' ? (
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
      ) : null}

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-bg-primary w-full max-w-md rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-1">Register Barcode</h3>
              <p className="text-sm text-text-secondary mb-6">Link this code to a medication in your inventory.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1 uppercase text-text-muted">Barcode String</label>
                  <input type="text" readOnly className="input-field bg-bg-tertiary font-mono" value={registrationData.barcode} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 uppercase text-text-muted">Target Medication</label>
                  <select 
                    className="input-field"
                    value={registrationData.targetId}
                    onChange={(e) => setRegistrationData({...registrationData, targetId: e.target.value})}
                  >
                    <option value="">Select Drug...</option>
                    {inventory.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.composition})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 uppercase text-text-muted">Notes (Optional)</label>
                  <input type="text" className="input-field" placeholder="e.g. Manufacturer package code" value={registrationData.notes} onChange={(e) => setRegistrationData({...registrationData, notes: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowRegisterModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={() => registerBarcodeMutation.mutate(registrationData)} disabled={!registrationData.targetId || registerBarcodeMutation.isPending} className="btn btn-primary flex-1">
                  {registerBarcodeMutation.isPending ? 'Registering...' : 'Register Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ProcurementTab({ orders = [], updateStatus, replenishment = [] }) {
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* PO List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" /> Active Purchase Orders
            </h2>
            <span className="text-[10px] font-black text-text-muted uppercase bg-bg-tertiary px-2 py-1 rounded border border-border">
              {orders.length} Total Orders
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {(Array.isArray(orders) ? orders : []).length === 0 ? (
              <div className="card p-10 text-center text-text-muted flex flex-col items-center gap-3">
                <Truck className="w-12 h-12 opacity-20" />
                <p className="font-bold">No active purchase orders.</p>
                <p className="text-[10px] uppercase tracking-widest">System will auto-generate orders when stock levels hit threshold.</p>
              </div>
            ) : (
              (Array.isArray(orders) ? orders : []).map((order) => (
                <div key={order.id} className="card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border ${
                      order.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                      order.status === 'ordered' ? 'bg-info/10 border-info/20 text-info' :
                      'bg-success/10 border-success/20 text-success'
                    }`}>
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-text-primary uppercase tracking-tight">{order.stockName || 'Medication Order'}</h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                        <span>Qty: <span className="text-text-primary">{order.quantity}</span></span>
                        <span>•</span>
                        <span>Ref: {order.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right hidden md:block">
                      <div className="text-[9px] font-black uppercase text-text-muted tracking-widest">Generated On</div>
                      <div className="text-xs font-bold text-text-primary">{new Date(order.generatedAt).toLocaleDateString()}</div>
                    </div>

                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button 
                          onClick={() => updateStatus(order.id, 'ordered')}
                          className="btn btn-primary py-1.5 text-[10px] px-4 font-black uppercase tracking-widest"
                        >
                          Mark Ordered
                        </button>
                      )}
                      {order.status === 'ordered' && (
                        <button 
                          onClick={() => updateStatus(order.id, 'received')}
                          className="btn btn-success py-1.5 text-[10px] px-4 font-black uppercase tracking-widest"
                        >
                          Confirm Receipt
                        </button>
                      )}
                      <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                        order.status === 'pending' ? 'bg-amber-500/5 border-amber-500/20 text-amber-600' :
                        order.status === 'ordered' ? 'bg-info/5 border-info/20 text-info' :
                        'bg-success/5 border-success/20 text-success'
                      }`}>
                        {order.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Replenishment Intelligence Sidebar */}
        <div className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" /> Procurement Intel
          </h2>
          <div className="card p-5 bg-primary/5 border-primary/20 space-y-4">
            <p className="text-xs font-bold text-text-secondary leading-relaxed">
              Based on current 30-day burn rates, the following items require immediate procurement attention.
            </p>
            <div className="space-y-3">
              {(Array.isArray(replenishment) ? replenishment : []).slice(0, 5).map((r) => (
                <div key={r.medicationId} className="flex items-center justify-between bg-bg-primary p-3 rounded-lg border border-border/40">
                  <div>
                    <div className="text-xs font-black text-text-primary uppercase tracking-tight">{r.name}</div>
                    <div className="text-[9px] font-bold text-danger uppercase tracking-widest">Suggested Order: {r.suggestedOrder}</div>
                  </div>
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded ${
                    r.urgency === 'HIGH' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {r.urgency}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary w-full text-[10px] font-black uppercase tracking-widest py-3">
              Export Procurement Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
