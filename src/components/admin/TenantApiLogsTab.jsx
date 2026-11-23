import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, ScrollText, Search } from 'lucide-react';
import api from '../../api/axiosInstance';
import LoadingSpinner from '../ui/LoadingSpinner';
import { formatDateTime } from '../../utils/helpers';

// Every API call made for ONE sourcing partner: vendor calls, the fallback used when one failed, SMS, and the steps
// of the bureau-linked-number consent flow, each with the case it belongs to. Same data as /admin/logs, narrowed to
// this partner (GET /admin/api-logs/:tenantId), so a partner's problem can be traced without leaving their page.

const PAGE_SIZE = 25;

const TRIGGER_TAGS = {
  FALLBACK: { label: 'Fallback used', color: '#b45309' },
  BUREAU_CONSENT: { label: 'Bureau consent', color: '#4338ca' },
  BUREAU_NUMBER_CHECK: { label: 'Bureau number check', color: '#0f766e' },
};

const STATUS_STYLE = {
  SUCCESS: { bg: 'rgba(22,163,74,0.14)', color: '#15803d' },
  FAILED: { bg: 'rgba(220,38,38,0.14)', color: '#dc2626' },
  REFUNDED: { bg: 'rgba(2,132,199,0.14)', color: '#0369a1' },
};
const statusStyle = (s) => STATUS_STYLE[s] || { bg: 'var(--bg-elevated)', color: 'var(--on-muted)' };

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'SUCCESS', label: 'Successful' },
];

const th = { textAlign: 'left', padding: '9px 10px', fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--outline)', whiteSpace: 'nowrap' };
const td = { padding: '9px 10px', fontSize: 12, borderBottom: '1px solid var(--outline)', verticalAlign: 'top' };

const TenantApiLogsTab = ({ tenantId }) => {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [caseId, setCaseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (status) params.status = status;
      if (caseId) params.case_id = caseId;
      const res = await api.get(`/admin/api-logs/${tenantId}`, { params });
      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load the logs.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, status, caseId]);

  useEffect(() => { load(); }, [load]);

  // A new filter always starts from the first page.
  const changeStatus = (s) => { setStatus(s); setPage(1); };
  const changeCase = (v) => { setCaseId(v.replace(/\D/g, '').slice(0, 9)); setPage(1); };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--outline)', flexWrap: 'wrap' }}>
        <ScrollText size={16} color="var(--primary)" />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>API logs</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>
            Every vendor call, fallback and bureau-consent step for this sourcing partner{total ? ` · ${total.toLocaleString('en-IN')} entries` : ''}.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              className={status === f.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => changeStatus(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--on-muted)' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 26, width: 150, height: 32, fontFamily: 'monospace', fontSize: 12 }}
            inputMode="numeric"
            placeholder="Case ID"
            value={caseId}
            onChange={(e) => changeCase(e.target.value)}
            aria-label="Filter by case ID"
          />
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load} aria-label="Refresh" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={24} /></div>
      ) : error ? (
        <div style={{ padding: 24, color: 'var(--error)', fontSize: 13 }}>{error}</div>
      ) : logs.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>
          {status || caseId ? 'No logs match these filters.' : 'No API calls have been logged for this sourcing partner yet.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Case ID</th>
                <th style={th}>Vendor</th>
                <th style={th}>API</th>
                <th style={th}>Status</th>
                <th style={{ ...th, minWidth: 260 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const tag = TRIGGER_TAGS[l.trigger_source];
                const st = statusStyle(l.status);
                const failed = l.status === 'FAILED' || l.status === 'REFUNDED' || String(l.status || '').startsWith('BLOCKED');
                return (
                  <tr key={`${l.source}-${l.id}`}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDateTime(l.timestamp)}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{l.case_reference || '—'}</td>
                    <td style={td}>{l.vendor || '—'}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, fontWeight: 600, wordBreak: 'break-word' }}>{l.api_code}</td>
                    <td style={td}>
                      <span style={{ background: st.bg, color: st.color, padding: '3px 8px', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{l.status}</span>
                    </td>
                    <td style={{ ...td, wordBreak: 'break-word' }}>
                      {tag && <span style={{ color: tag.color, fontWeight: 800, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em' }}>{tag.label}</span>}
                      {l.note && <div style={{ color: 'var(--on-muted)', fontSize: 11, marginTop: tag ? 2 : 0 }}>{l.note}</div>}
                      {failed && (l.error_message || l.status === 'FAILED') && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, color: 'var(--error)', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                          <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {l.error_message || 'Failed'}
                        </div>
                      )}
                      {!tag && !l.note && !failed && <span style={{ color: 'var(--on-muted)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--outline)' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /> Prev</button>
          <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
};

export default TenantApiLogsTab;
