import React from 'react';
import { History, TrendingDown, Layers } from 'lucide-react';

const THIRTY_DAYS_LATER = new Date(Date.now() + 30 * 86400000);

export default function StockStats({ financial, inventory, setShowHistory, highRiskItems, replenishment }) {
  return (
    <>
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
          {(replenishment || []).length > 0 && (
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
    </>
  );
}
