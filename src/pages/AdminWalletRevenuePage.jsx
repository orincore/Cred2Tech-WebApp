import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Receipt, FileSpreadsheet, AlertTriangle, Search, Download, ChevronDown,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CustomSelect from '../components/CustomSelect';
import { formatDateTime } from '../utils/helpers';
import { walletRevenueService } from '../api/walletRevenueService';
import { LineChart, BarChart, DonutChart, ChartCard, ChartGrid, PALETTE, inrShort } from '../components/charts/SvgCharts';

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
const STREAM_LABEL = { WALLET: 'Wallet recharge', MSME_FEE: 'MSME fee', SUBSCRIPTION: 'Virtual Workspace', STORAGE: 'Storage plan' };
const STREAM_COLOR = { WALLET: 'var(--primary)', MSME_FEE: 'var(--success)', SUBSCRIPTION: 'var(--warning)', STORAGE: 'var(--info, #7c5cff)' };
const STREAMS = ['WALLET', 'MSME_FEE', 'SUBSCRIPTION', 'STORAGE'];
// Bytes -> a readable size (1 GB = 1024³ B, the same unit the storage limit uses).
const fmtBytes = (b) => {
  const n = Number(b || 0);
  if (n >= 1024 ** 4) return `${(n / 1024 ** 4).toFixed(2)} TB`;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};
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
  { id: 'refunds', label: 'Refunds' },
  { id: 'register', label: 'Invoice Register' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'usage', label: 'Usage (Credits)' },
  { id: 'vendor_spend', label: 'Vendor Spend' },
];

// Clean, rate-card names for the Vendor Spend tab (the backend stores messy /
// null api_name values). Keyed by api_code; falls back to the stored name,
// then the raw code.
const VENDOR_SPEND_API_LABELS = {
  BUREAU_PULL: 'Cibil Report',
  BANK_ANALYSIS: 'Bank Statement Analysis',
  GST_FETCH: 'GST Analysis',
  ITR_ANALYTICS: 'ITR Analysis',
  PAN_FETCH: 'PAN All-in-One',
  PROFILE_ADVANCE: 'Mobile Number Verification',
  SALARY_OCR: 'Salary Slip Reading',
  ESR_GENERATION_SALARIED: 'Eligibility Report — Salaried',
  ESR_GENERATION_MSME: 'Eligibility Report — Self-Employed',
  ITR_FETCH: 'ITR Analysis (legacy)',
  DIRECT_MSME_ELIGIBILITY: 'Direct MSME Eligibility',
  VIRTUAL_WORKSPACE_SUBSCRIPTION: 'Virtual Workspace',
};
// Where the same api_code is a different product per vendor. "PAN All-in-One" is BEFISC's
// product only; what Signzy provides for PAN_FETCH is the PAN to GST list lookup.
const VENDOR_SPEND_API_LABELS_BY_VENDOR = { 'PAN_FETCH|SIGNZY': 'PAN to GST List' };
const vendorSpendApiLabel = (a) => VENDOR_SPEND_API_LABELS_BY_VENDOR[`${a?.api_code}|${a?.vendor || a?.display_vendor}`]
  || VENDOR_SPEND_API_LABELS[a?.api_code] || a?.api_name || a?.api_code || '—';
// Full "API · vendor" label for chart bars. The same API can be served by two vendors
// (Cibil Report by Signzy and by BEFISC, PAN All-in-One likewise), so a name alone gives
// identical bars. Shown in full: the chart wraps long labels (BarChart wrapLabels).
const vendorSpendApiChartLabel = (a) => `${vendorSpendApiLabel(a)} · ${vendorSpendVendorLabel(a?.display_vendor)}`;
const VENDOR_SPEND_VENDOR_LABELS = { SIGNZY: 'Signzy', BEFISC: 'BEFISC', SCOREME: 'ScoreMe', Cred2Tech: 'Cred2Tech', DEFAULT: 'Internal / platform' };
const vendorSpendVendorLabel = (v) => VENDOR_SPEND_VENDOR_LABELS[v] || v;
// Where a vendor call was made from — production, the shared dev server, or a developer's machine.
const VENDOR_SPEND_ENV_ORDER = ['production', 'development', 'local'];
const VENDOR_SPEND_ENV_LABELS = { production: 'Production', development: 'Dev server', local: 'Localhost' };
const vendorSpendEnvLabel = (e) => VENDOR_SPEND_ENV_LABELS[e] || e;
const EMPTY_ENV_TOTALS = { calls: 0, success_calls: 0, failed_calls: 0, billable_events: 0, unpriced_billable_events: 0, cost_total: 0, cost_base: 0, cost_gst: 0, vendors: [] };
const fmtIstDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const SEVERITY_STYLE = {
  high: { color: 'var(--error)', bg: 'var(--error-bg)' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  low: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
};
const FLAG_LABEL = {
  NO_INVOICE: 'No invoice', GST_NOT_RECORDED: 'GST not recorded', INVOICE_TAXABLE_MISMATCH: 'Taxable mismatch',
  GST_RATE_MISMATCH: 'GST ≠ rate', REFUND_REVIEW: 'Refund review',
  STATE_UNKNOWN: 'State unknown', INVALID_GSTIN: 'Bad GSTIN', INVOICE_NUMBER_TOO_LONG: 'No. > 16 chars', NO_BUYER_SNAPSHOT: 'No snapshot',
  TAX_HEADS_MISMATCH: 'Heads ≠ GST', STATE_DEFAULTED: 'State defaulted', TAX_SPLIT_NOT_RECORDED: 'Not split',
};

// "2026-10" -> "Oct 26" for chart axes.
const monthShort = (key) => {
  const [y, m] = String(key).split('-').map(Number);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(m || 1) - 1]} ${String(y).slice(2)}`;
};
// The GST-quarter label ("2026-27 Q3") of a "YYYY-MM" month, matching the backend's `quarterly` rows.
const quarterLabelOf = (key) => {
  const [y, m] = String(key).split('-').map(Number);
  const fyStart = m >= 4 ? y : y - 1;
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 ? 3 : 4;
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')} Q${q}`;
};
const REFUND_STATUS_STYLE = {
  PROCESSED: { label: 'Refunded', color: 'var(--success)', bg: 'var(--success-bg)' },
  SUBMITTED: { label: 'With Razorpay', color: 'var(--info)', bg: 'var(--info-bg)' },
  PENDING: { label: 'Sending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  NEEDS_REVIEW: { label: 'Needs review', color: 'var(--error)', bg: 'var(--error-bg)' },
  FAILED: { label: 'Failed', color: 'var(--error)', bg: 'var(--error-bg)' },
};

// Every control in the page's toolbars (selects, inputs, buttons): one slim height so a toolbar fits on one line.
const compactField = {
  border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--surface)', color: 'var(--text-primary)',
  fontSize: 11.5, fontWeight: 600, padding: '0 8px', height: 26, lineHeight: '24px', outline: 'none', boxSizing: 'border-box',
  whiteSpace: 'nowrap', flexShrink: 0,
};
// A toolbar that stays on one line (scrolls sideways on a very narrow screen rather than wrapping to a second row).
const toolbarRow = { display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 6, overflowX: 'auto', minWidth: 0 };

// ── export: any table on the page can be downloaded as a presented Excel sheet, exactly as shown ──
// The page provides `download(tables)` and a `subtitle` (period); every Section shows an Export button when a
// Grid inside it has registered itself, and sends the tables with the user's current filter and sort applied.
const ExportContext = createContext(null);
const SectionContext = createContext(null);

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_LABEL = /(₹|amount|taxable|gst|cgst|sgst|igst|gross|total|value|revenue|receipt|billed|refunded|net\b|fee|price|discount|mrr|invoice value|turnover|paid)/i;

