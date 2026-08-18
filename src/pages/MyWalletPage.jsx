import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Search, SlidersHorizontal,
  FileSpreadsheet, RefreshCw, TrendingUp, TrendingDown,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { walletService } from '../api/walletService';

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
  { value: 'CREDIT', label: 'Credits (added)' },
  { value: 'DEBIT', label: 'Debits (used)' },
];

const compactField = {
  border: '1px solid var(--outline)',
  borderRadius: 0,
  background: 'var(--surface)',
  color: 'var(--on-surface)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  outline: 'none',
};

const toDateInput = (d) => d.toISOString().slice(0, 10);

// "Weekly" -> last 7 days, "Yearly" -> 1 Jan of this year through today —
// both computed client-side into a plain date_from/date_to pair, same
// contract the custom range picker below already sends.
const PRESETS = [
  {
    key: 'week',
    label: 'Last 7 Days',
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return [toDateInput(from), toDateInput(to)];
    },
  },
  {
    key: 'year',
    label: 'This Year',
    range: () => {
      const to = new Date();
      const from = new Date(to.getFullYear(), 0, 1);
      return [toDateInput(from), toDateInput(to)];
    },
  },
];

const formatCredits = (n) => `${Number(n || 0).toLocaleString('en-IN')}`;

const MyWalletPage = () => {
  const { isMobile } = useResponsive();

  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(() => ({
    search, type, date_from: dateFrom, date_to: dateTo,
  }), [search, type, dateFrom, dateTo]);

  // Any filter change invalidates the current page — jumping back to page 1
  // avoids landing on a now out-of-range page.
  useEffect(() => { setPage(1); }, [filters]);

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const result = await walletService.getBalance();
      setBalance(result.balance);
    } catch (err) {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await walletService.getTransactions({ ...filters, page, limit: PAGE_SIZE });
      setRows(result.transactions || []);
      setTotal(result.total || 0);
      setSummary(result.summary || null);
    } catch (err) {
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const applyPreset = (preset) => {
    const [from, to] = preset.range();
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset.key);
  };

  const activeFilterCount = [type, dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setType('');
    setDateFrom(''); setDateTo(''); setActivePreset(null);
  };

  const handleDateInputChange = (setter) => (e) => {
    setter(e.target.value);
    setActivePreset(null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await walletService.exportTransactions(filters);
      toast.success('Excel export downloaded');
    } catch (err) {
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: 'created_at', label: 'Date & Time', width: '20%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{formatDateTime(t.created_at)}</span>,
    },
    {
      key: 'type', label: 'Type', width: '16%', padding: '16px 12px',
      render: (t) => (
        <span className="badge" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)',
          background: t.transaction_type === 'CREDIT' ? 'var(--success-bg)' : 'var(--error-bg)',
        }}>
          {t.transaction_type === 'CREDIT' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
          {t.reference_type}
        </span>
      ),
    },
    {
      key: 'amount', label: 'Amount', align: 'right', width: '14%', padding: '16px 12px',
      render: (t) => (
        <span style={{ fontSize: 14, fontWeight: 800, color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)' }}>
          {t.transaction_type === 'CREDIT' ? '+' : '-'}{formatCredits(t.amount)}
        </span>
      ),
    },
    {
      key: 'reference', label: 'Reference', width: '30%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 12, color: 'var(--on-surface)' }}>{t.remarks || t.api_code || '—'}</span>,
    },
    {
      key: 'balance_after', label: 'Balance After', align: 'right', width: '20%', padding: '16px 12px',
      render: (t) => <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{formatCredits(t.balance_after)}</span>,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader title="My Wallet" subtitle="Your credit balance and transaction history" compact={isMobile} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {/* ─── Summary stat cards ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: 16 }}>
          <StatCard title="Current Balance" value={balanceLoading ? '—' : (balance !== null ? formatCredits(balance) : '—')} icon={Wallet} color="var(--primary)" loading={balanceLoading} />
          <StatCard title="Credited (in range)" value={summary ? `+${formatCredits(summary.total_credit)}` : '—'} icon={TrendingUp} color="var(--success)" loading={!summary} />
          <StatCard title="Used (in range)" value={summary ? `-${formatCredits(summary.total_debit)}` : '—'} icon={TrendingDown} color="var(--error)" loading={!summary} />
        </div>

        <div className="card" style={{ padding: 0, borderRadius: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Transaction History</h3>
          </div>

          {/* ─── Filter toolbar ─── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--outline)' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140, maxWidth: 260 }}>
              <Search size={13} color="var(--on-muted)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search remarks, API…"
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

                <div style={{ display: 'flex', gap: 4 }}>
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p)}
                      style={{
                        ...compactField,
                        cursor: 'pointer',
                        border: `1px solid ${activePreset === p.key ? 'var(--primary)' : 'var(--outline)'}`,
                        color: activePreset === p.key ? 'var(--primary)' : 'var(--on-surface)',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input type="date" value={dateFrom} onChange={handleDateInputChange(setDateFrom)} style={{ ...compactField, maxWidth: 140 }} title="From date" />
                <input type="date" value={dateTo} onChange={handleDateInputChange(setDateTo)} style={{ ...compactField, maxWidth: 140 }} title="To date" />

                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} style={{ ...compactField, border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                    Clear ({activeFilterCount})
                  </button>
                )}
              </>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              style={{ ...compactField, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: exporting ? 'not-allowed' : 'pointer', border: '1px solid var(--outline)' }}
            >
              {exporting ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={13} />} Export Excel
            </button>
          </div>

          {/* ─── Table / mobile card list ─── */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Wallet} title="No transactions found" description="No wallet credit/debit history matches the applied filters." />
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {rows.map((t) => (
                <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="badge" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)',
                        background: t.transaction_type === 'CREDIT' ? 'var(--success-bg)' : 'var(--error-bg)',
                      }}>
                        {t.transaction_type === 'CREDIT' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                        {t.reference_type}
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6 }}>{formatDateTime(t.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)', flexShrink: 0 }}>
                      {t.transaction_type === 'CREDIT' ? '+' : '-'}{formatCredits(t.amount)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)' }}>
                    <span style={{ fontSize: 12, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.remarks || t.api_code || '—'}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', flexShrink: 0 }}>Bal: {formatCredits(t.balance_after)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DataTable columns={columns} data={rows} rowKey="id" />
          )}
        </div>

        {!loading && total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Page {page} of {Math.ceil(total / PAGE_SIZE)} · {total} total</span>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyWalletPage;
