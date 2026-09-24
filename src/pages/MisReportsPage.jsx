import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Download, RefreshCw, GitBranch, Package, Landmark, TrendingUp, Users, HandCoins,
  ClipboardCheck, Receipt, Layers, Target, Wallet, PieChart, Clock, Database, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { listMisReports, getMisFilterOptions, getMisReport, exportMisReport } from '../api/misService';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';
import TableSkeleton from '../components/ui/TableSkeleton';
import EmptyState from '../components/ui/EmptyState';
import Panel from '../components/ui/Panel';

const REPORT_ICONS = {
  'case-pipeline': GitBranch,
  'product-wise': Package,
  'lender-wise': Landmark,
  'volume-trend': TrendingUp,
  'sales-team': Users,
  'sub-dsa-performance': HandCoins,
  pdd: ClipboardCheck,
  'part-disbursement': Receipt,
  'slab-achievement': Layers,
  'sales-incentive-ledger': Target,
  'sub-dsa-payout-ledger': Wallet,
  'revenue-profitability': PieChart,
  'case-ageing': Clock,
  'case-master': Database
};

// Full report names shown on the tabs and as the report heading.
const REPORT_TAB_LABELS = {
  'case-pipeline': 'Case Pipeline / Funnel MIS',
  'product-wise': 'Product-wise Business MIS',
  'lender-wise': 'Lender-wise Business MIS',
  'volume-trend': 'Volume & Disbursement Trend MIS',
  'sales-team': 'Sales Team Performance MIS',
  'sub-dsa-performance': 'Sub-DSA Partner Performance MIS',
  pdd: 'PDD MIS',
  'part-disbursement': 'Part Disbursement / Tranche Tracking MIS',
  'slab-achievement': 'Lender Commission Slab Achievement MIS',
  'sales-incentive-ledger': 'Sales Incentive Payout MIS',
  'sub-dsa-payout-ledger': 'Sub-DSA Payout Ledger MIS',
  'revenue-profitability': 'Revenue, Expense & Profitability MIS',
  'case-ageing': 'Case Ageing / TAT MIS',
  'case-master': 'Case / Customer Master MIS'
};
const reportTitle = (r) => (r ? REPORT_TAB_LABELS[r.id] || r.title : undefined);

// Relative column widths for the fixed table layout: the table always fills
// exactly its container (no sideways scrolling), so each column gets a share
// by what it holds — numbers/dates need less than free text or names.
const columnWeight = (c) => {
  if (c.type === 'currency') return 1.45;
  if (c.type === 'date') return 1.6;
  if (c.type === 'number') return 1.05;
  if (c.type === 'percent') return 1.15;
  const text = `${c.key} ${c.label}`;
  // Identifier-like values read badly when a wrap splits them mid-value.
  if (/email/i.test(text)) return 2.8;
  if (/\bpan\b/i.test(text)) return 1.95;
  if (/mobile|phone/i.test(text)) return 1.7;
  if (/\bid\b|_id|ref\b|invoice/i.test(text)) return 1.6;
  if (/name|customer|partner/i.test(text)) return 2.0;
  return /lender|product|stage|channel|status/i.test(text) ? 1.5 : 1.3;
};

const fmtCurrency = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const fmtNumber = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toLocaleString('en-IN');
};
const fmtPercent = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : `${(n * 100).toFixed(2)}%`;
};
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—');

const isNumericCol = (col) => ['currency', 'percent', 'number'].includes(col.type);
const cellClass = (col) => (isNumericCol(col) ? 'num' : col.type === 'date' ? 'date' : undefined);

