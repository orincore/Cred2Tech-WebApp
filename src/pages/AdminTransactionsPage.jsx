import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Receipt, IndianRupee, CheckCircle2, Clock, XCircle, AlertTriangle,
  Search, SlidersHorizontal, FileSpreadsheet, FileText, RefreshCw,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { adminTransactionsService } from '../api/adminTransactionsService';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const PAGE_SIZE = 25;

const TYPE_OPTIONS = [
  { value: 'CASE_PAYMENT', label: 'MSME Eligibility Fee' },
  { value: 'WALLET_TOPUP', label: 'DSA Wallet Top-up' },
  { value: 'TENANT_SUBSCRIPTION', label: 'Virtual Workspace Subscription' },
];
const STATUS_OPTIONS = [
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REVIEW', label: 'Needs Review' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_STYLE = {
  SUCCESS: { color: 'var(--success)', bg: 'var(--success-bg)' },
  PENDING: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  FAILED: { color: 'var(--error)', bg: 'var(--error-bg)' },
  REVIEW: { color: 'var(--info)', bg: 'var(--info-bg)' },
  CANCELLED: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
};

const RECONCILIATION_LABEL = {
  CAPTURED_NOT_REFLECTED: 'Razorpay captured — app never recorded it',
  FAILED_NOT_REFLECTED: 'Razorpay reports failed',
};

const compactField = {
  border: '1px solid var(--outline)',
  borderRadius: 0,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  outline: 'none',
};

const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const StatusPill = ({ status, flag, webhook }) => {
  const style = STATUS_STYLE[status] || { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' };
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.03em' }}>
          {status}
        </span>
        {/* Compact stand-in for a whole "Webhook" column — a filled dot when
            Razorpay's own webhook log confirms this order, hollow when it
            doesn't. Hover for which event was received. */}
        <span
          title={webhook?.received ? `Webhook confirmed: ${webhook.latest_event_type}` : 'No webhook received for this order yet'}
          style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: webhook?.received ? 'var(--success)' : 'transparent',
            border: webhook?.received ? 'none' : '1.5px solid var(--outline)',
          }}
        />
      </span>
      {flag && (
        <span
          title={RECONCILIATION_LABEL[flag] || flag}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--error)', fontSize: 9, fontWeight: 700 }}
        >
          <AlertTriangle size={10} /> Mismatch
        </span>
      )}
    </div>
  );
};

