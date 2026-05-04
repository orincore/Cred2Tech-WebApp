import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, Shield, Building2, Layers, GitBranch, Calendar, Key, Activity } from 'lucide-react';
import { getMe } from '../api/authService';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime, getInitials, formatHierarchyPath } from '../utils/helpers';

const InfoRow = ({ icon: Icon, label, value, mono = false }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} color="var(--text-tertiary)" />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 500 }}>
        {value || '—'}
      </p>
    </div>
  </div>
);

const SectionCard = ({ title, children }) => (
  <div className="card card-padded" style={{ marginBottom: 20 }}>
    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{title}</h3>
    <div style={{ marginTop: 8 }}>{children}</div>
  </div>
);

const ProfilePage = () => {
  const { user: authUser, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getMe();
        setProfile(data.user || data);
      } catch {
        setProfile(authUser); // fallback to context data
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [authUser]);

  if (loading) return <LoadingSpinner fullPage />;

  const u = profile || authUser;
  if (!u) return null;

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Your account details and session information"
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'My Profile' }]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Profile card */}
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: 'white',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(79,70,229,0.3)',
          }}>
            {getInitials(u.name)}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{u.name}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>{u.email}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge type="role" value={u.role?.name} />
            <Badge type="status" value={u.status} />
          </div>

          {u.hierarchy_level && (
            <div style={{ marginTop: 14 }}>
              <Badge type="level" value={u.hierarchy_level} />
            </div>
          )}

          <div style={{ marginTop: 20, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-tertiary)' }}>
            <p><strong style={{ color: 'var(--text-secondary)' }}>User ID:</strong> #{u.id}</p>
            <p style={{ marginTop: 4 }}><strong style={{ color: 'var(--text-secondary)' }}>Member since:</strong><br />{formatDateTime(u.created_at)}</p>
          </div>
        </div>

        {/* Details */}
        <div>
          <SectionCard title="Basic Information">
            <InfoRow icon={User} label="Full Name" value={u.name} />
            <InfoRow icon={Mail} label="Email Address" value={u.email} />
            <InfoRow icon={Phone} label="Mobile" value={u.mobile} />
            <InfoRow icon={Activity} label="Account Status" value={u.status} />
          </SectionCard>

          <SectionCard title="Role & Access">
            <InfoRow icon={Shield} label="Platform Role" value={u.role?.name} />
            <InfoRow icon={User} label="Role ID" value={u.role_id?.toString()} />
          </SectionCard>

          <SectionCard title="Hierarchy & Organization">
            <InfoRow icon={Building2} label="DSA Organization" value={u.dsa?.name} />
            <InfoRow icon={Layers} label="Hierarchy Level" value={u.hierarchy_level} />
            <InfoRow icon={GitBranch} label="Hierarchy Path" value={formatHierarchyPath(u.hierarchy_path)} />
            <InfoRow icon={User} label="Manager ID" value={u.manager_id?.toString()} />
          </SectionCard>

          <SectionCard title="Session Information">
            <InfoRow icon={Calendar} label="Account Created" value={formatDateTime(u.created_at)} />
            <InfoRow icon={Key} label="Active Session Token (truncated)" value={token ? `${token.slice(0, 40)}…` : '—'} mono />
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
