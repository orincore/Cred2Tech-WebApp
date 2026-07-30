import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createUser, getUsers } from '../api/userService';
import { getRoles } from '../api/roleService';
import { useAuth } from '../context/AuthContext';
import { HIERARCHY_LEVELS } from '../constants/roles';
import TravelingBorderButton from '../components/TravelingBorderButton';
import PageHeader from '../components/ui/PageHeader';
import { countries } from '../lib/countries';
import { getErrorMessage } from '../utils/helpers';

const initialForm = {
  name: '',
  email: '',
  mobile: '',
  mobile_country_code: '+91',
  password: '',
  role_id: '',
  hierarchy_level: '',
  manager_id: '',
  designation: '',
};

const INTERNAL_ROLE_NAMES = ['SUPER_ADMIN', 'CRED2TECH_MEMBER'];
const DSA_ROLE_NAMES = ['DSA_ADMIN', 'DSA_MEMBER'];

const countryOptions = countries.map(c => ({
  value: c.dialCode,
  label: `${c.emoji} ${c.name} (${c.dialCode})`
})).filter((option, index, self) =>
  index === self.findIndex(o => o.value === option.value)
).sort((a, b) => {
  // Keep +91 at the top
  if (a.value === '+91') return -1;
  if (b.value === '+91') return 1;
  return a.value.localeCompare(b.value);
});

