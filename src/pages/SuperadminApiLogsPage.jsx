import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw, ChevronDown, BarChart3, SlidersHorizontal } from 'lucide-react';
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
  const [smsBalance, setSmsBalance] = useState(null);
  const [smsBalanceError, setSmsBalanceError] = useState(false);

  // Filters
  const [filters, setFilters] = useState({ page: 1, limit: 50, status: '', api_code: '' });
  const [totalPages, setTotalPages] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchSmsBalance();
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

      {/* ─── Summary Cards ───
          Mobile: collapsed by default behind a single toggle row — same
          collapse-on-mobile pattern as the Pricing page's info+stats
          section, so the metrics don't eat vertical space until asked for. */}
      {summary && (
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
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '10px 16px' : '20px 60px', display: 'flex', gap: isMobile ? 12 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
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

        {/* Mobile: API Type + Status collapse behind this toggle so the
            filter row is one line (Search + Filters button) until opened —
            same collapse-by-default pattern as the /users filter toggle. */}
        {isMobile && (
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '7px 12px', marginBottom: 2, background: 'transparent',
              border: `1px solid ${(filters.api_code || filters.status) ? 'var(--primary)' : 'var(--outline)'}`,
              color: (filters.api_code || filters.status) ? 'var(--primary)' : 'var(--on-surface)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 0,
            }}
          >
            <SlidersHorizontal size={12} />
            Filters{(filters.api_code || filters.status) ? ` (${[filters.api_code, filters.status].filter(Boolean).length})` : ''}
          </button>
        )}

        {(!isMobile || showFilters) && (
          <>
            {/* API Code */}
            <div style={{ flex: isMobile ? '1 1 45%' : 1, minWidth: isMobile ? 120 : 150 }}>
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
            <div style={{ flex: isMobile ? '1 1 45%' : 1, minWidth: isMobile ? 120 : 150 }}>
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
          </>
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
          <div style={{ padding: isMobile ? '10px 16px' : '14px 60px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
            <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: 'var(--on-surface)' }}>API Execution Logs</span>
            <span style={{ fontSize: isMobile ? 11 : 12, color: 'var(--on-muted)', fontWeight: 500 }}>Page {filters.page} of {totalPages}</span>
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
                      <span style={{
                        background: badge.bg, color: badge.color, flexShrink: 0,
                        padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                      }}>
                        {badge.label}
                      </span>
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
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Cost</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)' }}>{l.credits_used}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Customer / Trace</div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--on-surface)' }}>{l.customer_name || 'System Gen'}</div>
                        {l.error_message && <div style={{ color: 'var(--error)', fontSize: 10, marginTop: 4 }}>Error: {l.error_message}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
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
    </div>
  );
};

export default SuperadminApiLogsPage;
