import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTenant } from '../api/tenantService';
import { createUser } from '../api/userService';
import { getRoles } from '../api/roleService';
import PageHeader from '../components/ui/PageHeader';
import FormField from '../components/ui/FormField';
import { getErrorMessage } from '../utils/helpers';
import { TENANT_TYPES } from '../constants/roles';

const initialForm = {
  // Tenant fields
  name: '',
  email: '',
  mobile: '',
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
  admin_password: '',
};

const companyTypeOptions = ['Private Limited', 'Public Limited', 'Partnership', 'Proprietorship', 'LLP'];

const CreateTenantPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(''); // 'tenant' | 'admin' | 'done'

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');
  };

  const validate = () => {
    const e = {};
    // Tenant validations
    if (!form.name.trim()) e.name = 'Tenant name is required';
    if (!form.email.trim()) e.email = 'Organization email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.type) e.type = 'Type is required';
    if (!form.pan_number.trim()) e.pan_number = 'PAN required for compliance';
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number.toUpperCase())) e.pan_number = 'Invalid PAN format (e.g. ABCDE1234F)';
    if (!form.company_type) e.company_type = 'Select a company type';
    if (!form.state.trim()) e.state = 'State is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.pincode) e.pincode = 'Pincode is required';
    else if (!/^[1-9][0-9]{5}$/.test(form.pincode)) e.pincode = 'Invalid pincode';

    // Initial admin validations
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

  const sectionHeading = (label) => (
    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
      {label}
    </h3>
  );

  const spinner = <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;

  const stepLabel = step === 'tenant' ? 'Creating tenant…' : step === 'admin' ? 'Creating admin user…' : 'Processing…';

  return (
    <div>
      <PageHeader
        title="Onboard New DSA"
        subtitle="Onboard a new DSA or Team ecosystem with an initial admin user."
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Manage DSA', path: '/tenants' }, { label: 'Create DSA' }]}
      />

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {success && (
          <div className="notice" style={{ background: 'var(--success-bg)', borderColor: '#6EE7B7', color: '#064E3B', marginBottom: 20 }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            DSA and admin user created successfully! Redirecting…
          </div>
        )}

        {apiError && (
          <div className="notice notice-error" style={{ marginBottom: 20 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Organization Details */}
          <div className="card card-padded" style={{ marginBottom: 20 }}>
            {sectionHeading('DSA Organization Details')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <FormField label="Organization Name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Acme FinServe" required error={errors.name} />
              <FormField label="Official Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="e.g. admin@acme.com" required error={errors.email} />
              <FormField label="Mobile Number" name="mobile" value={form.mobile} onChange={handleChange} placeholder="e.g. 9876543210" hint="Optional contact number" />
              <FormField label="Organization Type" name="type" required error={errors.type}>
                <select name="type" value={form.type} onChange={handleChange} className={`form-control${errors.type ? ' error-input' : ''}`}>
                  {TENANT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="PAN Number" name="pan_number" value={form.pan_number} onChange={handleChange} placeholder="ABCDE1234F" required error={errors.pan_number} />
              <FormField label="GST Number" name="gst_number" value={form.gst_number} onChange={handleChange} placeholder="Optional GST format" />
              <FormField label="Company Type" name="company_type" required error={errors.company_type}>
                <select name="company_type" value={form.company_type} onChange={handleChange} className={`form-control${errors.company_type ? ' error-input' : ''}`}>
                  <option value="">Select Type...</option>
                  {companyTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          {/* Location Info */}
          <div className="card card-padded" style={{ marginBottom: 20 }}>
            {sectionHeading('Location Info')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <FormField label="State" name="state" value={form.state} onChange={handleChange} placeholder="Maharashtra" required error={errors.state} />
              <FormField label="City" name="city" value={form.city} onChange={handleChange} placeholder="Mumbai" required error={errors.city} />
              <FormField label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} placeholder="400001" required error={errors.pincode} />
            </div>
          </div>

          {/* Initial Admin User */}
          <div className="card card-padded" style={{ marginBottom: 20, borderLeft: '3px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <UserPlus size={16} color="var(--primary)" />
              {sectionHeading('Initial Admin User')}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, marginTop: -12 }}>
              This user will be created as <strong>DSA Admin</strong> for the new organization and will be able to log in immediately.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <FormField label="Admin Full Name" name="admin_name" value={form.admin_name} onChange={handleChange} placeholder="e.g. John Smith" required error={errors.admin_name} />
              <FormField label="Admin Email" name="admin_email" type="email" value={form.admin_email} onChange={handleChange} placeholder="e.g. john@acme.com" required error={errors.admin_email} />
              <FormField label="Admin Mobile" name="admin_mobile" value={form.admin_mobile} onChange={handleChange} placeholder="e.g. 9876543210" hint="Optional" />
              <FormField label="Login Password" name="admin_password" type="password" value={form.admin_password} onChange={handleChange} placeholder="Min. 6 characters" required error={errors.admin_password} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/tenants')} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || success} style={{ minWidth: 180, justifyContent: 'center' }}>
              {isLoading ? <>{spinner} {stepLabel}</> : <><Building2 size={15} /> Create DSA & Admin</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTenantPage;
