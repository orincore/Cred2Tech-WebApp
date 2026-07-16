import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, AlertTriangle, ChevronRight } from 'lucide-react';
import { caseService } from '../api/caseService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import TravelingBorderButton from '../components/TravelingBorderButton';
import CustomerTypeModal from '../components/customers/CustomerTypeModal';
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

const ENTITY_TYPES = ['All Entity Types', 'Partnership', 'Pvt Ltd', 'LLP', 'Proprietorship', 'Public Ltd'];
const LENDERS = ['All Lenders', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'SBI', 'IDFC First'];
const ALERT_TYPES = ['All Alerts', 'PDD_PENDING'];
const SORT_OPTIONS = [
  { label: 'Newest First', by: 'lead_date', order: 'desc' },
  { label: 'Oldest First', by: 'lead_date', order: 'asc' },
  { label: 'Name A-Z', by: 'name', order: 'asc' },
  { label: 'CIBIL (High-Low)', by: 'cibil_score', order: 'desc' },
  { label: 'Amount (High-Low)', by: 'loan_amount', order: 'desc' },
];
const LIMIT = 10;

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

const labelSm = { fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
const underlineInput = (active) => ({
  background: 'transparent', border: 'none',
  borderBottom: `2px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
  outline: 'none', width: '100%', padding: '6px 0',
  fontSize: 13, fontWeight: 600, color: 'var(--on-surface)',
  transition: 'border-color 0.2s',
});

const CustomersListPage = () => {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({ totalCases: 0, totalCustomers: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [entityType, setEntityType] = useState('All Entity Types');
  const [lender, setLender] = useState('All Lenders');
  const [alertFilter, setAlertFilter] = useState('All Alerts');
  const [sortIndex, setSortIndex] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        search,
        stage: STAGE_MAPPING[activeTab] || 'All',
        entity_type: entityType,
        lender,
        alert: alertFilter,
        sort_by: SORT_OPTIONS[sortIndex].by,
        sort_order: SORT_OPTIONS[sortIndex].order,
        page,
        limit: LIMIT,
      };
      const data = await caseService.getPipeline(params);
      setCases(Array.isArray(data.cases) ? data.cases : []);
      setStats({ totalCases: data.total_cases || 0, totalCustomers: data.total_customers || 0 });
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      toast.error('Failed to load pipeline data.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search, activeTab, entityType, lender, alertFilter, sortIndex, page]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  useEffect(() => {
    const handler = setTimeout(() => { setSearch(searchInput); setPage(1); }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const handleTabChange = (tab) => { setActiveTab(tab); setPage(1); };
  const handleFilterChange = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const goToCase = (c) => {
    if (c.stage === 'DRAFT') {
      const path = c.customer?.category === 'SALARIED' ? '/customers/salaried/add' : '/customers/add';
      navigate(`${path}?caseId=${c.id}`);
    } else if (c.stage === 'DATA_COLLECTION') {
      navigate(`/cases/${c.id}/esr`);
    } else {
      navigate(`/cases/${c.id}`);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      {/* ─── Top header ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            My Pipeline
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Customers & Pipeline
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
            {stats.totalCases} active cases · {stats.totalCustomers} customers
          </p>
        </div>

        <TravelingBorderButton onClick={() => setIsTypeModalOpen(true)} size="sm" solid showIcon={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <UserPlus size={14} /> Add New Customer
          </div>
        </TravelingBorderButton>
      </div>

      <CustomerTypeModal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} />

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '16px' : '20px 20px', display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{ flex: 2, minWidth: 200, maxWidth: 360 }}>
          <span style={labelSm}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 0, bottom: 9, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Name, Case ID, lender, PAN…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <span style={labelSm}>Entity Type</span>
          <select value={entityType} onChange={handleFilterChange(setEntityType)}
            style={{ ...underlineInput(entityType !== 'All Entity Types'), appearance: 'none', cursor: 'pointer' }}>
            {ENTITY_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 130 }}>
          <span style={labelSm}>Lender</span>
          <select value={lender} onChange={handleFilterChange(setLender)}
            style={{ ...underlineInput(lender !== 'All Lenders'), appearance: 'none', cursor: 'pointer' }}>
            {LENDERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 120 }}>
          <span style={labelSm}>Alert</span>
          <select value={alertFilter} onChange={handleFilterChange(setAlertFilter)}
            style={{ ...underlineInput(alertFilter !== 'All Alerts'), appearance: 'none', cursor: 'pointer' }}>
            {ALERT_TYPES.map(a => <option key={a} value={a}>{a === 'PDD_PENDING' ? 'PDD Pending' : a}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <span style={labelSm}>Sort</span>
          <select value={sortIndex} onChange={handleFilterChange(setSortIndex)}
            style={{ ...underlineInput(sortIndex !== 0), appearance: 'none', cursor: 'pointer' }}>
            {SORT_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* ─── Stage tabs ─── */}
      <div style={{ padding: isMobile ? '12px 16px' : '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
        {Object.keys(STAGE_MAPPING).map(tab => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                background: active ? '#4f46e5' : 'transparent',
                color: active ? '#fff' : 'var(--on-muted)',
                border: `1px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
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
      ) : cases.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No cases found</h3>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>Try adjusting your filters or search term.</p>
        </div>
      ) : isMobile ? (
        /* ─── Mobile: stacked cards — never scrolls horizontally ─── */
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {cases.map((c) => {
            const stageColors = STAGE_COLORS[c.stage] || STAGE_COLORS.DRAFT;
            const [stageBg, stageColor] = isDark ? stageColors.dark : stageColors.light;
            return (
              <div key={c.id} style={{ border: '1px solid var(--outline)', borderRadius: 10, padding: 14, marginBottom: 12, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>CASE-{c.id}</div>
                    {c.parent_case_id && (
                      <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>↳ From CASE-{c.parent_case_id}</div>
                    )}
                  </div>
                  <span style={{ background: stageBg, color: stageColor, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {STAGE_LABELS[c.stage] || c.stage}
                  </span>
                </div>

                <div
                  style={{ fontWeight: 700, color: '#4f46e5', marginBottom: 2, wordBreak: 'break-word' }}
                  onClick={() => navigate(`/customers/${c.customer_id}`)}
                >
                  {c.customer_name || c.customer?.business_name || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--on-muted)', marginBottom: 12 }}>
                  {[c.entity_type || c.customer?.entity_type, c.customer?.industry, c.customer?.business_vintage ? `${c.customer.business_vintage} yrs` : null].filter(Boolean).join(' · ') || '—'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: c.alert_flag === 'PDD_PENDING' ? 10 : 0 }}>
                  <div><div style={labelSm}>Employee</div><div style={{ color: 'var(--on-surface)', wordBreak: 'break-word' }}>{c.customer?.created_by?.name || '—'}</div></div>
                  <div><div style={labelSm}>CIBIL</div><div style={{ fontWeight: 800, color: getCibilColor(c.cibil_score, isDark) }}>{c.cibil_score || '—'}</div></div>
                  <div><div style={labelSm}>Lender</div><div style={{ color: 'var(--on-surface)', wordBreak: 'break-word' }}>{c.lender_name || '—'}</div></div>
                  <div><div style={labelSm}>Product</div><div style={{ color: 'var(--on-surface)', wordBreak: 'break-word' }}>{c.product_type || '—'}</div></div>
                  <div><div style={labelSm}>Requested</div><div style={{ color: 'var(--on-surface)' }}>{formatCurrency(c.loan_amount || c.parent_case?.loan_amount)}</div></div>
                  <div><div style={labelSm}>Sanctioned</div><div style={{ color: 'var(--on-surface)' }}>{formatCurrency(c.sanctioned_amount || c.parent_case?.sanctioned_amount)}</div></div>
                  <div><div style={labelSm}>Disbursed</div><div style={{ color: isDark ? '#6ee7b7' : '#059669', fontWeight: 700 }}>{formatCurrency(c.total_disbursed_amount || c.parent_case?.total_disbursed_amount)}</div></div>
                  <div><div style={labelSm}>Updated</div><div style={{ color: 'var(--on-surface)' }}>{formatRelative(c.updated_at)}</div></div>
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '9%' }} /><col style={{ width: '21%' }} /><col style={{ width: '14%' }} />
              <col style={{ width: '6%' }} /><col style={{ width: '20%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--outline)' }}>
                {['Case', 'Customer', 'Lender / Product', 'CIBIL', 'Amounts (Req / Sanc / Disb)', 'Stage / Alert', 'Updated', 'Action'].map((h) => (
                  <th key={h} style={{ padding: '10px 8px', fontSize: 10, fontWeight: 800, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const stageColors = STAGE_COLORS[c.stage] || STAGE_COLORS.DRAFT;
                const [stageBg, stageColor] = isDark ? stageColors.dark : stageColors.light;
                const cellStyle = { padding: '12px 8px', verticalAlign: 'middle', fontSize: 12, wordBreak: 'break-word', whiteSpace: 'normal', textAlign: 'center' };
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--outline)' }}>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 700, color: 'var(--on-surface)' }}>CASE-{c.id}</div>
                      {c.parent_case_id && <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 2 }}>↳ CASE-{c.parent_case_id}</div>}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 700, color: '#4f46e5', cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.customer_id}`)}>
                        {c.customer_name || c.customer?.business_name || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 2 }}>
                        {[c.entity_type || c.customer?.entity_type, c.customer?.industry, c.customer?.business_vintage ? `${c.customer.business_vintage} yrs` : null].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 2 }}>{c.customer?.created_by?.name || ''}</div>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ color: 'var(--on-surface)' }}>{c.lender_name || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 2 }}>{c.product_type || '—'}</div>
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
                      <div style={{ color: 'var(--on-muted)' }}>{formatDate(c.lead_date)}</div>
                      <div style={{ color: 'var(--on-muted)', marginTop: 2 }}>{formatRelative(c.updated_at)}</div>
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

      {!loading && cases.length > 0 && (
        <>
          {totalPages > 1 && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>
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
