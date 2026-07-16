import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsers } from '../api/userService';
import api from '../api/axiosInstance';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import { getInitials } from '../utils/helpers';
import { Sun, Moon, CloudSun } from 'lucide-react';

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

const QuickAction = ({ icon: IconSVG, label, desc, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent',
      border: '1px solid var(--outline)',
      borderRadius: 8,
      padding: '12px 16px',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'all 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = color;
      e.currentTarget.style.background = 'var(--surface-low)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--outline)';
      e.currentTarget.style.background = 'transparent';
    }}
  >
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {IconSVG}
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 1 }}>{label}</p>
      <p style={{ fontSize: 12, color: 'var(--on-muted)' }}>{desc}</p>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M5 12h14"></path>
      <path d="m12 5 7 7-7 7"></path>
    </svg>
  </button>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user.role === 'SUPER_ADMIN') {
          // SUPER_ADMIN Dashboard requirements: Show aggregated tenant-level performance only. Do not display individual user-level data.
          // They don't fetch users here. They fetch analytics.
          const res = await api.get('/analytics/dsa-performance');
          setUsers(res.data || []);
        } else {
          const data = await getUsers();
          setUsers(Array.isArray(data) ? data : data.users || []);
        }
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const recentUsers = user?.role === 'SUPER_ADMIN' ? [] : [...users].slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      {/* ─── Top header ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            {user?.role === 'SUPER_ADMIN' ? "Platform Analytics" : "Organization Overview"}
          </p>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            {greeting}, {user?.name?.split(' ')[0] || 'User'}{' '}
            {hour < 12 ? <Sun size={20} color="#f59e0b" /> : hour < 17 ? <CloudSun size={20} color="#f59e0b" /> : <Moon size={20} color="#6366f1" />}
          </h1>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px 20px' }}>
        {/* Stat cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                {user?.role === 'SUPER_ADMIN' ? "Total DSAs" : "Total Visible Users"}
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--on-surface)', margin: '4px 0 0' }}>
                {loading ? '…' : users.length}
              </p>
              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 0' }}>
                {loading ? '' : 'In your access scope'}
              </p>
            </div>
            <div style={{ width: 1, height: 40, background: 'var(--outline)' }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Your Role
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--on-surface)', margin: '4px 0 0' }}>
                {(user?.role || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </p>
              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 0' }}>
                Platform access level
              </p>
            </div>
            <div style={{ width: 1, height: 40, background: 'var(--outline)' }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Organization Scope
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--on-surface)', margin: '4px 0 0' }}>
                {user?.tenant_type || 'DSA'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 0' }}>
                DSA ID: {user?.tenant_id || 'Global'}
              </p>
            </div>
            {user?.role !== 'SUPER_ADMIN' && (
              <>
                <div style={{ width: 1, height: 40, background: 'var(--outline)' }} />
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Hierarchy Level
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--on-surface)', margin: '4px 0 0' }}>
                    {user?.hierarchy_level || 'Root'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '2px 0 0' }}>
                    {user?.hierarchy_path || '/'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 24 }}>
          {/* Recent users */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--outline)',
            borderRadius: 0,
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                  {user?.role === 'SUPER_ADMIN' ? 'Platform Analytics Overview' : 'Recent Users'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 2, marginBottom: 0 }}>
                  {user?.role === 'SUPER_ADMIN' ? "User counts aggregated by DSA ID" : "Users visible in your scope"}
                </p>
              </div>
              {user?.role !== 'SUPER_ADMIN' && (
                <button
                  onClick={() => navigate('/users')}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--outline)',
                    color: 'var(--on-surface)',
                    padding: '6px 12px',
                    borderRadius: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
                >
                  View All
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 24, color: 'var(--on-muted)' }}>Loading data...</div>
            ) : user?.role === 'SUPER_ADMIN' ? (
              <div style={{ padding: 24 }}>
                {users.map((tenantGroup, idx) => (
                  <div key={idx} style={{ padding: '10px 0', borderBottom: '1px solid var(--outline)', color: 'var(--on-surface)' }}>
                    <strong>DSA ID: {tenantGroup.tenant_id}</strong> - Total Users: {tenantGroup._count?.id || 0}
                  </div>
                ))}
                {users.length === 0 && <p style={{ color: 'var(--on-muted)' }}>No aggregated data found.</p>}
              </div>
            ) : (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: isMobile ? '400px' : '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
                <colgroup><col style={{ width: isMobile ? '60%' : '40%' }} />{!isMobile && <col style={{ width: '40%' }} />}<col style={{ width: isMobile ? '40%' : '20%' }} /></colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--outline)' }}>
                    {['Name', 'Email', 'Role'].filter(h => !isMobile || h !== 'Email').map(h => (
                      <th key={h} style={{
                        padding: isMobile ? '8px 12px' : '11px 20px', fontSize: isMobile ? 9 : 10, fontWeight: 800, color: 'var(--on-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => navigate(`/users/${u.id}`)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--outline)', transition: 'background 0.2s ease' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: isMobile ? '10px 12px' : '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
                          <div style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: '50%', background: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: isMobile ? 10 : 11, color: 'var(--on-surface)', flexShrink: 0, border: '1px solid var(--outline)' }}>
                            {getInitials(u.name)}
                          </div>
                          <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                        </div>
                      </td>
                      {!isMobile && <td style={{ padding: isMobile ? '10px 12px' : '14px 20px', fontSize: isMobile ? 11 : 12, color: 'var(--on-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </td>}
                      <td style={{ padding: isMobile ? '10px 12px' : '14px 20px' }}>
                        <Badge type="role" value={u.role?.name || u.role} />
                      </td>
                    </tr>
                  ))}
                  {recentUsers.length === 0 && (
                    <tr>
                      <td colSpan={isMobile ? 2 : 3} style={{ padding: isMobile ? 20 : 24, textAlign: 'center', color: 'var(--on-muted)', fontSize: isMobile ? 12 : 13 }}>
                        No users found in your DSA.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
          </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 4, margin: 0 }}>Quick Actions</h3>
          {user?.role === 'SUPER_ADMIN' && <QuickAction icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M17 21v-8.5a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 7 12.5V21"/></svg>} label="Manage DSAs" desc="Create and edit DSAs" color="#4f46e5" onClick={() => navigate('/tenants')} />}
          {user?.role === 'SUPER_ADMIN' && <QuickAction icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>} label="Create DSA" desc="Onboard a new DSA/Cred2Tech" color="#10b981" onClick={() => navigate('/tenants/create')} />}
          {user?.role !== 'SUPER_ADMIN' && <QuickAction icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} label="Create User" desc="Add a new user to the system" color="#10b981" onClick={() => navigate('/users/create')} />}
          <QuickAction icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>} label="My Profile" desc="View your profile & session" color="#f59e0b" onClick={() => navigate('/profile')} />
          {user?.role !== 'SUPER_ADMIN' && <QuickAction icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><path d="M7 21v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/><path d="M12 8v5"/><path d="M12 13l3-3"/><path d="M12 13l-3-3"/></svg>} label="View Hierarchy" desc="Explore the org chart" color="#8b5cf6" onClick={() => navigate('/hierarchy')} />}
        </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
