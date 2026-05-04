import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUserById, getUsers, updateUser } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import PageHeader from '../components/ui/PageHeader';
import FormField from '../components/ui/FormField';
import Badge from '../components/ui/Badge';
import { ROLE_OPTIONS, HIERARCHY_LEVELS } from '../constants/roles';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const ROLE_ID_MAP = { SUPER_ADMIN: 1, DSA_ADMIN: 2, CRED2TECH_MEMBER: 3, DSA_MEMBER: 4 };
const ROLE_ID_NAME = { 1: 'SUPER_ADMIN', 2: 'DSA_ADMIN', 3: 'CRED2TECH_MEMBER', 4: 'DSA_MEMBER' };

const EditUserPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', role: '', tenant_id: '', hierarchy_level: '', manager_id: '', designation: '', status: '' });
  const [tenantUsers, setTenantUsers] = useState([]);

  useEffect(() => {
    getUsers()
      .then(data => setTenantUsers(Array.isArray(data) ? data : data.users || []))
      .catch(() => { });
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await getUserById(id);
        const u = data.user || data;
        setUser(u);
        setForm({
          name: u.name || '',
          email: u.email || '',
          mobile: u.mobile || '',
          role: ROLE_ID_NAME[u.role_id] || u.role?.name || u.role || '',
          tenant_id: u.tenant_id?.toString() || '',
          hierarchy_level: u.hierarchy_level || '',
          manager_id: u.manager_id?.toString() || '',
          designation: u.designation || '',
          status: u.status || '',
        });
      } catch {
        const mock = MOCK_USERS.find((u) => u.id === Number(id));
        if (mock) {
          setUser(mock);
          setForm({
            name: mock.name || '',
            email: mock.email || '',
            mobile: mock.mobile || '',
            role: mock.role?.name || '',
            tenant_id: mock.tenant_id?.toString() || '',
            hierarchy_level: mock.hierarchy_level || '',
            manager_id: mock.manager_id?.toString() || '',
            designation: mock.designation || '',
            status: mock.status || '',
          });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUser(id, {
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        designation: form.designation,
        status: form.status,
        hierarchy_level: form.hierarchy_level || null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      });
      toast.success('User updated successfully');
      navigate('/users');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <PageHeader
        title={`Edit: ${user?.name || 'User'}`}
        subtitle="Modify user information"
        breadcrumbs={[
          { label: 'Dashboard', path: '/' },
          { label: 'Users', path: '/users' },
          { label: user?.name || 'User', path: `/users/${id}` },
          { label: 'Edit' },
        ]}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/users/${id}`)}>
            <ChevronLeft size={15} /> Back to User
          </button>
        }
      />

      <form onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
        <div className="card card-padded" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
            Basic Information
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <FormField label="Full Name" name="name" value={form.name} onChange={handleChange} required />
            <FormField label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} required />
            <FormField label="Mobile" name="mobile" value={form.mobile} onChange={handleChange} />
            <FormField label="Designation" name="designation" value={form.designation} onChange={handleChange} placeholder="e.g. Executive" />
          </div>
        </div>

        <div className="card card-padded" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
            Role & Organization
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <FormField label="Platform Role" name="role">
              <select name="role" value={form.role} onChange={handleChange} className="form-control" disabled>
                <option value="">Select role…</option>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </FormField>
            <FormField label="Status" name="status">
              <select name="status" value={form.status} onChange={handleChange} className="form-control" required>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </FormField>
            <FormField label="DSA ID" name="tenant_id" value={form.tenant_id} onChange={handleChange} disabled />
            <FormField label="Hierarchy Level" name="hierarchy_level">
              <select name="hierarchy_level" value={form.hierarchy_level} onChange={handleChange} className="form-control">
                <option value="">None</option>
                {HIERARCHY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </FormField>
            <FormField label="Manager" name="manager_id">
              <select name="manager_id" value={form.manager_id} onChange={handleChange} className="form-control">
                <option value="">None (root level)</option>
                {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.name || u.role})</option>)}
              </select>
            </FormField>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/users`)} disabled={saving}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditUserPage;
