import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Eye, Edit, Building, RefreshCw, X, MapPin, Hash, Wallet, Activity, Building2, ShieldCheck } from 'lucide-react';
import { getTenants, getTenantSummary } from '../api/tenantService';
import { MOCK_TENANTS } from '../constants/mockData';
import { STATUS_OPTIONS } from '../constants/roles';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDate, getInitials } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import TravelingBorderButton from '../components/TravelingBorderButton';
import DataTable from '../components/DataTable';

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

const TenantsListPage = () => {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTenants();
      setTenants(Array.isArray(data) ? data : data.tenants || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load DSAs.');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const openSummary = async (id) => {
    setSelectedTenantId(id);
    setSummaryData(null);
    setLoadingSummary(true);
    try {
      const data = await getTenantSummary(id);
      setSummaryData(data);
    } catch (err) {
      console.error('Failed to load summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        String(t.name).toLowerCase().includes(q) ||
        String(t.pan_number || '').toLowerCase().includes(q);
      const matchType = !filterType || t.type === filterType;
      const matchStatus = !filterStatus || t.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [tenants, search, filterType, filterStatus]);

  const hasFilters = search || filterType || filterStatus;

  const avatarPalette = [
    ['#ede9fe', '#4f46e5'], ['#dbeafe', '#1d4ed8'],
    ['#fce7f3', '#be185d'], ['#d1fae5', '#065f46'], ['#fef3c7', '#92400e'],
  ];
  const avatarColors = (name = '') => avatarPalette[(name.charCodeAt(0) || 0) % avatarPalette.length];

  /* ---- label style shared across filters ---- */
  const labelSm = { fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
  const underlineInput = (active) => ({
    background: 'transparent', border: 'none',
    borderBottom: `2px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
    outline: 'none', width: '100%', padding: '6px 0',
    fontSize: 13, fontWeight: 600, color: 'var(--on-surface)',
    transition: 'border-color 0.2s',
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      {/* ─── Top header ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Manage DSAs
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
            All registered DSA entities
          </p>
        </div>

        <TravelingBorderButton
          onClick={() => navigate('/tenants/create')}
          size={isMobile ? 'sm' : 'sm'}
          solid
          showIcon={false}
          className={isMobile ? 'px-4 py-2 text-xs' : ''}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 7 }}>
            <Building size={isMobile ? 12 : 14} /> Create DSA
          </div>
        </TravelingBorderButton>
      </div>

      {/* ─── Info bar ─── */}
      <div style={{ borderBottom: '1px solid var(--outline)', padding: '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ShieldCheck size={16} color="#4f46e5" />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--on-surface)' }}>Super Admin only</strong> can add, edit, or deactivate DSAs.
          DSAs receive wallet balance and API access upon registration.
        </p>
      </div>

      {/* ─── Error ─── */}
      {error && (
        <div style={{ padding: '10px 20px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', gap: 8, alignItems: 'center' }}>
          <RefreshCw size={13} color="#c2410c" />
          <span style={{ fontSize: 12, color: '#c2410c', fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '16px' : '20px 20px', display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>

        {/* Search */}
        <div style={{ flex: 2, minWidth: 200, maxWidth: 360 }}>
          <span style={labelSm}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 0, bottom: 9, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="DSA name or PAN…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
              onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
              onBlur={e => e.target.style.borderBottomColor = '#e2e8f0'}
            />
          </div>
        </div>

        {/* Type */}
        <div style={{ flex: 1, minWidth: 130 }}>
          <span style={labelSm}>Type</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ ...underlineInput(!!filterType), appearance: 'none', cursor: 'pointer', borderBottomColor: filterType ? '#4f46e5' : 'var(--outline)', color: filterType ? '#4f46e5' : 'var(--on-surface)' }}>
            <option value="">All Types</option>
            <option value="DSA">DSA</option>
            <option value="INTERNAL">INTERNAL</option>
          </select>
        </div>

        {/* Status */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <span style={labelSm}>Status</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ ...underlineInput(!!filterStatus), appearance: 'none', cursor: 'pointer', borderBottomColor: filterStatus ? '#4f46e5' : 'var(--outline)', color: filterStatus ? '#4f46e5' : 'var(--on-surface)' }}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', paddingBottom: 8, borderBottom: '2px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--on-muted)'}
          >
            Clear all
          </button>
        )}
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
          <LoadingSpinner fullPage />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <Building2 size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No DSAs found</h3>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: '0 0 24px' }}>Try adjusting your filters or create a new DSA.</p>
          <TravelingBorderButton
            onClick={() => navigate('/tenants/create')}
            size="sm"
            solid
            showIcon={false}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Building size={14} /> Create DSA
            </div>
          </TravelingBorderButton>
        </div>
      ) : (
        <>
          {/* Sub-header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>DSA Information</span>
            <span style={{ fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>{filtered.length} of {tenants.length} DSAs</span>
          </div>

          {/* Mobile: card list instead of a table. A table forced into a small
              viewport either truncates every column into illegibility or
              becomes horizontally scrollable — a scrollable table on a phone
              hides columns off-screen and needs a second gesture just to read
              a row. A card puts every field for one DSA in a single vertical
              read, needing only the scroll the user is already doing. */}
          {isMobile ? (
            <div style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {filtered.map((t) => {
                const [avatarBg, avatarClr] = avatarColors(t.name);
                const isActive = (t.status || 'ACTIVE') === 'ACTIVE';
                const isLowWallet = (t.wallet_balance || 0) < 500;
                return (
                  <div
                    key={t.id}
                    style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--outline)',
                      borderRadius: 0, padding: 14,
                    }}
                  >
                    {/* Identity row: avatar + name on the left, status pill anchored right */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: avatarBg, color: avatarClr,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800,
                        }}>
                          {getInitials(t.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.name || '—'}
                          </div>
                          <span style={{
                            display: 'inline-block', marginTop: 3,
                            background: t.type === 'DSA' ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#334155' : '#f1f5f9'),
                            color: t.type === 'DSA' ? (isDark ? '#6ee7b7' : '#15803d') : 'var(--on-muted)',
                            padding: '2px 7px', borderRadius: 0, fontSize: 9, fontWeight: 800,
                          }}>
                            {t.type || 'DSA'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#10b981' : '#f43f5e' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#10b981' : '#f43f5e', whiteSpace: 'nowrap' }}>
                          {t.status || 'ACTIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Fields grid: everything a table column showed, laid out 2-up */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                      marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--outline)',
                    }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>PAN</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.pan_number || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>City</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.city || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Wallet</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isLowWallet ? '#f43f5e' : '#10b981' }}>
                          ₹{Number(t.wallet_balance || 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>API Calls</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{t.api_calls_mtd || 0}</div>
                      </div>
                    </div>

                    {/* Action */}
                    <button
                      onClick={() => openSummary(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', marginTop: 12, padding: '8px 0',
                        background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0,
                        fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer',
                      }}
                    >
                      <Eye size={13} /> View
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'DSA Name', render: (t) => {
                const [avatarBg, avatarClr] = avatarColors(t.name);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: avatarBg, color: avatarClr,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800,
                    }}>
                      {getInitials(t.name)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name || '—'}
                    </span>
                  </div>
                );
              }},
              { key: 'pan_number', label: 'PAN', render: (t) => t.pan_number || '—' },
              { key: 'city', label: 'City', render: (t) => t.city || '—' },
              { key: 'wallet_balance', label: 'Wallet', render: (t) => (
                <span style={{ fontSize: 12, fontWeight: 700, color: (t.wallet_balance || 0) < 500 ? '#f43f5e' : '#10b981' }}>
                  ₹{Number(t.wallet_balance || 0).toLocaleString()}
                </span>
              )},
              { key: 'api_calls_mtd', label: 'API Calls', render: (t) => t.api_calls_mtd || 0 },
              { key: 'type', label: 'Type', render: (t) => (
                <span style={{
                  background: t.type === 'DSA' ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#334155' : '#f1f5f9'),
                  color: t.type === 'DSA' ? (isDark ? '#6ee7b7' : '#15803d') : ('var(--on-muted)'),
                  padding: '3px 8px', borderRadius: 4,
                  fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                }}>
                  {t.type || 'DSA'}
                </span>
              )},
              { key: 'status', label: 'Status', render: (t) => {
                const isActive = (t.status || 'ACTIVE') === 'ACTIVE';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#10b981' : '#f43f5e', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#10b981' : '#f43f5e', whiteSpace: 'nowrap' }}>
                      {t.status || 'ACTIVE'}
                    </span>
                  </div>
                );
              }},
              { key: 'action', label: 'Action', align: 'center', render: (t) => (
                <button
                  onClick={(e) => { e.stopPropagation(); openSummary(t.id); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'transparent', border: 'none',
                    padding: '5px 10px', fontSize: 11, fontWeight: 700,
                    color: 'var(--on-surface)', cursor: 'pointer', transition: 'all 0.15s',
                    borderRadius: 4, whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.background = 'var(--surface-low)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Eye size={11} />
                  View
                </button>
              )},
            ]}
            data={filtered}
            isMobile={isMobile}
            hoverRows={true}
          />
          )}
        </>
      )}

      {/* Slide-out Drawer for DSA Summary */}
      {selectedTenantId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }} onClick={() => setSelectedTenantId(null)}>
          <div style={{ background: isDark ? '#1e293b' : '#fff', width: '500px', height: '100%', padding: '24px', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', overflowY: 'auto', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Building size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>{summaryData?.tenant_name || 'DSA Details'}</h3>
                  <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: 0 }}>Detailed analytics and profile</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTenantId(null)}
                style={{ 
                  width: 28, 
                  height: 28, 
                  border: '1px solid var(--outline)', 
                  borderRadius: 6, 
                  background: 'transparent', 
                  cursor: 'pointer', 
                  color: 'var(--on-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexShrink: 0,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = '#fef2f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--outline)';
                  e.currentTarget.style.color = 'var(--on-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={16} />
              </button>
            </div>

            {loadingSummary ? (
              <div style={{ padding: 40, textAlign: 'center' }}><LoadingSpinner /></div>
            ) : summaryData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: 20, background: isDark ? '#0f172a' : 'var(--bg-secondary)', borderRadius: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)', margin: '0 0 4px 0' }}>Wallet Balance</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#4f46e5', margin: 0 }}>₹{Number(summaryData.wallet_balance).toLocaleString()}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)', margin: '0 0 4px 0' }}>Total API Calls</p>
                      <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>{summaryData.total_api_usage}</p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: 16, background: isDark ? '#0f172a' : '#fff', border: '1px solid var(--outline)', borderRadius: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px 0', textTransform: 'uppercase', color: 'var(--on-muted)' }}>Profile</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 2px 0' }}>PAN</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--on-surface)' }}>{summaryData.pan_number || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 2px 0' }}>GSTIN</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--on-surface)' }}>{summaryData.gst_number || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 2px 0' }}>Phone</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--on-surface)' }}>{summaryData.mobile || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 2px 0' }}>Email</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--on-surface)' }}>{summaryData.email || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 2px 0' }}>City</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--on-surface)' }}>{summaryData.city || '—'}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ padding: 16, background: isDark ? '#0f172a' : '#fff', border: '1px solid var(--outline)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Activity size={16} color="#4f46e5" />
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Activity (MTD)</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>ITR Calls</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{summaryData.itr_pulls}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>GST Calls</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{summaryData.gst_pulls}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Bureau Pulls</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{summaryData.bureau_pulls}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 16, background: isDark ? '#0f172a' : '#fff', border: '1px solid var(--outline)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Building size={16} color="#4f46e5" />
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Portfolio</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Customers</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{summaryData.total_customers}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Total Cases</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{summaryData.total_cases}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Team Size</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{summaryData.team_size}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: 0, overflow: 'hidden', background: isDark ? '#0f172a' : '#fff', border: '1px solid var(--outline)', borderRadius: 8 }}>
                  <div style={{ padding: '12px 16px', background: isDark ? '#1e293b' : 'var(--bg-secondary)', borderBottom: '1px solid var(--outline)' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Recent Wallet Activity</h4>
                  </div>
                  {summaryData.recent_wallet_transactions?.length > 0 ? (
                    <table style={{ margin: 0, border: 'none', width: '100%' }}>
                      <tbody style={{ border: 'none' }}>
                        {summaryData.recent_wallet_transactions.map(tx => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid var(--outline)' }}>
                            <td style={{ padding: '10px 16px', fontSize: 12 }}>
                              <p style={{ margin: 0, fontWeight: 500, color: 'var(--on-surface)' }}>{tx.remarks || tx.api_code || 'Wallet Update'}</p>
                              <p style={{ margin: 0, fontSize: 10, color: 'var(--on-muted)' }}>{formatDate(tx.created_at)}</p>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: tx.transaction_type === 'CREDIT' ? '#10b981' : '#f43f5e' }}>
                              {tx.transaction_type === 'CREDIT' ? '+' : '-'} {tx.amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--on-muted)', fontSize: 12 }}>No recent transactions</div>
                  )}
                </div>

              </div>
            ) : (
              <p style={{ color: 'var(--on-muted)', fontSize: 14 }}>Failed to load DSA metrics.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default TenantsListPage;
