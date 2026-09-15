import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download, RefreshCw, GitBranch, Package, Landmark, TrendingUp, Users, HandCoins,
  ClipboardCheck, Receipt, Layers, Target, Wallet, PieChart, Clock, Database
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { listMisReports, getMisFilterOptions, getMisReport, exportMisReport } from '../api/misService';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
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

function cellDisplay(value, col) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value; // pre-formatted / label / "n/a (...)" text passes through as-is
  switch (col.type) {
    case 'currency': return fmtCurrency(value);
    case 'percent': return fmtPercent(value);
    case 'number': return fmtNumber(value);
    case 'date': return fmtDate(value);
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
      className: 'form-control', style: { padding: '6px 10px', fontSize: 12.5 },
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
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner size={36} /></div>
  );

  const ActiveIcon = REPORT_ICONS[activeId];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .mis-page .report-nav-item {
          display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
          padding: 11px 14px; border: none; background: none; cursor: pointer;
          font-size: 12.5px; font-weight: 600; color: var(--text-secondary);
          border-left: 3px solid transparent; transition: background 0.15s, color 0.15s;
        }
        .mis-page .report-nav-item svg { flex-shrink: 0; opacity: 0.75; }
        .mis-page .report-nav-item.active { color: var(--primary); background: var(--primary-subtle); border-left-color: var(--primary); }
        .mis-page .report-nav-item.active svg { opacity: 1; }
        .mis-page .report-nav-item:hover:not(.active) { background: var(--bg-elevated); }
        .mis-page table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
        .mis-page th, .mis-page td { padding: 9px 14px; text-align: left; border-bottom: 1px solid var(--border); }
        .mis-page th { background: var(--bg-elevated); font-weight: 700; color: var(--text-secondary); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; position: sticky; top: 0; }
        .mis-page tbody tr:hover td { background: var(--bg-elevated); }
        .mis-page tr.totals-row td { font-weight: 700; background: var(--bg-elevated); }
        .mis-page tr.totals-row:hover td { background: var(--bg-elevated); }
        .mis-page .filter-field .form-label { display: block; margin-bottom: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); }
        @media (max-width: 900px) {
          .mis-page .layout { flex-direction: column !important; }
          .mis-page .report-nav-panel { width: 100% !important; }
        }
        @media (max-width: 768px) {
          .mis-page { padding: 80px 16px 16px !important; }
          /* Vertical list becomes a horizontally-scrolling pill strip — reads
             much better as a swipeable row than a tall stacked list eating
             the whole screen before any report data is even visible. */
          .mis-page .report-nav { display: flex !important; flex-direction: row !important; overflow-x: auto; gap: 6px; max-height: none !important; -webkit-overflow-scrolling: touch; }
          .mis-page .report-nav-item {
            flex-shrink: 0; width: auto; white-space: nowrap; border-left: none !important;
            border: 1px solid var(--border); border-radius: 20px; padding: 8px 14px;
          }
          .mis-page .report-nav-item.active { border-color: var(--primary); }
          /* 2-per-row grid instead of each filter field stacking full-width —
             matches the same density fix used on the other Financials pages. */
          .mis-page .filter-bar { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px 10px !important; align-items: end; }
          .mis-page .filter-field { min-width: 0 !important; }
          .mis-page .filter-bar-actions { grid-column: 1 / -1; display: flex; gap: 8px; margin-top: 2px; }
          .mis-page .filter-bar-actions button { flex: 1; justify-content: center; margin-left: 0 !important; }
          /* Same "stacked label:value card" transform the other ledger tables
             (e.g. Sub-SP Payout) use on mobile — a wide, many-column report
             table reads far better as one card per row than as a horizontally
             -scrolling grid on a phone screen. */
          .mis-page table, .mis-page thead, .mis-page tbody, .mis-page tr, .mis-page td { display: block; width: 100%; }
          .mis-page .table-wrapper { max-height: none !important; }
          .mis-page thead { display: none; }
          .mis-page tbody tr { border-bottom: 1px solid var(--border); padding: 6px 0; }
          .mis-page tbody tr.totals-row { background: var(--bg-elevated); }
          .mis-page td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 14px !important; border-bottom: none !important; text-align: right; white-space: normal; }
          .mis-page td::before { content: attr(data-label); font-weight: 700; color: var(--text-secondary); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; flex-shrink: 0; }
        }
      `}</style>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }} className="mis-page">
        <PageHeader title="MIS Reports" subtitle="Filterable, exportable detail behind every headline number on the platform" />

        <div className="layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <Panel className="report-nav-panel" bodyPadding={0} style={{ width: 280, flexShrink: 0 }}>
            <div className="report-nav" style={{ maxHeight: 640, overflowY: 'auto' }}>
              {reports.map(r => {
                const Icon = REPORT_ICONS[r.id];
                return (
                  <button key={r.id} className={`report-nav-item ${r.id === activeId ? 'active' : ''}`} onClick={() => selectReport(r.id)} title={r.description}>
                    {Icon && <Icon size={15} />}
                    <span>{r.title}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel
              icon={ActiveIcon}
              title={activeReport?.title}
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
                <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><LoadingSpinner size={30} /></div>
              ) : !data || data.rows.length === 0 ? (
                <EmptyState title="No data for this filter selection" description="Try widening the period or clearing a filter." />
              ) : (
                <div className="table-wrapper" style={{ overflowX: 'auto', maxHeight: 620, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>{data.columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, i) => (
                        <tr key={i}>
                          {data.columns.map(c => <td key={c.key} data-label={c.label}>{cellDisplay(row[c.key], c)}</td>)}
                        </tr>
                      ))}
                      {data.totals && (
                        <tr className="totals-row">
                          {data.columns.map(c => <td key={c.key} data-label={c.label}>{cellDisplay(data.totals[c.key], c)}</td>)}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
