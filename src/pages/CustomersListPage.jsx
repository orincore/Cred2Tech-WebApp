import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { caseService } from '../api/caseService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { toTitleCase, resolveEntityName, isUsableEntityName } from '../utils/helpers';
import TravelingBorderButton from '../components/TravelingBorderButton';
import CustomerTypeModal from '../components/customers/CustomerTypeModal';
import PageHeader from '../components/ui/PageHeader';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-hot-toast';

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
  LEAD_CREATED:         { light: ['#FEF3C7', '#92400E'], dark: ['#78350F', '#FDE68A'] },
  DATA_COLLECTION:      { light: ['#E0F2FE', '#0369A1'], dark: ['#0c4a6e', '#7dd3fc'] },
  LEAD_SENT_TO_LENDER:  { light: ['#F3E8FF', '#6B21A8'], dark: ['#4c1d95', '#d8b4fe'] },
  ESR_GENERATED:        { light: ['#FFEDD5', '#C2410C'], dark: ['#7c2d12', '#fdba74'] },
  APPROVED:             { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  DISBURSED:            { light: ['#DCFCE7', '#166534'], dark: ['#14532d', '#86efac'] },
  PARTLY_DISBURSED:     { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  CLOSED:               { light: ['#F3F4F6', '#374151'], dark: ['#1f2937', '#d1d5db'] },
  REJECTED:             { light: ['#FEE2E2', '#991B1B'], dark: ['#7f1d1d', '#fca5a5'] },
  DRAFT:                { light: ['#F3F4F6', '#6B7280'], dark: ['#1f2937', '#9ca3af'] },
};

const ENTITY_TYPE_OPTIONS = ['Partnership', 'Pvt Ltd', 'LLP', 'Proprietorship', 'Public Ltd'].map(v => ({ value: v, label: v }));
const LENDER_OPTIONS = ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'SBI', 'IDFC First'].map(v => ({ value: v, label: v }));
const ALERT_OPTIONS = [{ value: 'PDD_PENDING', label: 'PDD Pending' }];
const SORT_OPTIONS = [
  { label: 'Newest First', by: 'lead_date', order: 'desc' },
  { label: 'Oldest First', by: 'lead_date', order: 'asc' },
  { label: 'Name A-Z', by: 'name', order: 'asc' },
  { label: 'Bureau Score (High-Low)', by: 'cibil_score', order: 'desc' },
  { label: 'Amount (High-Low)', by: 'loan_amount', order: 'desc' },
];
const LIMIT = 10;
// Cases are fetched once (search + sort only) and then faceted client-side,
// since the backend's pipeline filters only accept a single value each.
// This ceiling keeps that one fetch bounded.
const FETCH_CEILING = 1000;

