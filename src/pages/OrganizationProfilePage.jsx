import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Save, ChevronDown, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTenantById, updateTenant, getDsaAgreementPdfBlob } from '../api/tenantService';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, formatDateTime } from '../utils/helpers';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import TravelingBorderButton from '../components/TravelingBorderButton';
import PageHeader from '../components/ui/PageHeader';
import VirtualWorkspaceSubscriptionCard from '../components/VirtualWorkspaceSubscriptionCard';

// Same list CreateTenantPage offers — kept in sync there rather than shared,
// same reasoning as EditUserPage's own local DSA_ROLE_NAMES copy.
const companyTypeOptions = ['Private Limited', 'Public Limited', 'Partnership', 'Proprietorship', 'LLP'];

// Same list DSARegisterPage.jsx uses for Operational States — kept local
// rather than shared for the same reason as companyTypeOptions above.
const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// A CSS-var-themed equivalent of DSARegisterPage.jsx's MultiSelectDropdown —
// same behavior (search, chips, toggle), but built with this page's
// var(--...) token styling instead of that page's hardcoded Tailwind
// dark:-class colors, so it matches everything else on this form.
const StatesMultiSelect = ({ value, onChange, options, placeholder, hasError, inputStyle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) { setIsOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (opt) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  const filteredOptions = search.trim()
    ? options.filter((opt) => opt.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div
        tabIndex={0}
        onClick={() => setIsOpen((o) => !o)}
        style={{ ...inputStyle, ...(hasError ? { borderBottomColor: 'var(--error)' } : {}), display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <span style={value.length === 0 ? { color: 'var(--on-muted)', fontWeight: 500 } : undefined}>
          {value.length === 0 ? placeholder : `${value.length} state${value.length > 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--on-muted)', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </div>

      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {value.map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--primary-bg, var(--bg-elevated))', color: 'var(--primary)', fontSize: 11, fontWeight: 700, borderRadius: 999 }}>
              {s}
              <X size={12} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggle(s); }} />
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <div style={{ position: 'absolute', zIndex: 50, width: '100%', minWidth: 240, top: 'calc(100% + 4px)', left: 0, background: 'var(--surface)', border: '1px solid var(--outline)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Search states…"
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid var(--outline)', outline: 'none', background: 'transparent', color: 'var(--on-surface)', fontSize: 13, padding: '10px 12px' }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filteredOptions.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--on-muted)' }}>No states match "{search}"</div>
            )}
            {filteredOptions.map((opt) => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 13, color: 'var(--on-surface)', cursor: 'pointer' }}>
                <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OrganizationProfilePage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', pan_number: '', gst_number: '', company_type: '', state: '', city: '', pincode: '', address_line: '', operational_states: [] });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isPincodeFetching, setIsPincodeFetching] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [viewingAgreement, setViewingAgreement] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!currentUser?.tenant_id) return;
    const fetchTenant = async () => {
      try {
        const data = await getTenantById(currentUser.tenant_id);
        setTenant(data);
        setForm({
          name: data.name || '',
          mobile: data.mobile || '',
          pan_number: data.pan_number || '',
          gst_number: data.gst_number || '',
          company_type: data.company_type || '',
          state: data.state || '',
          city: data.city || '',
          pincode: data.pincode || '',
          address_line: data.address_line || '',
          operational_states: Array.isArray(data.operational_states) ? data.operational_states : [],
        });
      } catch (err) {
        setApiError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchTenant();
  }, [currentUser?.tenant_id]);

  const labelStyle = { fontSize: 12, color: 'var(--on-muted)', marginBottom: 6, display: 'block', fontWeight: 600 };
  const inputStyle = {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    borderBottom: '2px solid var(--outline)', color: 'var(--on-surface)',
    fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s',
  };
  const inputFocusStyle = { borderBottomColor: 'var(--primary)' };
  const readOnlyStyle = { ...inputStyle, color: 'var(--on-muted)', cursor: 'not-allowed', opacity: 0.7 };

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'pan_number') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    else if (name === 'gst_number') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    else if (name === 'pincode') value = value.replace(/\D/g, '').slice(0, 6);
    else if (name === 'city') value = value.replace(/[^a-zA-Z\s\-]/g, '');
    else if (name === 'mobile') value = value.replace(/\D/g, '').slice(0, 10);

    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');

    if (name === 'pincode' && value.length === 6) fetchLocationData(value);
  };

  const fetchLocationData = async (pincode) => {
    setIsPincodeFetching(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success') {
        const postOffice = data[0].PostOffice[0];
        setForm((p) => ({ ...p, state: postOffice.State, city: postOffice.Name }));
        setErrors((p) => ({ ...p, state: '', city: '' }));
        toast.success(`Location detected: ${postOffice.Name}, ${postOffice.State}`);
      } else {
        toast.error('Invalid Pincode or no data found.');
      }
    } catch {
      toast.error('Could not autofill location. Please enter manually.');
    } finally {
      setIsPincodeFetching(false);
    }
  };

  const handleFieldBlur = (field) => {
    const value = form[field] || '';
    let errorMsg = '';
    switch (field) {
      case 'pan_number':
        if (!value.trim()) errorMsg = 'PAN number is required';
        else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) errorMsg = 'Invalid PAN format (e.g. ABCDE1234F)';
        break;
      case 'gst_number':
        if (value.trim()) {
          if (value.length !== 15) errorMsg = 'GST number must be 15 characters';
          else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value.toUpperCase())) errorMsg = 'Invalid GST format';
        }
        break;
      case 'pincode':
        if (!value) errorMsg = 'Pincode is required';
        else if (!/^[1-9][0-9]{5}$/.test(value)) errorMsg = 'Invalid pincode format';
        break;
      case 'mobile':
        if (value && value.length !== 10) errorMsg = 'Mobile number must be exactly 10 digits';
        break;
      case 'name':
        if (!value.trim()) errorMsg = 'Organization name is required';
        break;
      default:
        break;
    }
    setErrors((p) => ({ ...p, [field]: errorMsg }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Organization name is required';
    if (!form.pan_number.trim()) e.pan_number = 'PAN required for compliance';
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number.toUpperCase())) e.pan_number = 'Invalid PAN format (e.g. ABCDE1234F)';
    if (form.gst_number && form.gst_number.trim()) {
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst_number.toUpperCase())) e.gst_number = 'Invalid GST format (e.g. 27AAACR5055K1Z7)';
    }
    if (form.mobile && form.mobile.length !== 10) e.mobile = 'Must be 10 digits';
    if (!form.company_type) e.company_type = 'Company type is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.pincode) e.pincode = 'Pincode is required';
    else if (!/^[1-9][0-9]{5}$/.test(form.pincode)) e.pincode = 'Invalid 6-digit pincode';
    if (form.operational_states.length === 0) e.operational_states = 'Select at least one state you provide service in';
    return e;
  };

  const handleViewAgreement = async () => {
    setViewingAgreement(true);
    try {
      const blob = await getDsaAgreementPdfBlob(currentUser.tenant_id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Object URLs aren't auto-revoked — but revoking immediately can race
      // the new tab still loading it, so give the browser a moment to
      // actually open and start rendering it first.
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load DSA agreement');
    } finally {
      setViewingAgreement(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setApiError('');
    try {
      await updateTenant(currentUser.tenant_id, {
        name: form.name.trim(),
        mobile: form.mobile.trim() || undefined,
        pan_number: form.pan_number.toUpperCase(),
        gst_number: form.gst_number ? form.gst_number.toUpperCase() : undefined,
        company_type: form.company_type,
        state: form.state.trim(),
        city: form.city.trim(),
        pincode: form.pincode,
        // Always sent, even empty — the backend only treats this key as
        // "leave untouched" when it's absent from the body entirely, not
        // when it's an explicit empty string, so this page can actually
        // clear the address (see tenant.controller.js's updateTenant guard).
        address_line: form.address_line.trim(),
        operational_states: form.operational_states,
      });
      setSuccess(true);
      toast.success('Organization details updated successfully');
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err) {
      const msg = getErrorMessage(err);
      setApiError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (!tenant) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--on-muted)' }}>{apiError || 'Organization not found.'}</p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/profile')}>Back to Profile</button>
      </div>
    );
  }

  return (
    <div className="ogp-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .ogp-page > div { padding: 80px 24px 24px !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <PageHeader
          title="Organization Profile"
          subtitle={`Manage compliance and contact details for ${tenant.name}`}
          breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'My Profile', path: '/profile' }, { label: 'Organization' }]}
        />

        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, fontWeight: 500, background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <CheckCircle size={16} />
            Organization updated successfully! Redirecting…
          </div>
        )}

        {apiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, fontWeight: 500, background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)' }}>
            <AlertCircle size={16} />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Organization Details
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
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => { handleFieldBlur('name'); e.target.style.borderBottomColor = errors.name ? 'var(--error)' : 'var(--outline)'; }}
                />
                {errors.name && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <label style={labelStyle}>Official Email</label>
                <input type="email" value={tenant.email} disabled title="Organization email is your account identity and can't be changed here." style={readOnlyStyle} />
              </div>
              <div>
                <label style={labelStyle}>Mobile Number</label>
                <input
                  type="text"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  placeholder="9876543210"
                  style={{ ...inputStyle, ...(errors.mobile ? inputFocusStyle : {}) }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => { handleFieldBlur('mobile'); e.target.style.borderBottomColor = errors.mobile ? 'var(--error)' : 'var(--outline)'; }}
                />
                {errors.mobile && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.mobile}</div>}
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
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => { handleFieldBlur('pan_number'); e.target.style.borderBottomColor = errors.pan_number ? 'var(--error)' : 'var(--outline)'; }}
                />
                {errors.pan_number && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.pan_number}</div>}
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
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => { handleFieldBlur('gst_number'); e.target.style.borderBottomColor = errors.gst_number ? 'var(--error)' : 'var(--outline)'; }}
                />
                {errors.gst_number && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.gst_number}</div>}
              </div>
              <div>
                <label style={labelStyle}>Company Type *</label>
                <select
                  name="company_type"
                  value={form.company_type}
                  onChange={handleChange}
                  style={{ ...inputStyle, ...(errors.company_type ? inputFocusStyle : {}), cursor: 'pointer', appearance: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderBottomColor = errors.company_type ? 'var(--error)' : 'var(--outline)'}
                >
                  <option value="">Select Type…</option>
                  {companyTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.company_type && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.company_type}</div>}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Location Info
            </h3>
            <div style={{ marginBottom: isMobile ? 16 : 24 }}>
              <label style={labelStyle}>Address Line</label>
              <input
                type="text"
                name="address_line"
                value={form.address_line}
                onChange={handleChange}
                placeholder="e.g. 3rd Floor, Sunrise Chambers, MG Road"
                style={inputStyle}
                onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
              />
            </div>
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
                    onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                    onBlur={e => { handleFieldBlur('pincode'); e.target.style.borderBottomColor = errors.pincode ? 'var(--error)' : 'var(--outline)'; }}
                  />
                  {isPincodeFetching && (
                    <div style={{ position: 'absolute', right: 0, bottom: 3, width: 14, height: 14, border: '2px solid var(--outline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  )}
                </div>
                {errors.pincode && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.pincode}</div>}
              </div>
              <div>
                <label style={labelStyle}>State *</label>
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="e.g. Maharashtra"
                  style={{ ...inputStyle, ...(errors.state ? inputFocusStyle : {}) }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => { handleFieldBlur('state'); e.target.style.borderBottomColor = errors.state ? 'var(--error)' : 'var(--outline)'; }}
                />
                {errors.state && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.state}</div>}
              </div>
              <div>
                <label style={labelStyle}>City *</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai"
                  style={{ ...inputStyle, ...(errors.city ? inputFocusStyle : {}) }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--primary)'}
                  onBlur={e => { handleFieldBlur('city'); e.target.style.borderBottomColor = errors.city ? 'var(--error)' : 'var(--outline)'; }}
                />
                {errors.city && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.city}</div>}
              </div>
            </div>
            <div style={{ marginTop: isMobile ? 16 : 24 }}>
              <label style={labelStyle}>Operational States *</label>
              <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: '0 0 8px' }}>
                States you provide DSA service in — used to match you with leads in the admin panel.
              </p>
              <StatesMultiSelect
                value={form.operational_states}
                onChange={(vals) => { setForm((p) => ({ ...p, operational_states: vals })); setErrors((p) => ({ ...p, operational_states: '' })); }}
                options={indianStates}
                placeholder="Select states…"
                hasError={!!errors.operational_states}
                inputStyle={inputStyle}
              />
              {errors.operational_states && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{errors.operational_states}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
              Legal Documents
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24 }}>
              <div>
                <label style={labelStyle}>Terms of Use</label>
                <a href="/legal/Terms-of-Use.pdf" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <FileText size={14} /> View PDF
                </a>
                {tenant.terms_accepted_at && (
                  <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 4 }}>
                    Accepted {formatDateTime(tenant.terms_accepted_at)} (v{tenant.terms_version})
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Privacy Policy</label>
                <a href="/legal/Privacy-Policy.pdf" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <FileText size={14} /> View PDF
                </a>
                {tenant.privacy_accepted_at && (
                  <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 4 }}>
                    Accepted {formatDateTime(tenant.privacy_accepted_at)} (v{tenant.privacy_version})
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>DSA Partner Agreement</label>
                {tenant.agreement_accepted_at ? (
                  <>
                    <button
                      type="button"
                      onClick={handleViewAgreement}
                      disabled={viewingAgreement}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: viewingAgreement ? 'not-allowed' : 'pointer' }}
                    >
                      <FileText size={14} /> {viewingAgreement ? 'Loading…' : 'View PDF'}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 4 }}>
                      Accepted {formatDateTime(tenant.agreement_accepted_at)} (v{tenant.agreement_version})
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--on-muted)' }}>Not yet accepted</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start', marginTop: 32 }}>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={saving}
              style={{
                padding: '6px 14px', background: 'transparent', border: '2px solid var(--outline)',
                borderRadius: 0, fontSize: 12, fontWeight: 700, color: 'var(--on-surface)',
                cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
            <TravelingBorderButton type="submit" size="sm" solid showIcon={false} disabled={saving || success}>
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

        <VirtualWorkspaceSubscriptionCard />
      </div>
    </div>
  );
};

export default OrganizationProfilePage;
