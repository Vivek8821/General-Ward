import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../utils/api';
import { Plus, Trash2, Receipt, Lock, Ban, BadgeIndianRupee } from 'lucide-react';

const fmt = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLES = {
  open:       'bg-blue-500/10 text-blue-600 border-blue-500/30',
  finalized:  'bg-amber-500/10 text-amber-600 border-amber-500/30',
  paid:       'bg-green-500/10 text-green-600 border-green-500/30',
  cancelled:  'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded border ${STATUS_STYLES[status] || ''}`}>
      {status}
    </span>
  );
}

export default function BillingTab({ patientId, readOnly = false }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

  const { data: invoices = [], isLoading: invListLoading } = useQuery({
    queryKey: ['billing', 'invoices', patientId],
    queryFn: () => api.get(`/billing/patients/${patientId}/invoices`).then((r) => r?.data ?? []),
  });

  const { data: invoice, isLoading: invLoading } = useQuery({
    queryKey: ['billing', 'invoice', selectedId],
    queryFn: () => api.get(`/billing/invoices/${selectedId}`),
    enabled: !!selectedId,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['billing', 'invoices', patientId] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ['billing', 'invoice', selectedId] });
  };

  const createInvoice = useMutation({
    mutationFn: () => api.post(`/billing/patients/${patientId}/invoices`, { notes: null }),
    onSuccess: (created) => {
      toast.success('Invoice created');
      setSelectedId(created.id);
      refetch();
    },
    onError: (e) => toast.error(e.message || 'Failed to create invoice'),
  });

  if (invListLoading) return <div className="p-6 text-text-muted">Loading invoices...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 p-4">
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Invoices</h3>
          {!readOnly && (
            <button
              type="button"
              onClick={() => createInvoice.mutate()}
              disabled={createInvoice.isPending}
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-primary text-white disabled:opacity-50"
            >
              <Plus size={12} /> New
            </button>
          )}
        </div>
        {invoices.length === 0 && (
          <p className="text-sm text-text-muted py-6 text-center border border-dashed border-border rounded">No invoices yet.</p>
        )}
        <ul className="space-y-1">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <button
                type="button"
                onClick={() => setSelectedId(inv.id)}
                className={`w-full text-left px-3 py-2 rounded border ${selectedId === inv.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-bg-secondary'}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{new Date(inv.createdAt).toLocaleDateString('en-IN')}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{fmt(inv.grandTotal)}</span>
                  {Number(inv.balanceDue) > 0 && (
                    <span className="text-xs text-danger">Due {fmt(inv.balanceDue)}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main>
        {!selectedId && (
          <div className="h-full flex items-center justify-center p-12 border border-dashed border-border rounded">
            <div className="text-center text-text-muted">
              <Receipt size={32} className="mx-auto mb-2 opacity-50" />
              Select an invoice or create a new one.
            </div>
          </div>
        )}
        {selectedId && invLoading && <div className="p-6 text-text-muted">Loading invoice...</div>}
        {selectedId && invoice && (
          <InvoiceDetail invoice={invoice} readOnly={readOnly} refetch={refetch} />
        )}
      </main>
    </div>
  );
}

function InvoiceDetail({ invoice, readOnly, refetch }) {
  const [showLineForm, setShowLineForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const finalize = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoice.id}/finalize`, {}),
    onSuccess: () => { toast.success('Invoice finalized'); refetch(); },
    onError: (e) => toast.error(e.message || 'Could not finalize'),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoice.id}/cancel`, {}),
    onSuccess: () => { toast.success('Invoice cancelled'); refetch(); },
    onError: (e) => toast.error(e.message || 'Could not cancel'),
  });

  const removeLine = useMutation({
    mutationFn: (lineId) => api.delete(`/billing/invoices/${invoice.id}/lines/${lineId}`),
    onSuccess: () => { toast.success('Line removed'); refetch(); },
    onError: (e) => toast.error(e.message || 'Could not remove line'),
  });

  const canEditLines = invoice.status === 'open' && !readOnly;
  const canFinalize  = invoice.status === 'open' && !readOnly && invoice.lines.length > 0;
  const canCancel    = invoice.status !== 'paid' && invoice.status !== 'cancelled' && !readOnly;
  const canPay       = invoice.status === 'finalized' && Number(invoice.balanceDue) > 0 && !readOnly;

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-bold">Invoice</h4>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-xs text-text-muted mt-1 font-mono">{invoice.id}</p>
        </div>
        <div className="flex gap-2">
          {canFinalize && (
            <button type="button" onClick={() => finalize.mutate()} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded bg-amber-500 text-white">
              <Lock size={12} /> Finalize
            </button>
          )}
          {canCancel && (
            <button type="button" onClick={() => { if (confirm('Cancel this invoice?')) cancel.mutate(); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded border border-border hover:bg-danger/10 hover:text-danger">
              <Ban size={12} /> Cancel
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Totals label="Subtotal"    value={invoice.subtotal} />
        <Totals label="Discount"    value={invoice.discountTotal} negative />
        <Totals label="Grand total" value={invoice.grandTotal} strong />
        <Totals label="Balance due" value={invoice.balanceDue} danger={Number(invoice.balanceDue) > 0} />
      </div>

      {/* Lines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-bold uppercase tracking-wider text-text-muted">Line items ({invoice.lines.length})</h5>
          {canEditLines && (
            <button type="button" onClick={() => setShowLineForm((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border border-border">
              <Plus size={12} /> {showLineForm ? 'Cancel' : 'Add line'}
            </button>
          )}
        </div>
        {showLineForm && (
          <AddLineForm invoiceId={invoice.id} onDone={() => { setShowLineForm(false); refetch(); }} />
        )}
        {invoice.lines.length === 0 ? (
          <p className="text-sm text-text-muted p-4 text-center border border-dashed border-border rounded">No line items.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
                <th className="text-left py-2">Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit</th>
                <th className="text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/50">
                  <td className="py-2">
                    {line.description}
                    {line.source !== 'manual' && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-text-muted">[{line.source}]</span>
                    )}
                  </td>
                  <td className="text-right">{Number(line.quantity)}</td>
                  <td className="text-right">{fmt(line.unitPrice)}</td>
                  <td className="text-right font-semibold">{fmt(line.lineTotal)}</td>
                  <td className="text-right">
                    {canEditLines && (
                      <button type="button" onClick={() => { if (confirm('Remove this line?')) removeLine.mutate(line.id); }} className="text-text-muted hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-bold uppercase tracking-wider text-text-muted">Payments ({invoice.payments.length})</h5>
          {canPay && (
            <button type="button" onClick={() => setShowPaymentForm((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-primary text-white">
              <BadgeIndianRupee size={12} /> {showPaymentForm ? 'Cancel' : 'Record payment'}
            </button>
          )}
        </div>
        {showPaymentForm && (
          <RecordPaymentForm invoiceId={invoice.id} balanceDue={invoice.balanceDue} onDone={() => { setShowPaymentForm(false); refetch(); }} />
        )}
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-text-muted p-4 text-center border border-dashed border-border rounded">No payments recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
                <th className="text-left py-2">Date</th>
                <th className="text-left">Method</th>
                <th className="text-left">Reference</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-2">{new Date(p.createdAt).toLocaleString('en-IN')}</td>
                  <td className="uppercase text-xs">{p.method.replace('_', ' ')}</td>
                  <td className="font-mono text-xs">{p.reference || '-'}</td>
                  <td className="text-right font-semibold">{fmt(p.amount)}</td>
                  <td className="text-right text-xs uppercase tracking-wider">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Totals({ label, value, negative, danger, strong }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`mt-1 text-base ${strong ? 'font-bold' : 'font-semibold'} ${danger ? 'text-danger' : ''}`}>
        {negative && Number(value) > 0 ? '−' : ''}{fmt(value)}
      </div>
    </div>
  );
}

function AddLineForm({ invoiceId, onDone }) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  const addLine = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/lines`, {
      description,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      source: 'manual',
    }),
    onSuccess: () => { toast.success('Line added'); onDone(); },
    onError: (e) => toast.error(e.message || 'Could not add line'),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (description && Number(unitPrice) >= 0) addLine.mutate(); }}
      className="mb-3 p-3 border border-border rounded grid grid-cols-1 sm:grid-cols-[1fr_80px_120px_auto] gap-2 items-end"
    >
      <div>
        <label htmlFor="line-desc" className="block text-xs uppercase tracking-wider text-text-muted mb-1">Description</label>
        <input id="line-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full px-2 py-1.5 border border-border rounded bg-bg-primary text-sm" />
      </div>
      <div>
        <label htmlFor="line-qty" className="block text-xs uppercase tracking-wider text-text-muted mb-1">Qty</label>
        <input id="line-qty" type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-2 py-1.5 border border-border rounded bg-bg-primary text-sm" />
      </div>
      <div>
        <label htmlFor="line-price" className="block text-xs uppercase tracking-wider text-text-muted mb-1">Unit price (₹)</label>
        <input id="line-price" type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required className="w-full px-2 py-1.5 border border-border rounded bg-bg-primary text-sm" />
      </div>
      <button type="submit" disabled={addLine.isPending} className="px-3 py-1.5 text-sm font-bold uppercase tracking-wider rounded bg-primary text-white disabled:opacity-50">
        Add
      </button>
    </form>
  );
}

