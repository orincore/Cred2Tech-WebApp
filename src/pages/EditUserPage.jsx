import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUserById, getUsers, updateUser } from '../api/userService';
import { MOCK_USERS } from '../constants/mockData';
import { ROLE_OPTIONS, HIERARCHY_LEVELS } from '../constants/roles';
import { getErrorMessage } from '../utils/helpers';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { useTheme } from '../context/ThemeContext';

const ROLE_ID_NAME = { 1: 'SUPER_ADMIN', 2: 'DSA_ADMIN', 3: 'CRED2TECH_MEMBER', 4: 'DSA_MEMBER' };

const EditUserPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', role: '', tenant_id: '', hierarchy_level: '', manager_id: '', designation: '', status: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const labelStyle = { fontSize: 12, color: 'var(--on-muted)', marginBottom: 6, display: 'block', fontWeight: 600 };
  const inputStyle = {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628',
    fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s',
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');
  };

  const handleFieldBlur = (field) => {
    const value = form[field] || '';
    let errorMsg = '';

    switch (field) {
      case 'email':
        if (!value.trim()) {
          errorMsg = 'Email is required';
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
          errorMsg = 'Invalid email format (e.g. abc@xyz.com)';
        }
        break;
      case 'name':
        if (!value.trim()) errorMsg = 'Full name is required';
        break;
      case 'mobile':
        if (value && value.length !== 10) {
          errorMsg = 'Mobile number must be exactly 10 digits';
        }
        break;
      default:
        break;
    }

    setErrors((p) => ({ ...p, [field]: errorMsg }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) e.email = 'Invalid email format';
    if (form.mobile && form.mobile.length !== 10) e.mobile = 'Must be 10 digits';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setApiError('');
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
      setSuccess(true);
      toast.success('User updated successfully');
      setTimeout(() => navigate('/users'), 1500);
    } catch (err) {
      const msg = getErrorMessage(err);
      setApiError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] dark:bg-[#0a1628] font-sans overflow-y-auto">
      <div className="flex-1 flex flex-col px-6 py-8 md:px-16 lg:px-24 justify-center w-full">
        <div className="mb-10">
          <h1 className="text-[24px] md:text-[28px] lg:text-[34px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
            Edit User
          </h1>
          <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[13px] md:text-[14px] lg:text-[15px]">
            Modify user information for {user?.name || 'this user'}
          </p>
        </div>

        {/* Success banner */}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6 text-xs font-medium bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400">
            <CheckCircle size={16} />
            User updated successfully! Redirecting…
          </div>
        )}

        {/* Error banner */}
        {apiError && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
            <AlertCircle size={16} />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Basic Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. John Smith"
                  style={{ ...inputStyle, borderBottomColor: errors.name ? '#dc2626' : 'var(--outline)' }}
                  onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                  onBlur={e => {
                    handleFieldBlur('name');
                    e.target.style.borderBottomColor = errors.name ? '#dc2626' : 'var(--outline)';
                  }}
                />
                {errors.name && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="e.g. john@company.com"
                  style={{ ...inputStyle, borderBottomColor: errors.email ? '#dc2626' : 'var(--outline)' }}
                  onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                  onBlur={e => {
                    handleFieldBlur('email');
                    e.target.style.borderBottomColor = errors.email ? '#dc2626' : 'var(--outline)';
                  }}
                />
                {errors.email && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
              </div>
              <div>
                <label style={labelStyle}>Mobile</label>
                <input
                  type="text"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  placeholder="9876543210"
                  style={{ ...inputStyle, borderBottomColor: errors.mobile ? '#dc2626' : 'var(--outline)' }}
                  onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                  onBlur={e => {
                    handleFieldBlur('mobile');
                    e.target.style.borderBottomColor = errors.mobile ? '#dc2626' : 'var(--outline)';
                  }}
                />
                {errors.mobile && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.mobile}</div>}
              </div>
              <div>
                <label style={labelStyle}>Designation</label>
                <input
                  type="text"
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  placeholder="e.g. Executive"
                  style={{ ...inputStyle }}
                  onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                />
              </div>
            </div>
          </div>

          {/* Role & Organization */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Role & Organization
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
              <div>
                <label style={labelStyle}>Platform Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  disabled
                  style={{ ...inputStyle, cursor: 'not-allowed', opacity: 0.6, appearance: 'none' }}
                >
                  <option value="">Select role…</option>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status *</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>DSA ID</label>
                <input
                  type="text"
                  name="tenant_id"
                  value={form.tenant_id}
                  onChange={handleChange}
                  disabled
                  style={{ ...inputStyle, cursor: 'not-allowed', opacity: 0.6 }}
                />
              </div>
              <div>
                <label style={labelStyle}>Hierarchy Level</label>
                <select
                  name="hierarchy_level"
                  value={form.hierarchy_level}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                >
                  <option value="">None</option>
                  {HIERARCHY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Manager</label>
                <select
                  name="manager_id"
                  value={form.manager_id}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                >
                  <option value="">None (root level)</option>
                  {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.name || u.role})</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 32, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <button
              type="button"
              onClick={() => navigate('/users')}
              disabled={saving}
              style={{
                padding: '6px 16px', background: 'transparent', border: '2px solid var(--outline)',
                borderRadius: 10, fontSize: 11, fontWeight: 700, color: 'var(--on-surface)',
                cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                flex: isMobile ? 1 : 'auto',
              }}
            >
              Cancel
            </button>
            <TravelingBorderButton
              type="submit"
              disabled={saving || success}
              className="px-4 py-1.5 text-[11px] rounded-[10px]"
              style={{ flex: isMobile ? 1 : 'auto' }}
            >
              {saving ? (
                <div className="flex justify-center items-center w-full h-full">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span style={{ marginLeft: 4 }}>Saving…</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Save size={14} />
                  <span>Save Changes</span>
                </div>
              )}
            </TravelingBorderButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserPage;
