import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Search, AlertTriangle, ChevronRight, ChevronDown, Upload, CheckCircle2 } from 'lucide-react';
import { caseService } from '../api/caseService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { toTitleCase, resolveEntityName, isUsableEntityName, formatStatusLabel } from '../utils/helpers';
import TravelingBorderButton from '../components/TravelingBorderButton';
import CustomerTypeModal from '../components/customers/CustomerTypeModal';
import BulkUploadModal from '../components/customers/BulkUploadModal';
import PageHeader from '../components/ui/PageHeader';
import DataPurgedBadge from '../components/case/DataPurgedBadge';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-hot-toast';
import { subscribeToCasePulls } from '../lib/realtime';
import PageTour from '../components/tour/PageTour';

const PIPELINE_TOUR_STEPS = [
  { target: '[data-tour="pipeline-add-customer"]', title: 'Add a new customer', description: 'Start a brand-new case here. Choose whether it\'s a Business/MSME or Salaried customer and the wizard walks you through the rest.' },
  { target: '[data-tour="pipeline-bulk-upload"]', title: 'Bulk upload', description: 'Have many leads at once? Upload a spreadsheet here instead of adding customers one by one.' },
  { target: '[data-tour="pipeline-search"]', title: 'Search your pipeline', description: 'Find a case instantly by customer name, Case ID, lender, PAN, phone, or email.' },
  { target: '[data-tour="pipeline-filters"]', title: 'Filter your pipeline', description: 'Narrow the list down by entity type, lender, or open alerts (like a pending PDD), and sort it however is most useful to you.' },
  { target: '[data-tour="pipeline-stage-tabs"]', title: 'Filter by stage', description: 'Tap a stage to see only the cases sitting there right now, from Lead Created all the way through to Disbursed.' },
  { target: '[data-tour="pipeline-results"]', title: 'Your cases', description: 'Every case in your pipeline, with its bureau score, amounts, and current stage. Tap a row any time to resume, view, or continue a case.' },
];

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

const STAGE_MAPPING = {
  'All': 'All',
  'Lead Created': 'LEAD_CREATED',
  'Lead Sent': 'LEAD_SENT_TO_LENDER',
  'Data Pulled': 'DATA_COLLECTION',
  'Login Done': 'ESR_GENERATED',
  'Sanctioned': 'APPROVED',
  'Part Disbursed': 'PARTLY_DISBURSED',
  'Disbursed': 'DISBURSED',
  'Closed': 'CLOSED',
  'Rejected': 'REJECTED',
};

const STAGE_LABELS = {
  LEAD_CREATED: 'Lead Created',
  DATA_COLLECTION: 'Data Pulled',
  LEAD_SENT_TO_LENDER: 'Lead Sent',
  ESR_GENERATED: 'Login Done',
  APPROVED: 'Sanctioned',
  DISBURSED: 'Disbursed',
  PARTLY_DISBURSED: 'Partly Disbursed',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  DRAFT: 'Draft',
};

