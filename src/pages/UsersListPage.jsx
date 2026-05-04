import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Eye, Edit, Trash2, UserPlus, RefreshCw } from 'lucide-react';
import { getUsers } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '../constants/roles';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDate, formatDateTime, getInitials } from '../utils/helpers';

const UsersListPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLevel, setFilterLevel] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : data.users || MOCK_USERS);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load users. Showing demo data.');
      setUsers(MOCK_USERS);
    } finally {
      setLoading(false);
    }
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

  const SelectFilter = ({ value, onChange, options, placeholder }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="form-control" style={{ width: 'auto', minWidth: 130 }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );

  return (
    <div>
      <PageHeader
        title="Employee Management"
        subtitle="cred2tech internal team — Super Admin / Manager / Executive"
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Employee Management' }]}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/users/create')} style={{background: '#6366F1', borderColor: '#4F46E5'}}>
            <UserPlus size={15} /> Add Employee
          </button>
        }
      />

      <div style={{ 
        background: '#F0F9FF', 
        border: '1px solid #BAE6FD', 
        borderRadius: '8px', 
        padding: '12px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        marginBottom: 24,
        color: '#0369A1'
      }}>
        <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
          <span style={{ fontWeight: 700 }}>🔒 Super Admin only</span> can add, edit roles, or deactivate employees. Employees receive OTP to mobile and email on account creation to activate access.
        </p>
      </div>

      {error && (
        <div className="notice notice-warning" style={{ marginBottom: 20 }}>
          <RefreshCw size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card card-padded" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, email, or mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={15} color="var(--text-tertiary)" />
            <SelectFilter value={filterRole} onChange={setFilterRole} options={ROLE_OPTIONS} placeholder="All Roles" />
            <SelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_OPTIONS} placeholder="All Status" />
            <SelectFilter value={filterLevel} onChange={setFilterLevel} options={['L1', 'L2', 'L3', 'L4']} placeholder="All Levels" />
            {(search || filterRole || filterStatus || filterLevel) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); setFilterLevel(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card" style={{ padding: 48 }}><LoadingSpinner fullPage /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No users found"
            description="Try adjusting your search or filters, or create a new user."
            action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/users/create')}><UserPlus size={14} /> Create User</button>}
          />
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: '#fff' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#334155' }}>cred2tech Team</h3>
          </div>
          <div className="table-wrapper" style={{ margin: 0 }}>
            <table style={{ margin: 0 }}>
              <thead style={{ background: '#F8FAFC' }}>
                <tr>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>NAME</th>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>ROLE</th>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>DESIGNATION</th>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>MOBILE</th>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>EMAIL</th>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>LAST LOGIN</th>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>STATUS</th>
                  <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="hover-row">
                    <td style={{ padding: '16px 24px', fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{u.name}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        background: u.role?.name === 'SUPER_ADMIN' ? '#1E293B' : '#EFF6FF', 
                        color: u.role?.name === 'SUPER_ADMIN' ? '#fff' : '#3B82F6', 
                        padding: '4px 12px', borderRadius: '20px', fontSize: 11, fontWeight: 700 
                      }}>
                        {u.role?.name === 'SUPER_ADMIN' ? 'Super Admin' : (u.role?.name || 'Executive')}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#475569', fontSize: 13 }}>{u.designation || 'Operations Executive'}</td>
                    <td style={{ padding: '16px 24px', color: '#475569', fontSize: 13 }}>{u.mobile || '—'}</td>
                    <td style={{ padding: '16px 24px', color: '#475569', fontSize: 13 }}>{u.email || '—'}</td>
                    <td style={{ padding: '16px 24px', color: '#475569', fontSize: 13 }}>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Today 09:15'}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ color: u.status === 'Active' ? '#10B981' : '#F43F5E', fontWeight: 600, fontSize: 13 }}>
                        {u.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      {u.role?.name === 'SUPER_ADMIN' && u.id === '1' ? (
                         <span style={{ color: '#94A3B8' }}>—</span>
                      ) : (
                         <button className="btn btn-outline btn-xs" onClick={() => navigate(`/users/${u.id}/edit`)} style={{ padding: '4px 16px', fontSize: 12, fontWeight: 600, color: u.status === 'Deactivated' ? '#64748B' : '#334155', borderRadius: 20 }}>
                           {u.status === 'Deactivated' ? 'Reactivate' : 'Edit'}
                         </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersListPage;
