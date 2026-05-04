import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, Trash2, Mail, Phone, Shield, Building2, Layers, GitBranch, Calendar, User, Hash } from 'lucide-react';
import { getUserById } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDateTime, formatHierarchyPath, getInitials } from '../utils/helpers';

const Detail = ({ icon: Icon, label, value, children }) => (
  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={15} color="var(--text-tertiary)" />
    </div>
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</p>
      {children || <p style={{ fontSize: 14, fontWeight: 500, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{value || '—'}</p>}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="card" style={{ marginBottom: 20 }}>
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</p>
    </div>
    <div style={{ padding: '4px 20px' }}>{children}</div>
  </div>
);

const UserDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await getUserById(id);
        setUser(data.user || data);
      } catch {
        // Fallback: find in mock data
        const mock = MOCK_USERS.find((u) => u.id === Number(id));
        setUser(mock || null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>User not found.</p>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/users')}>Back to Users</button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={user.name}
        subtitle={user.email}
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Users', path: '/users' }, { label: user.name }]}
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/users')}>
              <ChevronLeft size={15} /> Back
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/users/${id}/edit`)} style={{ opacity: 0.6 }} title="Coming soon">
              <Edit size={14} /> Edit
            </button>
            <button className="btn btn-danger btn-sm" style={{ opacity: 0.6 }} title="Coming soon">
              <Trash2 size={14} /> Delete
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Avatar card */}
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: 'white',
            margin: '0 auto 14px',
          }}>
            {getInitials(user.name)}
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{user.name}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>#{user.id}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
            <Badge type="role" value={user.role?.name} />
            <Badge type="status" value={user.status} />
            {user.hierarchy_level && <Badge type="level" value={user.hierarchy_level} />}
          </div>
        </div>

        {/* Details sections */}
        <div>
          <Section title="Basic Information">
            <Detail icon={User} label="Full Name" value={user.name} />
            <Detail icon={Mail} label="Email" value={user.email} />
            <Detail icon={Phone} label="Mobile" value={user.mobile} />
          </Section>

          <Section title="Role & Access">
            <Detail icon={Shield} label="Role" value={user.role?.name} />
            <Detail icon={Hash} label="Role ID" value={user.role_id?.toString()} />
          </Section>

          <Section title="Hierarchy Information">
            <Detail icon={Layers} label="Hierarchy Level" value={user.hierarchy_level} />
            <Detail icon={GitBranch} label="Hierarchy Path" value={formatHierarchyPath(user.hierarchy_path)} />
            <Detail icon={User} label="Manager ID" value={user.manager_id?.toString()} />
          </Section>

          <Section title="DSA Information">
            <Detail icon={Building2} label="DSA Organization" value={user.dsa?.name} />
            <Detail icon={Hash} label="DSA ID" value={user.dsa_id?.toString()} />
          </Section>

          <Section title="Meta">
            <Detail icon={Calendar} label="Created At" value={formatDateTime(user.created_at)} />
            <Detail icon={User} label="Status" value={user.status} />
          </Section>
        </div>
      </div>
    </div>
  );
};

export default UserDetailPage;