// [light, dark] pill colors per stage — matches the theme-aware pill pattern used elsewhere (e.g. UsersListPage role pills)
const STAGE_COLORS = {
  LEAD_CREATED: { light: ['#FEF3C7', '#92400E'], dark: ['#78350F', '#FDE68A'] },
  DATA_COLLECTION: { light: ['#E0F2FE', '#0369A1'], dark: ['#0c4a6e', '#7dd3fc'] },
  LEAD_SENT_TO_LENDER: { light: ['#F3E8FF', '#6B21A8'], dark: ['#4c1d95', '#d8b4fe'] },
  ESR_GENERATED: { light: ['#FFEDD5', '#C2410C'], dark: ['#7c2d12', '#fdba74'] },
  APPROVED: { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  DISBURSED: { light: ['#DCFCE7', '#166534'], dark: ['#14532d', '#86efac'] },
  PARTLY_DISBURSED: { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  CLOSED: { light: ['#F3F4F6', '#374151'], dark: ['#1f2937', '#d1d5db'] },
  REJECTED: { light: ['#FEE2E2', '#991B1B'], dark: ['#7f1d1d', '#fca5a5'] },
  DRAFT: { light: ['#F3F4F6', '#6B7280'], dark: ['#1f2937', '#9ca3af'] },
};

const ENTITY_TYPE_OPTIONS = ['Partnership', 'Pvt Ltd', 'LLP', 'Proprietorship', 'Public Ltd'].map(v => ({ value: v, label: v }));
const CUSTOMER_TYPE_OPTIONS = [
  { value: 'MSME', label: 'Business / MSME' },
  { value: 'SALARIED', label: 'Salaried' },
];
const LENDER_OPTIONS = ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'SBI', 'IDFC First'].map(v => ({ value: v, label: v }));
const ALERT_OPTIONS = [{ value: 'PDD_PENDING', label: 'PDD Pending' }];
const SORT_OPTIONS = [
  { label: 'Newest First', by: 'lead_date', order: 'desc' },
  { label: 'Oldest First', by: 'lead_date', order: 'asc' },
  { label: 'Name A-Z', by: 'name', order: 'asc' },
  { label: 'Bureau Score (High-Low)', by: 'cibil_score', order: 'desc' },
  { label: 'Amount (High-Low)', by: 'loan_amount', order: 'desc' },
];
// True server-side pagination — one page of (at most) 50 cases per request.
// The backend hard-caps at this same value regardless of what's asked for
// (see case.service.js's MAX_PIPELINE_PAGE_SIZE), since it also fans out
// into a live-pull-status query per row.
const LIMIT = 50;

const formatCurrency = (val) => {
  // Prisma Decimal fields (sanctioned/disbursed/loan amount) serialize over
  // JSON as STRINGS (e.g. "0.00"), not numbers — `total_disbursed_amount`
  // in particular defaults to Decimal 0, not null, for every undisbursed
  // case. A non-empty string is truthy in JS, so the old `!val` check never
  // caught it and every undisbursed case showed "D: ₹0.00" instead of "—";
  // it also meant `.toLocaleString()` ran on a string (a no-op) rather than
  // actually formatting real amounts with thousands separators. Coercing to
  // a Number first fixes both.
  const num = Number(val);
  if (!num) return '—';
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(1)} Cr`;
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateStr));
};

// Lightweight relative-time formatter (avoids pulling in date-fns just for this)
const formatRelative = (dateStr) => {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const getCibilColor = (score, isDark) => {
  if (!score) return isDark ? '#64748b' : '#9CA3AF';
  if (score >= 700) return isDark ? '#6ee7b7' : '#10B981';
  if (score >= 650) return isDark ? '#fcd34d' : '#F59E0B';
  return isDark ? '#fca5a5' : '#EF4444';
};

const labelSm = (isDark) => ({ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 });
const underlineInput = (active) => ({
  background: 'transparent', border: 'none',
  borderBottom: `2px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
  outline: 'none', width: '100%', padding: '6px 0',
  fontSize: 13, fontWeight: 600, color: 'var(--on-surface)',
  transition: 'border-color 0.2s',
});

// Checkbox dropdown allowing zero-or-more selections. Empty selection reads
// as "All" (no filter applied) — matches the previous single-select's
// "All ..." sentinel option, just without needing a literal sentinel value.
const MultiSelectFilter = ({ label, options, selected, onChange, allLabel, isDark }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (value) => onChange(
    selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
  );

  const displayText = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label || selected[0])
      : `${selected.length} selected`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <span style={labelSm(isDark)}>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ ...underlineInput(selected.length > 0), textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, marginLeft: 6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: isDark ? '#fff' : 'var(--on-muted)' }} />
      </button>
      {open && (
        <div className="hide-scrollbar" style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 30,
          background: 'var(--surface)', border: '1px solid var(--outline)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 200, maxWidth: 260, maxHeight: 260, overflowY: 'auto', padding: 6,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer', borderBottom: '1px solid var(--outline)', marginBottom: 4 }}>
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
            {allLabel}
          </label>
          {options.map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', cursor: 'pointer', borderRadius: 6 }}>
              <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// Three breathing dots — same "actively working" signal PullStatusTracker's
// row-level animation already uses, reused here at badge scale so a pending
// pull reads consistently everywhere it shows up in the app.
const WorkingDots = ({ color }) => (
  <span style={{ display: 'inline-flex', gap: 2.5, alignItems: 'center' }}>
    {[0, 0.15, 0.3].map((delay, i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay }}
        style={{ width: 4, height: 4, borderRadius: '50%', background: color, display: 'inline-block' }}
      />
    ))}
  </span>
);

