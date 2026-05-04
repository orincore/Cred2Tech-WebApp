import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, AlertCircle, CheckCircle, UserPlus, Zap, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { publicRegisterDSA } from '../api/tenantService';

const initialForm = {
  // Tenant fields
  name: '',
  email: '',
  mobile: '',
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
  admin_password: '',
};

const companyTypeOptions = ['Private Limited', 'Public Limited', 'Partnership', 'Proprietorship', 'LLP'];

const DSARegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Organization name is required';
    if (!form.email.trim()) e.email = 'Organization email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.pan_number.trim()) e.pan_number = 'PAN required for compliance';
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(form.pan_number)) e.pan_number = 'Invalid PAN format (e.g. ABCDE1234F)';
    if (!form.company_type) e.company_type = 'Select a company type';
    if (!form.state.trim()) e.state = 'State is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.pincode) e.pincode = 'Pincode is required';
    else if (!/^[1-9][0-9]{5}$/.test(form.pincode)) e.pincode = 'Invalid 6-digit pincode';
    if (!form.admin_name.trim()) e.admin_name = 'Admin name is required';
    if (!form.admin_email.trim()) e.admin_email = 'Admin email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) e.admin_email = 'Invalid email format';
    if (!form.admin_password) e.admin_password = 'Password is required';
    else if (form.admin_password.length < 6) e.admin_password = 'Minimum 6 characters';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    setApiError('');
    try {
      await publicRegisterDSA({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim() || undefined,
        pan_number: form.pan_number.toUpperCase(),
        gst_number: form.gst_number ? form.gst_number.toUpperCase() : undefined,
        company_type: form.company_type,
        state: form.state.trim(),
        city: form.city.trim(),
        pincode: form.pincode,
        admin_name: form.admin_name.trim(),
        admin_email: form.admin_email.trim().toLowerCase(),
        admin_mobile: form.admin_mobile.trim() || undefined,
        admin_password: form.admin_password,
      });
      setSuccess(true);
      toast.success('Registration successful! You can now log in.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Registration failed. Please try again.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1.5px solid ${hasError ? '#EF4444' : 'rgba(255,255,255,0.15)'}`,
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  });

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 6,
    letterSpacing: '0.03em',
  };

  const errorStyle = {
    fontSize: 11,
    color: '#FCA5A5',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  const sectionTitle = (label, icon) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
    </div>
  );

  const spinner = (
    <div style={{
      width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTop: '2px solid white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px 60px',
    }}>
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -150, left: -150, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 780, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: 'var(--primary, #4F46E5)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(79,70,229,0.5)' }}>
              <Zap size={20} color="white" />
            </div>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>DSA CRM</span>
          </div>
          <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
            onMouseOver={e => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
          >
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>
        <div style={{ marginTop: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 6, letterSpacing: '-0.02em' }}>
            Register as a New DSA
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6 }}>
            Onboard your organization and create your admin account. You can start building your team right after logging in.
          </p>
        </div>
      </div>

      {/* Success Banner */}
      {success && (
        <div style={{ width: '100%', maxWidth: 780, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(52,211,153,0.4)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, color: '#34D399' }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14 }}>Registration successful! Redirecting you to login…</span>
        </div>
      )}

      {/* Error Banner */}
      {apiError && (
        <div style={{ width: '100%', maxWidth: 780, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, color: '#FCA5A5' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>{apiError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Organization Details */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, backdropFilter: 'blur(10px)' }}>
          {sectionTitle('Organization Details', <Building2 size={14} color="rgba(99,102,241,0.9)" />)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            <div>
              <label style={labelStyle}>Organization Name <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Acme FinServe Pvt Ltd" style={inputStyle(errors.name)} />
              {errors.name && <div style={errorStyle}><AlertCircle size={11} />{errors.name}</div>}
            </div>
            <div>
              <label style={labelStyle}>Official Email <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="e.g. office@acme.com" style={inputStyle(errors.email)} />
              {errors.email && <div style={errorStyle}><AlertCircle size={11} />{errors.email}</div>}
            </div>
            <div>
              <label style={labelStyle}>Mobile Number</label>
              <input name="mobile" value={form.mobile} onChange={handleChange} placeholder="e.g. 9876543210" style={inputStyle(false)} />
            </div>
            <div>
              <label style={labelStyle}>PAN Number <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="pan_number" value={form.pan_number} onChange={handleChange} placeholder="ABCDE1234F" style={inputStyle(errors.pan_number)} />
              {errors.pan_number && <div style={errorStyle}><AlertCircle size={11} />{errors.pan_number}</div>}
            </div>
            <div>
              <label style={labelStyle}>GST Number</label>
              <input name="gst_number" value={form.gst_number} onChange={handleChange} placeholder="Optional" style={inputStyle(false)} />
            </div>
            <div>
              <label style={labelStyle}>Company Type <span style={{ color: '#818CF8' }}>*</span></label>
              <select name="company_type" value={form.company_type} onChange={handleChange} style={{ ...inputStyle(errors.company_type), cursor: 'pointer' }}>
                <option value="" style={{ background: '#1E293B' }}>Select Type…</option>
                {companyTypeOptions.map((t) => <option key={t} value={t} style={{ background: '#1E293B' }}>{t}</option>)}
              </select>
              {errors.company_type && <div style={errorStyle}><AlertCircle size={11} />{errors.company_type}</div>}
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, backdropFilter: 'blur(10px)' }}>
          {sectionTitle('Location Info', <span style={{ fontSize: 14 }}>📍</span>)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
            <div>
              <label style={labelStyle}>State <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="state" value={form.state} onChange={handleChange} placeholder="Maharashtra" style={inputStyle(errors.state)} />
              {errors.state && <div style={errorStyle}><AlertCircle size={11} />{errors.state}</div>}
            </div>
            <div>
              <label style={labelStyle}>City <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="city" value={form.city} onChange={handleChange} placeholder="Mumbai" style={inputStyle(errors.city)} />
              {errors.city && <div style={errorStyle}><AlertCircle size={11} />{errors.city}</div>}
            </div>
            <div>
              <label style={labelStyle}>Pincode <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="pincode" value={form.pincode} onChange={handleChange} placeholder="400001" style={inputStyle(errors.pincode)} />
              {errors.pincode && <div style={errorStyle}><AlertCircle size={11} />{errors.pincode}</div>}
            </div>
          </div>
        </div>

        {/* Admin Account */}
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: 28, backdropFilter: 'blur(10px)' }}>
          {sectionTitle('Your Admin Account', <UserPlus size={14} color="rgba(99,102,241,0.9)" />)}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 18, marginTop: -8, lineHeight: 1.6 }}>
            This will be your <strong style={{ color: '#818CF8' }}>DSA Admin</strong> login — you can add team members after signing in.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            <div>
              <label style={labelStyle}>Your Full Name <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="admin_name" value={form.admin_name} onChange={handleChange} placeholder="e.g. Rahul Sharma" style={inputStyle(errors.admin_name)} />
              {errors.admin_name && <div style={errorStyle}><AlertCircle size={11} />{errors.admin_name}</div>}
            </div>
            <div>
              <label style={labelStyle}>Your Login Email <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="admin_email" type="email" value={form.admin_email} onChange={handleChange} placeholder="e.g. rahul@acme.com" style={inputStyle(errors.admin_email)} />
              {errors.admin_email && <div style={errorStyle}><AlertCircle size={11} />{errors.admin_email}</div>}
            </div>
            <div>
              <label style={labelStyle}>Your Mobile</label>
              <input name="admin_mobile" value={form.admin_mobile} onChange={handleChange} placeholder="Optional" style={inputStyle(false)} />
            </div>
            <div>
              <label style={labelStyle}>Create Password <span style={{ color: '#818CF8' }}>*</span></label>
              <input name="admin_password" type="password" value={form.admin_password} onChange={handleChange} placeholder="Min. 6 characters" style={inputStyle(errors.admin_password)} />
              {errors.admin_password && <div style={errorStyle}><AlertCircle size={11} />{errors.admin_password}</div>}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || success}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '14px 32px',
            background: isLoading || success ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: 'white', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: isLoading || success ? 'not-allowed' : 'pointer',
            boxShadow: isLoading || success ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
            transition: 'all 0.2s',
          }}
        >
          {isLoading ? <>{spinner} Registering…</> : success ? <><CheckCircle size={16} /> Registered!</> : <><Building2 size={16} /> Register My DSA</>}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#818CF8', fontWeight: 600, textDecoration: 'none' }}>Sign in here</Link>
        </p>
      </form>
    </div>
  );
};

export default DSARegisterPage;
