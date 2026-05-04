import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createUser, getUsers } from '../api/userService';
import { getRoles } from '../api/roleService';
import { useAuth } from '../context/AuthContext';
import { HIERARCHY_LEVELS } from '../constants/roles';
import PageHeader from '../components/ui/PageHeader';
import FormField from '../components/ui/FormField';
import { getErrorMessage } from '../utils/helpers';

const initialForm = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  role_id: '',
  hierarchy_level: '',
  manager_id: '',
  designation: '',
};

const INTERNAL_ROLE_NAMES = ['SUPER_ADMIN', 'CRED2TECH_MEMBER'];
const DSA_ROLE_NAMES = ['DSA_ADMIN', 'DSA_MEMBER'];

const CreateUserPage = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState('');

  useEffect(() => {
    // Fetch same-tenant users for manager dropdown
    getUsers()
      .then(data => setTenantUsers(Array.isArray(data) ? data : data.users || []))
      .catch(() => { });
    // Fetch roles dynamically from backend
    setIsLoadingRoles(true);
    getRoles()
      .then(data => {
        setRoles(Array.isArray(data) ? data : []);
        setRolesError('');
      })
      .catch((err) => {
        console.error('Failed to load roles:', err?.response?.data || err.message);
        setRolesError('Could not load roles. Please restart the backend and refresh.');
      })
      .finally(() => setIsLoadingRoles(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters required';
    if (!form.role_id) e.role_id = 'Please select a role';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setIsLoading(true);
    setApiError('');
    try {
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile || undefined,
        password: form.password,
        role_id: parseInt(form.role_id, 10), // real DB id from dynamic /roles response
        tenant_id: currentUser.tenant_id,    // backend overrides this — sent for context only
        hierarchy_level: form.hierarchy_level || undefined,
        manager_id: form.manager_id ? Number(form.manager_id) : undefined,
        designation: form.designation || undefined,
      });
      setSuccess(true);
      toast.success('User created successfully!');
      setTimeout(() => navigate('/users'), 1600);
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Filter roles allowed for the current user's tenant type
  const availableRoles = roles.filter((r) => {
    if (currentUser?.tenant_type === 'CRED2TECH') return INTERNAL_ROLE_NAMES.includes(r.name);
    if (currentUser?.tenant_type === 'DSA') return DSA_ROLE_NAMES.includes(r.name);
    return false;
  });

  // Manager dropdown: only same-tenant users (backend also enforces this)
  const eligibleManagers = tenantUsers.filter(u => u.tenant_id === currentUser?.tenant_id);

  return (
    <div>
      <PageHeader
        title="Create User"
        subtitle="Add a new user to the platform"
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Users', path: '/users' }, { label: 'Create User' }]}
      />

      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {success && (
          <div className="notice" style={{ background: 'var(--success-bg)', borderColor: '#6EE7B7', color: '#064E3B', marginBottom: 20 }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            User created successfully! Redirecting to users list…
          </div>
        )}

        {apiError && (
          <div className="notice notice-error" style={{ marginBottom: 20 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="card card-padded" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Basic Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <FormField label="Full Name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. John Doe" required error={errors.name} />
              <FormField label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} placeholder="e.g. john@example.com" required error={errors.email} />
              <FormField label="Mobile Number" name="mobile" value={form.mobile} onChange={handleChange} placeholder="e.g. 9876543210" hint="Optional — 10-digit mobile number" />
              <FormField label="Designation" name="designation" value={form.designation} onChange={handleChange} placeholder="e.g. Operations Executive" hint="Optional" />
              <FormField label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" required error={errors.password} />
            </div>
          </div>

          {/* Role */}
          <div className="card card-padded" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Role & Access
            </h3>
            <FormField label="Platform Role" name="role_id" required error={errors.role_id} hint="Determines what the user can access on the platform.">
              <select name="role_id" value={form.role_id} onChange={handleChange} className={`form-control${errors.role_id ? ' error-input' : ''}`} disabled={isLoadingRoles || !!rolesError}>
                <option value="">
                  {isLoadingRoles ? 'Loading roles…' : rolesError ? 'Failed to load roles' : 'Select a role…'}
                </option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              {rolesError && (
                <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{rolesError}</p>
              )}
            </FormField>

            <FormField label="Tenant Scope" hint="Users are strictly locked to your organizational tenant.">
              <input type="text" className="form-control" value={`Locked to Tenant ID: ${currentUser.tenant_id}`} disabled />
            </FormField>
          </div>

          {/* Hierarchy & Manager */}
          <div className="card card-padded" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Organization & Hierarchy
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <FormField label="Hierarchy Level" name="hierarchy_level" error={errors.hierarchy_level} hint="Only for DSA_MEMBER role users (L1, L2, L3…)">
                <select name="hierarchy_level" value={form.hierarchy_level} onChange={handleChange} className="form-control">
                  <option value="">None (root level)</option>
                  {HIERARCHY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormField>
              <FormField label="Manager" name="manager_id" hint="Select a manager from your tenant. Leave blank if none.">
                <select name="manager_id" value={form.manager_id} onChange={handleChange} className="form-control">
                  <option value="">None (root level)</option>
                  {eligibleManagers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role?.name || u.role})</option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/users')} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || success} style={{ minWidth: 140, justifyContent: 'center' }}>
              {isLoading ? <><div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Creating…</> : <><UserPlus size={15} /> Create User</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserPage;
