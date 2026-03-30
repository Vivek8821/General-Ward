import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE, getCsrfHeaders } from '../utils/api';
import toast from 'react-hot-toast';
import { Download, Trash2, Search, ClipboardList } from 'lucide-react';

export default function AdminAudit() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [successFilter, setSuccessFilter] = useState('');
  const [olderThanDays, setOlderThanDays] = useState('365');
  const [purgeBusy, setPurgeBusy] = useState(false);

  const loadPage = useCallback(
    async (cursor = null, append = false) => {
      try {
        setLoading(true);
        setLoadError(false);
        const params = new URLSearchParams({ limit: '50' });
        if (successFilter === '0' || successFilter === '1') params.set('success', successFilter);
        if (cursor) params.set('cursor', cursor);
        const q = params.toString();
        const data = await api.get(`/admin/audit-logs?${q}`);
        if (!data) return;
        setItems((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []));
        setNextCursor(data.nextCursor || null);
      } catch (e) {
        setLoadError(true);
        toast.error(e.message || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    },
    [successFilter]
  );

  useEffect(() => {
    loadPage(null, false);
  }, [loadPage]);

  const downloadCsv = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (successFilter === '0' || successFilter === '1') params.set('success', successFilter);
      const res = await fetch(`${API_BASE}/admin/audit-logs/export.csv?${params}`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        toast.error('Not authorized');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-logs.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    }
  };

  const runPurge = async (dryRun) => {
    const days = Number(olderThanDays);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error('Enter a positive number of days');
      return;
    }
    if (!dryRun) {
      const ok = window.confirm(
        `Permanently delete audit log rows older than ${days} day(s) for this tenant? This cannot be undone.`
      );
      if (!ok) return;
    }
    try {
      setPurgeBusy(true);
      const res = await fetch(`${API_BASE}/admin/audit/purge`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({ dryRun, olderThanDays: days }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || 'Purge request failed');
        return;
      }
      if (dryRun) {
        toast.success(`Dry run: ${body.wouldDelete ?? 0} row(s) would be deleted`);
      } else {
        toast.success(`Deleted ${body.deleted ?? 0} row(s)`);
        loadPage(null, false);
      }
    } catch (e) {
      toast.error(e.message || 'Purge failed');
    } finally {
      setPurgeBusy(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-danger font-semibold">
        Access denied. Administrator role required.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-slate-500" />
            Audit log
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Tenant-scoped API access history (authenticated requests only).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadCsv} className="btn btn-secondary text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Success</label>
            <select
              className="input-field !py-2"
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="1">Success (2xx–3xx)</option>
              <option value="0">Failed (4xx+)</option>
            </select>
          </div>
          <button type="button" onClick={() => loadPage(null, false)} className="btn btn-primary text-sm">
            <Search className="w-4 h-4" /> Apply
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4 border border-red-500/20">
        <h2 className="text-lg font-semibold text-red-400">Retention</h2>
        <p className="text-sm text-text-muted">
          Delete audit rows older than the given number of days for <strong>this tenant only</strong>. Use dry run
          first. You can also set <code className="text-xs bg-bg-tertiary px-1 rounded">AUDIT_RETENTION_DAYS</code> on
          the server and omit the field in API calls (see docs).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Older than (days)
            </label>
            <input
              type="number"
              min={1}
              className="input-field !py-2 w-32"
              value={olderThanDays}
              onChange={(e) => setOlderThanDays(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={purgeBusy}
            onClick={() => runPurge(true)}
            className="btn btn-secondary text-sm"
          >
            Dry run
          </button>
          <button
            type="button"
            disabled={purgeBusy}
            onClick={() => runPurge(false)}
            className="btn bg-red-800 text-white hover:bg-red-900 border border-red-900 text-sm"
          >
            <Trash2 className="w-4 h-4" /> Purge
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-bg-tertiary px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Recent entries</h2>
        </div>
        {loading && items.length === 0 ? (
          <div className="p-10 text-center text-text-muted">Loading…</div>
        ) : loadError && items.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-danger font-semibold">Failed to load audit logs.</p>
            <button
              type="button"
              onClick={() => loadPage(null, false)}
              className="btn btn-secondary text-sm"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-text-muted">No audit rows for this tenant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-3 font-medium">Time</th>
                  <th className="p-3 font-medium">User</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium">Action</th>
                  <th className="p-3 font-medium">Resource</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">OK</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 hover:bg-bg-tertiary/50">
                    <td className="p-3 whitespace-nowrap font-mono text-xs">{row.timestamp}</td>
                    <td className="p-3">{row.userId}</td>
                    <td className="p-3">{row.userRole}</td>
                    <td className="p-3">{row.action}</td>
                    <td className="p-3 max-w-[240px] truncate" title={row.resource}>
                      {row.resource}
                    </td>
                    <td className="p-3">{row.statusCode}</td>
                    <td className="p-3">{row.success ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor && (
          <div className="p-4 border-t border-border flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => loadPage(nextCursor, true)}
              className="btn btn-secondary text-sm"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