/**
 * "Action needed" / "data ready" badge for a case row's Stage/Alert cell —
 * pending (GST/ITR/bank sent to the customer or still processing server-side)
 * gets the animated dots; a completed pull the DSA hasn't opened the case to
 * see yet gets a static "ready" pill instead, since nothing further is
 * actually happening for that one.
 */
const PullAlertBadge = ({ pending, unseenCompleted, isDark, compact }) => {
  const fontSize = compact ? 10 : 11;
  const padding = compact ? '2px 6px' : '3px 8px';
  if (pending.length > 0) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? '#78350F' : '#FEF3C7', color: isDark ? '#FDE68A' : '#92400E', padding, borderRadius: 4, fontSize, fontWeight: 700 }}>
        <WorkingDots color={isDark ? '#FDE68A' : '#92400E'} /> {pending.join('/')} pending
      </div>
    );
  }
  if (unseenCompleted.length > 0) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? '#064e3b' : '#D1FAE5', color: isDark ? '#6ee7b7' : '#065F46', padding, borderRadius: 4, fontSize, fontWeight: 700 }}>
        <CheckCircle2 size={compact ? 10 : 11} /> {unseenCompleted.join('/')} data ready
      </div>
    );
  }
  return null;
};

const PULL_LABELS = [['gst', 'GST'], ['itr', 'ITR'], ['bank', 'BANK']];

/**
 * Live-updates the current page's pending/unseen-completed pull badges over
 * the same case-room sockets the case detail page itself uses (see
 * lib/realtime.js's subscribeToCasePulls) — bounded to whatever's actually
 * on screen (at most LIMIT rows), same as any other socket consumer here.
 *
 * The initial paint comes from each case's own `pull_status` (computed
 * server-side in case.service.js's attachPullStatus, using the real
 * pull_alerts_viewed_at cutoff); this hook only ever ADDS to or overrides
 * that per case once a live snapshot arrives, so a page's very first render
 * is never stuck on "nothing" while sockets connect.
 */
