import React from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import { fmtDateTime } from '../../../utils/dateFormat';

export default function AuditLogSlideover({ showHistory, setShowHistory, isHistoryLoading, history }) {
  if (!showHistory) return null;

  return (
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
                    <span className="text-[10px] text-text-muted font-black uppercase tracking-tighter">{fmtDateTime(tx.timestamp)}</span>
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
  );
}
