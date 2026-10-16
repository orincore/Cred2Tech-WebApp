import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import TableSkeleton from '../components/ui/TableSkeleton';
import {
  Activity, Search, ChevronDown, BarChart3, SlidersHorizontal,
  FileSpreadsheet, Maximize2, Minimize2, X, Copy, AlertTriangle,
} from 'lucide-react';
import api from '../api/axiosInstance';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

import CustomSelect from '../components/CustomSelect';
// Responsive hook
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile, isTablet };
};

// A responseType:'blob' request's error body also arrives as a Blob (even
// when the server sent plain JSON) — axios doesn't parse it for you on a
// failure. Without this, every export error renders as a useless generic
// message instead of the real "N logs exceed the cap" / server error text.
async function extractBlobErrorMessage(err, fallback) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      return JSON.parse(text)?.error || text || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.error || err?.message || fallback;
}

function downloadBlobResponse(response, fallbackName) {
  const disposition = response.headers?.['content-disposition'] || '';
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Only real filter values are ever sent, so an empty/unselected field (e.g.
// status: '') means "no filter" on the server rather than literally
// matching an empty string.
function buildQueryParams(obj) {
  const params = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = value;
  });
  return params;
}

// One raw JSON block inside the detail modal, with its own copy button —
// request_payload/response_payload are each shown separately so a long
// response doesn't bury a short request (or vice versa) in one scroll area.
const RawJsonBlock = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  if (value === null || value === undefined) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <button
          onClick={handleCopy}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: copied ? 'var(--success)' : 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Copy size={11} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: 12, background: 'var(--bg)', border: '1px solid var(--outline)',
        borderRadius: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--on-surface)',
        maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: "'Fira Code', 'Courier New', monospace",
      }}>
        {text}
      </pre>
    </div>
  );
};