function usePagePullStatus(caseIds) {
  const [liveByCase, setLiveByCase] = useState({});
  const idsKey = caseIds.join(',');

  useEffect(() => {
    if (!idsKey) { setLiveByCase({}); return undefined; }
    const ids = idsKey.split(',').map(Number);
    const unsubscribes = ids.map((id) => subscribeToCasePulls(id, (snapshot) => {
      setLiveByCase((prev) => {
        const prevEntry = prev[id];
        const pending = [];
        const justCompleted = [];
        for (const [key, label] of PULL_LABELS) {
          const overall = snapshot?.[key]?.overall;
          if (!overall) continue;
          if (overall.live) { pending.push(label); continue; }
          // Was pending a moment ago (per this same live stream) and just
          // finished — flag it "ready" immediately, without waiting for a
          // page reload to pick up the server-computed unseen_completed.
          if (prevEntry?.pending?.includes(label) && overall.phase === 'COMPLETED') {
            justCompleted.push(label);
          }
        }
        const mergedJustCompleted = [...new Set([...(prevEntry?.justCompleted || []), ...justCompleted])];
        return { ...prev, [id]: { pending, justCompleted: mergedJustCompleted } };
      });
    }));
    return () => unsubscribes.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return liveByCase;
}

const CustomersListPage = () => {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mutedColor = isDark ? '#fff' : 'var(--on-muted)';

  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({ totalCases: 0, totalCustomers: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Each of these holds zero or more selected values — empty means "All".
  const [selectedStages, setSelectedStages] = useState([]);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState([]);
  const [selectedCustomerTypes, setSelectedCustomerTypes] = useState([]);
  const [selectedLenders, setSelectedLenders] = useState([]);
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [sortIndex, setSortIndex] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  // Search, sort, every facet, AND the page itself all go to the backend now
  // — true server-side pagination (50 rows/request) instead of fetching up
  // to 1000 rows once and slicing/filtering them client-side. Each facet is
  // still multi-select in the UI; the backend now takes a comma-joined list
  // per facet and filters with an SQL `IN`, so OR-within-a-facet still works.
  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        search,
        stage: selectedStages.join(','),
        lender: selectedLenders.join(','),
        entity_type: selectedEntityTypes.join(','),
        category: selectedCustomerTypes.join(','),
        alert: selectedAlerts.join(','),
        sort_by: SORT_OPTIONS[sortIndex].by,
        sort_order: SORT_OPTIONS[sortIndex].order,
        page,
        limit: LIMIT,
      };
      const data = await caseService.getPipeline(params);
      setCases(Array.isArray(data.cases) ? data.cases : []);
      setStats({ totalCases: data.total_cases || 0, totalCustomers: data.total_customers || 0 });
      setTotalPages(Math.max(1, data.total_pages || 1));
    } catch (error) {
      toast.error('Failed to load pipeline data.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search, sortIndex, page, selectedStages, selectedLenders, selectedEntityTypes, selectedCustomerTypes, selectedAlerts]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  useEffect(() => {
    const handler = setTimeout(() => { setSearch(searchInput); setPage(1); }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // The server already returns exactly one page — no further client-side
  // filtering or slicing needed.
  const pagedCases = cases;

  // Live pending/data-ready pull badges for whatever's on screen right now —
  // see usePagePullStatus's own header.
  const livePullStatusByCase = usePagePullStatus(useMemo(() => pagedCases.map((c) => c.id), [pagedCases]));
  const getPullAlert = useCallback((c) => {
    const live = livePullStatusByCase[c.id];
    const pending = live?.pending ?? c.pull_status?.pending ?? [];
    const unseenCompleted = [...new Set([...(c.pull_status?.unseen_completed || []), ...(live?.justCompleted || [])])]
      .filter((t) => !pending.includes(t));
    return { pending, unseenCompleted };
  }, [livePullStatusByCase]);

  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const handleStageToggle = (val) => {
    setSelectedStages((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
    setPage(1);
  };
  const handleFacetChange = (setter) => (next) => { setter(next); setPage(1); };

  const goToCase = (c) => {
    if (c.stage === 'DRAFT') {
      // Classification lives on the case itself, not the shared customer
      // record — the same PAN/customer can have one salaried case and one
      // MSME case at once.
      const path = c.category === 'SALARIED' ? '/customers/salaried/add' : '/customers/add';
      navigate(`${path}?caseId=${c.id}`);
    } else if (c.stage === 'DATA_COLLECTION') {
      // ESR (step 6) now renders inline inside AddCustomerWizardPage.
      navigate(`/customers/add?caseId=${c.id}&step=6`);
    } else {
      navigate(`/cases/${c.id}`);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <style>{`
        .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .add-customer-btn-compact { padding: 5px 14px !important; font-size: 12px !important; }
      `}</style>
      {/* ─── Top header ─── */}
      <div style={{ padding: isMobile ? '80px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Pipeline & Customers"
          subtitle={`${stats.totalCases} active cases · ${stats.totalCustomers} customers`}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                data-tour="pipeline-bulk-upload"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsBulkUploadModalOpen(true)}
              >
                <Upload size={13} /> Bulk Upload
              </button>
              <div data-tour="pipeline-add-customer" style={{ display: 'inline-flex' }}>
                <TravelingBorderButton onClick={() => setIsTypeModalOpen(true)} size="sm" solid showIcon={false} className="add-customer-btn-compact">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UserPlus size={13} /> Add New Customer
                  </div>
                </TravelingBorderButton>
              </div>
            </div>
          }
        />
      </div>

      <CustomerTypeModal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} />
      <BulkUploadModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        onSuccess={() => fetchPipeline()}
      />

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '16px' : '20px 20px', display: 'flex', gap: isMobile ? 16 : 24, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
        <div data-tour="pipeline-search" style={{ flex: '0 1 240px', minWidth: isMobile ? '100%' : 180, maxWidth: isMobile ? '100%' : 240 }}>
          <span style={labelSm(isDark)}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 0, bottom: 9, color: isDark ? '#fff' : '#94a3b8' }} />
            <input
              type="text"
              placeholder="Name, Case ID, lender, PAN, phone, email…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
            />
          </div>
        </div>

        <div data-tour="pipeline-filters" style={{ display: 'flex', gap: isMobile ? 16 : 20, flexWrap: 'wrap', flex: '1 1 0', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 145 }}>
          <MultiSelectFilter
            label="Customer type" allLabel="All customer types" isDark={isDark}
            options={CUSTOMER_TYPE_OPTIONS} selected={selectedCustomerTypes}
            onChange={handleFacetChange(setSelectedCustomerTypes)}
          />
        </div>

        <div style={{ flex: 1, minWidth: 145 }}>
          <MultiSelectFilter
            label="Entity Type" allLabel="All Entity Types" isDark={isDark}
            options={ENTITY_TYPE_OPTIONS} selected={selectedEntityTypes}
            onChange={handleFacetChange(setSelectedEntityTypes)}
          />
        </div>

        <div style={{ flex: 1, minWidth: 135 }}>
          <MultiSelectFilter
            label="Lender" allLabel="All Lenders" isDark={isDark}
            options={LENDER_OPTIONS} selected={selectedLenders}
            onChange={handleFacetChange(setSelectedLenders)}
          />
        </div>

        <div style={{ flex: 1, minWidth: 120 }}>
          <MultiSelectFilter
            label="Alert" allLabel="All Alerts" isDark={isDark}
            options={ALERT_OPTIONS} selected={selectedAlerts}
            onChange={handleFacetChange(setSelectedAlerts)}
          />
        </div>

        <div style={{ flex: 1, minWidth: 145 }}>
          <span style={labelSm(isDark)}>Sort</span>
          <select value={sortIndex} onChange={(e) => { setSortIndex(Number(e.target.value)); setPage(1); }}
            style={{ ...underlineInput(sortIndex !== 0), appearance: 'none', cursor: 'pointer' }}>
            {SORT_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
          </select>
        </div>
        </div>
      </div>

      {/* ─── Stage tabs (multi-select, compact) ─── */}
      <div data-tour="pipeline-stage-tabs" className="hide-scrollbar" style={{ padding: isMobile ? '8px 16px' : '8px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
        <button
          onClick={() => { setSelectedStages([]); setPage(1); }}
          style={{
            background: selectedStages.length === 0 ? '#4f46e5' : 'transparent',
            color: selectedStages.length === 0 ? '#fff' : mutedColor,
            border: `1px solid ${selectedStages.length === 0 ? '#4f46e5' : 'var(--outline)'}`,
            padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', lineHeight: 1.6,
          }}
        >
          All
        </button>
        {Object.entries(STAGE_MAPPING).filter(([tab]) => tab !== 'All').map(([tab, enumVal]) => {
          const active = selectedStages.includes(enumVal);
          return (
            <button
              key={tab}
              onClick={() => handleStageToggle(enumVal)}
              style={{
                background: active ? '#4f46e5' : 'transparent',
                color: active ? '#fff' : mutedColor,
                border: `1px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', lineHeight: 1.6,
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
          <LoadingSpinner fullPage />
        </div>
      ) : pagedCases.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No cases found</h3>
          <p style={{ fontSize: 13, color: mutedColor, margin: 0 }}>Try adjusting your filters or search term.</p>
        </div>
      ) : isMobile ? (
        /* ─── Mobile: stacked cards — never scrolls horizontally ─── */
        <div data-tour="pipeline-results" className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {pagedCases.map((c) => {
            const stageColors = STAGE_COLORS[c.stage] || STAGE_COLORS.DRAFT;
            const [stageBg, stageColor] = isDark ? stageColors.dark : stageColors.light;
            return (
              <div key={c.id} style={{ border: '1px solid var(--outline)', borderRadius: 10, padding: 14, marginBottom: 12, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>CASE-{c.id}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        color: c.category === 'SALARIED' ? 'var(--info)' : 'var(--success)',
                        background: c.category === 'SALARIED' ? 'var(--info-bg)' : 'var(--success-bg)'
                      }}>{c.category === 'SALARIED' ? 'SALARIED' : 'BUSINESS'}</span>
                    </div>
                    {c.parent_case_id && (
                      <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>↳ From CASE-{c.parent_case_id}</div>
                    )}
                  </div>
                  <span style={{ background: stageBg, color: stageColor, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {STAGE_LABELS[c.stage] || c.stage}
                  </span>
                </div>

                <div
                  style={{ fontWeight: 700, color: isDark ? '#fff' : '#4f46e5', marginBottom: 2, wordBreak: 'break-word' }}
                  onClick={() => navigate(`/customers/${c.customer_id}`)}
                >
                  {toTitleCase(isUsableEntityName(c.customer_name) ? c.customer_name : resolveEntityName(c.customer)) || '—'}
                </div>
                <div style={{ fontSize: 11, color: mutedColor, marginBottom: 12 }}>
                  {[c.entity_type || c.customer?.entity_type, c.customer?.industry, c.customer?.business_vintage ? `${c.customer.business_vintage} yrs` : null].filter(Boolean).join(' · ') || '—'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: c.alert_flag === 'PDD_PENDING' ? 10 : 0 }}>
                  <div><div style={labelSm(isDark)}>Employee</div><div style={{ color: 'var(--on-surface)', wordBreak: 'break-word' }}>{c.customer?.created_by?.name || '—'}</div></div>
                  <div><div style={labelSm(isDark)}>Bureau Score</div><div style={{ fontWeight: 800, color: getCibilColor(c.cibil_score, isDark) }}>{c.cibil_score || '—'}</div></div>
                  <div><div style={labelSm(isDark)}>Lender</div><div style={{ color: 'var(--on-surface)', wordBreak: 'break-word' }}>{c.lender_name || '—'}</div></div>
                  <div><div style={labelSm(isDark)}>Product</div><div style={{ color: 'var(--on-surface)', wordBreak: 'break-word' }}>{c.product_type || '—'}</div></div>
                  <div><div style={labelSm(isDark)}>Sanctioned</div><div style={{ color: 'var(--on-surface)' }}>{formatCurrency(c.sanctioned_amount || c.parent_case?.sanctioned_amount)}</div></div>
                  <div><div style={labelSm(isDark)}>Disbursed</div><div style={{ color: isDark ? '#6ee7b7' : '#059669', fontWeight: 700 }}>{formatCurrency(c.total_disbursed_amount || c.parent_case?.total_disbursed_amount)}</div></div>
                  <div><div style={labelSm(isDark)}>Updated</div><div style={{ color: 'var(--on-surface)' }}>{formatRelative(c.updated_at)}</div></div>
                </div>

                {(() => {
                  const { pending, unseenCompleted } = getPullAlert(c);
                  return (pending.length > 0 || unseenCompleted.length > 0) && (
                    <div style={{ marginBottom: 10 }}>
                      <PullAlertBadge pending={pending} unseenCompleted={unseenCompleted} isDark={isDark} />
                    </div>
                  );
                })()}
                {c.alert_flag === 'PDD_PENDING' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? '#78350F' : '#FEF3C7', color: isDark ? '#FDE68A' : '#92400E', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
                    <AlertTriangle size={12} /> PDD Pending
                  </div>
                )}
                {c.data_purged_at && (
                  <div style={{ marginBottom: 10 }}><DataPurgedBadge /></div>
                )}

                <button
                  onClick={() => goToCase(c)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    background: 'transparent', border: '1px solid var(--outline)', borderRadius: 8,
                    padding: '8px 10px', fontSize: 12, fontWeight: 700, color: '#4f46e5', cursor: 'pointer',
                  }}
                >
                  {c.stage === 'DRAFT' ? 'Resume Wizard' : c.stage === 'DATA_COLLECTION' ? 'Continue to ESR' : 'View Case'}
                  <ChevronRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── Tablet / Desktop: fixed-layout table, wraps instead of overflowing — never scrolls horizontally ─── */
        <div data-tour="pipeline-results" className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '9%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} />
              <col style={{ width: '9%' }} /><col style={{ width: '20%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Case', 'Customer', 'Lender / Product', 'Bureau Score', 'Amounts (Sanc / Disb)', 'Stage / Alert', 'Updated', 'Action'].map((h) => (
                  <th key={h} style={{
                    position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)',
                    padding: '10px 8px', fontSize: 10, fontWeight: 800, color: mutedColor,
                    textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
                    borderBottom: '2px solid var(--outline)', boxShadow: '0 2px 0 var(--outline)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedCases.map((c) => {
                const stageColors = STAGE_COLORS[c.stage] || STAGE_COLORS.DRAFT;
                const [stageBg, stageColor] = isDark ? stageColors.dark : stageColors.light;
                const cellStyle = { padding: '12px 8px', verticalAlign: 'middle', fontSize: 12, wordBreak: 'break-word', whiteSpace: 'normal', textAlign: 'center' };
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--outline)' }}>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 700, color: 'var(--on-surface)' }}>CASE-{c.id}</div>
                      <div style={{ marginTop: 3, display: 'flex', justifyContent: 'center' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          color: c.category === 'SALARIED' ? 'var(--info)' : 'var(--success)',
                          background: c.category === 'SALARIED' ? 'var(--info-bg)' : 'var(--success-bg)'
                        }}>{c.category === 'SALARIED' ? 'SALARIED' : 'BUSINESS'}</span>
                      </div>
                      {c.parent_case_id && <div style={{ fontSize: 10, color: mutedColor, marginTop: 2 }}>↳ CASE-{c.parent_case_id}</div>}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 700, color: isDark ? '#fff' : '#4f46e5', cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.customer_id}`)}>
                        {toTitleCase(isUsableEntityName(c.customer_name) ? c.customer_name : resolveEntityName(c.customer)) || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: mutedColor, marginTop: 2 }}>
                        {[c.entity_type || c.customer?.entity_type, c.customer?.industry, c.customer?.business_vintage ? `${c.customer.business_vintage} yrs` : null].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: mutedColor, marginTop: 2 }}>{c.customer?.created_by?.name || ''}</div>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ color: 'var(--on-surface)' }}>{c.lender_name || '—'}</div>
                      <div style={{ fontSize: 10, color: mutedColor, marginTop: 2 }}>{c.product_type || '—'}</div>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ fontWeight: 800, color: getCibilColor(c.cibil_score, isDark) }}>{c.cibil_score || '—'}</span>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ color: 'var(--on-surface)' }}>S: {formatCurrency(c.sanctioned_amount || c.parent_case?.sanctioned_amount)}</div>
                      <div style={{ color: isDark ? '#6ee7b7' : '#059669', fontWeight: 700, marginTop: 2 }}>D: {formatCurrency(c.total_disbursed_amount || c.parent_case?.total_disbursed_amount)}</div>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', background: stageBg, color: stageColor, padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 700 }}>
                          {STAGE_LABELS[c.stage] || formatStatusLabel(c.stage)}
                        </span>
                        {(() => {
                          const { pending, unseenCompleted } = getPullAlert(c);
                          return (pending.length > 0 || unseenCompleted.length > 0) && (
                            <PullAlertBadge pending={pending} unseenCompleted={unseenCompleted} isDark={isDark} compact />
                          );
                        })()}
                        {c.alert_flag === 'PDD_PENDING' && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: isDark ? '#78350F' : '#FEF3C7', color: isDark ? '#FDE68A' : '#92400E', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                            <AlertTriangle size={10} /> PDD
                          </div>
                        )}
                        {c.data_purged_at && <DataPurgedBadge />}
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ color: mutedColor }}>{formatDate(c.lead_date)}</div>
                      <div style={{ color: mutedColor, marginTop: 2 }}>{formatRelative(c.updated_at)}</div>
                    </td>
                    <td style={cellStyle}>
                      <button
                        onClick={() => goToCase(c)}
                        style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: 11, fontWeight: 700, color: '#4f46e5', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {c.stage === 'DRAFT' ? 'Resume' : c.stage === 'DATA_COLLECTION' ? 'ESR' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && pagedCases.length > 0 && (
        <>
          {totalPages > 1 && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: mutedColor }}>
                Showing {(page - 1) * LIMIT + 1} to {Math.min(page * LIMIT, stats.totalCases)} of {stats.totalCases} results
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{ padding: '6px 14px', border: '1px solid var(--outline)', borderRadius: 6, background: 'var(--surface)', fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
                >
                  Prev
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 14px', border: '1px solid var(--outline)', borderRadius: 6, background: 'var(--surface)', fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <PageTour pageKey="pipeline" steps={PIPELINE_TOUR_STEPS} />
    </div>
  );
};

export default CustomersListPage;