const AdminTransactionsPage = () => {
  const { isMobile } = useResponsive();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce the free-text search — every keystroke would otherwise fire a
  // fresh cross-model query (CasePayment + WalletTopupRequest, each with an
  // OR across razorpay ids / user name / email / mobile / tenant name).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(() => ({
    search, type, status,
    date_from: dateFrom, date_to: dateTo,
  }), [search, type, status, dateFrom, dateTo]);

  // Any filter change invalidates the current page — jumping back to page 1
  // avoids landing on a now out-of-range page (e.g. filtered results have
  // fewer pages than where the admin was browsing).
  useEffect(() => { setPage(1); }, [filters]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminTransactionsService.list({ ...filters, page, limit: PAGE_SIZE });
      setRows(result.transactions);
      setTotal(result.total);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const result = await adminTransactionsService.summary(filters);
      setSummary(result);
    } catch (err) {
      // Non-fatal — the table itself still loads independently of the stat cards.
    }
  }, [filters]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const activeFilterCount = [type, status, dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setType(''); setStatus('');
    setDateFrom(''); setDateTo('');
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await adminTransactionsService.exportExcel(filters);
      toast.success('Excel export downloaded');
    } catch (err) {
      toast.error('Failed to export Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await adminTransactionsService.exportPdf(filters);
      toast.success('PDF report downloaded');
    } catch (err) {
      toast.error('Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const columns = [
    {
      key: 'created_at', label: 'Date & Time', width: '20%', padding: '16px 12px',
      render: (t) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{formatDateTime(t.created_at)}</div>
          {t.completed_at && <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 3 }}>Completed {formatDateTime(t.completed_at)}</div>}
        </div>
      ),
    },
    {
      key: 'type', label: 'Type', width: '20%', padding: '16px 12px',
      render: (t) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{t.type_label}</div>
          <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 3 }}>
            {t.purpose}{t.case_id ? ` · Case #${t.case_id}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'status', label: 'Status', align: 'center', width: '9%', padding: '16px 12px', render: (t) => <StatusPill status={t.status} flag={t.reconciliation_flag} webhook={t.webhook} /> },
    { key: 'amount', label: 'Amount', align: 'right', width: '10%', padding: '16px 12px', render: (t) => <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--on-surface)' }}>{formatINR(t.amount_inr)}</span> },
    {
      key: 'party', label: 'User / Tenant', width: '22%', padding: '16px 12px',
      render: (t) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.user?.name || t.tenant?.name || '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--on-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
            {t.user?.email || (t.tenant ? `Tenant · ${t.tenant.name}` : '—')}
          </div>
        </div>
      ),
    },
    {
      key: 'order_id', label: 'Razorpay Order ID', width: '19%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--on-surface)' }}>{t.razorpay_order_id || '—'}</span>,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Transactions"
          subtitle="A complete record of every payment made on the platform, including MSME eligibility fees, DSA wallet top-ups, and Virtual Workspace subscriptions, verified against Razorpay for accuracy."
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {/* ─── Summary stat cards ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: 16 }}>
          <StatCard title="Total Transactions" value={summary?.total_count ?? '—'} icon={Receipt} loading={!summary} />
          <StatCard title="Total Volume" value={summary ? formatINR(summary.total_amount) : '—'} icon={IndianRupee} color="var(--primary)" loading={!summary} />
          <StatCard title="Successful" value={summary?.success_count ?? '—'} subtitle={summary ? formatINR(summary.success_amount) : undefined} icon={CheckCircle2} color="var(--success)" loading={!summary} />
          <StatCard title="Pending" value={summary?.pending_count ?? '—'} icon={Clock} color="var(--warning)" loading={!summary} />
          <StatCard title="Failed / Review" value={summary ? summary.failed_count + summary.review_count : '—'} icon={XCircle} color="var(--error)" loading={!summary} />
          <StatCard
            title="Unconfirmed"
            value={summary?.mismatch_count ?? '—'}
            subtitle="Paid but not reflected"
            icon={AlertTriangle}
            color={summary?.mismatch_count > 0 ? 'var(--error)' : 'var(--text-tertiary)'}
            loading={!summary}
          />
        </div>

        <div className="card" style={{ padding: 0, borderRadius: 0 }}>
          {/* ─── Filter toolbar ─── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--outline)' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160, maxWidth: 280 }}>
              <Search size={13} color="var(--text-tertiary)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Name, email, mobile, order/payment ID, case…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }}
              />
            </div>

            {isMobile && (
              <button
                onClick={() => setShowFilters((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', background: 'transparent',
                  border: `1px solid ${activeFilterCount > 0 ? 'var(--primary)' : 'var(--outline)'}`,
                  color: activeFilterCount > 0 ? 'var(--primary)' : 'var(--on-surface)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 0,
                }}
              >
                <SlidersHorizontal size={13} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            )}

            {(!isMobile || showFilters) && (
              <>
                <select style={{ ...compactField, maxWidth: 170 }} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">All types</option>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select style={{ ...compactField, maxWidth: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...compactField, maxWidth: 140 }} title="From date" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...compactField, maxWidth: 140 }} title="To date" />
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} style={{ ...compactField, border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                    Clear ({activeFilterCount})
                  </button>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                style={{ ...compactField, display: 'flex', alignItems: 'center', gap: 6, cursor: exportingExcel ? 'not-allowed' : 'pointer', border: '1px solid var(--outline)' }}
              >
                {exportingExcel ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={13} />} Excel
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                style={{ ...compactField, display: 'flex', alignItems: 'center', gap: 6, cursor: exportingPdf ? 'not-allowed' : 'pointer', border: '1px solid var(--outline)' }}
              >
                {exportingPdf ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={13} />} PDF
              </button>
            </div>
          </div>

          {/* ─── Table / mobile card list ─── */}
          {loading ? (
            <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Receipt} title="No transactions found" description="No MSME eligibility payments, DSA wallet top-ups, or subscription charges match the applied filters." />
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {rows.map((t) => {
                const style = STATUS_STYLE[t.status] || { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' };
                return (
                  <div key={t.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{t.type_label}</div>
                        <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{formatDateTime(t.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--on-surface)' }}>{formatINR(t.amount_inr)}</div>
                        <span style={{ background: style.bg, color: style.color, padding: '2px 8px', borderRadius: 0, fontSize: 10, fontWeight: 800, display: 'inline-block', marginTop: 3 }}>
                          {t.status}
                        </span>
                      </div>
                    </div>

                    {t.reconciliation_flag && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 8px', background: 'var(--error-bg)', color: 'var(--error)', fontSize: 11, fontWeight: 700 }}>
                        <AlertTriangle size={12} /> {RECONCILIATION_LABEL[t.reconciliation_flag] || t.reconciliation_flag}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)' }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>User / Tenant</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.user?.name || t.tenant?.name || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Case</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{t.case_id ? `#${t.case_id}` : '—'}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Razorpay Order ID</div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.razorpay_order_id || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DataTable columns={columns} data={rows} rowKey="id" />
          )}
        </div>

        {!loading && total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Page {page} of {Math.ceil(total / PAGE_SIZE)} · {total} total</span>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTransactionsPage;
