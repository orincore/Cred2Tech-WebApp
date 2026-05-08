import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, RefreshCw, UserPlus, Edit, Lock, Users, ShieldCheck } from 'lucide-react';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { getUsers } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '../constants/roles';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime, getInitials } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
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

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.mobile?.includes(q);
      const matchRole = !filterRole || u.role?.name === filterRole;
      const matchStatus = !filterStatus || u.status === filterStatus;
      const matchLevel = !filterLevel || u.hierarchy_level === filterLevel;
      return matchSearch && matchRole && matchStatus && matchLevel;
    });
  }, [users, search, filterRole, filterStatus, filterLevel]);

  const hasFilters = search || filterRole || filterStatus || filterLevel;

  const getRoleLabel = (n) => {
    if (n === 'SUPER_ADMIN') return 'Super Admin';
    if (n === 'MANAGER') return 'Manager';
    if (n === 'DSA_ADMIN') return 'Admin';
    if (n === 'DSA_MEMBER') return 'Member';
    return n || 'Executive';
  };

  const getRolePill = (n) => {
    if (n === 'SUPER_ADMIN') return { bg: isDark ? '#ffffff' : '#0a1628', color: isDark ? '#0a1628' : '#fff' };
    if (n === 'MANAGER') return { bg: isDark ? '#2d2159' : '#ede9fe', color: isDark ? '#c7d2fe' : '#4f46e5' };
    if (n === 'DSA_ADMIN' || n === 'Admin') return { bg: isDark ? '#1e2a5c' : '#e0e7ff', color: isDark ? '#a5b4fc' : '#4338ca' };
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
  const labelSm = { fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
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
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Admin › Employee Management
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Employee Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
            Manage Your Employees Easily
          </p>
        </div>

        <TravelingBorderButton
          onClick={() => navigate('/users/create')}
          size={isMobile ? 'sm' : 'sm'}
          solid
          showIcon={false}
          className={isMobile ? 'px-4 py-2 text-xs' : ''}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 7 }}>
            <UserPlus size={isMobile ? 12 : 14} /> Add Employee
          </div>
        </TravelingBorderButton>
      </div>

      {/* ─── Info bar ─── */}
      <div style={{ borderBottom: '1px solid var(--outline)', padding: '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ShieldCheck size={16} color="#4f46e5" />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--on-surface)' }}>Super Admin only</strong> can add, edit roles, or deactivate employees.
          Employees receive OTP to mobile and email on account creation to activate access.
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
              placeholder="Name, email or mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
              onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
              onBlur={e => e.target.style.borderBottomColor = '#e2e8f0'}
            />
          </div>
        </div>

        {/* Role */}
        <div style={{ flex: 1, minWidth: 130 }}>
          <span style={labelSm}>Role</span>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            style={{ ...underlineInput(!!filterRole), appearance: 'none', cursor: 'pointer', borderBottomColor: filterRole ? '#4f46e5' : 'var(--outline)', color: filterRole ? '#4f46e5' : 'var(--on-surface)' }}>
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
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

        {/* Level */}
        <div style={{ flex: 1, minWidth: 110 }}>
          <span style={labelSm}>Level</span>
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
            style={{ ...underlineInput(!!filterLevel), appearance: 'none', cursor: 'pointer', borderBottomColor: filterLevel ? '#4f46e5' : 'var(--outline)', color: filterLevel ? '#4f46e5' : 'var(--on-surface)' }}>
            <option value="">All Levels</option>
            {['L1', 'L2', 'L3', 'L4'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); setFilterLevel(''); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer', paddingBottom: 8, borderBottom: '2px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
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
          <Users size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No employees found</h3>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: '0 0 24px' }}>Try adjusting your filters or add a new employee.</p>
          <TravelingBorderButton
            onClick={() => navigate('/users/create')}
            size="sm"
            solid
            showIcon={false}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <UserPlus size={14} /> Add Employee
            </div>
          </TravelingBorderButton>
        </div>
      ) : (
        <>
          {/* Sub-header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Team Information</span>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{filtered.length} of {users.length} employees</span>
          </div>

          {/* Table */}
          <DataTable
            columns={[
              { key: 'name', label: 'Name', render: (u) => {
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
              { key: 'role', label: 'Role', render: (u) => {
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
              { key: 'designation', label: 'Designation', render: (u) => u.designation || 'Operations Executive' },
              { key: 'mobile', label: 'Mobile', render: (u) => u.mobile || '—' },
              { key: 'email', label: 'Email', render: (u) => u.email || '—' },
              { key: 'last_login_at', label: 'Last Login', render: (u) => u.last_login_at ? formatDateTime(u.last_login_at) : 'Today 09:15' },
              { key: 'status', label: 'Status', render: (u) => {
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
              { key: 'action', label: 'Action', align: 'center', render: (u) => {
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
        </>
      )}
    </div>
  );
};

export default UsersListPage;
