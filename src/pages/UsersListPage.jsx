import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, RefreshCw, UserPlus, Edit, Users, ShieldCheck, Wallet } from 'lucide-react';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { getUsers } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '../constants/roles';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import { formatDateTime, getInitials } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import DataTable from '../components/DataTable';
import PageTour from '../components/tour/PageTour';

const USERS_TOUR_STEPS = [
  { target: '[data-tour="users-add"]', title: 'Add someone to your team', description: 'Bring on a new employee or Sub-DSA partner from here. They\'ll get an OTP by mobile and email to activate their own account.' },
  { target: '[data-tour="users-tabs"]', title: 'Employees vs Sub-DSA', description: 'Your internal employees and your external Sub-DSA referral partners are kept in separate tabs, since they\'re managed a little differently.' },
  { target: '[data-tour="users-filters"]', title: 'Search & filter your team', description: 'Search by name, email, or mobile, and filter by role, status, or hierarchy level to zero in on the person you need.' },
  { target: '[data-tour="users-results"]', title: 'Your team', description: 'Everyone on your team, with their role, status, and last login. Tap "Edit" on any row to update their details.' },
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

const UsersListPage = () => {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Employees vs Sub-DSA partners — same underlying /users list (a Sub-DSA
  // partner is just a User row with role.name === 'SUB_DSA'), split client-side
  // so each tab gets its own focused view instead of one mixed table.
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'subDsa'

  const fetchUsers = async () => {
    setLoading(true); setError('');
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : data.users || MOCK_USERS);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load users. Showing demo data.');
      setUsers(MOCK_USERS);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const employees = useMemo(() => users.filter((u) => u.role?.name !== 'SUB_DSA'), [users]);
  const subDsaUsers = useMemo(() => users.filter((u) => u.role?.name === 'SUB_DSA'), [users]);
  const tabUsers = activeTab === 'subDsa' ? subDsaUsers : employees;

  // Role/Level filters are meaningless on the Sub-DSA tab (every row already
  // is one role, and partners don't use the internal hierarchy) — reset them
  // on switching tabs so a leftover filter from Employees doesn't silently
  // empty out the Sub-DSA list.
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilterRole('');
    setFilterLevel('');
  };

  const filtered = useMemo(() => {
    return tabUsers.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.mobile?.includes(q);
      const matchRole = !filterRole || u.role?.name === filterRole;
      const matchStatus = !filterStatus || u.status === filterStatus;
      const matchLevel = !filterLevel || u.hierarchy_level === filterLevel;
      return matchSearch && matchRole && matchStatus && matchLevel;
    });
  }, [tabUsers, search, filterRole, filterStatus, filterLevel]);

  const hasFilters = search || filterRole || filterStatus || filterLevel;
  // Role/Status/Level (not Search) — what the mobile "Filters" toggle counts,
  // since Search stays visible inline regardless of the toggle state.
  const activeAdvancedFilterCount = [filterRole, filterStatus, filterLevel].filter(Boolean).length;

  const getRoleLabel = (n) => {
    if (n === 'SUPER_ADMIN') return 'Super Admin';
    if (n === 'MANAGER') return 'Manager';
    if (n === 'DSA_ADMIN') return 'Admin';
    if (n === 'DSA_MEMBER') return 'Member';
    if (n === 'SUB_DSA') return 'Partner';
    return n || 'Executive';
  };

  const getRolePill = (n) => {
    if (n === 'SUPER_ADMIN') return { bg: isDark ? '#ffffff' : '#0a1628', color: isDark ? '#0a1628' : '#fff' };
    if (n === 'MANAGER') return { bg: isDark ? '#2d2159' : '#ede9fe', color: isDark ? '#c7d2fe' : '#4f46e5' };
    if (n === 'DSA_ADMIN' || n === 'Admin') return { bg: isDark ? '#1e2a5c' : '#e0e7ff', color: isDark ? '#a5b4fc' : '#4338ca' };
    if (n === 'SUB_DSA') return { bg: 'var(--role-partner-bg)', color: 'var(--role-partner)' };
    return { bg: isDark ? '#064e3b' : '#dcfce7', color: isDark ? '#6ee7b7' : '#15803d' };
  };

  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
      <div style={{ padding: isMobile ? '68px 16px 10px' : '24px 24px 16px', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Team Management"
          subtitle={activeTab === 'subDsa' ? 'Manage Your Sub-DSA Partners Easily' : 'Manage Your Employees Easily'}
          compact={isMobile}
          actions={
            <div data-tour="users-add" style={{ display: 'inline-flex' }}>
              <TravelingBorderButton
                onClick={() => navigate(activeTab === 'subDsa' ? '/users/create?role=SUB_DSA' : '/users/create')}
                size="sm"
                solid
                showIcon={false}
                className={isMobile ? 'px-4 py-2 text-xs' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 7 }}>
                  <UserPlus size={isMobile ? 12 : 14} /> {activeTab === 'subDsa' ? 'Add Sub-DSA Partner' : 'Add Employee'}
                </div>
              </TravelingBorderButton>
            </div>
          }
        />

        {/* Employees / Sub-DSA tab switcher */}
        <div data-tour="users-tabs" style={{ display: 'flex', gap: 8, marginTop: isMobile ? 12 : 16 }}>
          {[
            { key: 'employees', label: 'Employees', count: employees.length },
            { key: 'subDsa', label: 'Sub-DSA', count: subDsaUsers.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 0,
                border: `1px solid ${activeTab === tab.key ? 'var(--primary)' : 'var(--outline)'}`,
                borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '1px solid var(--outline)',
                background: activeTab === tab.key ? 'var(--primary)0f' : 'var(--surface)',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab.label} <span style={{ opacity: 0.7, fontWeight: 600 }}>({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Info bar ─── */}
      {/* Collapsed to one short line on mobile — the full explanatory copy is
          nice-to-have context, not something worth permanent screen real
          estate on a small viewport. */}
      <div style={{ borderBottom: '1px solid var(--outline)', padding: isMobile ? '8px 16px' : '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ShieldCheck size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
        {isMobile ? (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--on-muted)', fontWeight: 500 }}>
            <strong style={{ color: 'var(--on-surface)' }}>Super Admin only</strong> — add, edit or deactivate {activeTab === 'subDsa' ? 'Sub-DSA partners' : 'employees'}.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
            <strong style={{ color: 'var(--on-surface)' }}>Super Admin only</strong> can add, edit roles, or deactivate {activeTab === 'subDsa' ? 'Sub-DSA partners' : 'employees'}.
            {activeTab === 'subDsa' ? ' Partners receive OTP to mobile and email on account creation to activate access.' : ' Employees receive OTP to mobile and email on account creation to activate access.'}
          </p>
        )}
      </div>

      {/* ─── Error ─── */}
      {error && (
        <div style={{ padding: '10px 20px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', gap: 8, alignItems: 'center' }}>
          <RefreshCw size={13} color="#c2410c" />
          <span style={{ fontSize: 12, color: '#c2410c', fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* ─── Filter row ─── */}
      {/* Mobile: Search stays inline (the filter people actually reach for
          first); Role/Status/Level collapse behind a "Filters" toggle, closed
          by default — this is what was eating half the screen: 4 stacked
          label+input pairs plus Clear-all, always rendered, before a single
          employee row was visible. Desktop is untouched — all four fields
          stay inline exactly as before. */}
      <div data-tour="users-filters" style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '12px 16px' : '20px 20px', display: 'flex', gap: isMobile ? 10 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>

        {/* Search */}
        <div style={{ flex: isMobile ? '1 1 auto' : 2, minWidth: isMobile ? 140 : 200, maxWidth: isMobile ? 'none' : 360 }}>
          <span style={labelSm}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 0, bottom: 9, color: 'var(--on-muted)' }} />
            <input
              type="text"
              placeholder="Name, email or mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
              onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
            />
          </div>
        </div>

        {isMobile && (
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '7px 12px', marginBottom: 2, background: 'transparent',
              border: `1px solid ${activeAdvancedFilterCount > 0 ? 'var(--primary)' : 'var(--outline)'}`,
              color: activeAdvancedFilterCount > 0 ? 'var(--primary)' : 'var(--on-surface)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 0,
            }}
          >
            <SlidersHorizontal size={13} />
            Filters{activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
          </button>
        )}

        {(!isMobile || showFilters) && (
          <>
            {/* Role — every row on the Sub-DSA tab is already the same role,
                so this filter would just be a confusing no-op there. */}
            {activeTab !== 'subDsa' && (
              <div style={{ flex: 1, minWidth: isMobile ? '45%' : 130 }}>
                <span style={labelSm}>Role</span>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  style={{ ...underlineInput(!!filterRole), appearance: 'none', cursor: 'pointer', borderBottomColor: filterRole ? 'var(--primary)' : 'var(--outline)', color: filterRole ? 'var(--primary)' : 'var(--on-surface)' }}>
                  <option value="">All Roles</option>
                  {ROLE_OPTIONS.filter(o => (o.value || o) !== 'SUB_DSA').map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
                </select>
              </div>
            )}

            {/* Status */}
            <div style={{ flex: 1, minWidth: isMobile ? '45%' : 120 }}>
              <span style={labelSm}>Status</span>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ ...underlineInput(!!filterStatus), appearance: 'none', cursor: 'pointer', borderBottomColor: filterStatus ? 'var(--primary)' : 'var(--outline)', color: filterStatus ? 'var(--primary)' : 'var(--on-surface)' }}>
                <option value="">All Status</option>
                {STATUS_OPTIONS.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
              </select>
            </div>

            {/* Level — Sub-DSA partners don't sit in the internal L1-L4 hierarchy. */}
            {activeTab !== 'subDsa' && (
              <div style={{ flex: 1, minWidth: isMobile ? '45%' : 110 }}>
                <span style={labelSm}>Level</span>
                <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                  style={{ ...underlineInput(!!filterLevel), appearance: 'none', cursor: 'pointer', borderBottomColor: filterLevel ? 'var(--primary)' : 'var(--outline)', color: filterLevel ? 'var(--primary)' : 'var(--on-surface)' }}>
                  <option value="">All Levels</option>
                  {['L1', 'L2', 'L3', 'L4'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}

            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); setFilterLevel(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--on-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', paddingBottom: 8, borderBottom: '2px solid transparent' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--on-muted)'}
              >
                Clear all
              </button>
            )}
          </>
        )}
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
          <LoadingSpinner fullPage />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <Users size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>
            {activeTab === 'subDsa' ? 'No Sub-DSA partners found' : 'No employees found'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: '0 0 24px' }}>
            {activeTab === 'subDsa' ? 'Try adjusting your filters or add a new Sub-DSA partner.' : 'Try adjusting your filters or add a new employee.'}
          </p>
          <TravelingBorderButton
            onClick={() => navigate(activeTab === 'subDsa' ? '/users/create?role=SUB_DSA' : '/users/create')}
            size="sm"
            solid
            showIcon={false}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <UserPlus size={14} /> {activeTab === 'subDsa' ? 'Add Sub-DSA Partner' : 'Add Employee'}
            </div>
          </TravelingBorderButton>
        </div>
      ) : (
        <>
          {/* Sub-header */}
          <div style={{ padding: isMobile ? '8px 16px' : '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{activeTab === 'subDsa' ? 'Sub-DSA Partners' : 'Team Information'}</span>
            <span style={{ fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>{filtered.length} of {tabUsers.length} {activeTab === 'subDsa' ? 'partners' : 'employees'}</span>
          </div>

          {/* Mobile: card list instead of a table — same reasoning as
              TenantsListPage/VendorManagementPage. A table forced into a
              small viewport either truncates every column or becomes
              horizontally scrollable, hiding columns off-screen behind a
              second gesture. A card puts every field for one employee in a
              single vertical read. */}
          {activeTab === 'subDsa' ? (
            // Sub-DSA gets one card layout at every breakpoint (not a
            // separate mobile/desktop split) — Payout Setup opens its own
            // full-screen route (SubDsaPayoutSetupPage) rather than
            // expanding inline, so it has room for its multi-column tables
            // on both desktop and mobile.
            <div data-tour="users-results" style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {filtered.map((u) => {
                const [avatarBg, avatarClr] = avatarColors(u.name);
                const pill = getRolePill(u.role?.name);
                const isActive = (u.status || 'ACTIVE') === 'ACTIVE';
                return (
                  <div key={u.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0 }}>
                    <div style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            background: avatarBg, color: avatarClr,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800,
                          }}>
                            {getInitials(u.name)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.name || '—'}
                            </div>
                            <span style={{ display: 'inline-block', marginTop: 3, background: pill.bg, color: pill.color, padding: '2px 7px', borderRadius: 0, fontSize: 9, fontWeight: 800 }}>
                              {getRoleLabel(u.role?.name)}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? 'var(--success)' : 'var(--error)' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--success)' : 'var(--error)', whiteSpace: 'nowrap' }}>
                            {u.status || 'ACTIVE'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--outline)' }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Designation</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.designation || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Mobile</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.mobile || '—'}</div>
                        </div>
                        <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Email</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Last Login</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{u.last_login_at ? formatDateTime(u.last_login_at) : '—'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => navigate(`/users/${u.id}/edit`)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0, fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer' }}
                        >
                          <Edit size={12} /> Edit Details
                        </button>
                        <button
                          onClick={() => navigate(`/users/${u.id}/payout-setup`)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0, fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer' }}
                        >
                          <Wallet size={12} /> Payout Setup
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isMobile ? (
            <div data-tour="users-results" style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
              {filtered.map((u) => {
                const [avatarBg, avatarClr] = avatarColors(u.name);
                const pill = getRolePill(u.role?.name);
                const isActive = (u.status || 'ACTIVE') === 'ACTIVE';
                const isSuperAdmin = u.role?.name === 'SUPER_ADMIN' && u.id === '1';
                return (
                  <div
                    key={u.id}
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
                          {getInitials(u.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.name || '—'}
                          </div>
                          <span style={{
                            display: 'inline-block', marginTop: 3,
                            background: pill.bg, color: pill.color,
                            padding: '2px 7px', borderRadius: 0, fontSize: 9, fontWeight: 800,
                          }}>
                            {getRoleLabel(u.role?.name)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? 'var(--success)' : 'var(--error)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--success)' : 'var(--error)', whiteSpace: 'nowrap' }}>
                          {u.status || 'ACTIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Fields grid: everything a table column showed, laid out 2-up */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                      marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--outline)',
                    }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Designation</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.designation || 'Operations Executive'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Mobile</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.mobile || '—'}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Email</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Last Login</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Today 09:15'}</div>
                      </div>
                    </div>

                    {/* Action */}
                    {isSuperAdmin ? null : (
                      <button
                        onClick={() => navigate(`/users/${u.id}/edit`)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          width: '100%', marginTop: 12, padding: '8px 0',
                          background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0,
                          fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer',
                        }}
                      >
                        <Edit size={12} /> {u.status === 'INACTIVE' ? 'Reactivate' : 'Edit'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
          <div data-tour="users-results">
          <DataTable
            columns={[
              { key: 'name', label: 'Name', width: '19%', render: (u) => {
                const [avatarBg, avatarClr] = avatarColors(u.name);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: avatarBg, color: avatarClr,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800,
                    }}>
                      {getInitials(u.name)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name || '—'}
                    </span>
                  </div>
                );
              }},
              { key: 'role', label: 'Role', width: '9%', render: (u) => {
                const pill = getRolePill(u.role?.name);
                return (
                  <span style={{
                    background: pill.bg, color: pill.color,
                    padding: '3px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                  }}>
                    {getRoleLabel(u.role?.name)}
                  </span>
                );
              }},
              { key: 'designation', label: 'Designation', width: '14%', render: (u) => u.designation || 'Operations Executive' },
              { key: 'mobile', label: 'Mobile', width: '10%', render: (u) => u.mobile || '—' },
              { key: 'email', label: 'Email', width: '20%', render: (u) => u.email || '—' },
              { key: 'last_login_at', label: 'Last Login', width: '13%', render: (u) => u.last_login_at ? formatDateTime(u.last_login_at) : 'Today 09:15' },
              { key: 'status', label: 'Status', width: '7%', render: (u) => {
                const isActive = (u.status || 'ACTIVE') === 'ACTIVE';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#10b981' : '#f43f5e', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#10b981' : '#f43f5e', whiteSpace: 'nowrap' }}>
                      {u.status || 'ACTIVE'}
                    </span>
                  </div>
                );
              }},
              { key: 'action', label: 'Action', align: 'center', width: '8%', render: (u) => {
                const isSuperAdmin = u.role?.name === 'SUPER_ADMIN' && u.id === '1';
                return isSuperAdmin ? (
                  <span style={{ color: 'var(--outline)' }}>—</span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/users/${u.id}/edit`); }}
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
                    <Edit size={11} />
                    {u.status === 'INACTIVE' ? 'Reactivate' : 'Edit'}
                  </button>
                );
              }},
            ]}
            data={filtered}
            isMobile={isMobile}
            hoverRows={true}
          />
          </div>
          )}
        </>
      )}
      <PageTour pageKey="users-list" steps={USERS_TOUR_STEPS} />
    </div>
  );
};

export default UsersListPage;