const CreateUserPage = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
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
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const labelStyle = { fontSize: 12, color: 'var(--on-muted)', marginBottom: 6, display: 'block', fontWeight: 600 };
  const inputStyle = {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    borderBottom: '2px solid var(--outline)', color: 'var(--on-surface)',
    fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s',
  };
  const inputFocusStyle = { borderBottomColor: 'var(--primary)' };

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
    let { name, value } = e.target;

    // Character limits & formatting
    if (name === 'name') {
      value = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (name === 'designation') {
      value = value.replace(/[^a-zA-Z\s\-]/g, '');
    }

    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');
  };

  const handlePhoneChange = (field, value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setForm((p) => ({ ...p, [field]: cleaned }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const handleCountryCodeChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (form.mobile) handleFieldBlur('mobile');
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const handleFieldBlur = (field, directValue = null) => {
    const value = directValue !== null ? directValue : (form[field] || '');
    let errorMsg = '';

    switch (field) {
      case 'email':
        const spamEmailPatterns = [
          /^(test|demo|sample|example|abc|xyz|temp|fake|spam)@/i,
          /@(test|demo|sample|example|temp|fake)\./i,
          /^(admin|user|email|mail|info)@/i,
        ];
        if (!value.trim()) {
          errorMsg = 'Email is required';
        } else if (spamEmailPatterns.some(pattern => pattern.test(value))) {
          errorMsg = 'Please enter a valid business email address';
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
          errorMsg = 'Invalid email format (e.g. abc@xyz.com)';
        }
        break;

      case 'mobile':
        if (value) {
          if (value.length !== 10) {
            errorMsg = 'Mobile number must be exactly 10 digits';
          } else if (/^(.)\1{9}$/.test(value)) {
            errorMsg = 'Please enter a valid mobile number (repeated digits detected)';
          } else if (/^0123456789$|^9876543210$|^1234567890$/.test(value)) {
            errorMsg = 'Please enter a valid mobile number (sequential digits detected)';
          } else {
            const countryCode = form.mobile_country_code;
            const fullMobile = countryCode + value.replace(/\s/g, '');
            if (countryCode === '+91' && !/^[6-9]\d{9}$/.test(value)) {
              errorMsg = 'Indian mobile numbers must start with 6-9';
            } else if (!/^\+[1-9]\d{1,3}[1-9]\d{4,12}$/.test(fullMobile)) {
              errorMsg = 'Invalid mobile format';
            }
          }
        }
        break;

      case 'password':
        if (!value) {
          errorMsg = 'Password is required';
        } else if (value.length < 8) {
          errorMsg = 'Password must be at least 8 characters';
        } else if (!/[A-Z]/.test(value)) {
          errorMsg = 'Password must contain at least one uppercase letter';
        } else if (!/[a-z]/.test(value)) {
          errorMsg = 'Password must contain at least one lowercase letter';
        } else if (!/[0-9]/.test(value)) {
          errorMsg = 'Password must contain at least one number';
        } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
          errorMsg = 'Password must contain at least one special character';
        }
        break;
    }

    setErrors((p) => ({ ...p, [field]: errorMsg }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    
    if (!form.email.trim()) {
      e.email = 'Email is required';
    } else {
      const spamEmailPatterns = [
        /^(test|demo|sample|example|abc|xyz|temp|fake|spam)@/i,
        /@(test|demo|sample|example|temp|fake)\./i,
        /^(admin|user|email|mail|info)@/i,
      ];
      if (spamEmailPatterns.some(pattern => pattern.test(form.email))) {
        e.email = 'Please enter a valid business email address';
      } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
        e.email = 'Invalid email format (e.g. abc@xyz.com)';
      }
    }

    if (form.mobile) {
      if (form.mobile.length !== 10) {
        e.mobile = 'Mobile number must be exactly 10 digits';
      } else if (/^(.)\1{9}$/.test(form.mobile)) {
        e.mobile = 'Please enter a valid mobile number (repeated digits detected)';
      } else if (/^0123456789$|^9876543210$|^1234567890$/.test(form.mobile)) {
        e.mobile = 'Please enter a valid mobile number (sequential digits detected)';
      } else {
        const countryCode = form.mobile_country_code;
        const fullMobile = countryCode + form.mobile.replace(/\s/g, '');
        if (countryCode === '+91' && !/^[6-9]\d{9}$/.test(form.mobile)) {
          e.mobile = 'Indian mobile numbers must start with 6-9';
        } else if (!/^\+[1-9]\d{1,3}[1-9]\d{4,12}$/.test(fullMobile)) {
          e.mobile = 'Invalid mobile format';
        }
      }
    }

    if (!form.password) {
      e.password = 'Password is required';
    } else if (form.password.length < 8) {
      e.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(form.password)) {
      e.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(form.password)) {
      e.password = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(form.password)) {
      e.password = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(form.password)) {
      e.password = 'Password must contain at least one special character';
    }

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
    <div className="cup-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .cup-page > div { padding: 80px 24px 24px !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <PageHeader title="Create User" subtitle="Add a new user to the platform" />

        {/* Success banner */}
        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, fontWeight: 500, background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <CheckCircle size={16} />
            User created successfully! Redirecting to users list…
          </div>
        )}

        {/* Error banner */}
        {apiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, fontWeight: 500, background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)' }}>
            <AlertCircle size={16} />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
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
                  placeholder="e.g. John Doe"
                  style={{ ...inputStyle, ...(errors.name ? inputFocusStyle : {}) }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderBottomColor = errors.name ? 'var(--error)' : 'var(--outline)'}
                />
                {errors.name && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="e.g. john@example.com"
                  style={{ ...inputStyle, ...(errors.email ? inputFocusStyle : {}) }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => {
                    handleFieldBlur('email');
                    e.target.style.borderBottomColor = errors.email ? 'var(--error)' : 'var(--outline)';
                  }}
                />
                {errors.email && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
              </div>
              <div>
                <label style={labelStyle}>Mobile Number</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    name="mobile_country_code"
                    value={form.mobile_country_code}
                    onChange={e => handleCountryCodeChange('mobile_country_code', e.target.value)}
                    style={{ ...inputStyle, width: '45px', cursor: 'pointer', appearance: 'none' }}
                    onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                  >
                    {countryOptions.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
                  </select>
                  <input
                    type="text"
                    name="mobile"
                    value={form.mobile}
                    onChange={e => handlePhoneChange('mobile', e.target.value)}
                    placeholder="9876543210"
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                    onBlur={e => {
                      handleFieldBlur('mobile');
                      e.target.style.borderBottomColor = errors.mobile ? 'var(--error)' : 'var(--outline)';
                    }}
                  />
                </div>
                {errors.mobile && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.mobile}</div>}
                <div style={{ color: 'var(--on-muted)', fontSize: 11, fontWeight: 500, marginTop: 4 }}>Optional — 10-digit mobile number</div>
              </div>
              <div>
                <label style={labelStyle}>Designation</label>
                <input
                  type="text"
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  placeholder="e.g. Operations Executive"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                />
                <div style={{ color: 'var(--on-muted)', fontSize: 11, fontWeight: 500, marginTop: 4 }}>Optional</div>
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  style={{ ...inputStyle, ...(errors.password ? inputFocusStyle : {}) }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => {
                    handleFieldBlur('password');
                    e.target.style.borderBottomColor = errors.password ? 'var(--error)' : 'var(--outline)';
                  }}
                />
                {errors.password && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.password}</div>}
              </div>
            </div>
          </div>

          {/* Role & Access */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Role & Access
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
              <div>
                <label style={labelStyle}>Platform Role *</label>
                <select
                  name="role_id"
                  value={form.role_id}
                  onChange={handleChange}
                  style={{ ...inputStyle, ...(errors.role_id ? inputFocusStyle : {}), cursor: 'pointer', appearance: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderBottomColor = errors.role_id ? 'var(--error)' : 'var(--outline)'}
                  disabled={isLoadingRoles || !!rolesError}
                >
                  <option value="">
                    {isLoadingRoles ? 'Loading roles…' : rolesError ? 'Failed to load roles' : 'Select a role…'}
                  </option>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                {errors.role_id && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.role_id}</div>}
                {rolesError && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{rolesError}</div>}
                <div style={{ color: 'var(--on-muted)', fontSize: 11, fontWeight: 500, marginTop: 4 }}>Determines what the user can access on the platform</div>
              </div>
            </div>
          </div>

          {/* Organization & Hierarchy */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Organization & Hierarchy
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
              <div>
                <label style={labelStyle}>Hierarchy Level</label>
                <select
                  name="hierarchy_level"
                  value={form.hierarchy_level}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                >
                  <option value="">None (root level)</option>
                  {HIERARCHY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <div style={{ color: 'var(--on-muted)', fontSize: 11, fontWeight: 500, marginTop: 4 }}>Only for DSA_MEMBER role users (L1, L2, L3…)</div>
              </div>
              <div>
                <label style={labelStyle}>Manager</label>
                <select
                  name="manager_id"
                  value={form.manager_id}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                >
                  <option value="">None (root level)</option>
                  {eligibleManagers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role?.name || u.role})</option>
                  ))}
                </select>
                <div style={{ color: 'var(--on-muted)', fontSize: 11, fontWeight: 500, marginTop: 4 }}>Select a manager from your tenant. Leave blank if none</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start', marginTop: 32 }}>
            <button
              type="button"
              onClick={() => navigate('/users')}
              disabled={isLoading}
              style={{
                padding: '6px 14px', background: 'transparent', border: '2px solid var(--outline)',
                borderRadius: 0, fontSize: 12, fontWeight: 700, color: 'var(--on-surface)',
                cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
            <TravelingBorderButton
              type="submit"
              size="sm"
              solid
              showIcon={false}
              disabled={isLoading || success}
            >
              {isLoading ? (
                <div className="flex justify-center items-center w-full h-full">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span style={{ marginLeft: 6 }}>Creating…</span>
                </div>
              ) : (
                <span>Create User</span>
              )}
            </TravelingBorderButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserPage;