// The report endpoints return raw enum values for basis / status / stage /
// channel columns (NET_DISBURSED, INVOICE_RAISED, SUB_DSA, PENDING...). Show
// them as readable labels: "Net Disbursed", "Invoice Raised", "Sub DSA",
// "Pending". Only whole-value UPPER_SNAKE enums are touched (letters only), so
// references/IDs with digits ("INV_2026_001") and names ("HDFC Bank") pass
// through unchanged.
const KEEP_UPPER = new Set(['PDD', 'DSA', 'TDS', 'GST', 'ITR', 'EMI', 'ROI', 'LAP', 'TAT', 'KYC', 'PAN', 'ESR', 'MSME', 'MIS', 'NA']);
const titleWord = (w) => (KEEP_UPPER.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase());
const ENUM_LIKE_COLUMN = /status|basis|stage|channel|trigger|type|level|flag/i;
function prettifyEnum(value, col) {
  if (/^[A-Z]+(?:_[A-Z]+)+$/.test(value)) return value.split('_').map(titleWord).join(' ');
  // A single all-caps word (PENDING, PAID) in an enum-style column reads
  // oddly next to "Net Disbursed" — same treatment there only.
  if (ENUM_LIKE_COLUMN.test(`${col.key} ${col.label}`) && /^[A-Z]{3,}$/.test(value)) return titleWord(value);
  return value;
}

function cellDisplay(value, col) {
  if (value === null || value === undefined || value === '') return '—';
  // Checked ahead of the generic string-passthrough below: a real Date
  // always arrives here as an ISO string — JSON has no Date type, so
  // res.json() on the backend already serialized it — not a JS Date
  // instance. None of this module's date columns ever carry a non-date
  // fallback string (they're always a real timestamp or null, already
  // handled above), so it's always safe to run every date column through
  // fmtDate regardless of its wire representation.
  if (col.type === 'date') return fmtDate(value);
  if (typeof value === 'string') return prettifyEnum(value, col); // pre-formatted / label / "n/a (...)" text passes through as-is
  switch (col.type) {
    case 'currency': return fmtCurrency(value);
    case 'percent': return fmtPercent(value);
    case 'number': return fmtNumber(value);
    default: return String(value);
  }
}

const STAGE_OPTIONS = [
  ['LEAD_CREATED', 'Lead Created'], ['DATA_COLLECTION', 'Data Collection'], ['INCOME_REVIEWED', 'Income Reviewed'],
  ['ESR_GENERATED', 'Login Done'], ['LEAD_SENT_TO_LENDER', 'Lead Sent'], ['IN_REVIEW', 'In Review'],
  ['APPROVED', 'Sanctioned'], ['REJECTED', 'Rejected'], ['PARTLY_DISBURSED', 'Partly Disbursed'],
  ['DISBURSED', 'Fully Disbursed'], ['CLOSED', 'Closed']
];

const STATUS_OPTIONS_BY_REPORT = {
  pdd: [['PENDING', 'Pending'], ['RECEIVED', 'Collected'], ['WAIVED', 'Waived']],
  'sales-incentive-ledger': [['CALCULATED', 'Calculated'], ['APPROVED', 'Approved'], ['PAID', 'Paid'], ['REJECTED', 'Rejected'], ['ON_HOLD', 'On Hold']],
  'sub-dsa-payout-ledger': [['DRAFT', 'Draft'], ['INVOICE_RAISED', 'Invoice Raised'], ['UNDER_REVIEW', 'Under Review'], ['RECONCILED', 'Reconciled'], ['PDD_PENDING', 'PDD Pending'], ['PAID', 'Paid'], ['REJECTED', 'Rejected']]
};

function todayIso() { return new Date().toISOString().split('T')[0]; }
function firstOfMonthIso() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }
function currentMonthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function defaultFiltersFor(filterKeys) {
  const f = {};
  filterKeys.forEach(key => {
    if (key === 'periodFrom') f[key] = firstOfMonthIso();
    else if (key === 'periodTo' || key === 'asOfDate') f[key] = todayIso();
    else if (key === 'periodMonth' || key === 'month') f[key] = currentMonthKey();
    else if (key === 'granularity') f[key] = 'MONTHLY';
    else f[key] = 'all';
  });
  return f;
}

