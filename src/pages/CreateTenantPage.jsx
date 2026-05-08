import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTenant } from '../api/tenantService';
import { createUser } from '../api/userService';
import { getRoles } from '../api/roleService';
import { getErrorMessage } from '../utils/helpers';
import { TENANT_TYPES } from '../constants/roles';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { useTheme } from '../context/ThemeContext';
import { countries } from '../lib/countries';

const initialForm = {
  // Tenant fields
  name: '',
  email: '',
  mobile: '',
  mobile_country_code: '+91',
  type: 'DSA',
  pan_number: '',
  gst_number: '',
  company_type: '',
  state: '',
  city: '',
  pincode: '',
  // Initial admin user fields
  admin_name: '',
  admin_email: '',
  admin_mobile: '',
  admin_mobile_country_code: '+91',
  admin_password: '',
};

const companyTypeOptions = ['Private Limited', 'Public Limited', 'Partnership', 'Proprietorship', 'LLP'];

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

const CreateTenantPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(''); // 'tenant' | 'admin' | 'done'
  const [isPincodeFetching, setIsPincodeFetching] = useState(false);
  const [locationFetched, setLocationFetched] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const labelStyle = { fontSize: 12, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 6, display: 'block', fontWeight: 600 };
  const inputStyle = {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628',
    fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s',
  };
  const inputFocusStyle = { borderBottomColor: '#4f46e5' };

  const handleChange = (e) => {
    let { name, value } = e.target;

    // Character limits & formatting
    if (name === 'pan_number') {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    } else if (name === 'gst_number') {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    } else if (name === 'pincode') {
      value = value.replace(/\D/g, '').slice(0, 6);
    } else if (name === 'city') {
      value = value.replace(/[^a-zA-Z\s\-]/g, '');
    }

    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');

    // Trigger Pincode Lookup
    if (name === 'pincode' && value.length === 6) {
      fetchLocationData(value);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  const fetchLocationData = async (pincode) => {
    setIsPincodeFetching(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();

      if (data && data[0] && data[0].Status === 'Success') {
        const postOffice = data[0].PostOffice[0];
        const state = postOffice.State;
        const city = postOffice.Name;

        setForm(p => ({
          ...p,
          state: state,
          city: city
        }));

        // Clear errors for these fields if they were set
        setErrors(p => ({ ...p, state: '', city: '' }));
        setLocationFetched(true);
        toast.success(`Location detected: ${city}, ${state}`);
      } else {
        toast.error('Invalid Pincode or no data found.');
      }
    } catch (err) {
      console.error('Pincode fetch error:', err);
      toast.error('Could not autofill location. Please enter manually.');
      setLocationFetched(true); // Allow manual entry even if API fails
    } finally {
      setIsPincodeFetching(false);
    }
  };

  const handlePhoneChange = (field, value) => {
    // Only digits and limit to exactly 10
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setForm((p) => ({ ...p, [field]: cleaned }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const handleCountryCodeChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    // Re-validate phone when country code changes
    const phoneField = field === 'mobile_country_code' ? 'mobile' : 'admin_mobile';
    if (form[phoneField]) handleFieldBlur(phoneField);

    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const handleFieldBlur = (field, directValue = null) => {
    const value = directValue !== null ? directValue : (form[field] || '');
    let errorMsg = '';

    switch (field) {
      case 'email':
      case 'admin_email':
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
      case 'admin_mobile':
        if (!value.trim()) {
          errorMsg = 'Mobile number is required';
        } else if (value.length !== 10) {
          errorMsg = 'Mobile number must be exactly 10 digits';
        } else if (/^(.)\1{9}$/.test(value)) {
          errorMsg = 'Please enter a valid mobile number (repeated digits detected)';
        } else if (/^0123456789$|^9876543210$|^1234567890$/.test(value)) {
          errorMsg = 'Please enter a valid mobile number (sequential digits detected)';
        } else {
          const countryCode = field === 'mobile' ? form.mobile_country_code : form.admin_mobile_country_code;
          const fullMobile = countryCode + value.replace(/\s/g, '');
          // Basic check for valid mobile start digits if country code is +91
          if (countryCode === '+91' && !/^[6-9]\d{9}$/.test(value)) {
            errorMsg = 'Indian mobile numbers must start with 6-9';
          } else if (!/^\+[1-9]\d{1,3}[1-9]\d{4,12}$/.test(fullMobile)) {
            errorMsg = 'Invalid mobile format';
          }
        }
        break;

      case 'pan_number':
        if (!value.trim()) {
          errorMsg = 'PAN number is required';
        } else if (value.length !== 10) {
          errorMsg = 'PAN must be exactly 10 characters';
        } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) {
          errorMsg = 'Invalid PAN format (e.g. ABCDE1234F)';
        }
        break;

      case 'gst_number':
        if (value.trim()) {
          if (value.length !== 15) {
            errorMsg = 'GST number must be 15 characters';
          } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value.toUpperCase())) {
            errorMsg = 'Invalid GST format';
          }
        }
        break;

      case 'pincode':
        if (!value) {
          errorMsg = 'Pincode is required';
        } else if (value.length !== 6) {
          errorMsg = 'Pincode must be exactly 6 digits';
        } else if (!/^[1-9][0-9]{5}$/.test(value)) {
          errorMsg = 'Invalid pincode format';
        }
        break;

      case 'admin_password':
        if (!value) {
          errorMsg = 'Password is required';
        } else if (value.length < 8) {
          errorMsg = 'Minimum 8 characters required';
        } else if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[!@#$%^&*]/.test(value)) {
          errorMsg = 'Password must include uppercase, lowercase, number and special char';
        }
        break;

      default:
        if (!value.trim()) {
          errorMsg = 'This field is required';
        }
    }

    setErrors((p) => ({ ...p, [field]: errorMsg }));
  };

  const validate = () => {
    const e = {};
    // Tenant validations
    if (!form.name.trim()) e.name = 'Organization name is required';

    if (!form.email.trim()) e.email = 'Organization email is required';
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) e.email = 'Invalid email format (e.g. abc@xyz.com)';

    if (!form.pan_number.trim()) e.pan_number = 'PAN required for compliance';
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number.toUpperCase())) e.pan_number = 'Invalid PAN format (e.g. ABCDE1234F)';

    if (form.mobile.trim()) {
      const fullMobile = form.mobile_country_code + form.mobile.replace(/\s/g, '');
      if (!/^\+[1-9]\d{1,3}[6-9]\d{9}$/.test(fullMobile)) {
        e.mobile = 'Invalid mobile format (e.g. +91 9876543210)';
      }
    }

    if (form.gst_number && form.gst_number.trim()) {
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst_number.toUpperCase().replace(/\s/g, ''))) {
        e.gst_number = 'Invalid GST format (e.g. 27AAACR5055K1Z7)';
      }
    }

    if (!form.company_type) e.company_type = 'Company type is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.pincode) e.pincode = 'Pincode is required';
    else if (!/^[1-9][0-9]{5}$/.test(form.pincode)) e.pincode = 'Invalid 6-digit pincode';

    // Initial admin validations
    if (!form.admin_name.trim()) e.admin_name = 'Admin name is required';

    if (!form.admin_email.trim()) e.admin_email = 'Admin email is required';
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.admin_email)) e.admin_email = 'Invalid email format (e.g. abc@xyz.com)';

    if (form.admin_mobile.trim()) {
      const fullAdminMobile = form.admin_mobile_country_code + form.admin_mobile.replace(/\s/g, '');
      if (!/^\+[1-9]\d{1,3}[6-9]\d{9}$/.test(fullAdminMobile)) {
        e.admin_mobile = 'Invalid mobile format (e.g. +91 9876543210)';
      }
    }

    if (!form.admin_password) e.admin_password = 'Password is required';
    else if (form.admin_password.length < 8) e.admin_password = 'Minimum 8 characters required';
    else if (!/[A-Z]/.test(form.admin_password) || !/[a-z]/.test(form.admin_password) || !/[0-9]/.test(form.admin_password) || !/[!@#$%^&*]/.test(form.admin_password)) {
      e.admin_password = 'Password must include uppercase, lowercase, number and special char';
    }

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    setApiError('');

    let newTenant = null;

    try {
      // Step 1: Create the tenant
      setStep('tenant');
      newTenant = await createTenant({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim() || undefined,
        type: form.type,
        pan_number: form.pan_number.toUpperCase(),
        gst_number: form.gst_number ? form.gst_number.toUpperCase() : undefined,
        company_type: form.company_type,
        state: form.state.trim(),
        city: form.city.trim(),
        pincode: form.pincode,
        status: 'ACTIVE',
      });

      // Step 2: Resolve DSA_ADMIN role id
      setStep('admin');
      const roles = await getRoles().catch(() => []);
      const dsaAdminRole = roles.find(r => r.name === 'DSA_ADMIN');

      if (!dsaAdminRole) {
        throw new Error('DSA_ADMIN role not found in database. Please ensure roles are seeded (restart backend).');
      }

      // Step 3: Create initial admin user for this tenant
      await createUser({
        name: form.admin_name.trim(),
        email: form.admin_email.trim().toLowerCase(),
        mobile: form.admin_mobile.trim() || undefined,
        password: form.admin_password,
        role_id: dsaAdminRole.id,
        tenant_id: newTenant.id, // backend overrides from currentUser — this is DSA tenant id
      });

      setStep('done');
      setSuccess(true);
      toast.success('Tenant and admin user created successfully!');
      setTimeout(() => navigate('/tenants'), 2000);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (step === 'admin' || (newTenant && !success)) {
        setApiError(`Tenant created (ID: ${newTenant?.id}), but admin user creation failed: ${msg}. Please create the admin user separately.`);
      } else {
        setApiError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabel = step === 'tenant' ? 'Creating tenant…' : step === 'admin' ? 'Creating admin user…' : 'Processing…';

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] dark:bg-[#0a1628] font-sans overflow-y-auto">
      <div className="flex-1 flex flex-col px-6 py-8 md:px-16 lg:px-24 justify-center w-full">
          <div className="mb-10">
            <h1 className="text-[24px] md:text-[28px] lg:text-[34px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
              Create DSA Organization
            </h1>
            <p className="text-[#4a5d73] dark:text-[#94a3b8] text-[13px] md:text-[14px] lg:text-[15px]">
              Onboard a new DSA or Team ecosystem with an initial admin user
            </p>
          </div>

          {/* Success banner */}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6 text-xs font-medium bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400">
              <CheckCircle size={16} />
              DSA and admin user created successfully! Redirecting…
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
            {/* Organization Details */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
                DSA Organization Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
                <div>
                  <label style={labelStyle}>Organization Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Acme FinServe"
                    style={{ ...inputStyle, ...(errors.name ? inputFocusStyle : {}) }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => e.target.style.borderBottomColor = errors.name ? '#dc2626' : 'var(--outline)'}
                  />
                  {errors.name && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Official Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="e.g. admin@acme.com"
                    style={{ ...inputStyle, ...(errors.email ? inputFocusStyle : {}) }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => {
                      handleFieldBlur('email');
                      e.target.style.borderBottomColor = errors.email ? '#dc2626' : 'var(--outline)';
                    }}
                  />
                  {errors.email && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Mobile Number</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      name="mobile_country_code"
                      value={form.mobile_country_code}
                      onChange={e => handleCountryCodeChange('mobile_country_code', e.target.value)}
                      style={{ ...inputStyle, width: '45px', cursor: 'pointer', appearance: 'none' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
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
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => {
                        handleFieldBlur('mobile');
                        e.target.style.borderBottomColor = errors.mobile ? '#dc2626' : 'var(--outline)';
                      }}
                    />
                  </div>
                  {errors.mobile && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.mobile}</div>}
                  <div style={{ color: isDark ? '#94a3b8' : '#4a5d73', fontSize: 11, marginTop: 4 }}>Optional contact number</div>
                </div>
                <div>
                  <label style={labelStyle}>Organization Type *</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    style={{ ...inputStyle, ...(errors.type ? inputFocusStyle : {}), cursor: 'pointer', appearance: 'none' }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => e.target.style.borderBottomColor = errors.type ? '#dc2626' : 'var(--outline)'}
                  >
                    {TENANT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.type && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.type}</div>}
                </div>
                <div>
                  <label style={labelStyle}>PAN Number *</label>
                  <input
                    type="text"
                    name="pan_number"
                    value={form.pan_number}
                    onChange={handleChange}
                    placeholder="ABCDE1234F"
                    style={{ ...inputStyle, ...(errors.pan_number ? inputFocusStyle : {}) }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => {
                      handleFieldBlur('pan_number');
                      e.target.style.borderBottomColor = errors.pan_number ? '#dc2626' : 'var(--outline)';
                    }}
                  />
                  {errors.pan_number && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.pan_number}</div>}
                </div>
                <div>
                  <label style={labelStyle}>GST Number</label>
                  <input
                    type="text"
                    name="gst_number"
                    value={form.gst_number}
                    onChange={handleChange}
                    placeholder="e.g. 27ABCDE1234F2Z5"
                    style={{ ...inputStyle, ...(errors.gst_number ? inputFocusStyle : {}) }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => {
                      handleFieldBlur('gst_number');
                      e.target.style.borderBottomColor = errors.gst_number ? '#dc2626' : 'var(--outline)';
                    }}
                  />
                  {errors.gst_number && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.gst_number}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Company Type *</label>
                  <select
                    name="company_type"
                    value={form.company_type}
                    onChange={handleChange}
                    style={{ ...inputStyle, ...(errors.company_type ? inputFocusStyle : {}), cursor: 'pointer', appearance: 'none' }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => e.target.style.borderBottomColor = errors.company_type ? '#dc2626' : 'var(--outline)'}
                  >
                    <option value="">Select Type...</option>
                    {companyTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.company_type && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.company_type}</div>}
                </div>
              </div>
            </div>

            {/* Location Info */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
                Location Info
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
                <div>
                  <label style={labelStyle}>Pincode *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleChange}
                      placeholder="400001"
                      style={{ ...inputStyle, ...(errors.pincode ? inputFocusStyle : {}) }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => {
                        if (form.pincode && form.pincode.length === 6) {
                          handleFieldBlur('pincode');
                        }
                        e.target.style.borderBottomColor = errors.pincode ? '#dc2626' : 'var(--outline)';
                      }}
                    />
                    {isPincodeFetching && (
                      <div style={{ position: 'absolute', right: 0, bottom: 3, width: 14, height: 14, border: '2px solid #4f46e5/30', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    )}
                  </div>
                  {errors.pincode && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.pincode}</div>}
                </div>
                <div>
                  <label style={{ ...labelStyle, opacity: locationFetched ? 1 : 0.4 }}>State *</label>
                  <input
                    type="text"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder={locationFetched ? "e.g. Maharashtra" : "Enter pincode first..."}
                    disabled={!locationFetched}
                    style={{ ...inputStyle, ...(errors.state ? inputFocusStyle : {}), opacity: locationFetched ? 1 : 0.4, cursor: locationFetched ? 'text' : 'not-allowed' }}
                    onFocus={e => locationFetched && (e.target.style.borderBottomColor = '#4f46e5')}
                    onBlur={e => {
                      if (locationFetched) {
                        handleFieldBlur('state');
                        e.target.style.borderBottomColor = errors.state ? '#dc2626' : 'var(--outline)';
                      }
                    }}
                  />
                  {errors.state && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.state}</div>}
                </div>
                <div>
                  <label style={{ ...labelStyle, opacity: locationFetched ? 1 : 0.4 }}>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder={locationFetched ? "e.g. Mumbai" : "Enter pincode first..."}
                    disabled={!locationFetched}
                    style={{ ...inputStyle, ...(errors.city ? inputFocusStyle : {}), opacity: locationFetched ? 1 : 0.4, cursor: locationFetched ? 'text' : 'not-allowed' }}
                    onFocus={e => locationFetched && (e.target.style.borderBottomColor = '#4f46e5')}
                    onBlur={e => {
                      if (locationFetched) {
                        handleFieldBlur('city');
                        e.target.style.borderBottomColor = errors.city ? '#dc2626' : 'var(--outline)';
                      }
                    }}
                  />
                  {errors.city && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.city}</div>}
                </div>
              </div>
            </div>

            {/* Initial Admin User */}
            <div style={{ marginBottom: 32, borderLeft: '3px solid #4f46e5', paddingLeft: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <UserPlus size={16} color="#4f46e5" />
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Initial Admin User
                </h3>
              </div>
              <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#4a5d73', marginBottom: 20 }}>
                This user will be created as <strong>DSA Admin</strong> for the new organization and will be able to log in immediately.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
                <div>
                  <label style={labelStyle}>Admin Full Name *</label>
                  <input
                    type="text"
                    name="admin_name"
                    value={form.admin_name}
                    onChange={handleChange}
                    placeholder="e.g. John Smith"
                    style={{ ...inputStyle, ...(errors.admin_name ? inputFocusStyle : {}) }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => e.target.style.borderBottomColor = errors.admin_name ? '#dc2626' : 'var(--outline)'}
                  />
                  {errors.admin_name && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.admin_name}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Admin Email *</label>
                  <input
                    type="email"
                    name="admin_email"
                    value={form.admin_email}
                    onChange={handleChange}
                    placeholder="e.g. john@acme.com"
                    style={{ ...inputStyle, ...(errors.admin_email ? inputFocusStyle : {}) }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => {
                      handleFieldBlur('admin_email');
                      e.target.style.borderBottomColor = errors.admin_email ? '#dc2626' : 'var(--outline)';
                    }}
                  />
                  {errors.admin_email && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.admin_email}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Admin Mobile</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      name="admin_mobile_country_code"
                      value={form.admin_mobile_country_code}
                      onChange={e => handleCountryCodeChange('admin_mobile_country_code', e.target.value)}
                      style={{ ...inputStyle, width: '45px', cursor: 'pointer', appearance: 'none' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                    >
                      {countryOptions.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
                    </select>
                    <input
                      type="text"
                      name="admin_mobile"
                      value={form.admin_mobile}
                      onChange={e => handlePhoneChange('admin_mobile', e.target.value)}
                      placeholder="9876543210"
                      style={{ ...inputStyle, flex: 1 }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => {
                        handleFieldBlur('admin_mobile');
                        e.target.style.borderBottomColor = errors.admin_mobile ? '#dc2626' : 'var(--outline)';
                      }}
                    />
                  </div>
                  {errors.admin_mobile && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.admin_mobile}</div>}
                  <div style={{ color: isDark ? '#94a3b8' : '#4a5d73', fontSize: 11, marginTop: 4 }}>Optional</div>
                </div>
                <div>
                  <label style={labelStyle}>Login Password *</label>
                  <input
                    type="password"
                    name="admin_password"
                    value={form.admin_password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    style={{ ...inputStyle, ...(errors.admin_password ? inputFocusStyle : {}) }}
                    onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                    onBlur={e => {
                      handleFieldBlur('admin_password');
                      e.target.style.borderBottomColor = errors.admin_password ? '#dc2626' : 'var(--outline)';
                    }}
                  />
                  {errors.admin_password && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.admin_password}</div>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 32, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <button
                type="button"
                onClick={() => navigate('/tenants')}
                disabled={isLoading}
                style={{
                  padding: '6px 16px', background: 'transparent', border: '2px solid var(--outline)',
                  borderRadius: 10, fontSize: 11, fontWeight: 700, color: 'var(--on-surface)',
                  cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  flex: isMobile ? 1 : 'auto',
                }}
              >
                Cancel
              </button>
              <TravelingBorderButton
                type="submit"
                disabled={isLoading || success}
                className="px-4 py-1.5 text-[11px] rounded-[10px]"
                style={{ flex: isMobile ? 1 : 'auto' }}
              >
                {isLoading ? (
                  <div className="flex justify-center items-center w-full h-full">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span style={{ marginLeft: 4 }}>{stepLabel}</span>
                  </div>
                ) : (
                  <span>Create DSA & Admin</span>
                )}
              </TravelingBorderButton>
            </div>
          </form>
        </div>
    </div>
  );
};

export default CreateTenantPage;
