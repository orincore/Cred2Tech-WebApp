import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, GitBranch, User, Shield, Building2, Layers, BarChart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUsers } from '../api/userService';
import StatCard from '../components/ui/StatCard';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import { getInitials } from '../utils/helpers';

const QuickAction = ({ icon: Icon, label, desc, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'all 0.15s',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 16px ${color}20`; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</p>
    </div>
  </button>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user.role === 'SUPER_ADMIN') {
          // SUPER_ADMIN Dashboard requirements: Show aggregated tenant-level performance only. Do not display individual user-level data.
          // They don't fetch users here. They fetch analytics.
          const res = await fetch('http://localhost:3000/analytics/dsa-performance', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
          const analytics = await res.json();
          setUsers(analytics || []);
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
    <div>
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'User'} 👋`}
        subtitle={user?.role === 'SUPER_ADMIN' ? "Overview of Platform DSAs." : "Here's an overview of your organization."}
      />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard title={user?.role === 'SUPER_ADMIN' ? "Total DSAs" : "Total Visible Users"} value={loading ? '…' : users.length} icon={user?.role === 'SUPER_ADMIN' ? Building2 : Users} color="var(--primary)" subtitle={loading ? '' : 'In your access scope'} loading={loading} />
        <StatCard title="Your Role" value={user?.role || '—'} icon={Shield} color="var(--role-admin)" subtitle="Platform access level" />
        <StatCard title="Organization Scope" value={user?.tenant_type || 'DSA'} icon={Building2} color="var(--role-dsa)" subtitle={`DSA ID: ${user?.tenant_id || 'Global'}`} />
        {user?.role !== 'SUPER_ADMIN' && <StatCard title="Hierarchy Level" value={user?.hierarchy_level || 'Root'} icon={Layers} color="var(--role-employee)" subtitle={user?.hierarchy_path || '/'} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Recent users */}
        <div className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>{user?.role === 'SUPER_ADMIN' ? 'Platform Analytics Overview' : 'Recent Users'}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {user?.role === 'SUPER_ADMIN' ? "User counts aggregated by DSA ID" : "Users visible in your scope"}
              </p>
            </div>
            {user?.role !== 'SUPER_ADMIN' && <button className="btn btn-secondary btn-sm" onClick={() => navigate('/users')}>View All</button>}
          </div>
          {loading ? (
            <div style={{ padding: 24 }}>Loading data...</div>
          ) : user?.role === 'SUPER_ADMIN' ? (
            <div style={{ padding: 24 }}>
              {users.map((tenantGroup, idx) => (
                <div key={idx} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>DSA ID: {tenantGroup.tenant_id}</strong> - Total Users: {tenantGroup._count?.id || 0}
                </div>
              ))}
              {users.length === 0 && <p>No aggregated data found.</p>}
            </div>
          ) : (
            <div>
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => navigate(`/users/${u.id}`)}
                  style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                    {getInitials(u.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                  </div>
                  <Badge type="role" value={u.role?.name || u.role} />
                </div>
              ))}
              {recentUsers.length === 0 && <div style={{ padding: 24 }}>No users found in your DSA.</div>}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Quick Actions</h3>
          {user?.role === 'SUPER_ADMIN' && <QuickAction icon={Building2} label="Manage DSAs" desc="Create and edit DSAs" color="var(--primary)" onClick={() => navigate('/tenants')} />}
          {user?.role === 'SUPER_ADMIN' && <QuickAction icon={Building2} label="Create DSA" desc="Onboard a new DSA/Cred2Tech" color="var(--success)" onClick={() => navigate('/tenants/create')} />}
          {user?.role !== 'SUPER_ADMIN' && <QuickAction icon={UserPlus} label="Create User" desc="Add a new user to the system" color="var(--success)" onClick={() => navigate('/users/create')} />}
          <QuickAction icon={User} label="My Profile" desc="View your profile & session" color="var(--role-dsa)" onClick={() => navigate('/profile')} />
          {user?.role !== 'SUPER_ADMIN' && <QuickAction icon={GitBranch} label="View Hierarchy" desc="Explore the org chart" color="var(--role-partner)" onClick={() => navigate('/hierarchy')} />}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
