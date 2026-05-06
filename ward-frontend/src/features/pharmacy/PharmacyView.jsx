import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { Package, Search, Plus, X, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import BarcodeScanner from '../../components/BarcodeScanner';
import toast from 'react-hot-toast';

import StockStats from './components/StockStats';
import InventoryTable from './components/InventoryTable';
import ProcurementTab from './components/ProcurementTab';
import WasteTab from './components/WasteTab';
import AuditLogSlideover from './components/AuditLogSlideover';
import AddStockModal from './components/AddStockModal';
import AddBatchModal from './components/AddBatchModal';
import RegisterBarcodeModal from './components/RegisterBarcodeModal';

export default function PharmacyView() {
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

  const registerBarcodeMutation = useMutation({
    mutationFn: (data) => api.post('/pharmacy/barcodes/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
      setShowRegisterModal(false);
      setScanResult(null);
      toast.success('Barcode registered successfully');
    },
    onError: (err) => toast.error('Registration failed: ' + (err.message || 'Error'))
  });

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
          <StockStats 
            financial={financial} 
            inventory={inventory} 
            setShowHistory={setShowHistory} 
            highRiskItems={highRiskItems} 
            replenishment={replenishment} 
          />

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

          <InventoryTable 
            filteredInventory={filteredInventory} 
            analyticsMap={analyticsMap} 
            expandedRow={expandedRow} 
            setExpandedRow={setExpandedRow} 
            editingId={editingId} 
            setEditingId={setEditingId} 
            editLevel={editLevel} 
            setEditLevel={setEditLevel} 
            updateMutation={updateMutation} 
            deleteMutation={deleteMutation} 
            recallMutation={recallMutation} 
            setAddingBatchFor={setAddingBatchFor} 
            setShowHistory={setShowHistory} 
          />

          <AddBatchModal 
            addingBatchFor={addingBatchFor} 
            setAddingBatchFor={setAddingBatchFor} 
            newBatch={newBatch} 
            setNewBatch={setNewBatch} 
            addBatchMutation={addBatchMutation} 
          />

          <AddStockModal 
            isAdding={isAdding} 
            setIsAdding={setIsAdding} 
            newItem={newItem} 
            setNewItem={setNewItem} 
            addMutation={addMutation} 
          />

          <AuditLogSlideover 
            showHistory={showHistory} 
            setShowHistory={setShowHistory} 
            isHistoryLoading={isHistoryLoading} 
            history={history} 
          />
        </>
      ) : activeTab === 'procurement' ? (
        <ProcurementTab 
          orders={orders} 
          updateStatus={(id, status) => updateOrderStatusMutation.mutate({ id, status })}
          replenishment={replenishment}
        />
      ) : activeTab === 'waste' ? (
        <WasteTab 
          inventory={inventory} 
          pendingWaste={pendingWaste} 
          wasteHistory={wasteHistory} 
          initiateWasteMutation={initiateWasteMutation} 
          confirmWasteMutation={confirmWasteMutation} 
          cancelWasteMutation={cancelWasteMutation} 
        />
      ) : null}

      <RegisterBarcodeModal 
        showRegisterModal={showRegisterModal} 
        setShowRegisterModal={setShowRegisterModal} 
        registrationData={registrationData} 
        setRegistrationData={setRegistrationData} 
        inventory={inventory} 
        registerBarcodeMutation={registerBarcodeMutation} 
      />
    </div>
  );
}