const formatCurrency = (val) => {
  if (!val) return '—';
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(1)} Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
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
  const [selectedLenders, setSelectedLenders] = useState([]);
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [sortIndex, setSortIndex] = useState(0);

  const [page, setPage] = useState(1);

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  // Only search + sort go to the backend — stage/lender/entity/alert are
  // faceted client-side below, since the pipeline endpoint only accepts one
  // value per filter and multi-select needs OR-within-a-facet.
  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        search,
        stage: 'All',
        sort_by: SORT_OPTIONS[sortIndex].by,
        sort_order: SORT_OPTIONS[sortIndex].order,
        page: 1,
        limit: FETCH_CEILING,
      };
      const data = await caseService.getPipeline(params);
      setCases(Array.isArray(data.cases) ? data.cases : []);
      setStats((s) => ({ ...s, totalCustomers: data.total_customers || 0 }));
    } catch (error) {
      toast.error('Failed to load pipeline data.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search, sortIndex]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  useEffect(() => {
    const handler = setTimeout(() => { setSearch(searchInput); setPage(1); }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const filteredCases = useMemo(() => cases.filter((c) =>
    (selectedStages.length === 0 || selectedStages.includes(c.stage)) &&
    (selectedEntityTypes.length === 0 || selectedEntityTypes.includes(c.entity_type || c.customer?.entity_type)) &&
    (selectedLenders.length === 0 || selectedLenders.includes(c.lender_name)) &&
    (selectedAlerts.length === 0 || selectedAlerts.includes(c.alert_flag))
  ), [cases, selectedStages, selectedEntityTypes, selectedLenders, selectedAlerts]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / LIMIT));
  const pagedCases = useMemo(() => filteredCases.slice((page - 1) * LIMIT, page * LIMIT), [filteredCases, page]);

  useEffect(() => { setStats((s) => ({ ...s, totalCases: filteredCases.length })); }, [filteredCases]);
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
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <TravelingBorderButton onClick={() => setIsTypeModalOpen(true)} size="sm" solid showIcon={false} className="add-customer-btn-compact">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserPlus size={13} /> Add New Customer
            </div>
          </TravelingBorderButton>
        </div>
      </div>

      <CustomerTypeModal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} />

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '16px' : '20px 20px', display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{ flex: 2, minWidth: 200, maxWidth: 360 }}>
          <span style={labelSm(isDark)}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 0, bottom: 9, color: isDark ? '#fff' : '#94a3b8' }} />
            <input
              type="text"
              placeholder="Name, Case ID, lender, PAN…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <MultiSelectFilter
            label="Entity Type" allLabel="All Entity Types" isDark={isDark}
            options={ENTITY_TYPE_OPTIONS} selected={selectedEntityTypes}
            onChange={handleFacetChange(setSelectedEntityTypes)}
          />
        </div>

        <div style={{ flex: 1, minWidth: 150 }}>
          <MultiSelectFilter
            label="Lender" allLabel="All Lenders" isDark={isDark}
            options={LENDER_OPTIONS} selected={selectedLenders}
            onChange={handleFacetChange(setSelectedLenders)}
          />
        </div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <MultiSelectFilter
            label="Alert" allLabel="All Alerts" isDark={isDark}
            options={ALERT_OPTIONS} selected={selectedAlerts}
            onChange={handleFacetChange(setSelectedAlerts)}
          />
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <span style={labelSm(isDark)}>Sort</span>
          <select value={sortIndex} onChange={(e) => { setSortIndex(Number(e.target.value)); setPage(1); }}
            style={{ ...underlineInput(sortIndex !== 0), appearance: 'none', cursor: 'pointer' }}>
            {SORT_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* ─── Stage tabs (multi-select, compact) ─── */}
      <div className="hide-scrollbar" style={{ padding: isMobile ? '8px 16px' : '8px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
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
      ) : filteredCases.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No cases found</h3>
          <p style={{ fontSize: 13, color: mutedColor, margin: 0 }}>Try adjusting your filters or search term.</p>
        </div>
      ) : isMobile ? (
        /* ─── Mobile: stacked cards — never scrolls horizontally ─── */
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
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
                  <div><div style={labelSm(isDark)}>Requested</div><div style={{ color: 'var(--on-surface)' }}>{formatCurrency(c.loan_amount || c.parent_case?.loan_amount)}</div></div>
                  <div><div style={labelSm(isDark)}>Sanctioned</div><div style={{ color: 'var(--on-surface)' }}>{formatCurrency(c.sanctioned_amount || c.parent_case?.sanctioned_amount)}</div></div>
                  <div><div style={labelSm(isDark)}>Disbursed</div><div style={{ color: isDark ? '#6ee7b7' : '#059669', fontWeight: 700 }}>{formatCurrency(c.total_disbursed_amount || c.parent_case?.total_disbursed_amount)}</div></div>
                  <div><div style={labelSm(isDark)}>Updated</div><div style={{ color: 'var(--on-surface)' }}>{formatRelative(c.updated_at)}</div></div>
                </div>

                {c.alert_flag === 'PDD_PENDING' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? '#78350F' : '#FEF3C7', color: isDark ? '#FDE68A' : '#92400E', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
                    <AlertTriangle size={12} /> PDD Pending
                  </div>
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
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '9%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} />
              <col style={{ width: '9%' }} /><col style={{ width: '20%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Case', 'Customer', 'Lender / Product', 'Bureau Score', 'Amounts (Req / Sanc / Disb)', 'Stage / Alert', 'Updated', 'Action'].map((h) => (
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
                      <div style={{ color: 'var(--on-surface)' }}>R: {formatCurrency(c.loan_amount || c.parent_case?.loan_amount)}</div>
                      <div style={{ color: 'var(--on-surface)', marginTop: 2 }}>S: {formatCurrency(c.sanctioned_amount || c.parent_case?.sanctioned_amount)}</div>
                      <div style={{ color: isDark ? '#6ee7b7' : '#059669', fontWeight: 700, marginTop: 2 }}>D: {formatCurrency(c.total_disbursed_amount || c.parent_case?.total_disbursed_amount)}</div>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', background: stageBg, color: stageColor, padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                          {STAGE_LABELS[c.stage] || c.stage}
                        </span>
                        {c.alert_flag === 'PDD_PENDING' && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: isDark ? '#78350F' : '#FEF3C7', color: isDark ? '#FDE68A' : '#92400E', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                            <AlertTriangle size={10} /> PDD
                          </div>
                        )}
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

      {!loading && filteredCases.length > 0 && (
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
    </div>
  );
};

export default CustomersListPage;
