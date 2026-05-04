import React, { useEffect, useState } from 'react';
import { GitBranch, List, Network } from 'lucide-react';
import { getUsers } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { getInitials } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const UserNode = ({ user, children, navigate }) => (
  <div style={{ position: 'relative' }}>
    <div
      onClick={() => navigate(`/users/${user.id}`)}
      style={{
        background: 'var(--bg-surface)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all 0.15s',
        minWidth: 260,
        maxWidth: 320,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,70,229,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
        {getInitials(user.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <Badge type="role" value={user.role?.name} />
        {user.hierarchy_level && <Badge type="level" value={user.hierarchy_level} />}
      </div>
    </div>

    {/* Children subtree */}
    {children && children.length > 0 && (
      <div style={{ paddingLeft: 40, marginTop: 0, position: 'relative' }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 19, top: 0, bottom: 16, width: 2, background: 'var(--border)' }} />
        {children.map((child, idx) => (
          <div key={child.id} style={{ marginTop: 12, position: 'relative' }}>
            {/* Horizontal connector */}
            <div style={{ position: 'absolute', left: -21, top: 28, width: 21, height: 2, background: 'var(--border)' }} />
            <UserNode user={child} children={child._children} navigate={navigate} />
          </div>
        ))}
      </div>
    )}
  </div>
);

const buildTree = (users) => {
  const map = {};
  const roots = [];
  users.forEach((u) => { map[u.id] = { ...u, _children: [] }; });
  users.forEach((u) => {
    if (u.manager_id && map[u.manager_id]) {
      map[u.manager_id]._children.push(map[u.id]);
    } else {
      roots.push(map[u.id]);
    }
  });
  return roots;
};

const HierarchyPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('tree'); // tree | list

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getUsers();
        setUsers(Array.isArray(data) ? data : data.users || MOCK_USERS);
      } catch {
        setUsers(MOCK_USERS);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const tree = buildTree(users);

  return (
    <div>
      <PageHeader
        title="Hierarchy Explorer"
        subtitle="Visual org chart of your team structure based on manager relationships"
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Hierarchy' }]}
        actions={
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <button
              className={`btn btn-sm${viewMode === 'tree' ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => setViewMode('tree')}
              style={{ padding: '6px 14px' }}
            >
              <Network size={14} /> Tree
            </button>
            <button
              className={`btn btn-sm${viewMode === 'list' ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => setViewMode('list')}
              style={{ padding: '6px 14px' }}
            >
              <List size={14} /> List
            </button>
          </div>
        }
      />

      {/* Legend */}
      <div className="card card-padded" style={{ marginBottom: 24, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Legend:
        </p>
        {['SUPER_ADMIN', 'DSA_ADMIN', 'DSA_MEMBER', 'CRED2TECH_MEMBER'].map((role) => <Badge key={role} type="role" value={role} />)}
        {['L1', 'L2', 'L3'].map((l) => <Badge key={l} type="level" value={l} />)}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Click any card to view user details</span>
      </div>

      {loading ? (
        <LoadingSpinner fullPage />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="No hierarchy data available." />
      ) : viewMode === 'tree' ? (
        <div style={{ overflowX: 'auto', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 'fit-content' }}>
            {tree.map((root) => (
              <UserNode key={root.id} user={root} children={root._children} navigate={navigate} />
            ))}
          </div>
        </div>
      ) : (
        /* List view grouped by level */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Root', 'L1', 'L2', 'L3', 'L4'].map((level) => {
            const matched = users.filter((u) => (level === 'Root' ? !u.hierarchy_level : u.hierarchy_level === level));
            if (!matched.length) return null;
            return (
              <div key={level} className="card">
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge type="level" value={level} />
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{matched.length} user{matched.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {matched.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => navigate(`/users/${u.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'background 0.1s', minWidth: 220 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-subtle)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Manager: {u.manager_id || 'None'}</p>
                      </div>
                      <Badge type="role" value={u.role?.name} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HierarchyPage;