function RecordPaymentForm({ invoiceId, balanceDue, onDone }) {
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(String(balanceDue ?? ''));
  const [reference, setReference] = useState('');

  const record = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/payments`, {
      method,
      amount: Number(amount),
      reference: reference || undefined,
    }),
    onSuccess: () => { toast.success('Payment recorded'); onDone(); },
    onError: (e) => toast.error(e.message || 'Could not record payment'),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (Number(amount) > 0) record.mutate(); }}
      className="mb-3 p-3 border border-border rounded grid grid-cols-1 sm:grid-cols-[120px_140px_1fr_auto] gap-2 items-end"
    >
      <div>
        <label htmlFor="pay-method" className="block text-xs uppercase tracking-wider text-text-muted mb-1">Method</label>
        <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded bg-bg-primary text-sm">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="pay-amount" className="block text-xs uppercase tracking-wider text-text-muted mb-1">Amount (₹)</label>
        <input id="pay-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full px-2 py-1.5 border border-border rounded bg-bg-primary text-sm" />
      </div>
      <div>
        <label htmlFor="pay-ref" className="block text-xs uppercase tracking-wider text-text-muted mb-1">Reference (optional)</label>
        <input id="pay-ref" type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID / UPI ref" className="w-full px-2 py-1.5 border border-border rounded bg-bg-primary text-sm" />
      </div>
      <button type="submit" disabled={record.isPending} className="px-3 py-1.5 text-sm font-bold uppercase tracking-wider rounded bg-primary text-white disabled:opacity-50">
        Record
      </button>
    </form>
  );
}
