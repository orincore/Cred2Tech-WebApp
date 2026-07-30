import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw } from 'lucide-react';
import api from '../api/axiosInstance';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

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

const SuperadminApiLogsPage = () => {
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters
  const [filters, setFilters] = useState({ page: 1, limit: 50, status: '', api_code: '' });
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/admin/api-logs/summary`);
      setSummary(res.data);
    } catch (e) {
      console.error("Summary load fail");
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams(filters);
      const res = await api.get(`/admin/api-logs?${q.toString()}`);
      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
        label: 'BLOCKED'
      };
      default: return {
        bg: isDark ? '#374151' : '#f3f4f6',
        color: isDark ? '#d1d5db' : '#6b7280',
        label: status || 'UNKNOWN'
      };
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      {/* ─── Top header ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Admin › API Observability
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            API Observability & Audits
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
            Monitor API Usage and System Performance
          </p>
        </div>
      </div>

      {/* ─── Summary Cards ─── */}
      {summary && (
        <div style={{ padding: isMobile ? '12px' : '20px 60px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 12 : 16, background: 'var(--bg)', flexShrink: 0 }}>
          <div style={{ background: 'var(--surface)', padding: isMobile ? 12 : 16, borderRadius: 12, border: '1px solid var(--outline)' }}>
            <h4 style={{ color: 'var(--text-tertiary)', fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px' }}>Total API Pings</h4>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--on-surface)' }}>{summary.total_api_calls.toLocaleString()}</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: isMobile ? 12 : 16, borderRadius: 12, border: '1px solid var(--outline)' }}>
            <h4 style={{ color: 'var(--text-tertiary)', fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px' }}>Credits Consumed</h4>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#4f46e5' }}>{summary.total_credits_consumed.toLocaleString()}</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: isMobile ? 12 : 16, borderRadius: 12, border: '1px solid var(--outline)' }}>
            <h4 style={{ color: 'var(--text-tertiary)', fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px' }}>Credits Refunded</h4>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#9333ea' }}>{summary.total_refunds.toLocaleString()}</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: isMobile ? 12 : 16, borderRadius: 12, border: '1px solid var(--outline)' }}>
            <h4 style={{ color: 'var(--text-tertiary)', fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px' }}>Failed Executions</h4>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#dc2626' }}>{summary.total_failed_calls.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '12px' : '20px 60px', display: 'flex', gap: isMobile ? 12 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ flex: isMobile ? 1 : 2, minWidth: isMobile ? 140 : 200, maxWidth: isMobile ? 200 : 360 }}>
          <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={isMobile ? 12 : 13} style={{ position: 'absolute', left: 0, bottom: 9, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="DSA name, API code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20, fontSize: isMobile ? 13 : 13 }}
              onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
              onBlur={e => e.target.style.borderBottomColor = '#e2e8f0'}
            />
          </div>
        </div>

        {/* API Code */}
        <div style={{ flex: isMobile ? 1 : 1, minWidth: isMobile ? 120 : 150 }}>
          <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>API Type</span>
          <select
            value={filters.api_code}
            onChange={e => setFilters({ ...filters, api_code: e.target.value, page: 1 })}
            style={{ ...underlineInput(!!filters.api_code), appearance: 'none', cursor: 'pointer', borderBottomColor: filters.api_code ? '#4f46e5' : 'var(--outline)', color: filters.api_code ? '#4f46e5' : 'var(--on-surface)', fontSize: isMobile ? 13 : 13 }}
          >
            <option value="">All APIs</option>
            <option value="BANK_ANALYSIS">Bank Analysis</option>
            <option value="GST_FETCH">GST Fetch</option>
            <option value="ITR_FETCH">ITR Fetch</option>
            <option value="BUREAU_PULL">Bureau Pull</option>
            <option value="PAN_FETCH">PAN Verify</option>
          </select>
        </div>

        {/* Status */}
        <div style={{ flex: isMobile ? 1 : 1, minWidth: isMobile ? 120 : 150 }}>
          <span style={{ ...labelSm, fontSize: isMobile ? 10 : 11 }}>Status</span>
          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}
            style={{ ...underlineInput(!!filters.status), appearance: 'none', cursor: 'pointer', borderBottomColor: filters.status ? '#4f46e5' : 'var(--outline)', color: filters.status ? '#4f46e5' : 'var(--on-surface)', fontSize: isMobile ? 13 : 13 }}
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="REFUNDED">Refunded Only</option>
            <option value="BLOCKED_INSUFFICIENT_CREDITS">Blocked (Missing Funds)</option>
          </select>
        </div>

        {(search || filters.api_code || filters.status) && (
          <button
            onClick={() => { setSearch(''); setFilters({ ...filters, api_code: '', status: '', page: 1 }); }}
            style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: isMobile ? 11 : 12, fontWeight: 700, cursor: 'pointer', paddingBottom: 8, borderBottom: '2px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--on-muted)'}
          >
            Clear all
          </button>
        )}
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <RefreshCw size={24} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: 'var(--on-muted)', fontWeight: 500 }}>Loading logs...</span>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <Activity size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No logs found</h3>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: '0 0 24px' }}>Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <>
          {/* Sub-header */}
          <div style={{ padding: isMobile ? '14px 16px' : '14px 60px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>API Execution Logs</span>
            <span style={{ fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>Page {filters.page} of {totalPages}</span>
          </div>

          {/* Table */}
          <DataTable
            columns={[
              { key: 'timestamp', label: 'Timestamp', render: (l) => formatDateTime(l.timestamp) },
              { key: 'tenant_name', label: 'DSA', render: (l) => l.tenant_name || '—' },
              { key: 'api_code', label: 'API Triggered', render: (l) => (
                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{l.api_code}</span>
              )},
              { key: 'credits_used', label: 'Cost', render: (l) => l.credits_used },
              { key: 'status', label: 'Status', render: (l) => {
                const badge = getStatusBadge(l.status);
                return (
                  <span style={{
                    background: badge.bg, color: badge.color,
                    padding: '3px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                  }}>
                    {badge.label}
                  </span>
                );
              }},
              { key: 'customer', label: 'Customer / Trace', render: (l) => (
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{l.customer_name || 'System Gen'}</span>
                  {l.error_message && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Error: {l.error_message}</div>}
                </div>
              )},
            ]}
            data={logs}
            isMobile={isMobile}
            hoverRows={true}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: isMobile ? '16px' : '16px 60px', display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', borderTop: '1px solid var(--outline)', background: 'var(--bg)', flexShrink: 0 }}>
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
    </div>
  );
};

export default SuperadminApiLogsPage;
