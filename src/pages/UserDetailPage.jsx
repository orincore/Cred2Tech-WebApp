import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, Trash2, Mail, Phone, Shield, Building2, Layers, GitBranch, Calendar, User, Hash, Briefcase, Clock } from 'lucide-react';
import { getUserById } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime, formatHierarchyPath, getInitials, toTitleCase } from '../utils/helpers';

// `borderRadius: 0` override — matches the sharp-corner language used by the
// list page one hop away (UsersListPage) and its sibling detail page
// (AdminTicketDetailPage), rather than the softer rounded `.card` default.
const sharpCard = { borderRadius: 0 };

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

// Same avatar palette as UsersListPage so a user's avatar color stays
// consistent between the list and this detail page.
const avatarPalette = [
  ['#ede9fe', '#4f46e5'], ['#dbeafe', '#1d4ed8'],
  ['#fce7f3', '#be185d'], ['#d1fae5', '#065f46'], ['#fef3c7', '#92400e'],
];
const avatarColors = (name = '') => avatarPalette[(name.charCodeAt(0) || 0) % avatarPalette.length];

const sectionTitleStyle = { fontSize: 12, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 };

const Detail = ({ icon: Icon, label, value, children, mono = false, last = false }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderBottom: last ? 'none' : '1px solid var(--outline)' }}>
    <div style={{ width: 30, height: 30, borderRadius: 0, background: 'var(--bg)', border: '1px solid var(--outline)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={14} color="var(--on-muted)" />
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
      {children || (
        <p style={{
          fontSize: 13, fontWeight: 600, color: value ? 'var(--on-surface)' : 'var(--on-muted)',
          fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit', wordBreak: 'break-word',
        }}>
          {value || '—'}
        </p>
      )}
    </div>
  </div>
);

const UserDetailPage = () => {
  const { isMobile } = useResponsive();
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchUser = async () => {
      try {
        const data = await getUserById(id);
        if (!cancelled) setUser(data.user || data);
      } catch {
        if (!cancelled) {
          const mock = MOCK_USERS.find((u) => u.id === Number(id));
          setUser(mock || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUser();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>;
  if (!user) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <p style={{ fontSize: 15, color: 'var(--on-muted)' }}>User not found.</p>
      <button className="btn btn-secondary" style={{ ...sharpCard, marginTop: 16 }} onClick={() => navigate('/users')}>Back to Users</button>
    </div>
  );

  const [avatarBg, avatarClr] = avatarColors(user.name);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title={user.name}
          subtitle={user.email}
          breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Team Management', path: '/users' }, { label: user.name }]}
          compact={isMobile}
          actions={
            <>
              <button className="btn btn-secondary btn-sm" style={sharpCard} onClick={() => navigate('/users')}>
                <ChevronLeft size={14} /> Back
              </button>
              <button className="btn btn-secondary btn-sm" style={sharpCard} onClick={() => navigate(`/users/${id}/edit`)}>
                <Edit size={13} /> Edit
              </button>
              <button className="btn btn-danger btn-sm" style={{ ...sharpCard, opacity: 0.6, cursor: 'not-allowed' }} title="Coming soon" disabled>
                <Trash2 size={13} /> Delete
              </button>
            </>
          }
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {/* Identity card */}
        <div className="card card-padded" style={{ ...sharpCard, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: avatarBg, color: avatarClr,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800,
          }}>
            {getInitials(user.name)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 2 }}>#{user.id} · {user.designation || 'No designation set'}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <Badge type="role" value={user.role?.name} />
              <Badge type="status" value={user.status} />
              {user.hierarchy_level && <Badge type="level" value={user.hierarchy_level} />}
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatCard title="Hierarchy Level" value={user.hierarchy_level || '—'} icon={Layers} color="var(--primary)" />
          <StatCard title="Designation" value={user.designation || '—'} icon={Briefcase} color="var(--info)" />
          <StatCard title="Last Login" value={user.last_login_at ? formatDateTime(user.last_login_at) : 'Never'} icon={Clock} color="var(--success)" />
          <StatCard title="Member Since" value={user.created_at ? formatDateTime(user.created_at) : '—'} icon={Calendar} color="var(--warning)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div className="card card-padded" style={sharpCard}>
              <h3 style={sectionTitleStyle}>Basic Information</h3>
              <Detail icon={User} label="Full Name" value={user.name} />
              <Detail icon={Mail} label="Email" value={user.email} />
              <Detail icon={Phone} label="Mobile" value={user.mobile} last />
            </div>

            <div className="card card-padded" style={sharpCard}>
              <h3 style={sectionTitleStyle}>Role & Hierarchy</h3>
              <Detail icon={Shield} label="Role"><Badge type="role" value={user.role?.name} /></Detail>
              <Detail icon={GitBranch} label="Hierarchy Path" value={formatHierarchyPath(user.hierarchy_path)} />
              <Detail icon={User} label="Manager ID" value={user.manager_id?.toString()} last />
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-padded" style={sharpCard}>
              <h3 style={sectionTitleStyle}>Organization</h3>
              <Detail icon={Building2} label="Tenant" value={user.tenant?.name} />
              <Detail icon={Layers} label="Tenant Type" value={user.tenant?.type ? toTitleCase(user.tenant.type) : null} last />
            </div>

            <div className="card card-padded" style={sharpCard}>
              <h3 style={sectionTitleStyle}>Meta</h3>
              <Detail icon={Hash} label="User ID" value={`#${user.id}`} mono />
              <Detail icon={Hash} label="Role ID" value={user.role_id?.toString()} mono />
              <Detail icon={Calendar} label="Created At" value={formatDateTime(user.created_at)} last />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailPage;