// Full raw record for one log — fetched on demand (not preloaded on every
// row) since request/response payloads can be several KB of vendor JSON
// each. Opened from the error-flagged rows in the table/card list below.
const LogDetailModal = ({ logId, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setError(null);
    api.get(`/admin/api-logs/${logId}/detail`)
      .then((res) => { if (!cancelled) setDetail(res.data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || 'Failed to load log detail'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [logId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--outline)' }}>
      <span style={{ color: 'var(--on-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--on-surface)', fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{value ?? '—'}</span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', width: '100%', maxWidth: 680, maxHeight: '85vh', overflowY: 'auto', padding: 20, position: 'relative' }}
      >
        <button
          onClick={onClose}
          title="Close"
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-muted)' }}
        >
          <X size={18} />
        </button>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="var(--error)" /> Log #{logId} — Raw Debug Detail
        </h3>

        {loading && <div style={{ fontSize: 13, color: 'var(--on-muted)', padding: '20px 0', textAlign: 'center' }}>Loading…</div>}
        {error && <div style={{ fontSize: 13, color: 'var(--error)', padding: '20px 0', textAlign: 'center' }}>{error}</div>}

        {detail && (
          <>
            {row('Timestamp', formatDateTime(detail.timestamp))}
            {row('Vendor', detail.vendor)}
            {row('API Code', detail.api_code)}
            {row('Status', detail.status)}
            {row('Response', detail.response_status)}
            {row('Credits Used', detail.credits_used)}
            {row('Sourcing Partner', detail.tenant_name)}
            {row('Triggered By', detail.triggered_by_user)}
            {row('Customer Email', detail.customer_email)}
            {row('Case ID', detail.case_reference)}
            {row('Idempotency Key', detail.idempotency_key)}

            {detail.error_message && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Error Message</div>
                <pre style={{
                  margin: 0, padding: 12, background: 'var(--error-bg)', border: '1px solid var(--error)',
                  borderRadius: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--error)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'Fira Code', 'Courier New', monospace",
                }}>
                  {detail.error_message}
                </pre>
              </div>
            )}

            <RawJsonBlock label="Request Payload" value={detail.request_payload} />
            <RawJsonBlock label="Response Payload" value={detail.response_payload} />
          </>
        )}
      </div>
    </div>
  );
};

const SuperadminApiLogsPage = () => {
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [smsBalance, setSmsBalance] = useState(null);
  const [smsBalanceError, setSmsBalanceError] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [detailLogId, setDetailLogId] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    page: 1, limit: 50, status: '', api_code: '', vendor: '',
    date_from: '', date_to: '', search: '', sort_by: 'timestamp', sort_dir: 'desc',
  });
  const [totalPages, setTotalPages] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchSmsBalance();
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  // Debounced free-text search — merged into `filters` (not sent directly)
  // so it goes through the same server-side query as every other filter,
  // instead of the input simply doing nothing (its previous behavior: it
  // was never wired into the fetch at all).
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === search ? f : { ...f, search, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/admin/api-logs/summary`);
      setSummary(res.data);
    } catch (e) {
      console.error("Summary load fail");
    }
  };

  // Live remaining SMS credit from alots.io — separate call/state from the
  // usage-log summary above (different source, and shouldn't block or be
  // blocked by it if one of the two fails).
  const fetchSmsBalance = async () => {
    try {
      const res = await api.get(`/admin/api-logs/sms-balance`);
      setSmsBalance(res.data.walletBalance);
      setSmsBalanceError(false);
    } catch (e) {
      console.error("SMS balance load fail");
      setSmsBalanceError(true);
    }
  };

  // Distinct vendors actually present in the log table, for the Vendor
  // filter's options — read from the data so it never drifts from whichever
  // vendors are really wired up (admin-configurable, see Bureau API Settings).
  const fetchVendors = async () => {
    try {
      const res = await api.get(`/admin/api-logs/vendors`);
      setVendors(res.data.vendors || []);
    } catch (e) {
      console.error("Vendor list load fail");
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams(buildQueryParams(filters));
      const res = await api.get(`/admin/api-logs?${q.toString()}`);
      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = useCallback((column) => {
    setFilters((f) => {
      if (f.sort_by === column) {
        return { ...f, sort_dir: f.sort_dir === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...f, sort_by: column, sort_dir: column === 'timestamp' ? 'desc' : 'asc', page: 1 };
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { page, limit, ...exportFilters } = filters;
      const q = new URLSearchParams(buildQueryParams(exportFilters));
      const res = await api.get(`/admin/api-logs/export.xlsx?${q.toString()}`, { responseType: 'blob' });
      downloadBlobResponse(res, `Cred2Tech_API_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel export downloaded');
    } catch (err) {
      const msg = await extractBlobErrorMessage(err, 'Failed to export logs');
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  /* ---- label style shared across filters ---- */
  const labelSm = { fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
  const underlineInput = (active) => ({
    background: 'transparent', border: 'none',
    borderBottom: `2px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
    outline: 'none', width: '100%', padding: '6px 0',
    fontSize: 13, fontWeight: 600, color: 'var(--on-surface)',
    transition: 'border-color 0.2s',
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS': return {
        bg: isDark ? '#064e3b' : '#dcfce7',
        color: isDark ? '#6ee7b7' : '#15803d',
        label: 'SUCCESS'
      };
      case 'FAILED': return {
        bg: isDark ? '#7f1d1d' : '#fee2e2',
        color: isDark ? '#fca5a5' : '#dc2626',
        label: 'FAILED'
      };
      case 'REFUNDED': return {
        bg: isDark ? '#2d2159' : '#ede9fe',
        color: isDark ? '#c7d2fe' : '#4f46e5',
        label: 'REFUNDED'
      };
      case 'BLOCKED_INSUFFICIENT_CREDITS': return {
        bg: isDark ? '#78350f' : '#fef3c7',
        color: isDark ? '#fcd34d' : '#d97706',
        label: 'BLOCKED (CREDITS)'
      };
      case 'BLOCKED_INACTIVE_API': return {
        bg: isDark ? '#78350f' : '#fef3c7',
        color: isDark ? '#fcd34d' : '#d97706',
        label: 'BLOCKED (INACTIVE)'
      };
      default: return {
        bg: isDark ? '#374151' : '#f3f4f6',
        color: isDark ? '#d1d5db' : '#6b7280',
        label: status || 'UNKNOWN'
      };
    }
  };

  // Response (HTTP-shaped) badge — distinct palette from the Status badge
  // above so "SUCCESS / 200" vs "FAILED / 500" each read as their own signal
  // rather than two copies of the same color.
  const getResponseBadge = (responseStatus) => {
    if (!responseStatus) return { bg: isDark ? '#374151' : '#f3f4f6', color: isDark ? '#9ca3af' : '#9ca3af', label: '—' };
    const code = parseInt(responseStatus, 10);
    if (!isNaN(code) && code < 400) return { bg: isDark ? '#064e3b' : '#dcfce7', color: isDark ? '#6ee7b7' : '#15803d', label: String(responseStatus) };
    return { bg: isDark ? '#7f1d1d' : '#fee2e2', color: isDark ? '#fca5a5' : '#dc2626', label: String(responseStatus) };
  };

  const hasError = (l) => !!l.error_message || l.status === 'FAILED' || l.status === 'REFUNDED' || String(l.status || '').startsWith('BLOCKED');

  const hasActiveFilters = search || filters.api_code || filters.status || filters.vendor || filters.date_from || filters.date_to;

  const clearAllFilters = () => {
    setSearch('');
    setFilters((f) => ({ ...f, api_code: '', status: '', vendor: '', date_from: '', date_to: '', search: '', page: 1 }));
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      {/* ─── Top header ───
          Hidden in fullscreen mode along with the summary cards below —
          the toggle itself moves into the sub-header row so it's still
          reachable to exit. */}
      {!fullScreen && (
        <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '64px 14px 8px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 16 : 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              API Observability & Audits
            </h1>
            <p style={{ margin: isMobile ? '1px 0 0' : '4px 0 0', fontSize: isMobile ? 10 : 13, color: 'var(--on-muted)' }}>
              Monitor API Usage and System Performance
            </p>
          </div>
        </div>
      )}

      {/* ─── Summary Cards ───
          Mobile: collapsed by default behind a single toggle row — same
          collapse-on-mobile pattern as the Pricing page's info+stats
          section, so the metrics don't eat vertical space until asked for.
          Hidden entirely in fullscreen mode. */}
      {summary && !fullScreen && (
        isMobile ? (
          <div style={{ borderBottom: '2px solid var(--outline)', background: 'var(--surface)', flexShrink: 0 }}>
            <button
              onClick={() => setShowSummary(v => !v)}
              style={{
                width: '100%', padding: '8px 14px', background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <BarChart3 size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: 'var(--on-surface)', fontWeight: 700 }}>Summary Metrics</span>
              <ChevronDown
                size={13}
                color="var(--on-muted)"
                style={{ flexShrink: 0, transition: 'transform 0.15s', transform: showSummary ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {showSummary && (
              <div style={{ padding: '0 12px 10px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 0, border: '1px solid var(--outline)' }}>
                  <h4 style={{ color: 'var(--on-muted)', fontSize: 9, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Total API Pings</h4>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.total_api_calls.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 0, border: '1px solid var(--outline)' }}>
                  <h4 style={{ color: 'var(--on-muted)', fontSize: 9, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Credits Consumed</h4>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#4f46e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.total_credits_consumed.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 0, border: '1px solid var(--outline)' }}>
                  <h4 style={{ color: 'var(--on-muted)', fontSize: 9, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Credits Refunded</h4>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#9333ea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.total_refunds.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 0, border: '1px solid var(--outline)' }}>
                  <h4 style={{ color: 'var(--on-muted)', fontSize: 9, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Failed Executions</h4>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.total_failed_calls.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 0, border: '1px solid var(--outline)' }}>
                  <h4 style={{ color: 'var(--on-muted)', fontSize: 9, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>SMS Credits (alots.io)</h4>
                  <div style={{ fontSize: 15, fontWeight: 800, color: smsBalanceError ? 'var(--on-muted)' : '#0891b2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {smsBalanceError ? '—' : smsBalance == null ? '…' : `₹${smsBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px 60px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 0, border: '1px solid var(--outline)' }}>
              <h4 style={{ color: 'var(--on-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Total API Pings</h4>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-surface)' }}>{summary.total_api_calls.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 0, border: '1px solid var(--outline)' }}>
              <h4 style={{ color: 'var(--on-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Credits Consumed</h4>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4f46e5' }}>{summary.total_credits_consumed.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 0, border: '1px solid var(--outline)' }}>
              <h4 style={{ color: 'var(--on-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Credits Refunded</h4>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#9333ea' }}>{summary.total_refunds.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 0, border: '1px solid var(--outline)' }}>
              <h4 style={{ color: 'var(--on-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>Failed Executions</h4>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{summary.total_failed_calls.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 0, border: '1px solid var(--outline)' }}>
              <h4 style={{ color: 'var(--on-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>SMS Credits (alots.io)</h4>
              <div style={{ fontSize: 24, fontWeight: 800, color: smsBalanceError ? 'var(--on-muted)' : '#0891b2' }}>
                {smsBalanceError ? 'Unavailable' : smsBalance == null ? '…' : `₹${smsBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </div>
        )
      )}

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '10px 16px' : '20px 60px', display: 'flex', gap: isMobile ? 12 : 24, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ flex: isMobile ? 1 : 2, minWidth: isMobile ? 140 : 180, maxWidth: isMobile ? 200 : 280 }}>
          <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={isMobile ? 12 : 13} style={{ position: 'absolute', left: 0, bottom: 9, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Sourcing Partner, customer email, API, vendor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...underlineInput(!!search), paddingLeft: 20, fontSize: isMobile ? 13 : 13 }}
            />
          </div>
        </div>

        {/* Mobile: the rest of the filters collapse behind this toggle so
            the filter row is one line (Search + Filters button) until
            opened — same collapse-by-default pattern as the /users filter
            toggle. */}
        {isMobile && (
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '7px 12px', marginBottom: 2, background: 'transparent',
              border: `1px solid ${hasActiveFilters ? 'var(--primary)' : 'var(--outline)'}`,
              color: hasActiveFilters ? 'var(--primary)' : 'var(--on-surface)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 0,
            }}
          >
            <SlidersHorizontal size={12} />
            Filters
          </button>
        )}

        {(!isMobile || showFilters) && (
          <>
            {/* API Code */}
            <div style={{ flex: isMobile ? '1 1 45%' : 1, minWidth: isMobile ? 120 : 130 }}>
              <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>API Type</span>
              <CustomSelect
                value={filters.api_code}
                onChange={e => setFilters({ ...filters, api_code: e.target.value, page: 1 })}
                style={{ ...underlineInput(!!filters.api_code), appearance: 'none', cursor: 'pointer', borderBottomColor: filters.api_code ? '#4f46e5' : 'var(--outline)', color: filters.api_code ? '#4f46e5' : 'var(--on-surface)', fontSize: isMobile ? 13 : 13 }}
              >
                <option value="">All APIs</option>
                <option value="BANK_ANALYSIS">Bank Analysis</option>
                <option value="GST_FETCH">GST Fetch</option>
                <option value="ITR_ANALYTICS">ITR Analytics</option>
                <option value="BUREAU_PULL">Bureau Pull</option>
                <option value="PAN_FETCH">PAN Verify</option>
                <option value="SALARY_OCR">Salary Slip OCR</option>
                <option value="ESR_GENERATION_SALARIED">ESR Generation — Salaried</option>
                <option value="ESR_GENERATION_MSME">ESR Generation — MSME</option>
                <option value="PROFILE_ADVANCE">Profile Advance</option>
                <option value="SMS">SMS (alots.io)</option>
              </CustomSelect>
            </div>

            {/* Vendor */}
            <div style={{ flex: isMobile ? '1 1 45%' : 1, minWidth: isMobile ? 120 : 130 }}>
              <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>Vendor</span>
              <CustomSelect
                value={filters.vendor}
                onChange={e => setFilters({ ...filters, vendor: e.target.value, page: 1 })}
                style={{ ...underlineInput(!!filters.vendor), appearance: 'none', cursor: 'pointer', borderBottomColor: filters.vendor ? '#4f46e5' : 'var(--outline)', color: filters.vendor ? '#4f46e5' : 'var(--on-surface)', fontSize: isMobile ? 13 : 13 }}
              >
                <option value="">All Vendors</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </CustomSelect>
            </div>

            {/* Status */}
            <div style={{ flex: isMobile ? '1 1 45%' : 1, minWidth: isMobile ? 120 : 130 }}>
              <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>Status</span>
              <CustomSelect
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}
                style={{ ...underlineInput(!!filters.status), appearance: 'none', cursor: 'pointer', borderBottomColor: filters.status ? '#4f46e5' : 'var(--outline)', color: filters.status ? '#4f46e5' : 'var(--on-surface)', fontSize: isMobile ? 13 : 13 }}
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed Only</option>
                <option value="REFUNDED">Refunded Only</option>
                <option value="BLOCKED_INSUFFICIENT_CREDITS">Blocked (Missing Funds)</option>
                <option value="BLOCKED_INACTIVE_API">Blocked (Inactive API)</option>
              </CustomSelect>
            </div>

            {/* Date range */}
            <div style={{ flex: isMobile ? '1 1 45%' : 1, minWidth: isMobile ? 120 : 130 }}>
              <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>From</span>
              <input
                type="date"
                value={filters.date_from}
                onChange={e => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
                style={{ ...underlineInput(!!filters.date_from), fontSize: isMobile ? 13 : 13 }}
              />
            </div>
            <div style={{ flex: isMobile ? '1 1 45%' : 1, minWidth: isMobile ? 120 : 130 }}>
              <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>To</span>
              <input
                type="date"
                value={filters.date_to}
                onChange={e => setFilters({ ...filters, date_to: e.target.value, page: 1 })}
                style={{ ...underlineInput(!!filters.date_to), fontSize: isMobile ? 13 : 13 }}
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: isMobile ? 11 : 12, fontWeight: 700, cursor: 'pointer', paddingBottom: 8, borderBottom: '2px solid transparent' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--on-muted)'}
              >
                Clear all
              </button>
            )}
          </>
        )}
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ flex: 1, background: 'var(--bg)', overflow: 'hidden' }} role="status" aria-label="Loading logs">
          <TableSkeleton rows={10} columns={6} />
        </div>
      ) : logs.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <Activity size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No logs found</h3>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: '0 0 24px' }}>Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <>
          {/* Sub-header — also where the fullscreen toggle and Excel export live */}
          <div style={{ padding: isMobile ? '10px 16px' : '14px 60px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'var(--bg)', flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: 'var(--on-surface)' }}>API Execution Logs</span>
              <span style={{ fontSize: isMobile ? 11 : 12, color: 'var(--on-muted)', fontWeight: 500 }}>Page {filters.page} of {totalPages}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleExport}
                disabled={exporting}
                title="Export the currently filtered logs to Excel"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0,
                  fontSize: 11, fontWeight: 700, color: 'var(--on-surface)',
                  cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1,
                }}
              >
                <FileSpreadsheet size={13} /> {exporting ? 'Exporting…' : 'Export Excel'}
              </button>
              <button
                onClick={() => setFullScreen(v => !v)}
                title={fullScreen ? 'Exit full screen' : 'Full screen — logs only'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  background: fullScreen ? 'var(--primary)' : 'transparent',
                  color: fullScreen ? '#fff' : 'var(--on-surface)',
                  border: '1px solid var(--outline)', borderRadius: 0,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {fullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                {fullScreen ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
          </div>

          {/* Mobile: card list instead of a table — same reasoning as the
              other admin list pages. A table forced into a small viewport
              either truncates every column or becomes horizontally
              scrollable; a card puts every field for one log entry in a
              single vertical read. */}
          {isMobile ? (
            <div style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
              {logs.map((l, idx) => {
                const badge = getStatusBadge(l.status);
                const respBadge = getResponseBadge(l.response_status);
                return (
                  <div
                    key={l.id || idx}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 10 }}
                  >
                    {/* Identity row: timestamp + DSA on the left, status badge anchored right */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)' }}>{formatDateTime(l.timestamp)}</div>
                        <div style={{ fontSize: 10, color: 'var(--on-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.tenant_name || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <span style={{ background: respBadge.bg, color: respBadge.color, padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {respBadge.label}
                        </span>
                        <span style={{ background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    {/* Fields grid */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                      marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--outline)',
                    }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>API Triggered</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--on-surface)' }}>{l.api_code}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Vendor</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-surface)' }}>{l.vendor || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Cost</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)' }}>{l.credits_used}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                          {l.source === 'SMS' ? 'Mobile' : 'Customer Email'}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--on-surface)', wordBreak: 'break-all' }}>
                          {l.source === 'SMS' ? (l.mobile || '—') : (l.customer_email || 'System Gen')}
                        </div>
                        {hasError(l) && (
                          l.source !== 'API' ? (
                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'flex-start', gap: 4, color: 'var(--error)', fontSize: 11, fontWeight: 600 }}>
                              <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {l.error_message || 'Failed'}
                            </div>
                          ) : (
                            <button
                              onClick={() => setDetailLogId(l.id)}
                              style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--error)', fontSize: 11, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <AlertTriangle size={11} /> View raw error
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <DataTable
            columns={[
              { key: 'timestamp', label: 'Timestamp', width: '12%', sortable: true, render: (l) => formatDateTime(l.timestamp) },
              { key: 'tenant_name', label: 'SP', width: '12%', render: (l) => l.tenant_name || '—' },
              { key: 'vendor', label: 'Vendor', width: '9%', sortable: true, render: (l) => l.vendor || '—' },
              { key: 'api_code', label: 'API Triggered', width: '12%', sortable: true, render: (l) => (
                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{l.api_code}</span>
              )},
              { key: 'response_status', label: 'Response', width: '8%', render: (l) => {
                const badge = getResponseBadge(l.response_status);
                return (
                  <span style={{ background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {badge.label}
                  </span>
                );
              }},
              { key: 'credits_used', label: 'Cost', width: '7%', sortable: true, render: (l) => l.credits_used },
              { key: 'status', label: 'Status', width: '10%', sortable: true, render: (l) => {
                const badge = getStatusBadge(l.status);
                return (
                  <span style={{
                    background: badge.bg, color: badge.color,
                    padding: '3px 8px', borderRadius: 0,
                    fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                  }}>
                    {badge.label}
                  </span>
                );
              }},
              { key: 'customer_email', label: 'Customer / Mobile', width: '20%', render: (l) => (
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {l.source === 'SMS' ? (l.mobile || '—') : (l.customer_email || 'System Gen')}
                  </span>
                  {hasError(l) && (
                    l.source !== 'API' ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                        <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {l.error_message || 'Failed'}
                      </div>
                    ) : (
                      <button
                        onClick={() => setDetailLogId(l.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 11, fontWeight: 700, marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title="View the full raw request/response for this failed call"
                      >
                        <AlertTriangle size={11} /> View raw error
                      </button>
                    )
                  )}
                </div>
              )},
            ]}
            data={logs}
            isMobile={isMobile}
            hoverRows={true}
            sortBy={filters.sort_by}
            sortDir={filters.sort_dir}
            onSort={handleSort}
          />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: isMobile ? '10px 16px' : '16px 60px', display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', borderTop: '1px solid var(--outline)', background: 'var(--bg)', flexShrink: 0 }}>
              <button
                disabled={filters.page === 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                style={{
                  padding: '8px 16px', background: filters.page === 1 ? 'var(--surface)' : 'var(--primary)',
                  color: filters.page === 1 ? 'var(--on-muted)' : '#fff',
                  border: '1px solid var(--outline)', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: filters.page === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
                {filters.page} of {totalPages}
              </span>
              <button
                disabled={filters.page === totalPages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                style={{
                  padding: '8px 16px', background: filters.page === totalPages ? 'var(--surface)' : 'var(--primary)',
                  color: filters.page === totalPages ? 'var(--on-muted)' : '#fff',
                  border: '1px solid var(--outline)', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: filters.page === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {detailLogId && <LogDetailModal logId={detailLogId} onClose={() => setDetailLogId(null)} />}
    </div>
  );
};

export default SuperadminApiLogsPage;