export default function MisReportsPage() {
  const [reports, setReports] = useState([]);
  const [options, setOptions] = useState({ lenders: [], products: [], subDsaUsers: [], teamMembers: [], hierarchyLevels: [] });
  const [activeId, setActiveId] = useState(null);
  // Split into "draft" (what the controls show, updated on every keystroke)
  // and "applied" (what the last report fetch/export actually used). Only
  // appliedFilters feeds the effect below — editing a date field mid-way
  // through setting up several filters must not fire a request per change;
  // it should wait for an explicit Run, same as picking a new report edits
  // both and runs once with that report's defaults.
  const [draftFilters, setDraftFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Table vs stacked-card layout, decided from the width each column gets.
  const tableWrapRef = useRef(null);
  const [cardMode, setCardMode] = useState(false);
  const MIN_COLUMN_PX = 70;

  // Report tabs scroll sideways; the arrows show/hide with the scroll position.
  const navRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const updateTabArrows = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);
  const scrollTabs = (dir) => {
    const el = navRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 200), behavior: 'smooth' });
  };

  useEffect(() => {
    (async () => {
      try {
        const [reportList, filterOptions] = await Promise.all([listMisReports(), getMisFilterOptions()]);
        setReports(reportList.reports || []);
        setOptions(filterOptions);
        if (reportList.reports?.length) {
          const defaults = defaultFiltersFor(reportList.reports[0].filters);
          setActiveId(reportList.reports[0].id);
          setDraftFilters(defaults);
          setAppliedFilters(defaults);
        }
      } catch (e) {
        toast.error('Failed to load MIS Reports module');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeReport = useMemo(() => reports.find(r => r.id === activeId), [reports, activeId]);

  useEffect(() => {
    const el = tableWrapRef.current;
    const cols = data?.columns?.length;
    if (!el || !cols) return undefined;
    const check = () => setCardMode(el.clientWidth / cols < MIN_COLUMN_PX);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // Keep the arrows accurate on load/resize, and bring the selected tab into
  // view when it changes (e.g. picked near the edge of the strip).
  useEffect(() => {
    updateTabArrows();
    window.addEventListener('resize', updateTabArrows);
    return () => window.removeEventListener('resize', updateTabArrows);
  }, [updateTabArrows, reports, loading]);
  useEffect(() => {
    const el = navRef.current;
    const tab = el?.querySelector('.report-nav-item.active');
    if (!el || !tab) return;
    const left = tab.offsetLeft - 40;
    const right = tab.offsetLeft + tab.offsetWidth + 40;
    if (left < el.scrollLeft) el.scrollTo({ left: Math.max(left, 0), behavior: 'smooth' });
    else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth, behavior: 'smooth' });
  }, [activeId, reports, loading]);
  const hasPendingFilterChanges = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
    [draftFilters, appliedFilters]
  );

  const fetchReport = useCallback(async () => {
    if (!activeId) return;
    try {
      setFetching(true);
      const result = await getMisReport(activeId, appliedFilters);
      setData(result);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load report');
      setData(null);
    } finally {
      setFetching(false);
    }
  }, [activeId, appliedFilters]);

  // Fires only when a report is first selected (activeId) or when Run
  // Report is clicked (appliedFilters) — never on a bare draft edit.
  useEffect(() => { fetchReport(); }, [fetchReport]);

  const selectReport = (id) => {
    const rep = reports.find(r => r.id === id);
    const defaults = defaultFiltersFor(rep?.filters || []);
    setActiveId(id);
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
  };

  const runReport = () => setAppliedFilters(draftFilters);

  const handleExport = async () => {
    try {
      setExporting(true);
      // Exports whatever's currently on screen (appliedFilters), not any
      // not-yet-run draft edit sitting in the filter controls.
      await exportMisReport(activeId, appliedFilters);
    } catch (e) {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const renderFilterControl = (key) => {
    const commonProps = {
      className: 'form-control', style: { padding: '0 9px', fontSize: 11.5, height: 32 },
    };
    const value = draftFilters[key] ?? 'all';
    const set = (v) => setDraftFilters(prev => ({ ...prev, [key]: v }));

    if (['periodFrom', 'periodTo', 'asOfDate'].includes(key)) {
      return <input type="date" {...commonProps} value={value === 'all' ? '' : value} onChange={e => set(e.target.value)} />;
    }
    if (['periodMonth', 'month'].includes(key)) {
      return <input type="month" {...commonProps} value={value === 'all' ? '' : value} onChange={e => set(e.target.value)} />;
    }
    if (key === 'granularity') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="DAILY">Daily</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      );
    }
    if (key === 'product') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          {options.products.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      );
    }
    if (key === 'lenderId') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          {options.lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      );
    }
    if (key === 'subDsaUserId') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          {options.subDsaUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      );
    }
    if (key === 'sourcingPartnerId') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          {options.teamMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          {options.subDsaUsers.map(u => <option key={u.id} value={u.id}>{u.name} (Sub-DSA)</option>)}
        </select>
      );
    }
    if (key === 'hierarchyLevel') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          {options.hierarchyLevels.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      );
    }
    if (key === 'sourcingChannel') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          <option value="SALES_TEAM">Sales Team</option>
          <option value="SUB_DSA">Sub-DSA</option>
        </select>
      );
    }
    if (key === 'stage') {
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          {STAGE_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      );
    }
    if (key === 'status') {
      const opts = STATUS_OPTIONS_BY_REPORT[activeId] || [];
      return (
        <select {...commonProps} value={value} onChange={e => set(e.target.value)}>
          <option value="all">All</option>
          {opts.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      );
    }
    return null;
  };

  const FILTER_LABELS = {
    periodFrom: 'Period From', periodTo: 'Period To', asOfDate: 'Report As Of Date', periodMonth: 'Payout Period',
    month: 'Month', granularity: 'Granularity', product: 'Product', lenderId: 'Lender', subDsaUserId: 'Sub-DSA Partner',
    sourcingPartnerId: 'Sourcing Partner', hierarchyLevel: 'Hierarchy Level', sourcingChannel: 'Sourcing Channel',
    stage: 'Stage', status: 'Status'
  };

  if (loading) return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }} role="status" aria-label="Loading MIS reports">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
        <PageHeader compact title="MIS Reports" subtitle="Filterable, exportable detail behind every headline number on the platform" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ borderRadius: 0, padding: '10px 12px', display: 'flex', gap: 10, overflow: 'hidden' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} width={150 + ((i * 37) % 70)} height={26} style={{ flexShrink: 0 }} />
            ))}
          </div>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ borderRadius: 0 }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
                <Skeleton width={180} height={15} style={{ marginBottom: 8 }} />
                <Skeleton width={300} height={11} />
              </div>
              <div style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ minWidth: 140 }}>
                    <Skeleton width={80} height={10} style={{ marginBottom: 6 }} />
                    <Skeleton width={140} height={34} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <Skeleton width={110} height={34} />
                  <Skeleton width={120} height={34} />
                </div>
              </div>
            </div>
            <div className="card" style={{ borderRadius: 0 }}>
              <TableSkeleton rows={8} columns={6} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ActiveIcon = REPORT_ICONS[activeId];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        /* Typeface + type scale for this page. Inter is built for dense UI and
           numeric tables (proper tabular figures); sizes are a notch below the
           app default so wide reports stay readable without crowding. */
        .mis-page, .mis-page button, .mis-page input, .mis-page select, .mis-page table {
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
        }
        .mis-page .btn { font-size: 11px; }
        .mis-page .card h3 { font-size: 13px !important; }
        .mis-page .card h3 + p { font-size: 10.5px !important; }
        .mis-page .num { font-feature-settings: 'tnum' 1; }
        /* House style: sharp corners. The global .card/.btn/.form-control
           tokens are rounded (var(--radius)); every other data-heavy page
           overrides them to 0 the same way (see EsrPage / CaseDetailPage). */
        .mis-page .card,
        .mis-page .btn,
        .mis-page .form-control,
        .mis-page .table-wrapper,
        .mis-page .report-nav-panel,
        .mis-page .report-nav-item,
        .mis-page input,
        .mis-page select,
        .mis-page button {
          border-radius: 0 !important;
        }
        /* Report picker: one row of tabs above the report that scrolls
           sideways (arrows + swipe) instead of taking a column beside it. */
        .mis-page .report-tabs { display: flex; align-items: stretch; border: 1px solid var(--border); background: var(--bg-surface, transparent); }
        .mis-page .report-nav { flex: 1; min-width: 0; display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .mis-page .report-nav::-webkit-scrollbar { display: none; }
        .mis-page .report-nav-item {
          flex-shrink: 0; white-space: nowrap; display: flex; align-items: center; gap: 8px;
          padding: 11px 16px; border: none; border-bottom: 2px solid transparent; background: none; cursor: pointer;
          font-size: 11.5px; font-weight: 600; color: var(--text-secondary);
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .mis-page .report-nav-item svg { flex-shrink: 0; opacity: 0.75; }
        .mis-page .report-nav-item.active { color: var(--primary); background: var(--primary-subtle); border-bottom-color: var(--primary); }
        .mis-page .report-nav-item.active svg { opacity: 1; }
        .mis-page .report-nav-item:hover:not(.active) { background: var(--bg-elevated); }
        .mis-page .tabs-arrow { flex-shrink: 0; width: 34px; display: flex; align-items: center; justify-content: center; border: none; background: var(--bg-elevated); color: var(--text-secondary); cursor: pointer; }
        .mis-page .tabs-arrow.left { border-right: 1px solid var(--border); }
        .mis-page .tabs-arrow.right { border-left: 1px solid var(--border); }
        .mis-page .tabs-arrow:hover:not(:disabled) { color: var(--primary); }
        .mis-page .tabs-arrow:disabled { opacity: 0.35; cursor: default; }
        /* The table fits its container instead of scrolling sideways: cells
           wrap (overflow-wrap:anywhere lets even a long word give way as a
           last resort), numbers/dates stay on one line, padding is compact. */
        .mis-page table { width: 100%; border-collapse: collapse; font-size: 10.5px; table-layout: fixed; }
        .mis-page th, .mis-page td { padding: 8px 6px; text-align: left; border-bottom: 1px solid var(--border); white-space: normal; overflow-wrap: anywhere; vertical-align: top; }
        .mis-page td { font-size: 10.5px; }
        .mis-page td.num, .mis-page td.date { white-space: nowrap; overflow-wrap: normal; }
        .mis-page th { background: var(--bg-elevated); font-weight: 600; color: var(--text-secondary); font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; line-height: 1.25; position: sticky; top: 0; vertical-align: bottom; }
        .mis-page tbody tr:hover td { background: var(--bg-elevated); }
        .mis-page th.num, .mis-page td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .mis-page tr.totals-row td { font-weight: 700; background: var(--bg-elevated); border-top: 2px solid var(--border-strong, var(--border)); }
        .mis-page .result-meta { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 7px 14px; border-bottom: 1px solid var(--border); font-size: 10.5px; font-weight: 600; color: var(--text-tertiary); }
        .mis-page .result-meta-stale { color: var(--warning, var(--primary)); }
        .mis-page .filter-bar-actions .btn { height: 34px; }
        .mis-page tr.totals-row:hover td { background: var(--bg-elevated); }
        .mis-page .filter-field .form-label { display: block; margin-bottom: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); }
        /* When a report's columns would each get too little room to read (see
           the width check in the component), its rows become stacked
           label/value cards instead of a squeezed table. */
        .mis-page .table-wrapper.cards { max-height: none !important; }
        .mis-page .table-wrapper.cards table, .mis-page .table-wrapper.cards thead, .mis-page .table-wrapper.cards tbody,
        .mis-page .table-wrapper.cards tr, .mis-page .table-wrapper.cards td { display: block; width: 100%; }
        .mis-page .table-wrapper.cards thead { display: none; }
        .mis-page .table-wrapper.cards tbody tr { border-bottom: 1px solid var(--border); padding: 6px 0; }
        .mis-page .table-wrapper.cards tbody tr.totals-row { background: var(--bg-elevated); }
        .mis-page .table-wrapper.cards td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 14px !important; border-bottom: none !important; text-align: right; white-space: normal !important; }
        .mis-page .table-wrapper.cards td::before { content: attr(data-label); font-weight: 700; color: var(--text-secondary); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; flex-shrink: 0; }
        @media (max-width: 768px) {
          .mis-page { padding: 80px 16px 16px !important; }
          /* Tabs stay a swipeable row on phones; arrows aren't needed. */
          .mis-page .tabs-arrow { display: none; }
          .mis-page .report-nav-item { padding: 12px 14px; }
          /* 2-per-row grid instead of each filter field stacking full-width —
             matches the same density fix used on the other Financials pages. */
          .mis-page .filter-bar { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px 10px !important; align-items: end; }
          .mis-page .filter-field { min-width: 0 !important; }
          .mis-page .filter-bar-actions { grid-column: 1 / -1; display: flex; gap: 8px; margin-top: 2px; }
          .mis-page .filter-bar-actions button { flex: 1; justify-content: center; margin-left: 0 !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }} className="mis-page">
        <PageHeader compact title="MIS Reports" subtitle="Filterable, exportable detail behind every headline number on the platform" />

        <div className="layout" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="report-tabs report-nav-panel" style={{ borderRadius: 0 }}>
            <button type="button" className="tabs-arrow left" onClick={() => scrollTabs(-1)} disabled={!canScrollLeft} aria-label="Scroll reports left">
              <ChevronLeft size={16} />
            </button>
            <div className="report-nav" ref={navRef} onScroll={updateTabArrows} role="tablist">
              {reports.map(r => {
                const Icon = REPORT_ICONS[r.id];
                return (
                  <button key={r.id} role="tab" aria-selected={r.id === activeId} className={`report-nav-item ${r.id === activeId ? 'active' : ''}`} onClick={() => selectReport(r.id)} title={r.description}>
                    {Icon && <Icon size={15} />}
                    <span>{reportTitle(r)}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="tabs-arrow right" onClick={() => scrollTabs(1)} disabled={!canScrollRight} aria-label="Scroll reports right">
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel
              icon={ActiveIcon}
              title={reportTitle(activeReport)}
              subtitle={activeReport?.description}
              bodyPadding={14}
            >
              <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                {(activeReport?.filters || []).map(key => (
                  <div key={key} className="filter-field" style={{ minWidth: 140 }}>
                    <label className="form-label">{FILTER_LABELS[key] || key}</label>
                    {renderFilterControl(key)}
                  </div>
                ))}
                <div className="filter-bar-actions" style={{ display: 'flex', gap: 8, marginLeft: (activeReport?.filters?.length ? 'auto' : 0) }}>
                  <button
                    className={`btn btn-sm ${hasPendingFilterChanges ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={runReport}
                    disabled={fetching}
                    title={hasPendingFilterChanges ? 'Filter changes not yet applied — click to run' : 'Re-run with current filters'}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw size={14} /> Run Report{hasPendingFilterChanges ? ' •' : ''}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting || !data?.rows?.length} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download size={14} /> {exporting ? 'Exporting…' : 'Export Excel'}
                  </button>
                </div>
              </div>
            </Panel>

            <Panel bodyPadding={0} style={{ flex: 1 }}>
              {fetching ? (
                <div role="status" aria-label="Loading report"><TableSkeleton rows={8} columns={Math.min(6, activeReport?.filters?.length ? 6 : 5)} /></div>
              ) : !data || data.rows.length === 0 ? (
                <EmptyState title="No data for this filter selection" description="Try widening the period or clearing a filter." />
              ) : (
                <>
                  <div className="result-meta">
                    <span>{data.rows.length.toLocaleString('en-IN')} {data.rows.length === 1 ? 'row' : 'rows'}</span>
                    {hasPendingFilterChanges && <span className="result-meta-stale">Filters changed — click Run Report to refresh</span>}
                  </div>
                  <div ref={tableWrapRef} className={`table-wrapper${cardMode ? ' cards' : ''}`} style={{ overflowX: 'auto', maxHeight: 620, overflowY: 'auto' }}>
                    <table>
                      <colgroup>
                        {(() => {
                          const w = data.columns.map(columnWeight);
                          const total = w.reduce((a, b) => a + b, 0);
                          return data.columns.map((c, i) => <col key={c.key} style={{ width: `${(w[i] / total) * 100}%` }} />);
                        })()}
                      </colgroup>
                      <thead>
                        <tr>{data.columns.map(c => <th key={c.key} className={isNumericCol(c) ? 'num' : undefined}>{c.label}</th>)}</tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row, i) => (
                          <tr key={i}>
                            {data.columns.map(c => <td key={c.key} data-label={c.label} className={cellClass(c)}>{cellDisplay(row[c.key], c)}</td>)}
                          </tr>
                        ))}
                        {data.totals && (
                          <tr className="totals-row">
                            {data.columns.map(c => <td key={c.key} data-label={c.label} className={cellClass(c)}>{cellDisplay(data.totals[c.key], c)}</td>)}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
