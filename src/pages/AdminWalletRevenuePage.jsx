import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  IndianRupee, Receipt, Percent, FileSpreadsheet, AlertTriangle, CheckCircle2, Search, Tag, Layers,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CustomSelect from '../components/CustomSelect';
import { formatDateTime } from '../utils/helpers';
import { walletRevenueService } from '../api/walletRevenueService';

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
const STREAM_LABEL = { WALLET: 'Wallet recharge', MSME_FEE: 'MSME fee', SUBSCRIPTION: 'Subscription' };
const STREAM_COLOR = { WALLET: 'var(--primary)', MSME_FEE: 'var(--success)', SUBSCRIPTION: 'var(--warning)' };
const STREAMS = ['WALLET', 'MSME_FEE', 'SUBSCRIPTION'];
// ▲/▼ + percentage for a comparison metric; says so plainly when there is no
// previous figure to compare against (a % of zero is meaningless).
const changeText = (d) => {
  if (!d) return '—';
  if (d.change === 0) return 'No change';
  const arrow = d.change > 0 ? '▲' : '▼';
  return d.change_pct === null ? `${arrow} new (nothing in previous period)` : `${arrow} ${Math.abs(d.change_pct)}%`;
};
const changeColor = (d) => (!d || d.change === 0 ? 'var(--on-muted)' : d.change > 0 ? 'var(--success)' : 'var(--error)');
const pct = (part, whole) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y}`;
};
const PERIOD_OPTIONS = [
  { value: 'FY', label: 'Financial year' },
  { value: 'Q1', label: 'Q1 (Apr–Jun)' },
  { value: 'Q2', label: 'Q2 (Jul–Sep)' },
  { value: 'Q3', label: 'Q3 (Oct–Dec)' },
  { value: 'Q4', label: 'Q4 (Jan–Mar)' },
  { value: 'MONTH', label: 'Single month' },
  { value: 'CUSTOM', label: 'Custom dates' },
];
const TABS = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'overview', label: 'Overview' },
  { id: 'gst', label: 'GST Returns' },
  { id: 'register', label: 'Invoice Register' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'usage', label: 'Usage (Credits)' },
];
const SEVERITY_STYLE = {
  high: { color: 'var(--error)', bg: 'var(--error-bg)' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  low: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
};
const FLAG_LABEL = {
  NO_INVOICE: 'No invoice', GST_NOT_RECORDED: 'GST not recorded', INVOICE_TAXABLE_MISMATCH: 'Taxable mismatch',
  GST_RATE_MISMATCH: 'GST ≠ rate', REFUND_REVIEW: 'Refund review',
  STATE_UNKNOWN: 'State unknown', INVALID_GSTIN: 'Bad GSTIN', INVOICE_NUMBER_TOO_LONG: 'No. > 16 chars', NO_BUYER_SNAPSHOT: 'No snapshot',
};

const compactField = {
  border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--surface)', color: 'var(--text-primary)',
  fontSize: 12, fontWeight: 600, padding: '6px 10px', outline: 'none',
};

const inr = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const num = (n) => Number(n || 0).toLocaleString('en-IN');

const th = { textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)', padding: '10px 12px', borderBottom: '1px solid var(--outline)', whiteSpace: 'nowrap', background: 'var(--surface)', position: 'sticky', top: 0 };
const td = { fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', padding: '10px 12px', borderBottom: '1px solid var(--outline)', whiteSpace: 'nowrap' };
const right = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const Section = ({ title, hint, children }) => (
  <div className="card" style={{ padding: 0, borderRadius: 0, marginBottom: 16 }}>
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--outline)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
    </div>
    <div style={{ overflowX: 'auto' }}>{children}</div>
  </div>
);

// Generic dense table. `cols`: [{ key, label, num?, render? }]; `foot` is an optional totals row.
const Grid = ({ cols, rows, foot, empty = 'No data for this period' }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
    <thead>
      <tr>{cols.map((c) => <th key={c.key} style={{ ...th, ...(c.num ? right : {}) }}>{c.label}</th>)}</tr>
    </thead>
    <tbody>
      {rows.length === 0 && <tr><td colSpan={cols.length} style={{ ...td, textAlign: 'center', color: 'var(--on-muted)', padding: 24 }}>{empty}</td></tr>}
      {rows.map((r, i) => (
        <tr key={r.key ?? i}>
          {cols.map((c) => <td key={c.key} style={{ ...td, ...(c.num ? right : {}) }}>{c.render ? c.render(r) : r[c.key]}</td>)}
        </tr>
      ))}
      {foot && (
        <tr>{cols.map((c) => <td key={c.key} style={{ ...td, ...(c.num ? right : {}), fontWeight: 800, background: 'var(--bg-elevated)' }}>{foot[c.key] ?? ''}</td>)}</tr>
      )}
    </tbody>
  </table>
);

const taxCols = [
  { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
  { key: 'gst', label: 'GST (18%)', num: true, render: (r) => inr(r.gst) },
  { key: 'total', label: 'Gross', num: true, render: (r) => inr(r.total) },
];
const taxFoot = (t) => ({ taxable: inr(t.taxable), gst: inr(t.gst), total: inr(t.total) });

const Pill = ({ children, style }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', ...style }}>{children}</span>
);

const AdminWalletRevenuePage = () => {
  const { isMobile } = useResponsive();
  const [years, setYears] = useState([]);
  const [period, setPeriod] = useState('FY');
  const [fy, setFy] = useState('');
  const [month, setMonth] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState('revenue');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [regRows, setRegRows] = useState([]);
  const [regTotal, setRegTotal] = useState(0);
  const [regPage, setRegPage] = useState(1);
  const [regLoading, setRegLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    walletRevenueService.financialYears().then((r) => {
      setYears(r.years);
      if (r.years[0]) setFy(String(r.years[0].value));
    }).catch(() => toast.error('Failed to load financial years'));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // The exact params the server needs to resolve this period; null until valid.
  const periodParams = useMemo(() => {
    if (period === 'MONTH') return month ? { period, month } : null;
    if (period === 'CUSTOM') return from && to ? { period, from, to } : null;
    return fy ? { period, fy } : null;
  }, [period, fy, month, from, to]);

  const fetchReport = useCallback(async () => {
    if (!periodParams) return;
    setLoading(true);
    try {
      setReport(await walletRevenueService.summary(periodParams));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load wallet revenue');
    } finally {
      setLoading(false);
    }
  }, [periodParams]);
  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => { setRegPage(1); }, [periodParams, search, category]);
  const fetchRegister = useCallback(async () => {
    if (!periodParams || tab !== 'register') return;
    setRegLoading(true);
    try {
      const r = await walletRevenueService.register({ ...periodParams, page: regPage, limit: PAGE_SIZE, q: search, category });
      setRegRows(r.rows); setRegTotal(r.total);
    } catch (err) {
      toast.error('Failed to load invoice register');
    } finally {
      setRegLoading(false);
    }
  }, [periodParams, tab, regPage, search, category]);
  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  const handleExport = async () => {
    if (!periodParams) return;
    setExporting(true);
    try {
      await walletRevenueService.exportExcel(periodParams);
      toast.success('Excel workbook downloaded');
    } catch (err) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const t = report?.totals;
  const highCount = report ? report.exceptions.filter((e) => e.severity === 'high').length : 0;
  const integrityOk = report && report.integrity.total_ties_to_payments && report.integrity.gst_ties_to_payments && report.integrity.gst_is_18_percent_of_taxable;

  const monthRows = report ? report.monthly.map((m) => ({ ...m, key: m.month })) : [];
  const quarterRows = report ? report.quarterly.map((q) => ({ ...q, key: q.quarter })) : [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Wallet Revenue & GST"
          subtitle="Revenue and GST collected on wallet recharge invoices, organised for GSTR-1, GSTR-3B and the income-tax return. Every figure is derived from the payment records and tied back to the database totals."
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {/* ─── Period controls ─── */}
        <div className="card" style={{ padding: '10px 14px', borderRadius: 0, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <CustomSelect style={{ ...compactField, maxWidth: 170 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </CustomSelect>
          {(period === 'FY' || /^Q/.test(period)) && (
            <CustomSelect style={{ ...compactField, maxWidth: 150 }} value={fy} onChange={(e) => setFy(e.target.value)}>
              {years.map((y) => <option key={y.value} value={y.value}>FY {y.label}</option>)}
            </CustomSelect>
          )}
          {period === 'MONTH' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...compactField, maxWidth: 160 }} />}
          {period === 'CUSTOM' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...compactField, maxWidth: 140 }} title="From (IST)" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...compactField, maxWidth: 140 }} title="To (IST, inclusive)" />
            </>
          )}
          {report && <span style={{ fontSize: 11, color: 'var(--on-muted)', fontWeight: 600 }}>{report.period.label} · {report.period.from} → {report.period.to} (IST)</span>}
          <button
            onClick={handleExport}
            disabled={exporting || !periodParams}
            style={{ ...compactField, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: exporting ? 'not-allowed' : 'pointer' }}
          >
            {exporting ? <span className="skeleton-inline" style={{ width: 13, height: 13 }} /> : <FileSpreadsheet size={13} />} Excel workbook
          </button>
        </div>

        {/* ─── KPIs ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: 16 }}>
          <StatCard title="Taxable Value (Revenue)" value={t ? inr(t.taxable) : '—'} subtitle={report ? `${changeText(report.comparison.net_revenue)} vs ${report.comparison.previous_period.label}` : 'Total received − GST'} icon={IndianRupee} color="var(--primary)" loading={!report} />
          <StatCard title="GST Collected (18%)" value={t ? inr(t.gst) : '—'} subtitle="Single GST on taxable value" icon={Percent} color="var(--warning)" loading={!report} />
          <StatCard title="Gross Receipts" value={t ? inr(t.total) : '—'} subtitle={t ? `${num(t.invoices)} invoices · avg ${inr(t.avg_invoice_value)}` : undefined} icon={Receipt} color="var(--success)" loading={!report} />
          <StatCard title="Promo Discounts Given" value={t ? inr(t.promo_discount) : '—'} subtitle={t ? `${num(t.promo_value_credits)} promotional credits` : undefined} icon={Tag} color="var(--info)" loading={!report} />
          <StatCard
            title="Needs Attention"
            value={report ? highCount : '—'}
            subtitle={report ? (highCount ? 'High-severity issues' : 'No high-severity issues') : undefined}
            icon={highCount ? AlertTriangle : CheckCircle2}
            color={highCount ? 'var(--error)' : 'var(--success)'}
            loading={!report}
          />
        </div>

        {report && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12, fontWeight: 700, background: integrityOk ? 'var(--success-bg)' : 'var(--error-bg)', color: integrityOk ? 'var(--success)' : 'var(--error)' }}>
            {integrityOk ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {integrityOk
              ? `Totals tie to the database: ${num(report.integrity.invoices_in_period)} invoices, gross and GST match the raw payment sums, and GST is 18% of the taxable value on every row.`
              : 'Integrity check FAILED — these figures do not tie to the raw payment records. Do not file from this view.'}
          </div>
        )}

        {report && (report.unclassified.invoices > 0 || report.refund_review.invoices > 0) && (
          <div style={{ padding: '10px 12px', marginBottom: 16, fontSize: 12, fontWeight: 600, background: 'var(--warning-bg)', color: 'var(--warning)', lineHeight: 1.6 }}>
            {report.unclassified.invoices > 0 && <div><b>{report.unclassified.invoices} payments ({inr(report.unclassified.total)})</b> have no GST recorded (legacy). They are in Gross Receipts but excluded from Taxable Value and GST — resolve them with your accountant before filing.</div>}
            {report.refund_review.invoices > 0 && <div><b>{report.refund_review.invoices} invoices ({inr(report.refund_review.total)})</b> are under refund review. They remain in the totals; issue a credit note if the refund goes through.</div>}
          </div>
        )}

        {/* ─── Tabs ─── */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--outline)', marginBottom: 16, overflowX: 'auto' }}>
          {TABS.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              style={{
                padding: '9px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: 'transparent', border: 'none', whiteSpace: 'nowrap',
                color: tab === x.id ? 'var(--primary)' : 'var(--on-muted)',
                borderBottom: `2px solid ${tab === x.id ? 'var(--primary)' : 'transparent'}`,
              }}
            >
              {x.label}{x.id === 'exceptions' && report ? ` (${report.exceptions.length})` : ''}
            </button>
          ))}
        </div>

        {loading && !report ? <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div> : !report ? (
          <EmptyState icon={Receipt} title="Pick a period" description="Choose a financial year, quarter, month or custom range." />
        ) : (
          <>
            {tab === 'revenue' && (
              <>
                <Section
                  title={`Compared with ${report.comparison.previous_period.label}`}
                  hint={`The same-length period immediately before this one (${report.comparison.previous_period.from} → ${report.comparison.previous_period.to}, IST).${report.comparison.current_period_in_progress ? ' This period is still in progress, so it will naturally trail a finished one until it ends.' : ''}${report.comparison.previous_has_data ? '' : ' There were no invoices in the previous period, so there is nothing to compare against.'}`}
                >
                  {(() => {
                    const c = report.comparison;
                    const money = (d) => ({ cur: inr(d.current), prev: inr(d.previous), chg: `${d.change > 0 ? '+' : d.change < 0 ? '−' : ''}${inr(Math.abs(d.change))}` });
                    const count = (d) => ({ cur: num(d.current), prev: num(d.previous), chg: `${d.change > 0 ? '+' : d.change < 0 ? '−' : ''}${num(Math.abs(d.change))}` });
                    const rows = [
                      { key: 'n', label: 'Net revenue', d: c.net_revenue, ...money(c.net_revenue), bold: true },
                      ...STREAMS.map((s) => ({ key: s, label: `   ${STREAM_LABEL[s]}`, d: c.by_stream[s].net_revenue, ...money(c.by_stream[s].net_revenue) })),
                      { key: 'g', label: 'GST collected', d: c.gst, ...money(c.gst) },
                      { key: 'b', label: 'Gross billed', d: c.gross, ...money(c.gross) },
                      { key: 'i', label: 'Invoices', d: c.invoices, ...count(c.invoices) },
                    ];
                    return (
                      <Grid
                        cols={[
                          { key: 'label', label: 'Measure', render: (r) => <span style={{ whiteSpace: 'pre', fontWeight: r.bold ? 800 : 600 }}>{r.label}</span> },
                          { key: 'cur', label: report.period.label, num: true, render: (r) => <span style={{ fontWeight: r.bold ? 800 : 600 }}>{r.cur}</span> },
                          { key: 'prev', label: c.previous_period.label, num: true },
                          { key: 'chg', label: 'Change', num: true, render: (r) => <span style={{ color: changeColor(r.d), fontWeight: 700 }}>{r.chg}</span> },
                          { key: 'pct', label: '%', num: true, render: (r) => <span style={{ color: changeColor(r.d), fontWeight: 700 }}>{changeText(r.d)}</span> },
                        ]}
                        rows={rows}
                      />
                    );
                  })()}
                </Section>

                <Section title="How much we earned" hint="From everything billed in this period to the revenue that is actually ours. GST is collected on behalf of the government, so it is not revenue.">
                  <Grid
                    cols={[{ key: 'k', label: 'Step' }, { key: 'v', label: 'Amount', num: true }, { key: 'n', label: 'What it means' }]}
                    rows={[
                      { key: 'g', k: 'Gross billed (incl. GST)', v: inr(t.total), n: `${num(t.invoices)} invoices across wallet recharges, MSME fees and subscriptions` },
                      ...(report.unclassified.invoices > 0 ? [{ key: 'u', k: `Less: GST not recorded (${report.unclassified.invoices} older payments)`, v: `− ${inr(report.unclassified.total)}`, n: 'Received before GST was recorded — cannot be split into revenue and tax, so excluded here' }] : []),
                      { key: 'x', k: 'Less: GST collected (18%)', v: `− ${inr(t.gst)}`, n: 'Payable to the government — not our revenue' },
                    ]}
                    foot={{ k: 'NET REVENUE (taxable value)', v: inr(t.taxable), n: `${pct(t.taxable, t.total)} of gross billed` }}
                  />
                </Section>

                <Section title="Revenue by source" hint="Net revenue (excluding GST) for each thing we sell.">
                  <Grid
                    cols={[
                      { key: 'k', label: 'Source', render: (r) => <span><span style={{ display: 'inline-block', width: 9, height: 9, background: STREAM_COLOR[r.s], marginRight: 8 }} />{STREAM_LABEL[r.s]}</span> },
                      { key: 'invoices', label: 'Invoices', num: true },
                      { key: 'taxable', label: 'Net revenue', num: true, render: (r) => inr(r.taxable) },
                      { key: 'share', label: 'Share', num: true },
                      { key: 'avg', label: 'Avg per invoice', num: true },
                      { key: 'gst', label: 'GST collected', num: true, render: (r) => inr(r.gst) },
                      { key: 'total', label: 'Gross billed', num: true, render: (r) => inr(r.total) },
                    ]}
                    rows={STREAMS.map((s) => {
                      const b = report.by_stream[s];
                      const classified = b.taxable > 0 ? b.invoices : 0;
                      return { key: s, s, ...b, share: pct(b.taxable, t.taxable), avg: classified ? inr(b.taxable / b.invoices) : '—' };
                    })}
                    foot={{ k: 'Total', invoices: num(t.invoices), taxable: inr(t.taxable), share: '100%', avg: t.invoices ? inr(t.taxable / t.invoices) : '—', gst: inr(t.gst), total: inr(t.total) }}
                  />
                </Section>

                <Section title="Month by month" hint="Net revenue each month, split by source.">
                  {(() => {
                    const rows = report.monthly_by_stream;
                    const monthTotal = (m) => STREAMS.reduce((s, k) => s + m[k].taxable, 0);
                    const max = Math.max(1, ...rows.map(monthTotal));
                    return (
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--on-muted)', marginBottom: 12 }}>
                          {STREAMS.map((s) => (
                            <span key={s}><span style={{ display: 'inline-block', width: 9, height: 9, background: STREAM_COLOR[s], marginRight: 6 }} />{STREAM_LABEL[s]}</span>
                          ))}
                        </div>
                        {rows.map((m) => {
                          const total = monthTotal(m);
                          return (
                            <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                              <div style={{ width: 70, fontSize: 11, fontWeight: 700, color: 'var(--on-surface)', flexShrink: 0 }}>{monthLabel(m.month)}</div>
                              <div style={{ flex: 1, background: 'var(--bg-elevated)', height: 18, display: 'flex' }} title={STREAMS.map((s) => `${STREAM_LABEL[s]}: ${inr(m[s].taxable)}`).join('\n')}>
                                {STREAMS.map((s) => (m[s].taxable > 0 ? <div key={s} style={{ width: `${(m[s].taxable / max) * 100}%`, background: STREAM_COLOR[s] }} /> : null))}
                              </div>
                              <div style={{ width: 110, textAlign: 'right', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{inr(total)}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <Grid
                    cols={[
                      { key: 'month', label: 'Month', render: (r) => monthLabel(r.month) },
                      ...STREAMS.map((s) => ({ key: s, label: STREAM_LABEL[s], num: true, render: (r) => inr(r[s].taxable) })),
                      { key: 'net', label: 'Net revenue', num: true, render: (r) => <b>{inr(STREAMS.reduce((a, s) => a + r[s].taxable, 0))}</b> },
                      { key: 'gst', label: 'GST', num: true, render: (r) => inr(STREAMS.reduce((a, s) => a + r[s].gst, 0)) },
                    ]}
                    rows={report.monthly_by_stream.map((m) => ({ ...m, key: m.month }))}
                    foot={{ month: 'Total', ...Object.fromEntries(STREAMS.map((s) => [s, inr(report.by_stream[s].taxable)])), net: inr(t.taxable), gst: inr(t.gst) }}
                  />
                </Section>

                <Section title={`Top customers${report.buyer_count > report.by_buyer.length ? ` (top ${report.by_buyer.length} of ${num(report.buyer_count)})` : ''}`} hint="Who paid us the most in this period, by net revenue.">
                  <Grid
                    cols={[
                      { key: 'name', label: 'Customer', render: (r) => <div><div>{r.name}</div><div style={{ fontSize: 10, color: 'var(--on-muted)' }}>{r.gstin || 'Unregistered'}</div></div> },
                      { key: 'streams', label: 'Bought', render: (r) => r.streams.map((s) => STREAM_LABEL[s]).join(', ') },
                      { key: 'invoices', label: 'Invoices', num: true },
                      { key: 'taxable', label: 'Net revenue', num: true, render: (r) => inr(r.taxable) },
                      { key: 'share', label: 'Share', num: true },
                    ]}
                    rows={report.by_buyer.map((b, i) => ({ ...b, key: `${b.gstin || b.name}-${i}`, share: pct(b.taxable, t.taxable) }))}
                    empty="No classified revenue in this period"
                  />
                </Section>

                <Section title="Earned vs received (credits)" hint={report.usage.note}>
                  <Grid
                    cols={[{ key: 'k', label: 'Measure' }, { key: 'v', label: '₹ / credits', num: true }, { key: 'n', label: 'What it means' }]}
                    rows={[
                      { key: 'r', k: 'Received as wallet recharges (net of GST, in ₹)', v: inr(report.by_stream.WALLET.taxable), n: 'Cash we collected for credits — prepayment, not yet earned' },
                      { key: 'c', k: 'Credits consumed in the period', v: num(report.usage.net_credits_consumed), n: 'API usage and wallet-paid subscriptions, net of refunds — closest to revenue actually earned (≈ ₹1 per credit)' },
                      { key: 'f', k: 'Free credits granted', v: num(report.usage.free_credits_granted), n: 'Admin top-ups and promo freebies — cost to us, no cash received' },
                      { key: 'u', k: 'Unused credits right now (all tenants)', v: num(report.usage.wallet_float_credits), n: 'Prepaid balance still owed back as service — a liability until used' },
                    ]}
                  />
                </Section>

                {(report.refund_review.invoices > 0 || t.promo_discount > 0) && (
                  <Section title="Adjustments to keep in mind">
                    <Grid
                      cols={[{ key: 'k', label: 'Item' }, { key: 'v', label: 'Amount', num: true }, { key: 'n', label: 'Effect' }]}
                      rows={[
                        ...(t.promo_discount > 0 ? [{ key: 'p', k: 'Promo discounts given', v: inr(t.promo_discount), n: 'Already reflected — revenue above is net of these discounts' }] : []),
                        ...(report.refund_review.invoices > 0 ? [{ key: 'r', k: `Refunds under review (${report.refund_review.invoices})`, v: inr(report.refund_review.taxable), n: 'Still counted in revenue; will reduce it (via a credit note) if the refund goes through' }] : []),
                      ]}
                    />
                  </Section>
                )}
              </>
            )}

            {tab === 'overview' && (
              <>
                <Section title="Month-wise" hint="Each top-up is counted in the IST month it was credited. Months with no activity are shown as zero.">
                  <Grid
                    cols={[{ key: 'month', label: 'Month' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols]}
                    rows={monthRows}
                    foot={{ month: 'Total', invoices: num(t.invoices), ...taxFoot(t) }}
                  />
                </Section>
                <Section title="Quarter-wise (GST quarters, Apr–Mar)" hint="Use for quarterly returns (QRMP). Quarters outside the selected range are not shown.">
                  <Grid
                    cols={[{ key: 'quarter', label: 'Quarter' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols]}
                    rows={quarterRows}
                    foot={{ quarter: 'Total', invoices: num(t.invoices), ...taxFoot(t) }}
                  />
                </Section>
                <Section title="B2B vs B2C" hint="B2B = buyer has a valid GSTIN. B2C = unregistered buyer (or a GSTIN that is not a valid format).">
                  <Grid
                    cols={[{ key: 'k', label: 'Category' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols]}
                    rows={['B2B', 'B2C'].map((k) => ({ key: k, k, ...report.by_category[k] }))}
                  />
                </Section>
                <Section title="By supply" hint="Wallet recharges, Direct-MSME eligibility fees and Virtual Workspace subscriptions are separate supplies, each with its own invoice series.">
                  <Grid
                    cols={[{ key: 'k', label: 'Supply' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols]}
                    rows={['WALLET', 'MSME_FEE', 'SUBSCRIPTION'].map((k) => ({ key: k, k: STREAM_LABEL[k], ...report.by_stream[k] }))}
                    foot={{ k: 'Total', invoices: num(t.invoices), ...taxFoot(t) }}
                  />
                </Section>
                <Section title="By place of supply (buyer state)" hint="Buyer state comes from the GSTIN when present, otherwise the tenant’s state field (abbreviations such as ‘MH’ are understood).">
                  <Grid
                    cols={[{ key: 'name', label: 'State', render: (r) => `${r.code === 'UNKNOWN' ? '—' : r.code} ${r.name}` }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols]}
                    rows={report.by_state.map((s) => ({ ...s, key: s.code }))}
                  />
                </Section>
                <Section title="Credits issued vs paid" hint="Credits issued include volume bonus, promo cashback and discounts; only the taxable value is revenue.">
                  <Grid
                    cols={[{ key: 'a', label: 'Credits issued', num: true }, { key: 'b', label: 'Taxable value received (₹)', num: true }, { key: 'c', label: 'Promotional value (credits − paid)', num: true }]}
                    rows={[{ a: num(t.credits_issued), b: inr(t.taxable), c: num(t.promo_value_credits) }]}
                  />
                </Section>
              </>
            )}

            {tab === 'gst' && (
              <>
                <Section title="GST return summary — outward taxable supplies" hint={report.gst_summary.note}>
                  <Grid
                    cols={[{ key: 'v', label: 'Taxable value', num: true }, { key: 'g', label: 'GST payable (18%)', num: true }]}
                    rows={[{ v: inr(report.gst_summary.outward_taxable_value), g: inr(report.gst_summary.gst) }]}
                  />
                </Section>
                <Section title="B2B invoices (buyer has a valid GSTIN)" hint="Registered buyers. Place of supply is the buyer’s state.">
                  <Grid
                    cols={[
                      { key: 'invoice_number', label: 'Invoice no.', render: (r) => r.invoice_number || '—' },
                      { key: 'invoice_date', label: 'Date', render: (r) => formatDateTime(r.invoice_date) },
                      { key: 'buyer_gstin', label: 'GSTIN' }, { key: 'buyer_name', label: 'Buyer' },
                      { key: 'pos', label: 'Place of supply', render: (r) => `${r.pos_code || '—'} ${r.pos_name || ''}` },
                      { key: 'gst_rate', label: 'Rate', num: true, render: (r) => `${(r.gst_rate * 100).toFixed(0)}%` },
                      { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
                      { key: 'gst', label: 'GST (18%)', num: true, render: (r) => inr(r.gst) },
                      { key: 'total', label: 'Invoice value', num: true, render: (r) => inr(r.total) },
                    ]}
                    rows={report.b2b.map((r) => ({ ...r, key: `${r.stream}-${r.topup_id}` }))}
                    empty="No B2B invoices"
                  />
                </Section>
                <Section title="B2C (unregistered buyers) — by buyer state" hint="Consolidated by state and rate, not invoice-wise.">
                  <Grid
                    cols={[
                      { key: 'pos', label: 'Buyer state', render: (r) => `${r.pos_code || '—'} ${r.pos_name || 'Unknown'}` },
                      { key: 'gst_rate', label: 'Rate', num: true, render: (r) => `${(r.gst_rate * 100).toFixed(0)}%` },
                      { key: 'invoices', label: 'Invoices', num: true },
                      { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
                      { key: 'gst', label: 'GST (18%)', num: true, render: (r) => inr(r.gst) },
                    ]}
                    rows={report.b2c.map((r, i) => ({ ...r, key: i }))}
                    empty="No B2C invoices"
                  />
                </Section>
                <Section title="Documents issued (invoice series)" hint="Invoices are numbered INV/<year>/<serial>, one gapless series per financial year. Any ‘skipped’ number in a current series is a real problem; the older INV-yyyy-yy-… series was derived from the top-up ID and is expected to have gaps.">
                  <Grid
                    cols={[
                      { key: 'prefix', label: 'Series', render: (r) => `${r.prefix}…${r.legacy ? ' (legacy)' : ''}` },
                      { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                      { key: 'count', label: 'Issued', num: true },
                      { key: 'gap_count', label: 'Numbers skipped', num: true, render: (r) => (r.legacy ? '— (legacy)' : r.gap_count) },
                    ]}
                    rows={report.documents.series.map((s) => ({ ...s, key: s.prefix }))}
                    empty="No invoices issued in this period"
                  />
                </Section>
              </>
            )}

            {tab === 'register' && (
              <div className="card" style={{ padding: 0, borderRadius: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--outline)' }}>
                  <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
                    <Search size={13} color="var(--text-tertiary)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Invoice no., buyer, GSTIN, payment ID…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }} />
                  </div>
                  <CustomSelect style={{ ...compactField, maxWidth: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    <option value="B2B">B2B</option><option value="B2C">B2C</option><option value="UNCLASSIFIED">Unclassified</option>
                  </CustomSelect>
                </div>
                {regLoading ? <div style={{ padding: 40 }}><LoadingSpinner fullPage /></div> : (
                  <div style={{ overflowX: 'auto' }}>
                    <Grid
                      cols={[
                        { key: 'stream', label: 'Source', render: (r) => STREAM_LABEL[r.stream] || r.stream },
                        { key: 'invoice_number', label: 'Invoice no.', render: (r) => r.invoice_number || <Pill style={SEVERITY_STYLE.high}>NOT ISSUED</Pill> },
                        { key: 'invoice_date', label: 'Date', render: (r) => formatDateTime(r.invoice_date) },
                        { key: 'buyer_name', label: 'Buyer', render: (r) => <div><div>{r.buyer_name || '—'}</div><div style={{ fontSize: 10, color: 'var(--on-muted)' }}>{r.buyer_gstin || 'Unregistered'}</div></div> },
                        { key: 'category', label: 'Type' },
                        { key: 'pos', label: 'Place of supply', render: (r) => `${r.pos_code || '—'} ${r.pos_name || ''}` },
                        { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
                        { key: 'gst', label: 'GST (18%)', num: true, render: (r) => inr(r.gst) },
                        { key: 'total', label: 'Invoice value', num: true, render: (r) => inr(r.total) },
                        { key: 'flags', label: 'Flags', render: (r) => (r.flags.length === 0 ? '—' : r.flags.map((f) => <Pill key={f} style={{ ...SEVERITY_STYLE.low, marginRight: 4 }}>{FLAG_LABEL[f] || f}</Pill>)) },
                      ]}
                      rows={regRows.map((r) => ({ ...r, key: `${r.stream}-${r.topup_id}` }))}
                      empty="No invoices match"
                    />
                  </div>
                )}
                {regTotal > PAGE_SIZE && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', padding: 12 }}>
                    <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={regPage === 1} onClick={() => setRegPage((p) => p - 1)}>Previous</button>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Page {regPage} of {Math.ceil(regTotal / PAGE_SIZE)} · {regTotal} total</span>
                    <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={regPage * PAGE_SIZE >= regTotal} onClick={() => setRegPage((p) => p + 1)}>Next</button>
                  </div>
                )}
              </div>
            )}

            {tab === 'exceptions' && (
              <Section title="Data-quality exceptions" hint="Resolve the high-severity items before filing. Each one is a row where the records disagree with each other or with GST requirements.">
                <Grid
                  cols={[
                    { key: 'severity', label: 'Severity', render: (r) => <Pill style={SEVERITY_STYLE[r.severity]}>{r.severity.toUpperCase()}</Pill> },
                    { key: 'message', label: 'Issue' },
                    { key: 'stream', label: 'Source', render: (r) => STREAM_LABEL[r.stream] || r.stream },
                    { key: 'topup_id', label: 'Record ID', num: true },
                    { key: 'invoice_number', label: 'Invoice no.', render: (r) => r.invoice_number || '—' },
                    { key: 'buyer_name', label: 'Buyer', render: (r) => r.buyer_name || '—' },
                    { key: 'total', label: 'Gross', num: true, render: (r) => inr(r.total) },
                    { key: 'taxable', label: 'Taxable (paid − GST)', num: true, render: (r) => inr(r.taxable) },
                    { key: 'printed_taxable', label: 'Printed on invoice', num: true, render: (r) => inr(r.printed_taxable) },
                  ]}
                  rows={report.exceptions.map((e, i) => ({ ...e, key: `${e.stream}-${e.topup_id}-${e.flag}-${i}` }))}
                  empty="No exceptions — records are consistent for this period"
                />
              </Section>
            )}

            {tab === 'usage' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: 16 }}>
                  <StatCard title="Net Credits Consumed" value={num(report.usage.net_credits_consumed)} subtitle="API usage + subscriptions, net of refunds" icon={Layers} color="var(--primary)" />
                  <StatCard title="Free Credits Granted" value={num(report.usage.free_credits_granted)} subtitle="Admin top-ups + promo freebies" icon={Tag} color="var(--info)" />
                  <StatCard title="Unused Credits (all tenants)" value={num(report.usage.wallet_float_credits)} subtitle="Current wallet float, as of now" icon={IndianRupee} color="var(--warning)" />
                </div>
                <Section title="Credits consumed by API / source" hint={report.usage.note}>
                  <Grid
                    cols={[{ key: 'code', label: 'API / source' }, { key: 'credits', label: 'Net credits', num: true, render: (r) => num(r.credits) }]}
                    rows={report.usage.by_api.map((u) => ({ ...u, key: u.code }))}
                  />
                </Section>
              </>
            )}

            <div style={{ fontSize: 11, color: 'var(--on-muted)', lineHeight: 1.6, marginTop: 8 }}>
              <b>Scope &amp; basis.</b> {report.basis} This page covers wallet recharge, Direct-MSME eligibility-fee and Virtual Workspace subscription invoices (subscriptions paid from wallet credits carry no new GST and are not listed). Input tax credit is not tracked. Figures are a working aid; confirm with your chartered accountant before filing.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminWalletRevenuePage;