/** One Grid -> one table for the Excel export. Raw values, typed columns; formatting is the workbook's job. */
function gridToTable({ title, subtitle, cols, rows, foot }) {
  const usable = cols.filter((c) => c.label && c.export !== false);
  // The raw value behind a cell; a computed column (no `row[key]`) falls back to its formatted text.
  const rawOf = (c, r) => {
    const v = c.exportValue ? c.exportValue(r) : r[c.key];
    if (v === undefined && c.render) { const t = cellText(c, r); return t === '' ? null : t; }
    return v;
  };
  const columns = usable.map((c) => {
    const raws = rows.map((r) => rawOf(c, r));
    const present = raws.filter((v) => v !== null && v !== undefined && v !== '' && v !== '—');
    const strs = present.filter((v) => typeof v === 'string');
    let type = 'text';
    if (present.length && present.every((v) => typeof v === 'string' && ISO_DATETIME.test(v))) type = 'datetime';
    else if (present.length && present.every((v) => typeof v === 'string' && ISO_DATE.test(v))) type = 'date';
    else if (present.length && present.every((v) => toSortable(v) !== null && typeof toSortable(v) === 'number')) {
      const allInt = present.every((v) => Number.isInteger(toSortable(v)));
      if (strs.some((s) => s.includes('₹')) || (!allInt) || (MONEY_LABEL.test(c.label) && !/credits|calls|accounts|invoices|number|count|#/i.test(c.label))) type = 'money';
      else if (strs.some((s) => s.includes('%')) || /%/.test(c.label)) type = 'pct';
      else type = allInt ? 'int' : 'number';
    }
    const footHas = foot && foot[c.key] !== undefined && foot[c.key] !== '' && foot[c.key] !== null;
    return { c, type, total: type === 'money' || (footHas && (type === 'int' || type === 'number')) };
  });
  const cell = (c, type, r) => {
    let v = rawOf(c, r);
    if (Array.isArray(v)) v = v.join(', ');
    if (v === null || v === undefined || v === '' || v === '—') return null;
    if (type === 'money' || type === 'int' || type === 'number' || type === 'pct') { const n = toSortable(v); return typeof n === 'number' ? n : String(v); }
    if (type === 'date' || type === 'datetime') return v;
    if (typeof v === 'object') return cellText(c, r) || null; // JSX cell: fall back to its plain text
    return String(v);
  };
  return {
    title,
    subtitle,
    columns: columns.map(({ c, type, total }) => ({ label: c.label, type, total })),
    rows: rows.map((r) => columns.map(({ c, type }) => cell(c, type, r))),
  };
}

const inr = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const num = (n) => Number(n || 0).toLocaleString('en-IN');

const th = { textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)', padding: '10px 12px', borderBottom: '1px solid var(--outline)', whiteSpace: 'nowrap', background: 'var(--surface)', position: 'sticky', top: 0 };
const td = { fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', padding: '10px 12px', borderBottom: '1px solid var(--outline)', whiteSpace: 'nowrap' };
const right = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const Section = ({ title, hint, children }) => {
  const exportCtx = useContext(ExportContext);
  const grids = useRef(new Map()); // id -> () => table, for every Grid inside this section
  const [gridCount, setGridCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const sectionCtx = useMemo(() => ({
    title: typeof title === 'string' ? title : 'Table',
    register: (id, getTable) => { grids.current.set(id, getTable); setGridCount(grids.current.size); return () => { grids.current.delete(id); setGridCount(grids.current.size); }; },
  }), [title]);

  const exportNow = async () => {
    if (!exportCtx || busy) return;
    const tables = [...grids.current.values()].map((get) => get()).filter((t) => t && t.rows.length);
    if (!tables.length) { toast('Nothing to export in this table'); return; }
    setBusy(true);
    try { await exportCtx.download(typeof title === 'string' ? title : 'Export', tables); toast.success('Excel report downloaded'); }
    catch { toast.error('Failed to export'); }
    finally { setBusy(false); }
  };

  return (
    <SectionContext.Provider value={sectionCtx}>
      <div className="card" style={{ padding: 0, borderRadius: 0, marginBottom: 16 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>{title}</div>
            {hint && <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
          </div>
          {exportCtx && gridCount > 0 && (
            <button type="button" onClick={exportNow} disabled={busy} title="Download this table as a formatted Excel report (with your current filter and sort)" style={{ ...compactField, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              <Download size={12} /> {busy ? 'Preparing…' : 'Excel'}
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>{children}</div>
      </div>
    </SectionContext.Provider>
  );
};

// A cell's value for sorting: numbers stay numbers, money / percent strings ("₹1,200.00", "−5.2%")
// are read as numbers, an empty value or a dash sorts last, anything else sorts as text.
const toSortable = (v) => {
  if (v === null || v === undefined || v === '' || v === '—') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/[₹,%\s]/g, '').replace('−', '-');
  return /^[-+]?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : v.toLowerCase();
};
const compareSortable = (a, b) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // empty values always last, whichever direction
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true });
};
// Text of a cell for filtering: the column's own `text()`, else the formatted output if it is plain text, else the raw value.
const cellText = (c, r) => {
  if (c.text) return String(c.text(r) ?? '');
  const rendered = c.render ? c.render(r) : null;
  if (typeof rendered === 'string' || typeof rendered === 'number') return String(rendered);
  const raw = r[c.key];
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
};
const SortMark = ({ dir }) => <span aria-hidden style={{ marginLeft: 4, fontSize: 9, opacity: dir ? 1 : 0.3 }}>{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</span>;

/**
 * Generic dense table with sorting and filtering built in.
 *  - `cols`: [{ key, label, num?, render?, sort?(row), text?(row), filterBy?, sortable? }]
 *  - Click a header to sort (ascending → descending → original order). `sort(row)` gives the sort value when the
 *    cell's raw `row[key]` is not it. Columns marked `filterBy` get a dropdown of their distinct values.
 *  - A search box filters across every column once there are more than 6 rows (`filterable` forces it on or off).
 *  - `sortable={false}` keeps a fixed order (statement-style tables where the row order is the meaning).
 *  - `server={{ sort: {key, dir}, onSort(key) }}` hands sorting to the caller (for server-paged data); the
 *    caller also does its own filtering, so the built-in search is off.
 *  - `foot` is an optional totals row; it always covers every row, not just the filtered ones.
 */
const Grid = ({ cols, rows, foot, empty = 'No data for this period', sortable = true, filterable, server, exportTitle }) => {
  const [localSort, setLocalSort] = useState(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState({});

  const canSort = sortable && (server || rows.length > 1);
  const showSearch = !server && (filterable ?? rows.length > 6);
  const dropdownCols = server ? [] : cols.filter((c) => c.filterBy);
  const sort = server ? server.sort : localSort;

  const options = useMemo(() => Object.fromEntries(dropdownCols.map((c) => [c.key, [...new Set(rows.map((r) => cellText(c, r)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))])), [rows, dropdownCols.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = query.trim().toLowerCase();
  const filtering = Boolean(needle) || Object.values(picked).some(Boolean);

  const shown = useMemo(() => {
    let out = rows;
    if (!server) {
      if (needle) out = out.filter((r) => cols.some((c) => cellText(c, r).toLowerCase().includes(needle)));
      dropdownCols.forEach((c) => { if (picked[c.key]) out = out.filter((r) => cellText(c, r) === picked[c.key]); });
      const col = localSort && cols.find((c) => c.key === localSort.key);
      if (col) {
        const sign = localSort.dir === 'asc' ? 1 : -1;
        out = out.map((r, i) => ({ r, i, v: toSortable(col.sort ? col.sort(r) : r[col.key]) }))
          .sort((a, b) => (a.v === null || b.v === null ? compareSortable(a.v, b.v) : compareSortable(a.v, b.v) * sign) || a.i - b.i)
          .map((x) => x.r);
      }
    }
    return out;
  }, [rows, cols, needle, picked, localSort, server]); // eslint-disable-line react-hooks/exhaustive-deps

  // Let the surrounding Section export this table as shown: filtered, sorted, in the visible order.
  const sectionCtx = useContext(SectionContext);
  const gridId = useId();
  const exportRef = useRef(null);
  exportRef.current = () => {
    const notes = [];
    if (needle) notes.push(`search "${query.trim()}"`);
    dropdownCols.forEach((c) => { if (picked[c.key]) notes.push(`${c.label}: ${picked[c.key]}`); });
    if (filtering) notes.push(`${shown.length} of ${rows.length} rows`);
    const sortCol = localSort && cols.find((c) => c.key === localSort.key);
    if (sortCol) notes.push(`sorted by ${sortCol.label} (${localSort.dir === 'asc' ? 'ascending' : 'descending'})`);
    return gridToTable({ title: exportTitle || sectionCtx?.title || 'Table', subtitle: notes.length ? `Filtered view: ${notes.join(' · ')}` : '', cols, rows: shown, foot });
  };
  useEffect(() => (sectionCtx && !server ? sectionCtx.register(gridId, () => exportRef.current()) : undefined), [sectionCtx, gridId, server]);

  const onHeader = (c) => {
    if (server) { server.onSort(c.key); return; }
    setLocalSort((s) => {
      if (!s || s.key !== c.key) return { key: c.key, dir: c.num ? 'desc' : 'asc' };
      const first = c.num ? 'desc' : 'asc';
      return s.dir === first ? { key: c.key, dir: first === 'asc' ? 'desc' : 'asc' } : null;
    });
  };

  const showBar = showSearch || dropdownCols.length > 0;
  return (
    <>
      {showBar && (
        <div style={{ position: 'sticky', left: 0, ...toolbarRow, padding: '6px 10px', borderBottom: '1px solid var(--outline)', background: 'var(--surface)' }}>
          {showSearch && (
            <div style={{ position: 'relative', flex: '0 1 200px', minWidth: 110 }}>
              <Search size={12} color="var(--text-tertiary)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="text" aria-label="Filter rows" placeholder="Filter rows…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }} />
            </div>
          )}
          {dropdownCols.map((c) => (
            <CustomSelect compact menuMinWidth={190} key={c.key} style={{ ...compactField, maxWidth: 150 }} value={picked[c.key] || ''} onChange={(e) => setPicked((p) => ({ ...p, [c.key]: e.target.value }))}>
              <option value="">{c.label}</option>
              {options[c.key].map((o) => <option key={o} value={o}>{o}</option>)}
            </CustomSelect>
          ))}
          {filtering && (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)' }}>{shown.length} of {rows.length}{foot ? ' · totals row covers all rows' : ''}</span>
              <button type="button" onClick={() => { setQuery(''); setPicked({}); }} style={{ ...compactField, cursor: 'pointer', fontWeight: 700 }}>Clear</button>
            </>
          )}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map((c) => {
              const active = sort && sort.key === c.key;
              const can = canSort && c.sortable !== false;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onClick={can ? () => onHeader(c) : undefined}
                  title={can ? 'Click to sort' : undefined}
                  style={{ ...th, ...(c.num ? right : {}), ...(can ? { cursor: 'pointer', userSelect: 'none' } : {}), ...(active ? { color: 'var(--primary)' } : {}) }}
                >
                  {c.label}{can && <SortMark dir={active ? sort.dir : null} />}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && <tr><td colSpan={cols.length} style={{ ...td, textAlign: 'center', color: 'var(--on-muted)', padding: 24 }}>{filtering ? 'No rows match the filter' : empty}</td></tr>}
          {shown.map((r, i) => (
            <tr key={r.key ?? i}>
              {cols.map((c) => <td key={c.key} style={{ ...td, ...(c.num ? right : {}) }}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
          {foot && (
            <tr>{cols.map((c) => <td key={c.key} style={{ ...td, ...(c.num ? right : {}), fontWeight: 800, background: 'var(--bg-elevated)' }}>{foot[c.key] ?? ''}</td>)}</tr>
          )}
        </tbody>
      </table>
    </>
  );
};

// GST by head: CGST 9% + SGST 9% when the buyer is in Karnataka, IGST 18% for any other state
// (decided per invoice by the backend). `unsplit_gst` is GST on invoices issued before the
// heads were shown; that column appears only when the period has such invoices.
const gstHeadCols = (showUnsplit) => [
  { key: 'cgst', label: 'CGST (9%)', num: true, render: (r) => inr(r.cgst) },
  { key: 'sgst', label: 'SGST (9%)', num: true, render: (r) => inr(r.sgst) },
  { key: 'igst', label: 'IGST (18%)', num: true, render: (r) => inr(r.igst) },
  ...(showUnsplit ? [{ key: 'unsplit_gst', label: 'GST not split', num: true, render: (r) => inr(r.unsplit_gst) }] : []),
  { key: 'gst', label: 'GST total', num: true, render: (r) => inr(r.gst) },
];
const taxCols = (showUnsplit) => [
  { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
  ...gstHeadCols(showUnsplit),
  { key: 'total', label: 'Gross', num: true, render: (r) => inr(r.total) },
];
const taxFoot = (t) => ({
  taxable: inr(t.taxable), cgst: inr(t.cgst), sgst: inr(t.sgst), igst: inr(t.igst), unsplit_gst: inr(t.unsplit_gst), gst: inr(t.gst), total: inr(t.total),
});

const Pill = ({ children, style }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', ...style }}>{children}</span>
);

// A slim summary tile: one-line label, one-line value, one-line detail. Used for the strip at the top of
// the page, where the full-size StatCard took far more room than the figures need.
const CompactStat = ({ label, value, sub, color = 'var(--primary)', title }) => (
  <div title={title} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', borderLeft: `3px solid ${color}`, padding: '7px 10px', minWidth: 0 }}>
    <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
    {value === null || value === undefined
      ? <div className="skeleton" style={{ height: 16, width: '55%', margin: '4px 0 3px' }} />
      : <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--on-surface)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</div>}
    <div style={{ fontSize: 10, color: 'var(--on-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 13 }}>{sub}</div>
  </div>
);

// Used only if the sheet list cannot be loaded; the server's list is the source of truth.
const FALLBACK_SECTIONS = [
  { name: 'Dashboard', group: 'Overview' }, { name: 'Summary', group: 'Overview' },
  { name: 'GST Return (GSTR)', group: 'GST' }, { name: 'Credit Notes', group: 'GST' }, { name: 'B2B (GSTIN)', group: 'GST' }, { name: 'B2C by State', group: 'GST' }, { name: 'Invoice Register', group: 'GST' },
  { name: 'Revenue by source', group: 'Revenue' }, { name: 'Monthly', group: 'Revenue' }, { name: 'Income Tax (ITR)', group: 'Revenue' }, { name: 'Top customers', group: 'Revenue' },
  { name: 'Refunds', group: 'Refunds' }, { name: 'Usage (credits)', group: 'Usage & storage' }, { name: 'Storage plans (now)', group: 'Usage & storage' }, { name: 'Exceptions', group: 'Data quality' },
];

/**
 * "Excel report" button with a small menu to choose which sheets go in the workbook (all by default).
 * The panel is fixed-positioned from the button so a scrolling or clipping toolbar cannot cut it off.
 */
const ExportPicker = ({ disabled, busy, onDownload }) => {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const panel = useRef(null);

  const toggleOpen = () => {
    if (open) { setOpen(false); return; }
    const r = btn.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open || sections) return;
    walletRevenueService.exportSections().then((s) => { setSections(s); setPicked(new Set(s.map((x) => x.name))); })
      .catch(() => { setSections(FALLBACK_SECTIONS); setPicked(new Set(FALLBACK_SECTIONS.map((x) => x.name))); });
  }, [open, sections]);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!panel.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const groups = useMemo(() => {
    const m = new Map();
    (sections || []).forEach((s) => { if (!m.has(s.group)) m.set(s.group, []); m.get(s.group).push(s); });
    return [...m.entries()];
  }, [sections]);
  const flip = (name) => setPicked((p) => { const n = new Set(p); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const total = sections?.length || 0;
  const allPicked = total > 0 && picked.size === total;

  return (
    <>
      <button ref={btn} type="button" onClick={toggleOpen} disabled={disabled || busy} title="Download a formatted Excel report (choose the sheets)" style={{ ...compactField, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: disabled || busy ? 'not-allowed' : 'pointer', marginLeft: 'auto', opacity: disabled ? 0.6 : 1 }}>
        {busy ? <span className="skeleton-inline" style={{ width: 12, height: 12 }} /> : <FileSpreadsheet size={12} />} Excel report <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>
      {open && pos && (
        <div ref={panel} role="dialog" aria-label="Choose the sheets to export" style={{ position: 'fixed', top: pos.top, right: pos.right, width: 330, maxWidth: 'calc(100vw - 16px)', maxHeight: 'min(70vh, 460px)', overflowY: 'auto', zIndex: 10000, background: 'var(--bg-surface)', border: '1px solid var(--outline)', boxShadow: 'var(--shadow-lg)', padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)' }}>Sheets to include</span>
            <button type="button" onClick={() => setPicked(new Set((sections || []).map((s) => s.name)))} style={{ ...compactField, height: 22, lineHeight: '20px', padding: '0 6px' }}>All</button>
            <button type="button" onClick={() => setPicked(new Set())} style={{ ...compactField, height: 22, lineHeight: '20px', padding: '0 6px' }}>None</button>
          </div>
          {!sections && <div style={{ padding: 12, fontSize: 12, color: 'var(--on-muted)' }}>Loading…</div>}
          {groups.map(([group, items]) => (
            <div key={group} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 0' }}>{group}</div>
              {items.map((s) => (
                <label key={s.name} title={s.about} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={picked.has(s.name)} onChange={() => flip(s.name)} style={{ margin: 0 }} />
                  <span>{s.name}</span>
                  {s.about && <span style={{ color: 'var(--on-muted)', fontWeight: 500, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>— {s.about}</span>}
                </label>
              ))}
            </div>
          ))}
          <button type="button" disabled={!picked.size || busy} onClick={() => { setOpen(false); onDownload(allPicked ? [] : [...picked]); }}
            style={{ ...compactField, width: '100%', marginTop: 6, height: 30, background: picked.size ? 'var(--primary)' : 'var(--surface)', color: picked.size ? '#fff' : 'var(--on-muted)', borderColor: 'var(--primary)', cursor: picked.size ? 'pointer' : 'not-allowed' }}>
            Download {allPicked ? 'full workbook' : `${picked.size} sheet${picked.size === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </>
  );
};

// Multi-select dropdown (checkboxes). Empty selection = no filter (all shown).
// The menu is position:fixed off the button's rect so it is never clipped by a
// scroll container — same approach as ExportPicker above.
const MultiSelectDropdown = ({ label, options, selected, onChange, width = 170 }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const panel = useRef(null);

  const toggleOpen = () => {
    if (open) { setOpen(false); return; }
    const r = btn.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 268)) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!panel.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const flip = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const summary = selected.length === 0 ? `All ${label.toLowerCase()}` : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  return (
    <>
      <button ref={btn} type="button" onClick={toggleOpen} title={`Filter by ${label.toLowerCase()} — select one or more`}
        style={{ ...compactField, width, display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer', color: selected.length ? 'var(--on-surface)' : 'var(--on-muted)', borderColor: selected.length ? 'var(--primary)' : undefined }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <ChevronDown size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>
      {open && pos && (
        <div ref={panel} role="dialog" aria-label={`Choose ${label}`} style={{ position: 'fixed', top: pos.top, left: pos.left, width: 252, maxWidth: 'calc(100vw - 16px)', maxHeight: 'min(60vh, 360px)', overflowY: 'auto', zIndex: 10000, background: 'var(--bg-surface)', border: '1px solid var(--outline)', boxShadow: 'var(--shadow-lg)', padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)' }}>{label}</span>
            <button type="button" onClick={() => onChange([])} disabled={!selected.length} style={{ ...compactField, height: 22, lineHeight: '20px', padding: '0 6px', cursor: selected.length ? 'pointer' : 'default', opacity: selected.length ? 1 : 0.5 }}>Clear</button>
          </div>
          {options.length === 0 && <div style={{ padding: 8, fontSize: 12, color: 'var(--on-muted)' }}>No options</div>}
          {options.map((o) => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => flip(o)} style={{ margin: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{o}</span>
            </label>
          ))}
        </div>
      )}
    </>
  );
};

const AdminWalletRevenuePage = () => {
  const { isMobile } = useResponsive();
  const [years, setYears] = useState([]);
  const [period, setPeriod] = useState('FY');
  const [fy, setFy] = useState('');
  const [month, setMonth] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // The tab lives in the URL (?tab=gst) so a refresh, a shared link or the back button
  // lands on the same tab. An unknown or missing value falls back to the first tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = TABS.some((x) => x.id === requestedTab) ? requestedTab : 'revenue';
  const setTab = useCallback((id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [regRows, setRegRows] = useState([]);
  const [regTotal, setRegTotal] = useState(0);
  const [regPage, setRegPage] = useState(1);
  const [regStream, setRegStream] = useState(''); // register filter: WALLET | MSME_FEE | SUBSCRIPTION | STORAGE
  const [regDocType, setRegDocType] = useState(''); // register filter: INVOICE | CREDIT_NOTE
  const [regSort, setRegSort] = useState(null); // register sort, done on the server across every page: { key, dir }
  // Header click on the register: first click = descending for amounts / dates, ascending for text; third click clears.
  const onRegSort = (key) => setRegSort((s) => {
    const numeric = ['invoice_date', 'taxable', 'cgst', 'sgst', 'igst', 'unsplit_gst', 'gst', 'total', 'flags'].includes(key);
    const first = numeric ? 'desc' : 'asc';
    if (!s || s.key !== key) return { key, dir: first };
    return s.dir === first ? { key, dir: first === 'asc' ? 'desc' : 'asc' } : null;
  });
  const [regLoading, setRegLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [refundFilter, setRefundFilter] = useState('ALL'); // Refunds tab: ALL | PROCESSED | IN_PROGRESS | FAILED

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

  useEffect(() => { setRegPage(1); }, [periodParams, search, category, regStream, regDocType, regSort]);
  const fetchRegister = useCallback(async () => {
    if (!periodParams || tab !== 'register') return;
    setRegLoading(true);
    try {
      const r = await walletRevenueService.register({
        ...periodParams, page: regPage, limit: PAGE_SIZE, q: search, category, stream: regStream, docType: regDocType, sort: regSort?.key, dir: regSort?.dir,
      });
      setRegRows(r.rows); setRegTotal(r.total);
    } catch (err) {
      toast.error('Failed to load invoice register');
    } finally {
      setRegLoading(false);
    }
  }, [periodParams, tab, regPage, search, category, regStream, regDocType, regSort]);
  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  // Vendor spend (cost of service) — fetched only when its tab is open, for the
  // selected period (same IST boundaries as every other tab).
  const [vendorSpend, setVendorSpend] = useState(null);
  const [vendorSpendLoading, setVendorSpendLoading] = useState(false);
  useEffect(() => {
    if (!periodParams || tab !== 'vendor_spend') return;
    let cancelled = false;
    setVendorSpendLoading(true);
    walletRevenueService.vendorCostReport(periodParams)
      .then((d) => { if (!cancelled) setVendorSpend(d); })
      .catch((err) => { if (!cancelled) toast.error(err.response?.data?.error || 'Failed to load vendor spend'); })
      .finally(() => { if (!cancelled) setVendorSpendLoading(false); });
    return () => { cancelled = true; };
  }, [periodParams, tab]);

  // The "Spend by API" section can be narrowed to its own date range,
  // independent of the page period above. When both dates are set we fetch a
  // second report for that custom range (IST, via the same endpoint) and the
  // API table renders from it; otherwise it uses the page-period report.
  const [apiFrom, setApiFrom] = useState('');
  const [apiTo, setApiTo] = useState('');
  const [vendorSpendApi, setVendorSpendApi] = useState(null);
  const [vendorSpendApiLoading, setVendorSpendApiLoading] = useState(false);
  const apiRangeActive = Boolean(apiFrom && apiTo);
  // Multi-select filters for the Spend by API table (empty = all).
  const [apiVendorSel, setApiVendorSel] = useState([]);
  const [apiServiceSel, setApiServiceSel] = useState([]);
  useEffect(() => {
    if (tab !== 'vendor_spend' || !apiRangeActive) { setVendorSpendApi(null); return; }
    let cancelled = false;
    setVendorSpendApiLoading(true);
    walletRevenueService.vendorCostReport({ period: 'CUSTOM', from: apiFrom, to: apiTo })
      .then((d) => { if (!cancelled) setVendorSpendApi(d); })
      .catch((err) => { if (!cancelled) toast.error(err.response?.data?.error || 'Failed to load Spend by API for that range'); })
      .finally(() => { if (!cancelled) setVendorSpendApiLoading(false); });
    return () => { cancelled = true; };
  }, [tab, apiFrom, apiTo, apiRangeActive]);

  // `sections`: the sheets picked in the export menu ([] = the whole workbook).
  const handleExport = async (sections = []) => {
    if (!periodParams) return;
    setExporting(true);
    try {
      await walletRevenueService.exportExcel(periodParams, sections);
      toast.success('Excel workbook downloaded');
    } catch (err) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  // Used by every table's Excel button: the tables as shown, headed with the period.
  const exportCtx = useMemo(() => ({
    download: async (title, tables) => {
      const periodText = report ? `${report.period.label} (${report.period.from} → ${report.period.to}, IST)` : '';
      await walletRevenueService.exportTables({
        title,
        tables: tables.map((tb) => ({ ...tb, subtitle: [periodText, tb.subtitle].filter(Boolean).join('   ·   ') })),
      });
    },
  }), [report]);

  // The invoice register: all pages, with the screen's search, filters and sort.
  const [regExporting, setRegExporting] = useState(false);
  const exportRegister = async () => {
    if (!periodParams || regExporting) return;
    setRegExporting(true);
    try {
      await walletRevenueService.exportRegister({ ...periodParams, q: search, category, stream: regStream, docType: regDocType, sort: regSort?.key, dir: regSort?.dir });
      toast.success('Excel report downloaded');
    } catch { toast.error('Failed to export'); } finally { setRegExporting(false); }
  };

  const t = report?.totals;
  const highCount = report ? report.exceptions.filter((e) => e.severity === 'high').length : 0;
  // The head checks are absent from an older API response; treat "absent" as fine, "false" as a failure.
  const headsOk = !report || (report.integrity.tax_heads_add_up_to_gst !== false && report.integrity.tax_heads_tie_to_payments !== false);
  const integrityOk = report && report.integrity.total_ties_to_payments && report.integrity.gst_ties_to_payments && report.integrity.gst_is_18_percent_of_taxable && headsOk;
  const showUnsplit = !!t && Number(t.unsplit_gst || 0) > 0;

  const monthRows = report ? report.monthly.map((m) => ({ ...m, key: m.month })) : [];
  const quarterRows = report ? report.quarterly.map((q) => ({ ...q, key: q.quarter })) : [];

  // ── chart data ──
  const rf = report?.refunds;
  const rfByMonth = new Map((rf?.monthly || []).map((m) => [m.month, m]));
  const monthLabels = report ? report.monthly.map((m) => monthShort(m.month)) : [];
  const refundSeries = (key) => (report ? report.monthly.map((m) => rfByMonth.get(m.month)?.[key] ?? null) : []);
  const mval = (m, side, field) => m?.[side]?.[field] ?? 0;

  return (
    <ExportContext.Provider value={exportCtx}>
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Wallet Revenue & GST"
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {/* ─── Period controls ─── */}
        <div className="card" style={{ padding: '6px 10px', borderRadius: 0, marginBottom: 12, ...toolbarRow, overflowX: isMobile ? 'auto' : 'visible' }}>
          <CustomSelect compact menuMinWidth={150} style={{ ...compactField, maxWidth: 150 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </CustomSelect>
          {(period === 'FY' || /^Q/.test(period)) && (
            <CustomSelect compact menuMinWidth={120} style={{ ...compactField, maxWidth: 130 }} value={fy} onChange={(e) => setFy(e.target.value)}>
              {years.map((y) => <option key={y.value} value={y.value}>FY {y.label}</option>)}
            </CustomSelect>
          )}
          {period === 'MONTH' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...compactField, width: 128 }} />}
          {period === 'CUSTOM' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...compactField, width: 124 }} title="From (IST)" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...compactField, width: 124 }} title="To (IST, inclusive)" />
            </>
          )}
          {report && <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 11, color: 'var(--on-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${report.period.label} · ${report.period.from} → ${report.period.to} (IST)`}>{report.period.label} · {report.period.from} → {report.period.to} (IST)</span>}
          {!report && <span style={{ flex: 1 }} />}
          <ExportPicker disabled={!periodParams} busy={exporting} onDownload={handleExport} />
        </div>

        {/* ─── Summary strip (compact): net revenue, GST by head, billed, refunded, promo, attention ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
          <CompactStat label="Net revenue (taxable)" value={t ? inr(t.taxable) : null} sub={report ? `${changeText(report.comparison.net_revenue)} vs ${report.comparison.previous_period.label}` : ''} color="var(--primary)" />
          <CompactStat
            label="GST (net of refunds)" value={t ? inr(t.gst) : null} color="var(--warning)"
            sub={t ? `CGST ${inr(t.cgst)} · SGST ${inr(t.sgst)} · IGST ${inr(t.igst)}${showUnsplit ? ` · unsplit ${inr(t.unsplit_gst)}` : ''}` : ''}
            title="CGST + SGST for a Karnataka buyer, IGST for any other state"
          />
          <CompactStat label="Billed before refunds" value={report ? inr(report.refunds.gross.total) : null} sub={t ? `${num(t.invoices)} invoices · avg ${inr(report.refunds.gross.count ? report.refunds.gross.total / report.refunds.gross.count : 0)}` : ''} color="var(--success)" />
          <CompactStat label="Refunded" value={report ? inr(report.refunds.refunded.total) : null} sub={report ? `${num(report.refunds.refunded.count)} credit notes · ${report.refunds.refund_rate_pct}% of billed` : ''} color={report && report.refunds.refunded.total > 0 ? 'var(--error)' : 'var(--text-tertiary)'} />
          <CompactStat label="Promo discounts" value={t ? inr(t.promo_discount) : null} sub={t ? `${num(t.promo_value_credits)} promo credits` : ''} color="var(--info)" />
          <CompactStat label="Needs attention" value={report ? String(highCount) : null} sub={report ? (highCount ? 'high-severity issues' : 'all clear') : ''} color={highCount ? 'var(--error)' : 'var(--success)'} />
        </div>

        {/* The "totals tie to the database" confirmation and the legacy / refund-review notes were removed to save
            space (the same items stay listed on the Exceptions tab). Only a FAILED integrity check is shown, so
            nobody files from figures that do not match the database; it takes no room when everything ties. */}
        {report && !integrityOk && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 12, fontSize: 11.5, fontWeight: 700, background: 'var(--error-bg)', color: 'var(--error)' }}>
            <AlertTriangle size={14} /> Integrity check FAILED — these figures do not tie to the raw payment records. Do not file from this view.
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
                <ChartGrid min={420}>
                  <ChartCard title="Revenue trend" hint="Net revenue (taxable value after refunds) and GST by month, with what was given back in refunds.">
                    <LineChart
                      ariaLabel="Monthly net revenue, GST and refunds"
                      labels={monthLabels}
                      series={[
                        { name: 'Net revenue', color: 'var(--primary)', values: report.monthly.map((m) => m.taxable) },
                        { name: 'GST (net)', color: 'var(--warning)', values: report.monthly.map((m) => m.gst) },
                        { name: 'Refunded (taxable)', color: 'var(--error)', dashed: true, values: report.monthly.map((m) => mval(rfByMonth.get(m.month), 'refunded', 'taxable')) },
                      ]}
                    />
                  </ChartCard>
                  <ChartCard title="Revenue by source, month by month" hint="Net revenue (excluding GST) from each thing we sell.">
                    <BarChart
                      stacked
                      ariaLabel="Monthly net revenue by source"
                      labels={monthLabels}
                      series={STREAMS.map((s) => ({ name: STREAM_LABEL[s], color: STREAM_COLOR[s], values: report.monthly_by_stream.map((m) => m[s].taxable) }))}
                    />
                  </ChartCard>
                </ChartGrid>
                <ChartGrid min={420}>
                  <ChartCard title="Where every ₹ billed went" hint="Everything billed, split into revenue we keep, GST we hold for the government, and money given back to customers.">
                    <DonutChart
                      ariaLabel="Share of billed amount: net revenue, GST and refunds"
                      centerLabel="Billed" centerValue={inrShort(rf.gross.total)}
                      slices={[
                        { name: 'Net revenue', value: t.taxable, color: 'var(--primary)' },
                        { name: 'GST (net)', value: t.gst, color: 'var(--warning)' },
                        { name: 'Refunded (incl. GST)', value: rf.refunded.total, color: 'var(--error)' },
                      ]}
                    />
                  </ChartCard>
                  <ChartCard title="Share of net revenue by source">
                    <DonutChart
                      ariaLabel="Net revenue share by source"
                      centerLabel="Net revenue" centerValue={inrShort(t.taxable)}
                      slices={STREAMS.map((s) => ({ name: STREAM_LABEL[s], value: report.by_stream[s].taxable, color: STREAM_COLOR[s] }))}
                    />
                  </ChartCard>
                </ChartGrid>

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
                        sortable={false}
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
                    sortable={false}
                    cols={[{ key: 'k', label: 'Step' }, { key: 'v', label: 'Amount', num: true }, { key: 'n', label: 'What it means' }]}
                    rows={[
                      { key: 'g', k: 'Billed before refunds (incl. GST)', v: inr(report.refunds.gross.total), n: `${num(t.invoices)} invoices across wallet recharges, MSME fees, Virtual Workspace and storage plans` },
                      ...(report.refunds.refunded.count > 0 ? [{ key: 'rf', k: `Less: refunds (${report.refunds.refunded.count} credit notes, incl. GST)`, v: `− ${inr(report.refunds.refunded.total)}`, n: `${report.refunds.refund_rate_pct}% of the taxable value billed was given back` }] : []),
                      ...(report.unclassified.invoices > 0 ? [{ key: 'u', k: `Less: GST not recorded (${report.unclassified.invoices} older payments)`, v: `− ${inr(report.unclassified.total)}`, n: 'Received before GST was recorded — cannot be split into revenue and tax, so excluded here' }] : []),
                      { key: 'x', k: report.refunds.refunded.count > 0 ? 'Less: GST collected (18%), net of GST reversed on refunds' : 'Less: GST collected (18%)', v: `− ${inr(t.gst)}`, n: `CGST ${inr(t.cgst)} + SGST ${inr(t.sgst)} + IGST ${inr(t.igst)}${showUnsplit ? ` + ${inr(t.unsplit_gst)} not split` : ''} — payable to the government, not our revenue` },
                    ]}
                    foot={{ k: 'NET REVENUE (taxable value, after refunds)', v: inr(t.taxable), n: `${pct(t.taxable, report.refunds.gross.total)} of what was billed` }}
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

                {report.storage_plans && (
                  <Section title="Storage plans — right now" hint={`A live snapshot as of ${formatDateTime(report.storage_plans.as_of)}, not tied to the period above. The money actually collected for storage in the period is the “Storage plan” row in Revenue by source.`}>
                    {(() => {
                      const sp = report.storage_plans;
                      const usedPct = sp.total_capacity_bytes ? Math.min(100, (sp.total_used_bytes / sp.total_capacity_bytes) * 100) : 0;
                      return (
                        <>
                          <Grid
                            sortable={false}
                            cols={[{ key: 'k', label: 'Measure' }, { key: 'v', label: 'Value', num: true }, { key: 'n', label: 'What it means' }]}
                            rows={[
                              { key: 'a', k: 'DSA accounts', v: num(sp.accounts), n: `${num(sp.paid_accounts)} on a paid plan · ${num(sp.free_accounts)} on the free 2 GB` },
                              { key: 'm', k: 'Monthly recurring (excl. GST)', v: inr(sp.recurring.base), n: `${num(sp.recurring.accounts)} renewing plan(s); ${inr(sp.recurring.gst)} GST on top = ${inr(sp.recurring.total)} billed each month` },
                              { key: 'e', k: 'Plans ending', v: num(sp.ending_accounts), n: 'Cancelled or set to cancel — will drop out of recurring revenue' },
                              { key: 'f', k: 'Plans with a failing payment', v: num(sp.payment_failing_accounts), n: 'Razorpay could not charge; in the grace period before dropping to the free tier' },
                              { key: 'u', k: 'Storage used', v: `${fmtBytes(sp.total_used_bytes)} of ${fmtBytes(sp.total_capacity_bytes)}`, n: `${usedPct.toFixed(1)}% of all capacity sold or given (distinct files only)` },
                              { key: 'x', k: 'Accounts full / 95%+ / 80%+', v: `${num(sp.full_accounts)} / ${num(sp.critical_accounts)} / ${num(sp.warning_accounts)}`, n: 'Full accounts are blocked from new document pulls and uploads — likely upgrade candidates' },
                            ]}
                          />
                          {sp.by_plan.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <Grid
                                cols={[{ key: 'gb', label: 'Plan' }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'b', label: 'Monthly (excl. GST)', num: true }, { key: 'g', label: 'GST', num: true }, { key: 't', label: 'Billed monthly', num: true }]}
                                rows={sp.by_plan.map((p) => ({ key: p.gb, gb: `${p.gb} GB`, accounts: num(p.accounts), b: inr(p.mrr_base), g: inr(p.mrr_gst), t: inr(p.mrr_total) }))}
                                foot={{ gb: 'Total', accounts: num(sp.recurring.accounts), b: inr(sp.recurring.base), g: inr(sp.recurring.gst), t: inr(sp.recurring.total) }}
                              />
                            </div>
                          )}
                          {sp.near_limit.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 6 }}>
                                Closest to their limit{sp.near_limit_total > sp.near_limit.length ? ` (top ${sp.near_limit.length} of ${num(sp.near_limit_total)})` : ''}
                              </div>
                              <Grid
                                cols={[
                                  { key: 'name', label: 'Account' },
                                  { key: 'plan', label: 'Plan' },
                                  { key: 'used', label: 'Used', num: true },
                                  { key: 'pct', label: '%', num: true, render: (r) => <span style={{ fontWeight: 700, color: r.level === 'full' ? 'var(--error)' : 'var(--warning)' }}>{r.percent}%</span> },
                                ]}
                                rows={sp.near_limit.map((a) => ({ key: a.tenant_id, ...a, used: `${fmtBytes(a.used_bytes)} of ${a.limit_gb} GB` }))}
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </Section>
                )}

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
                    sortable={false}
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
                      sortable={false}
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
                <ChartGrid min={340}>
                  <ChartCard title="Registered vs unregistered buyers" hint="Net revenue from buyers with a valid GSTIN (B2B) and without (B2C).">
                    <DonutChart
                      size={150} ariaLabel="Net revenue, B2B versus B2C"
                      centerLabel="Net revenue" centerValue={inrShort(t.taxable)}
                      slices={[{ name: 'B2B (GSTIN)', value: report.by_category.B2B.taxable, color: 'var(--primary)' }, { name: 'B2C', value: report.by_category.B2C.taxable, color: 'var(--success)' }]}
                    />
                  </ChartCard>
                  <ChartCard title="Net revenue by buyer state" hint="The eight states that bring the most revenue.">
                    <BarChart
                      ariaLabel="Net revenue by buyer state"
                      labels={report.by_state.slice(0, 8).map((s) => (s.name || s.code || '?').replace(/^\d+\s*/, '').slice(0, 12))}
                      series={[{ name: 'Net revenue', color: 'var(--primary)', values: report.by_state.slice(0, 8).map((s) => s.taxable) }]}
                    />
                  </ChartCard>
                  <ChartCard title="Net revenue and refunds by quarter" hint="GST quarters (Apr–Mar).">
                    <BarChart
                      ariaLabel="Net revenue and refunds by quarter"
                      labels={quarterRows.map((q) => q.quarter.replace(/^\d{4}-\d{2}\s*/, ''))}
                      series={[
                        { name: 'Net revenue', color: 'var(--primary)', values: quarterRows.map((q) => q.taxable) },
                        { name: 'Refunded (taxable)', color: 'var(--error)', values: quarterRows.map((q) => report.monthly.filter((m) => quarterLabelOf(m.month) === q.quarter).reduce((s, m) => s + mval(rfByMonth.get(m.month), 'refunded', 'taxable'), 0)) },
                      ]}
                    />
                  </ChartCard>
                </ChartGrid>
                <Section title="Month-wise" hint="Each top-up is counted in the IST month it was credited. Months with no activity are shown as zero.">
                  <Grid
                    cols={[{ key: 'month', label: 'Month' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols(showUnsplit)]}
                    rows={monthRows}
                    foot={{ month: 'Total', invoices: num(t.invoices), ...taxFoot(t) }}
                  />
                </Section>
                <Section title="Quarter-wise (GST quarters, Apr–Mar)" hint="Use for quarterly returns (QRMP). Quarters outside the selected range are not shown.">
                  <Grid
                    cols={[{ key: 'quarter', label: 'Quarter' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols(showUnsplit)]}
                    rows={quarterRows}
                    foot={{ quarter: 'Total', invoices: num(t.invoices), ...taxFoot(t) }}
                  />
                </Section>
                <Section title="B2B vs B2C" hint="B2B = buyer has a valid GSTIN. B2C = unregistered buyer (or a GSTIN that is not a valid format).">
                  <Grid
                    cols={[{ key: 'k', label: 'Category' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols(showUnsplit)]}
                    rows={['B2B', 'B2C'].map((k) => ({ key: k, k, ...report.by_category[k] }))}
                  />
                </Section>
                <Section title="By supply" hint="Wallet recharges, Direct-MSME eligibility fees, Virtual Workspace subscriptions and storage plans are separate supplies. Subscriptions and storage plans share the SUB/ invoice series.">
                  <Grid
                    cols={[{ key: 'k', label: 'Supply' }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols(showUnsplit)]}
                    rows={STREAMS.map((k) => ({ key: k, k: STREAM_LABEL[k], ...report.by_stream[k] }))}
                    foot={{ k: 'Total', invoices: num(t.invoices), ...taxFoot(t) }}
                  />
                </Section>
                <Section title="By place of supply (buyer state)" hint="Karnataka buyers are charged CGST + SGST; every other state is charged IGST. Buyer state is the GSTIN’s state code when the buyer has one, otherwise the state they registered with (then their pincode).">
                  <Grid
                    cols={[{ key: 'name', label: 'State', render: (r) => `${r.code === 'UNKNOWN' ? '—' : r.code} ${r.name}` }, { key: 'invoices', label: 'Invoices', num: true }, ...taxCols(showUnsplit)]}
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
                <ChartGrid min={380}>
                  <ChartCard title="GST by head" hint="CGST + SGST for buyers in Karnataka, IGST for every other state — net of GST reversed on refunds.">
                    <DonutChart
                      size={150} ariaLabel="GST by tax head"
                      centerLabel="GST (net)" centerValue={inrShort(t.gst)}
                      slices={[
                        { name: 'CGST (9%)', value: t.cgst, color: 'var(--warning)' },
                        { name: 'SGST (9%)', value: t.sgst, color: 'var(--success)' },
                        { name: 'IGST (18%)', value: t.igst, color: 'var(--info, #7c5cff)' },
                        ...(showUnsplit ? [{ name: 'Not split (older invoices)', value: t.unsplit_gst, color: 'var(--text-tertiary)' }] : []),
                      ]}
                    />
                  </ChartCard>
                  <ChartCard title="GST payable by month" hint="Net of credit notes, split by head.">
                    <BarChart
                      stacked ariaLabel="Monthly GST by head"
                      labels={monthLabels}
                      series={[
                        { name: 'CGST', color: 'var(--warning)', values: report.monthly.map((m) => m.cgst) },
                        { name: 'SGST', color: 'var(--success)', values: report.monthly.map((m) => m.sgst) },
                        { name: 'IGST', color: 'var(--info, #7c5cff)', values: report.monthly.map((m) => m.igst) },
                        ...(showUnsplit ? [{ name: 'Not split', color: 'var(--text-tertiary)', values: report.monthly.map((m) => m.unsplit_gst) }] : []),
                      ]}
                    />
                  </ChartCard>
                </ChartGrid>
                <Section title="GST return summary — outward taxable supplies" hint={report.gst_summary.note}>
                  <Grid
                    cols={[
                      { key: 'v', label: 'Taxable value', num: true },
                      { key: 'cgst', label: 'CGST (9%)', num: true }, { key: 'sgst', label: 'SGST (9%)', num: true }, { key: 'igst', label: 'IGST (18%)', num: true },
                      ...(showUnsplit ? [{ key: 'unsplit', label: 'GST not split', num: true }] : []),
                      { key: 'g', label: 'GST payable (total)', num: true },
                    ]}
                    rows={[{
                      v: inr(report.gst_summary.outward_taxable_value),
                      cgst: inr(report.gst_summary.cgst), sgst: inr(report.gst_summary.sgst), igst: inr(report.gst_summary.igst),
                      unsplit: inr(report.gst_summary.unsplit_gst), g: inr(report.gst_summary.gst),
                    }]}
                  />
                </Section>
                <Section title="B2B invoices (buyer has a valid GSTIN)" hint="Registered buyers. Place of supply is the state code in the buyer’s GSTIN: 29 (Karnataka) is CGST + SGST, any other code is IGST.">
                  <Grid
                    cols={[
                      { key: 'invoice_number', label: 'Invoice no.', render: (r) => r.invoice_number || '—' },
                      { key: 'invoice_date', label: 'Date', render: (r) => formatDateTime(r.invoice_date) },
                      { key: 'buyer_gstin', label: 'GSTIN' }, { key: 'buyer_name', label: 'Buyer' },
                      { key: 'pos', label: 'Place of supply', render: (r) => `${r.pos_code || '—'} ${r.pos_name || ''}` },
                      { key: 'gst_rate', label: 'Rate', num: true, render: (r) => `${(r.gst_rate * 100).toFixed(0)}%` },
                      { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
                      ...gstHeadCols(showUnsplit),
                      { key: 'total', label: 'Invoice value', num: true, render: (r) => inr(r.total) },
                    ]}
                    rows={report.b2b.map((r) => ({ ...r, key: `${r.stream}-${r.topup_id}` }))}
                    empty="No B2B invoices"
                  />
                </Section>
                <Section title="B2C (unregistered buyers) — by buyer state" hint="Consolidated by state and rate, not invoice-wise. Buyer state is the state they registered with (then their pincode): Karnataka is CGST + SGST, any other state is IGST.">
                  <Grid
                    cols={[
                      { key: 'pos', label: 'Buyer state', render: (r) => `${r.pos_code || '—'} ${r.pos_name || 'Unknown'}` },
                      { key: 'gst_rate', label: 'Rate', num: true, render: (r) => `${(r.gst_rate * 100).toFixed(0)}%` },
                      { key: 'invoices', label: 'Invoices', num: true },
                      { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
                      ...gstHeadCols(showUnsplit),
                    ]}
                    rows={report.b2c.map((r, i) => ({ ...r, key: i }))}
                    empty="No B2C invoices"
                  />
                </Section>
                <Section title="Credit notes issued (refunds)" hint="Each refund reverses part or all of an invoice, in the month its credit note is issued, by the same tax heads. These amounts are already netted off every total on this page, so report them as credit notes (GSTR-1, credit/debit notes) rather than adjusting the invoices above.">
                  <Grid
                    cols={[
                      { key: 'invoice_number', label: 'Credit note no.' },
                      { key: 'invoice_date', label: 'Date', render: (r) => formatDateTime(r.invoice_date) },
                      { key: 'original_invoice_number', label: 'Against invoice', render: (r) => r.original_invoice_number || '—' },
                      { key: 'buyer_gstin', label: 'GSTIN', render: (r) => r.buyer_gstin || 'Unregistered' }, { key: 'buyer_name', label: 'Buyer' },
                      { key: 'pos', label: 'Place of supply', render: (r) => `${r.pos_code || '—'} ${r.pos_name || ''}` },
                      { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
                      ...gstHeadCols(false),
                      { key: 'total', label: 'Refunded', num: true, render: (r) => inr(r.total) },
                    ]}
                    rows={(report.credit_notes || []).map((r) => ({ ...r, key: `${r.stream}-${r.topup_id}` }))}
                    empty="No credit notes in this period"
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

            {tab === 'refunds' && (() => {
              const bs = rf.by_status; const bk = rf.by_kind;
              const stateOf = (r) => (r.status === 'PROCESSED' ? 'PROCESSED' : r.status === 'FAILED' ? 'FAILED' : 'IN_PROGRESS');
              const records = rf.records.filter((r) => refundFilter === 'ALL' || stateOf(r) === refundFilter);
              const FILTERS = [['ALL', `All (${rf.records.length})`], ['PROCESSED', `Refunded (${bs.PROCESSED.count})`], ['IN_PROGRESS', `In progress (${bs.IN_PROGRESS.count})`], ['FAILED', `Failed (${bs.FAILED.count})`]];
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                    <CompactStat label="Refunded (credit notes)" value={inr(rf.refunded.total)} sub={`${num(rf.refunded.count)} credit notes · taxable ${inr(rf.refunded.taxable)}`} color="var(--error)" />
                    <CompactStat label="Refund rate" value={`${rf.refund_rate_pct}%`} sub="of taxable value billed" color="var(--warning)" />
                    <CompactStat label="GST reversed" value={inr(rf.refunded.gst)} sub={`CGST ${inr(rf.refunded.cgst)} · SGST ${inr(rf.refunded.sgst)} · IGST ${inr(rf.refunded.igst)}`} color="var(--info, #7c5cff)" />
                    <CompactStat label="In progress" value={inr(bs.IN_PROGRESS.amount)} sub={`${num(bs.IN_PROGRESS.count)} not yet processed`} color="var(--info)" />
                    <CompactStat label="Failed attempts" value={num(bs.FAILED.count)} sub="nothing refunded, credits restored" color="var(--text-tertiary)" />
                    <CompactStat label="Credits taken back" value={num(rf.credits_taken_back)} sub="from partner wallets" color="var(--primary)" />
                  </div>

                  <ChartGrid min={420}>
                    <ChartCard title="Billed vs refunded, by month" hint="Taxable value billed on invoices, and the taxable value given back by credit notes issued that month.">
                      <BarChart
                        ariaLabel="Billed versus refunded by month"
                        labels={monthLabels}
                        series={[
                          { name: 'Billed (taxable)', color: 'var(--primary)', values: report.monthly.map((m) => mval(rfByMonth.get(m.month), 'gross', 'taxable')) },
                          { name: 'Refunded (taxable)', color: 'var(--error)', values: report.monthly.map((m) => mval(rfByMonth.get(m.month), 'refunded', 'taxable')) },
                        ]}
                      />
                    </ChartCard>
                    <ChartCard title="Refund rate trend" hint="Refunded taxable value as a share of what was billed that month (a month can exceed 100% if it refunds earlier months' invoices).">
                      <LineChart
                        ariaLabel="Refund rate by month"
                        labels={monthLabels}
                        format={(n) => `${n}%`} tipFormat={(n) => `${n}%`}
                        series={[{ name: 'Refund rate', color: 'var(--warning)', values: refundSeries('refund_rate_pct').map((v) => v ?? 0) }]}
                      />
                    </ChartCard>
                  </ChartGrid>

                  <ChartGrid min={300}>
                    <ChartCard title="Refunds by source" hint="Taxable value refunded.">
                      <DonutChart size={140} ariaLabel="Refunds by source" centerLabel="Refunded" centerValue={inrShort(rf.refunded.taxable)}
                        slices={STREAMS.map((s) => ({ name: STREAM_LABEL[s], value: rf.by_stream[s].refunded.taxable, color: STREAM_COLOR[s] }))} />
                    </ChartCard>
                    <ChartCard title="Where the refunds stand" hint="By status, incl. GST. Failed attempts moved no money.">
                      <DonutChart size={140} ariaLabel="Refunds by status" centerLabel="Requested" centerValue={inrShort(bs.PROCESSED.amount + bs.IN_PROGRESS.amount + bs.FAILED.amount)}
                        slices={[{ name: 'Refunded', value: bs.PROCESSED.amount, color: 'var(--success)' }, { name: 'In progress', value: bs.IN_PROGRESS.amount, color: 'var(--info)' }, { name: 'Failed', value: bs.FAILED.amount, color: 'var(--error)' }]} />
                    </ChartCard>
                    <ChartCard title="Full vs partial" hint="Refunds that moved money, incl. GST.">
                      <DonutChart size={140} ariaLabel="Full versus partial refunds" centerLabel="Refunds" centerValue={num((bk.FULL?.count || 0) + (bk.PARTIAL?.count || 0))}
                        slices={[{ name: 'Full', value: bk.FULL?.amount || 0, color: 'var(--primary)' }, { name: 'Partial', value: bk.PARTIAL?.amount || 0, color: 'var(--warning)' }]} />
                    </ChartCard>
                    <ChartCard title="Refund rate by source" hint="Refunded as a share of what was billed for each source.">
                      <BarChart ariaLabel="Refund rate by source" height={190} format={(n) => `${n}%`} tipFormat={(n) => `${n}%`}
                        labels={STREAMS.map((s) => STREAM_LABEL[s])}
                        series={[{ name: 'Refund rate', color: 'var(--error)', values: STREAMS.map((s) => rf.by_stream[s].refund_rate_pct) }]} />
                    </ChartCard>
                  </ChartGrid>

                  <Section
                    title="Refund records"
                    hint="Every refund requested in this period, whatever its status. The GST and revenue effect is counted in the month each credit note is issued; the Excel workbook has the same list on its Refunds sheet."
                  >
                    <div style={{ ...toolbarRow, padding: '6px 10px', borderBottom: '1px solid var(--outline)' }}>
                      {FILTERS.map(([key, text]) => (
                        <button key={key} onClick={() => setRefundFilter(key)} style={{ ...compactField, cursor: 'pointer', fontWeight: 700, background: refundFilter === key ? 'var(--primary)' : 'var(--surface)', color: refundFilter === key ? '#fff' : 'var(--text-primary)', borderColor: refundFilter === key ? 'var(--primary)' : 'var(--outline)' }}>{text}</button>
                      ))}
                    </div>
                    <Grid
                      cols={[
                        { key: 'requested_at', label: 'Requested', render: (r) => formatDateTime(r.requested_at) },
                        { key: 'processed_at', label: 'Processed', render: (r) => (r.processed_at ? formatDateTime(r.processed_at) : '—') },
                        { key: 'source_label', label: 'Refund of', filterBy: true, text: (r) => r.source_label, sort: (r) => `${r.source_label} ${String(r.source_id).padStart(9, '0')}`, render: (r) => `${r.source_label} #${r.source_id}` },
                        { key: 'buyer', label: 'Buyer', render: (r) => r.buyer || '—' },
                        { key: 'amount', label: 'Refunded', num: true, render: (r) => inr(r.amount) },
                        { key: 'gst', label: 'GST', num: true, render: (r) => inr(r.gst) },
                        { key: 'kind', label: 'Kind', filterBy: true, text: (r) => (r.kind === 'FULL' ? 'Full' : 'Partial'), render: (r) => (r.kind === 'FULL' ? 'Full' : 'Partial') },
                        { key: 'status', label: 'Status', filterBy: true, text: (r) => (REFUND_STATUS_STYLE[r.status] || REFUND_STATUS_STYLE.FAILED).label, render: (r) => { const s = REFUND_STATUS_STYLE[r.status] || REFUND_STATUS_STYLE.FAILED; return <Pill style={{ background: s.bg, color: s.color }}>{s.label}</Pill>; } },
                        { key: 'credits_debited', label: 'Credits taken back', num: true, render: (r) => (r.credits_debited ? num(r.credits_debited) : '—') },
                        { key: 'credit_note_number', label: 'Credit note', render: (r) => r.credit_note_number || '—' },
                        { key: 'requested_by', label: 'Issued by', render: (r) => r.requested_by || '—' },
                        { key: 'reason', label: 'Reason', render: (r) => <span style={{ whiteSpace: 'normal', display: 'inline-block', minWidth: 160, maxWidth: 280 }}>{r.reason}{r.failure_reason ? <span style={{ color: 'var(--error)' }}> · {r.failure_reason}</span> : ''}</span> },
                      ]}
                      rows={records.map((r) => ({ ...r, key: r.id }))}
                      empty="No refunds in this period"
                    />
                  </Section>
                </>
              );
            })()}

            {tab === 'register' && (
              <div className="card" style={{ padding: 0, borderRadius: 0 }}>
                <div style={{ ...toolbarRow, padding: '6px 10px', borderBottom: '1px solid var(--outline)' }}>
                  <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300, minWidth: 140 }}>
                    <Search size={12} color="var(--text-tertiary)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Invoice no., buyer, GSTIN, payment ID…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }} />
                  </div>
                  <CustomSelect compact menuMinWidth={140} style={{ ...compactField, maxWidth: 120 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All types</option>
                    <option value="B2B">B2B</option><option value="B2C">B2C</option><option value="UNCLASSIFIED">Unclassified</option>
                  </CustomSelect>
                  <CustomSelect compact menuMinWidth={160} style={{ ...compactField, maxWidth: 140 }} value={regStream} onChange={(e) => setRegStream(e.target.value)}>
                    <option value="">All sources</option>
                    {STREAMS.map((s) => <option key={s} value={s}>{STREAM_LABEL[s]}</option>)}
                  </CustomSelect>
                  <CustomSelect compact menuMinWidth={150} style={{ ...compactField, maxWidth: 140 }} value={regDocType} onChange={(e) => setRegDocType(e.target.value)}>
                    <option value="">All documents</option>
                    <option value="INVOICE">Invoices</option><option value="CREDIT_NOTE">Credit notes</option>
                  </CustomSelect>
                  {(search || category || regStream || regDocType || regSort) && (
                    <button type="button" onClick={() => { setSearchInput(''); setCategory(''); setRegStream(''); setRegDocType(''); setRegSort(null); }} style={{ ...compactField, cursor: 'pointer', fontWeight: 700 }}>Clear</button>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--on-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{num(regTotal)} documents</span>
                  <button type="button" onClick={exportRegister} disabled={regExporting || !regTotal} title="Download every matching document (all pages) as a formatted Excel report" style={{ ...compactField, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: regExporting ? 'wait' : 'pointer', opacity: regTotal ? 1 : 0.6 }}>
                    <Download size={12} /> {regExporting ? 'Preparing…' : 'Excel'}
                  </button>
                </div>
                {regLoading ? <div style={{ padding: 40 }}><LoadingSpinner fullPage /></div> : (
                  <div style={{ overflowX: 'auto' }}>
                    <Grid
                      server={{ sort: regSort, onSort: onRegSort }}
                      cols={[
                        { key: 'stream', label: 'Source', render: (r) => STREAM_LABEL[r.stream] || r.stream },
                        { key: 'invoice_number', label: 'Invoice no.', render: (r) => r.invoice_number || <Pill style={SEVERITY_STYLE.high}>NOT ISSUED</Pill> },
                        { key: 'invoice_date', label: 'Date', render: (r) => formatDateTime(r.invoice_date) },
                        { key: 'buyer_name', label: 'Buyer', render: (r) => <div><div>{r.buyer_name || '—'}</div><div style={{ fontSize: 10, color: 'var(--on-muted)' }}>{r.buyer_gstin || 'Unregistered'}</div></div> },
                        { key: 'category', label: 'Type', render: (r) => (r.doc_type === 'CREDIT_NOTE' ? `${r.category} · Credit note` : r.category) },
                        { key: 'pos', label: 'Place of supply', render: (r) => `${r.pos_code || '—'} ${r.pos_name || ''}` },
                        { key: 'taxable', label: 'Taxable', num: true, render: (r) => inr(r.taxable) },
                        ...gstHeadCols(showUnsplit),
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
                    { key: 'severity', label: 'Severity', filterBy: true, text: (r) => r.severity.toUpperCase(), sort: (r) => ({ high: 0, medium: 1, low: 2 }[r.severity] ?? 3), render: (r) => <Pill style={SEVERITY_STYLE[r.severity]}>{r.severity.toUpperCase()}</Pill> },
                    { key: 'message', label: 'Issue', filterBy: true },
                    { key: 'stream', label: 'Source', filterBy: true, text: (r) => STREAM_LABEL[r.stream] || r.stream, render: (r) => STREAM_LABEL[r.stream] || r.stream },
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
              (() => {
                const us = report.usage;
                const cnum = (n) => num(Math.round(n)); // credits, not rupees
                const cshort = (n) => { const v = Math.abs(n); const s = n < 0 ? '−' : ''; return v >= 1e7 ? `${s}${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${s}${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `${s}${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K` : `${s}${Math.round(v)}`; };
                const usageMonths = us.by_month.map((m) => m.month);
                const mLabels = usageMonths.map(monthShort);
                const topApis = us.by_api.filter((a) => a.credits > 0).slice(0, 6).map((a) => a.code);
                const monthApi = new Map(us.by_month_api.map((x) => [`${x.month}|${x.code}`, x.credits]));
                const stackSeries = [
                  ...topApis.map((code, i) => ({ name: code, color: PALETTE[i % PALETTE.length], values: usageMonths.map((m) => monthApi.get(`${m}|${code}`) || 0) })),
                  { name: 'All other', color: 'var(--text-tertiary)', values: usageMonths.map((m) => us.by_month.find((x) => x.month === m).credits - topApis.reduce((s, c) => s + (monthApi.get(`${m}|${c}`) || 0), 0)) },
                ];
                const topPositive = us.by_api.filter((a) => a.credits > 0);
                const shareSlices = [
                  ...topPositive.slice(0, 7).map((a, i) => ({ name: a.code, value: a.credits, color: PALETTE[i % PALETTE.length] })),
                  ...(topPositive.length > 7 ? [{ name: 'All other', value: topPositive.slice(7).reduce((s, a) => s + a.credits, 0), color: 'var(--text-tertiary)' }] : []),
                ];
                const top8 = us.by_api.slice(0, 8);
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                      <CompactStat label="Net credits consumed" value={cnum(us.net_credits_consumed)} sub="API usage + subscriptions, net" color="var(--primary)" />
                      <CompactStat label="Credits consumed" value={cnum(us.credits_consumed_gross)} sub={`${num(us.api_calls)} calls · avg ${us.api_calls ? cnum(us.credits_consumed_gross / us.api_calls) : 0} each`} color="var(--warning)" />
                      <CompactStat label="Given back" value={cnum(us.credits_returned)} sub="refunds and re-prices" color="var(--error)" />
                      <CompactStat label="Free credits granted" value={cnum(us.free_credits_granted)} sub={`admin ${cnum(us.free_by_kind.ADMIN_TOPUP)} · promo ${cnum(us.free_by_kind.PROMO_FREEBIE)}`} color="var(--info)" />
                      <CompactStat label="Unused credits" value={cnum(us.wallet_float_credits)} sub="all wallets, as of now" color="var(--success)" />
                    </div>

                    <ChartGrid min={420}>
                      <ChartCard title="Credits over time" hint="Consumed by customers, given back through refunds / re-prices, and granted free, per month.">
                        <LineChart
                          ariaLabel="Monthly credits consumed, given back and granted" labels={mLabels} format={cshort} tipFormat={cnum}
                          series={[
                            { name: 'Consumed', color: 'var(--warning)', values: us.by_month.map((m) => m.consumed) },
                            { name: 'Net consumed', color: 'var(--primary)', values: us.by_month.map((m) => m.credits) },
                            { name: 'Given back', color: 'var(--error)', dashed: true, values: us.by_month.map((m) => m.returned) },
                            { name: 'Granted free', color: 'var(--info, #7c5cff)', dashed: true, values: us.by_month.map((m) => m.free_granted) },
                          ]}
                        />
                      </ChartCard>
                      <ChartCard title="Net credits by API, month by month" hint="The six busiest APIs; everything else grouped.">
                        <BarChart stacked ariaLabel="Monthly net credits by API" labels={mLabels} format={cshort} tipFormat={cnum} series={stackSeries} />
                      </ChartCard>
                    </ChartGrid>

                    <ChartGrid min={340}>
                      <ChartCard title="Share of credits by API" hint="Net credits consumed.">
                        <DonutChart size={150} ariaLabel="Share of net credits by API" centerLabel="Net credits" centerValue={cshort(us.net_credits_consumed)} format={cnum} slices={shareSlices} />
                      </ChartCard>
                      <ChartCard title="Consumed vs given back" hint="Debits against refunds and re-prices.">
                        <DonutChart size={150} ariaLabel="Credits kept versus given back" centerLabel="Consumed" centerValue={cshort(us.credits_consumed_gross)} format={cnum}
                          slices={[{ name: 'Kept as consumed', value: us.net_credits_consumed, color: 'var(--primary)' }, { name: 'Given back', value: us.credits_returned, color: 'var(--error)' }]} />
                      </ChartCard>
                      <ChartCard title="Free vs consumed vs unused" hint="Free credits granted this period, credits consumed this period, and the wallet float now.">
                        <DonutChart size={150} ariaLabel="Free, consumed and unused credits" centerLabel="Credits" centerValue={cshort(us.free_credits_granted + us.net_credits_consumed + us.wallet_float_credits)} format={cnum}
                          slices={[{ name: 'Consumed (net)', value: us.net_credits_consumed, color: 'var(--primary)' }, { name: 'Granted free', value: us.free_credits_granted, color: 'var(--info, #7c5cff)' }, { name: 'Unused now', value: us.wallet_float_credits, color: 'var(--success)' }]} />
                      </ChartCard>
                      <ChartCard title="Free credits by kind">
                        <DonutChart size={150} ariaLabel="Free credits by kind" centerLabel="Free" centerValue={cshort(us.free_credits_granted)} format={cnum}
                          slices={[{ name: 'Admin top-ups', value: us.free_by_kind.ADMIN_TOPUP, color: 'var(--primary)' }, { name: 'Promo freebies', value: us.free_by_kind.PROMO_FREEBIE, color: 'var(--warning)' }]} />
                      </ChartCard>
                    </ChartGrid>

                    <ChartGrid min={420}>
                      <ChartCard title="Top APIs by net credits">
                        <BarChart ariaLabel="Top APIs by net credits" labels={top8.map((a) => a.code.length > 12 ? `${a.code.slice(0, 11)}…` : a.code)} format={cshort} tipFormat={cnum}
                          series={[{ name: 'Net credits', color: 'var(--primary)', values: top8.map((a) => a.credits) }]} />
                      </ChartCard>
                      <ChartCard title="Calls vs credits given back" hint="How often each top API was called, and how much of it was returned.">
                        <BarChart ariaLabel="Calls and credits given back by API" labels={top8.map((a) => a.code.length > 12 ? `${a.code.slice(0, 11)}…` : a.code)} format={cshort} tipFormat={cnum}
                          series={[{ name: 'Calls', color: 'var(--success)', values: top8.map((a) => a.calls) }, { name: 'Credits given back', color: 'var(--error)', values: top8.map((a) => a.returned) }]} />
                      </ChartCard>
                    </ChartGrid>

                    <Section title="Credits consumed by API / source" hint={us.note}>
                      <Grid
                        cols={[
                          { key: 'code', label: 'API / source' },
                          { key: 'calls', label: 'Calls', num: true, render: (r) => num(r.calls) },
                          { key: 'consumed', label: 'Consumed', num: true, render: (r) => num(r.consumed) },
                          { key: 'returned', label: 'Given back', num: true, render: (r) => num(r.returned) },
                          { key: 'credits', label: 'Net credits', num: true, render: (r) => num(r.credits) },
                          { key: 'avg', label: 'Avg / call', num: true, render: (r) => (r.calls ? num(Math.round(r.consumed / r.calls)) : '—') },
                          { key: 'share', label: 'Share', num: true, render: (r) => pct(r.credits, us.net_credits_consumed) },
                        ]}
                        rows={us.by_api.map((u) => ({ ...u, key: u.code }))}
                        foot={{ code: 'TOTAL', calls: num(us.api_calls), consumed: num(us.credits_consumed_gross), returned: num(us.credits_returned), credits: num(us.net_credits_consumed), avg: '', share: '' }}
                      />
                    </Section>
                  </>
                );
              })()
            )}

            {tab === 'vendor_spend' && (
              vendorSpendLoading && !vendorSpend ? (
                <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
              ) : !vendorSpend ? (
                <EmptyState icon={Receipt} title="No vendor spend yet" description="No successful vendor calls in this period." />
              ) : (
                (() => {
                  const vs = vendorSpend;
                  const tot = vs.totals;
                  const realVendors = vs.vendors.filter((v) => v.cost_total > 0);
                  const donutSlices = realVendors.map((v, i) => ({ name: vendorSpendVendorLabel(v.vendor), value: v.cost_total, color: PALETTE[i % PALETTE.length] }));
                  const topApis = vs.apis.filter((a) => a.cost_total > 0).slice(0, 8);
                  // "Spend by API" uses its own date range when one is set.
                  const apiReport = apiRangeActive && vendorSpendApi ? vendorSpendApi : vs;
                  const apiTot = apiReport.totals;
                  // Multi-select vendor / API-service filters, applied here (not
                  // in Grid) so the TOTAL row and share column reflect exactly
                  // what is shown. Empty selection = everything.
                  const apiVendorOptions = [...new Set(apiReport.apis.map((a) => vendorSpendVendorLabel(a.display_vendor)))].sort();
                  const apiServiceOptions = [...new Set(apiReport.apis.map((a) => vendorSpendApiLabel(a)))].sort();
                  const filteredApis = apiReport.apis.filter((a) =>
                    (apiVendorSel.length === 0 || apiVendorSel.includes(vendorSpendVendorLabel(a.display_vendor))) &&
                    (apiServiceSel.length === 0 || apiServiceSel.includes(vendorSpendApiLabel(a)))
                  );
                  const fTot = filteredApis.reduce((t, a) => {
                    t.success_calls += a.success_calls; t.failed_calls += a.failed_calls; t.total_calls += a.total_calls;
                    t.cost_base += a.cost_base; t.cost_gst += a.cost_gst; t.cost_total += a.cost_total; return t;
                  }, { success_calls: 0, failed_calls: 0, total_calls: 0, cost_base: 0, cost_gst: 0, cost_total: 0 });
                  const apiFiltered = apiVendorSel.length > 0 || apiServiceSel.length > 0;
                  const chipLabel = { fontSize: 10, fontWeight: 800, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2 };
                  // Spend per environment, from the vendor call ledger (the only place dev /
                  // localhost calls reach production). Production, Dev server and Localhost
                  // always get a row, even at zero, so a silent environment is visible.
                  const envByName = new Map((vs.environments || []).map((e) => [e.environment, e]));
                  const envSeen = new Map((vs.ledger_last_reported || []).map((l) => [l.environment, l]));
                  const envNames = [...VENDOR_SPEND_ENV_ORDER, ...[...envByName.keys()].filter((k) => !VENDOR_SPEND_ENV_ORDER.includes(k))];
                  const envRows = envNames.map((name) => ({ ...EMPTY_ENV_TOTALS, ...(envByName.get(name) || {}), environment: name, key: name, last_call_at: envSeen.get(name)?.last_call_at || null }));
                  const envTot = envRows.reduce((t, e) => {
                    t.calls += e.calls; t.failed_calls += e.failed_calls; t.billable_events += e.billable_events;
                    t.unpriced_billable_events += e.unpriced_billable_events; t.cost_total += e.cost_total; return t;
                  }, { calls: 0, failed_calls: 0, billable_events: 0, unpriced_billable_events: 0, cost_total: 0 });
                  const envVendorRows = envRows.flatMap((e) => e.vendors.map((v) => ({ ...v, environment: e.environment, key: `${e.environment}|${v.vendor}` })));
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                        <CompactStat label="Total paid to vendors" value={inr(tot.cost_total)} sub="GST-inclusive · success only" color="var(--primary)" />
                        <CompactStat label="Base (ex-GST)" value={inr(tot.cost_base)} sub="before GST" color="var(--success)" />
                        <CompactStat label="GST (18%)" value={inr(tot.cost_gst)} sub="recoverable input credit" color="var(--warning)" />
                        <CompactStat label="Successful calls (billed)" value={num(tot.success_calls)} sub={`${realVendors.length} paid vendor${realVendors.length === 1 ? '' : 's'}`} color="var(--info)" />
                        <CompactStat label="Failed calls (not billed)" value={num(tot.failed_calls)} sub={`${num(tot.total_calls)} total calls`} color={tot.failed_calls > 0 ? 'var(--error)' : 'var(--text-tertiary)'} />
                      </div>

                      <ChartGrid min={340}>
                        <ChartCard title="Spend share by vendor" hint="GST-inclusive amount paid to each vendor this period (successful calls only).">
                          <DonutChart size={150} ariaLabel="Spend share by vendor" centerLabel="Total" centerValue={inr(tot.cost_total)} format={inr}
                            slices={donutSlices.length ? donutSlices : [{ name: 'No spend', value: 1, color: 'var(--text-tertiary)' }]} />
                        </ChartCard>
                        <ChartCard title="Top APIs by spend" hint="GST-inclusive cost per API, highest first.">
                          <BarChart ariaLabel="Top APIs by spend" format={inr} tipFormat={inr} wrapLabels
                            labels={topApis.map(vendorSpendApiChartLabel)}
                            series={[{ name: 'Spend', color: 'var(--primary)', values: topApis.map((a) => a.cost_total) }]} />
                        </ChartCard>
                      </ChartGrid>

                      <Section title="Spend by vendor" hint="How much Cred2Tech paid each vendor this period. Cost is charged on successful calls only; failed calls are shown for context. GST-inclusive, with base and GST split out.">
                        <Grid
                          cols={[
                            { key: 'vendor', label: 'Vendor', text: (r) => vendorSpendVendorLabel(r.vendor), sort: (r) => vendorSpendVendorLabel(r.vendor), render: (r) => vendorSpendVendorLabel(r.vendor) },
                            { key: 'success_calls', label: 'Success', num: true, render: (r) => num(r.success_calls) },
                            { key: 'failed_calls', label: 'Failed', num: true, render: (r) => num(r.failed_calls) },
                            { key: 'total_calls', label: 'Total calls', num: true, render: (r) => num(r.total_calls) },
                            { key: 'cost_base', label: 'Base (ex-GST)', num: true, render: (r) => inr(r.cost_base) },
                            { key: 'cost_gst', label: 'GST 18%', num: true, render: (r) => inr(r.cost_gst) },
                            { key: 'cost_total', label: 'Total paid', num: true, render: (r) => inr(r.cost_total) },
                            { key: 'share', label: 'Share', num: true, sort: (r) => r.cost_total, render: (r) => pct(r.cost_total, tot.cost_total) },
                          ]}
                          rows={vs.vendors.map((v) => ({ ...v, key: v.vendor }))}
                          foot={{ vendor: 'TOTAL', success_calls: num(tot.success_calls), failed_calls: num(tot.failed_calls), total_calls: num(tot.total_calls), cost_base: inr(tot.cost_base), cost_gst: inr(tot.cost_gst), cost_total: inr(tot.cost_total), share: '' }}
                          exportTitle="Vendor spend by vendor"
                          empty="No vendor calls in this period"
                        />
                      </Section>

                      <Section
                        title="Spend by environment"
                      >
                        <Grid
                          filterable={false}
                          cols={[
                            { key: 'environment', label: 'Environment', sort: (r) => vendorSpendEnvLabel(r.environment), render: (r) => vendorSpendEnvLabel(r.environment) },
                            { key: 'last_call_at', label: 'Last call (IST)', sort: (r) => r.last_call_at || '', render: (r) => fmtIstDateTime(r.last_call_at) },
                            { key: 'billable_events', label: 'Billable calls', num: true, render: (r) => num(r.billable_events) },
                            { key: 'calls', label: 'Total calls', num: true, render: (r) => num(r.calls) },
                            { key: 'failed_calls', label: 'Failed', num: true, render: (r) => num(r.failed_calls) },
                            { key: 'unpriced_billable_events', label: 'No rate', num: true, render: (r) => num(r.unpriced_billable_events) },
                            { key: 'cost_total', label: 'Total spend', num: true, render: (r) => inr(r.cost_total) },
                            { key: 'share', label: 'Share', num: true, sort: (r) => r.cost_total, render: (r) => pct(r.cost_total, envTot.cost_total) },
                          ]}
                          rows={envRows}
                          foot={{ environment: 'TOTAL', last_call_at: '', billable_events: num(envTot.billable_events), calls: num(envTot.calls), failed_calls: num(envTot.failed_calls), unpriced_billable_events: num(envTot.unpriced_billable_events), cost_total: inr(envTot.cost_total), share: '' }}
                          exportTitle="Vendor spend by environment"
                          empty="No vendor calls recorded in this period"
                        />
                        {envVendorRows.length > 0 && (
                          <Grid
                            filterable={false}
                            cols={[
                              { key: 'environment', label: 'Environment', sort: (r) => vendorSpendEnvLabel(r.environment), render: (r) => vendorSpendEnvLabel(r.environment) },
                              { key: 'vendor', label: 'Vendor', sort: (r) => vendorSpendVendorLabel(r.vendor), render: (r) => vendorSpendVendorLabel(r.vendor) },
                              { key: 'billable_events', label: 'Billable calls', num: true, render: (r) => num(r.billable_events) },
                              { key: 'calls', label: 'Total calls', num: true, render: (r) => num(r.calls) },
                              { key: 'failed_calls', label: 'Failed', num: true, render: (r) => num(r.failed_calls) },
                              { key: 'unpriced_billable_events', label: 'No rate', num: true, render: (r) => num(r.unpriced_billable_events) },
                              { key: 'cost_total', label: 'Total spend', num: true, render: (r) => inr(r.cost_total) },
                            ]}
                            rows={envVendorRows}
                            exportTitle="Vendor spend by environment and vendor"
                            empty="No vendor calls recorded in this period"
                          />
                        )}
                      </Section>

                      <Section
                        title="Spend by API"
                        hint="Every API we were charged for — plus ones we called at no vendor cost — by vendor. Cost is success-only; failed calls shown too. Unit cost is the current GST-inclusive vendor rate. Sort any column; filter by vendor or API."
                      >
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--outline)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                            <span style={chipLabel}>Date range</span>
                            <input type="date" value={apiFrom} max={apiTo || undefined} onChange={(e) => setApiFrom(e.target.value)} style={{ ...compactField, width: 150 }} title="From (IST, inclusive)" />
                            <span style={{ color: 'var(--on-muted)', fontSize: 12 }}>→</span>
                            <input type="date" value={apiTo} min={apiFrom || undefined} onChange={(e) => setApiTo(e.target.value)} style={{ ...compactField, width: 150 }} title="To (IST, inclusive)" />
                            {apiRangeActive && (
                              <button type="button" onClick={() => { setApiFrom(''); setApiTo(''); }} style={{ ...compactField, cursor: 'pointer', fontWeight: 700 }}>Clear</button>
                            )}
                            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: apiRangeActive ? 'var(--primary)' : 'var(--on-muted)', whiteSpace: 'nowrap' }}>
                              {apiRangeActive
                                ? (vendorSpendApiLoading ? 'Loading range…' : `Showing ${apiReport.period?.from} → ${apiReport.period?.to} (IST)`)
                                : `Using page period · ${vs.period?.from} → ${vs.period?.to} (IST)`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                            <span style={chipLabel}>Filter</span>
                            <MultiSelectDropdown label="Vendors" options={apiVendorOptions} selected={apiVendorSel} onChange={setApiVendorSel} width={160} />
                            <MultiSelectDropdown label="APIs" options={apiServiceOptions} selected={apiServiceSel} onChange={setApiServiceSel} width={190} />
                            {apiFiltered && (
                              <button type="button" onClick={() => { setApiVendorSel([]); setApiServiceSel([]); }} style={{ ...compactField, cursor: 'pointer', fontWeight: 700 }}>Clear filters</button>
                            )}
                          </div>
                        </div>
                        <Grid
                          filterable={false}
                          cols={[
                            { key: 'vendor', label: 'Vendor', sort: (r) => vendorSpendVendorLabel(r.display_vendor), render: (r) => vendorSpendVendorLabel(r.display_vendor) },
                            { key: 'api', label: 'API', sort: (r) => vendorSpendApiLabel(r), render: (r) => vendorSpendApiLabel(r) },
                            { key: 'success_calls', label: 'Success', num: true, render: (r) => num(r.success_calls) },
                            { key: 'failed_calls', label: 'Failed', num: true, render: (r) => num(r.failed_calls) },
                            { key: 'total_calls', label: 'Total calls', num: true, render: (r) => num(r.total_calls) },
                            { key: 'unit_cost', label: 'Unit cost', num: true, render: (r) => inr(r.unit_cost) },
                            { key: 'cost_base', label: 'Base (ex-GST)', num: true, render: (r) => inr(r.cost_base) },
                            { key: 'cost_gst', label: 'GST 18%', num: true, render: (r) => inr(r.cost_gst) },
                            { key: 'cost_total', label: 'Total paid', num: true, render: (r) => inr(r.cost_total) },
                            { key: 'share', label: 'Share', num: true, sort: (r) => r.cost_total, render: (r) => pct(r.cost_total, fTot.cost_total) },
                          ]}
                          rows={filteredApis.map((a) => ({ ...a, key: `${a.api_code}|${a.vendor}` }))}
                          foot={{ vendor: apiFiltered ? 'TOTAL (filtered)' : 'TOTAL', api: '', success_calls: num(fTot.success_calls), failed_calls: num(fTot.failed_calls), total_calls: num(fTot.total_calls), unit_cost: '', cost_base: inr(fTot.cost_base), cost_gst: inr(fTot.cost_gst), cost_total: inr(fTot.cost_total), share: '' }}
                          exportTitle="Vendor spend by API"
                          empty="No vendor calls match these filters"
                        />
                      </Section>

                      <div style={{ fontSize: 11, color: 'var(--on-muted)', lineHeight: 1.6, marginTop: 8 }}>
                        <b>How this is counted.</b> Every call is shown (successful and failed), but only <b>successful</b> calls are billed — failed, refunded and blocked calls are not a charge. Each successful call is valued at the current vendor rate (<code>vendor_cost</code>, GST-inclusive); there is no per-call historical price snapshot, so a past call is valued at today's rate. The 18% GST is a recoverable input tax credit, reported separately from the GST we collect on sales. Headline figures use the page period {vs.period?.label} ({vs.period?.from} → {vs.period?.to}, IST); the Spend by API table can be narrowed to its own range above.
                      </div>
                    </>
                  );
                })()
              )
            )}

            {tab !== 'vendor_spend' && (
              <div style={{ fontSize: 11, color: 'var(--on-muted)', lineHeight: 1.6, marginTop: 8 }}>
                <b>Scope &amp; basis.</b> {report.basis} This page covers wallet recharge, Direct-MSME eligibility-fee and Virtual Workspace subscription invoices (subscriptions paid from wallet credits carry no new GST and are not listed). Input tax credit is not tracked. Figures are a working aid; confirm with your chartered accountant before filing.
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </ExportContext.Provider>
  );
};

export default AdminWalletRevenuePage;
