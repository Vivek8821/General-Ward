import React from 'react';
import { ShoppingCart, Truck, Package, AlertTriangle } from 'lucide-react';

export default function ProcurementTab({ orders = [], updateStatus, replenishment = [] }) {
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
