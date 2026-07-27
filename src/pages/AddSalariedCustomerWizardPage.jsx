import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { caseService } from '../api/caseService';
import { customerService } from '../api/customerService';
import { otpService } from '../api/otpService';
import FormField from '../components/ui/FormField';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Search, CheckCircle2, Check } from 'lucide-react';
import api from '../api/axiosInstance';
import SalarySlipUploader from '../components/onboarding/SalarySlipUploader';
import DataPullProgress from '../components/onboarding/DataPullProgress';
import { toTitleCase } from '../utils/helpers';

const PROPERTY_REQUIRED = ['LAP', 'HL'];

const AddSalariedCustomerWizardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlCaseId = searchParams.get('caseId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [caseId, setCaseId] = useState(null);

  const [formData, setFormData] = useState({
    customer_id: null,
    business_pan: '',
    business_name: '',
    business_mobile: '',
    business_email: '',
    pincode: '',
    dob: '',
    mobile_verified: false,
    applicants: [],
    product_type: '',
    property_type: '',
    occupancy_status: 'Self Occupied',
    ownership_type: 'Sole Owner',
    market_value: ''
  });

  const [panVerifying, setPanVerifying] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const [otpModal, setOtpModal] = useState({
    isOpen: false,
    targetType: null,
    targetId: null,
    mobile: '',
    purpose: '',
    otpInput: '',
    loading: false
  });

  useEffect(() => {
    restoreSession();
  }, [urlCaseId]);

  const checkPanDuplicate = async (pan) => {
    if (!pan || pan.length !== 10) return;
    try {
      const res = await api.get('/customers/check-existing-by-pan', { params: { pan } });
      if (res.data?.existingCustomerFound && res.data.customer?.id) {
        setDuplicateWarning({
          id: res.data.customer.id,
          name: res.data.customer.business_name,
          pan: res.data.customer.business_pan,
          mobile: res.data.customer.business_mobile,
          category: res.data.customer.category,
          summary: res.data.reusable_summary
        });
      } else {
        setDuplicateWarning(null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setDuplicateWarning(null);
      } else {
        console.error('[PAN duplicate check]', err);
      }
    }
  };

  const handleContinueAsNewCase = async () => {
    if (!duplicateWarning) return;
    try {
      setSaving(true);
      const res = await api.post('/cases/create-from-existing', {
        customer_id: duplicateWarning.id
      });
      const newCaseId = res.data.id;
      toast.success('New case created with existing customer data!');
      setDuplicateWarning(null);
      navigate(`/customers/salaried/add?caseId=${newCaseId}`);
    } catch (error) {
      console.error('[handleContinueAsNewCase]', error);
      toast.error(error.response?.data?.error || 'Failed to create new case from existing customer.');
    } finally {
      setSaving(false);
    }
  };

  const restoreSession = async () => {
    try {
      setLoading(true);
      const targetCaseId = urlCaseId;

      if (!targetCaseId) {
        setLoading(false);
        return;
      }

      const caseData = await caseService.getCaseById(targetCaseId);

      setCaseId(caseData.id);

      const applicants = caseData.applicants || [];
      const primaryApp = applicants.find(a => a.type === 'PRIMARY');

      const restoredApplicants = applicants.map(app => ({
        ...app,
        bureau_fetched: app.bureau_fetched ||
          (app.bureau_checks?.length > 0) ||
          (app.obligations?.length > 0),
        has_ocr: app.salary_ocr_results?.length > 0
      }));

      setFormData({
        customer_id: caseData.customer?.id,
        business_pan: caseData.customer?.business_pan || '',
        business_name: caseData.customer?.business_name || '',
        business_mobile: (caseData.customer?.business_mobile || '').replace(/\D/g, ''),
        business_email: caseData.customer?.business_email || '',
        pincode: primaryApp?.pincode || caseData.customer?.pan_profiles?.[0]?.principal_pincode || '',
        dob: caseData.customer?.dob || '',
        mobile_verified: caseData.customer?.mobile_verified || false,
        applicants: restoredApplicants.map(app => ({
          ...app,
          mobile: (app.mobile || '').replace(/\D/g, '')
        })),
        product_type: caseData.product_type || '',
        property_type: caseData.property?.property_type || '',
        occupancy_status: caseData.property?.occupancy_status || 'Self Occupied',
        ownership_type: caseData.property?.ownership_type || 'Sole Owner',
        market_value: caseData.property?.market_value || '',
      });

      if (caseData.customer?.mobile_verified && restoredApplicants.length > 0) {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }
    } catch (error) {
      console.error('[restoreSession]', error);
      toast.error('Failed to restore case draft.');
    } finally {
      setLoading(false);
    }
  };

  const ensureDraftSaved = async () => {
    let targetCaseId = caseId;
    let targetCustomerId = formData.customer_id;

    if (!targetCaseId && !formData.business_pan) {
      throw new Error('PAN is required to start the case');
    }

    if (/[a-zA-Z]/.test(formData.business_mobile)) {
      throw new Error("Invalid Mobile Number. Please ensure you haven't entered the PAN in the mobile field.");
    }

    if (!caseId) {
      const res = await api.post('/customers/salaried/start', {
        business_pan: formData.business_pan,
        business_name: formData.business_name,
        business_mobile: formData.business_mobile,
        business_email: formData.business_email,
        dob: formData.dob
      });

      const savedCase = res.data.data;
      targetCaseId = savedCase.id;
      targetCustomerId = savedCase.customer_id;

      setCaseId(targetCaseId);
      setFormData(prev => ({
        ...prev,
        customer_id: targetCustomerId,
        applicants: savedCase.applicants || []
      }));
      navigate(`?caseId=${targetCaseId}`, { replace: true });
      return { targetCaseId, targetCustomerId, savedCase };
    } else {
      await customerService.createOrAttach({
        customer_id: formData.customer_id,
        business_pan: formData.business_pan,
        business_name: formData.business_name,
        business_mobile: formData.business_mobile,
        business_email: formData.business_email,
        dob: formData.dob
      });

      const savedCase = await caseService.getCaseById(caseId);
      return { targetCaseId: caseId, targetCustomerId: formData.customer_id, savedCase };
    }
  };

  const handleSendPrimaryOtp = async () => {
    try {
      setSaving(true);
      const { targetCustomerId } = await ensureDraftSaved();
      const res = await otpService.sendOtp({
        mobile: formData.business_mobile,
        purpose: 'PRIMARY_APPLICANT',
        target_type: 'CUSTOMER',
        target_id: targetCustomerId
      });
      if (res.otp) toast.success(`[DEV] OTP: ${res.otp}`, { duration: 10000 });
      else toast.success('OTP sent');

      setOtpModal({ isOpen: true, targetType: 'CUSTOMER', targetId: targetCustomerId, mobile: formData.business_mobile, purpose: 'PRIMARY_APPLICANT', otpInput: '', loading: false });
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendCoapplicantOtp = async (index) => {
    const app = formData.applicants[index];
    if (!app.pan_number || !app.mobile) return toast.error('PAN and Mobile required for Co-Applicant OTP');

    try {
      setSaving(true);
      const { targetCaseId } = await ensureDraftSaved();

      let targetAppId = app.id;
      if (!targetAppId) {
        const savedApp = await caseService.addApplicant(targetCaseId, app);
        targetAppId = savedApp.id;
        const newArr = [...formData.applicants];
        newArr[index] = savedApp;
        setFormData(prev => ({ ...prev, applicants: newArr }));
      }

      const res = await otpService.sendOtp({
        mobile: app.mobile,
        purpose: 'CO_APPLICANT',
        target_type: 'APPLICANT',
        target_id: targetAppId
      });
      if (res.otp) toast.success(`[DEV] OTP: ${res.otp}`, { duration: 10000 });
      else toast.success('OTP sent');

      setOtpModal({ isOpen: true, targetType: 'APPLICANT', targetId: targetAppId, mobile: app.mobile, purpose: 'CO_APPLICANT', otpInput: '', loading: false });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send OTP');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyPan = async (isCoapplicant = false, idx = null) => {
    if (typeof isCoapplicant === 'object') {
      isCoapplicant = false;
      idx = null;
    }

    if (!formData.business_pan || formData.business_pan.length < 10) return toast.error('Valid PAN required');

    setPanVerifying(true);

    try {
      let targetCaseId = caseId;
      let targetCustomerId = formData.customer_id;
      if (!targetCaseId) {
        const draft = await ensureDraftSaved();
        targetCaseId = draft.targetCaseId;
        targetCustomerId = draft.targetCustomerId;
      }

      const res = await api.post('/external/pan/verify', {
        pan: isCoapplicant ? formData.applicants[idx].pan_number : formData.business_pan,
        customer_id: targetCustomerId,
        case_id: targetCaseId,
        is_coapplicant: isCoapplicant,
        applicant_id: isCoapplicant && idx !== null ? formData.applicants[idx].id : null
      });
      const data = res.data;

      const entityName = data.name || '';
      const entityDob = data.dob || '';

      if (isCoapplicant && idx !== null) {
        const list = [...formData.applicants];
        list[idx] = { ...list[idx], name: entityName, dob: entityDob, pan_verified: true };
        setFormData(prev => ({ ...prev, applicants: list }));
      } else {
        setFormData(prev => ({
          ...prev,
          business_name: entityName && !prev.business_name ? entityName : prev.business_name,
          dob: entityDob && !prev.dob ? entityDob : prev.dob,
          pan_verified: true
        }));
      }

      toast.success('PAN Verified Successfully!');
    } catch (err) {
      const errMsg = err.response?.data?.error_message || err.response?.data?.error || err.message || 'Failed to verify PAN';
      toast.error(errMsg);
    } finally {
      setPanVerifying(false);
    }
  };

  const handleVerifyOtpSubmit = async () => {
    if (otpModal.otpInput.length < 6) return toast.error('Enter valid 6-digit OTP');
    try {
      setOtpModal(prev => ({ ...prev, loading: true }));
      await otpService.verifyOtp({
        otp: otpModal.otpInput,
        target_type: otpModal.targetType,
        target_id: otpModal.targetId
      });

      toast.success('Verified Successfully!');

      if (otpModal.targetType === 'CUSTOMER') {
        setFormData(prev => ({ ...prev, mobile_verified: true }));
      } else {
        const newArr = [...formData.applicants].map(a =>
          a.id === otpModal.targetId ? { ...a, otp_verified: true } : a
        );
        setFormData(prev => ({ ...prev, applicants: newArr }));
      }
      setOtpModal({ isOpen: false, targetType: null, targetId: null, mobile: '', purpose: '', otpInput: '', loading: false });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setOtpModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleResendOtp = async () => {
    try {
      setOtpModal(prev => ({ ...prev, loading: true }));
      const res = await otpService.resendOtp({
        mobile: otpModal.mobile,
        purpose: otpModal.purpose,
        target_type: otpModal.targetType,
        target_id: otpModal.targetId
      });
      if (res.otp) toast.success(`[DEV] New OTP: ${res.otp}`, { duration: 10000 });
      else toast.success('New OTP sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend');
    } finally {
      setOtpModal(prev => ({ ...prev, loading: false }));
    }
  };

  const addCoApplicantRow = () => {
    setFormData(prev => ({
      ...prev,
      applicants: [...prev.applicants, { type: 'CO_APPLICANT', employment_type: 'SALARIED', pan_number: '', mobile: '', email: '', otp_verified: false }]
    }));
  };

  const updateApplicantRow = (idx, field, val) => {
    const list = [...formData.applicants];
    list[idx] = { ...list[idx], [field]: val };
    setFormData(prev => ({ ...prev, applicants: list }));
  };

  const removeApplicant = (index) => {
    const arr = [...formData.applicants];
    arr.splice(index, 1);
    setFormData(prev => ({ ...prev, applicants: arr }));
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!formData.business_pan) return toast.error('PAN is required.');
    if (!formData.business_name) return toast.error('Name is required.');
    if (!formData.mobile_verified) return toast.error('Primary Mobile must be verified before proceeding.');

    try {
      setSaving(true);
      const { targetCaseId, savedCase } = await ensureDraftSaved();

      const currentApplicants = [...formData.applicants];
      if (savedCase.applicants) {
        savedCase.applicants.forEach(sa => {
          const idx = currentApplicants.findIndex(a => a.pan_number === sa.pan_number);
          if (idx !== -1) currentApplicants[idx].id = sa.id;
        });
      }

      const savedApps = [];
      for (const app of currentApplicants) {
        if (app.pan_number) {
          const savedApp = await caseService.addApplicant(targetCaseId, app);
          savedApps.push(savedApp);
        }
      }

      setFormData(prev => ({ ...prev, applicants: savedApps }));
      setCaseId(targetCaseId);

      setCurrentStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunBureau = async (applicantId) => {
    if (!caseId) return toast.error('Case ID missing');
    if (saving) return;
    try {
      setSaving(true);
      const res = await api.post(`/verification/bureau/run/${caseId}`, { applicantId });
      const data = res.data;

      if (data.status === 'FAILED') {
        toast.error(data.errors?.[0]?.error || 'Bureau fetch failed');
        return;
      }
      toast.success('Bureau pull success!');

      const updatedApps = formData.applicants.map(a =>
        a.id === applicantId ? { ...a, bureau_fetched: true } : a
      );
      setFormData(prev => ({ ...prev, applicants: updatedApps }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bureau fetch failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    const anyBureauReady = formData.applicants.some(a =>
      a.bureau_fetched || (a.bureau_checks?.length > 0) || (a.obligations?.length > 0)
    );

    if (!anyBureauReady) {
      return toast.error('Bureau pull must be completed for at least one applicant before proceeding.');
    }

    setCurrentStep(3);
  };

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    if (!formData.product_type) return toast.error('Please select a loan product.');
    const needsProperty = PROPERTY_REQUIRED.includes(formData.product_type);
    if (needsProperty && !formData.property_type) return toast.error('Property type is required for LAP/HL.');
    if (needsProperty && !formData.market_value) return toast.error('Market value is required for LAP/HL.');

    try {
      setSaving(true);
      const payload = {
        product_type: formData.product_type,
        property: needsProperty ? {
          property_type: formData.property_type,
          occupancy_status: formData.occupancy_status,
          ownership_type: formData.ownership_type,
          market_value: parseFloat(formData.market_value)
        } : null
      };
      await caseService.updateProductProperty(caseId, payload);
      toast.success('Product & property saved!');
      // Steps 4-7 (Income Summary onward) live inside AddCustomerWizardPage
      // now, not a separate route — hand off there at step 4.
      navigate(`/customers/add?caseId=${caseId}&step=4`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save product details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><LoadingSpinner size={40} /></div>;

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{caseId ? 'Resume Salaried Case' : 'Add Salaried Customer'}</h1>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>Step {currentStep} of 3 — {currentStep === 1 ? 'Personal Details' : currentStep === 2 ? 'Salary & Income Information' : 'Product Selection'}</p>
        </div>
        {caseId && (
          <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} /> Auto-saved
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="card" style={{ padding: '24px 40px', marginBottom: 30, display: 'flex', position: 'relative', justifyContent: 'space-between' }}>
        <div style={{ position: 'absolute', top: '50%', left: 60, right: 60, height: 2, background: 'var(--border)', zIndex: 0, transform: 'translateY(-50%)' }} />
        {[{ step: 1, label: 'Personal Details' }, { step: 2, label: 'Salary & Income' }, { step: 3, label: 'Product & Property' }].map((s) => {
          const isActive = currentStep === s.step;
          const isPast = currentStep > s.step;
          return (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface)', zIndex: 1, padding: '0 10px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'var(--success)' : isPast ? 'var(--bg-surface)' : 'var(--bg-elevated)', border: isPast ? '2px solid var(--success)' : 'none', color: isActive ? 'white' : isPast ? 'var(--success)' : 'var(--text-tertiary)', fontWeight: 600, fontSize: 13 }}>
                {isPast ? <Check size={16} strokeWidth={3} /> : s.step}
              </div>
              <span style={{ fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--success)' : 'var(--text-secondary)', fontSize: 14 }}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {duplicateWarning && !caseId && (
              <div className="notice" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 12, padding: 20, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--warning)' }}>
                    <Search size={22} color="var(--warning)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: 16, color: 'var(--warning)', marginBottom: 4 }}>Existing individual found: {duplicateWarning.name || 'N/A'}</h4>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>PAN {duplicateWarning.pan} is already registered in your tenant. You can reuse their profile and data for a new case.</p>
                      </div>
                      <button type="button" onClick={() => navigate(`/customers/${duplicateWarning.id}`)} className="btn btn-secondary btn-sm">View Profile</button>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600, textTransform: 'uppercase', gridColumn: '1/-1', marginBottom: -4 }}>Reusable Data Available:</div>
                      {duplicateWarning.summary?.bureau?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Check size={14} color="var(--success)" /> Bureau Score</div>}
                      {duplicateWarning.summary?.salary_ocr?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Check size={14} color="var(--success)" /> Salary Slip OCR</div>}
                      {duplicateWarning.summary?.bank?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Check size={14} color="var(--success)" /> Bank Statement</div>}
                    </div>

                    <button
                      type="button"
                      onClick={handleContinueAsNewCase}
                      disabled={saving}
                      className="btn"
                      style={{ background: 'var(--warning)', color: 'white', border: 'none' }}
                    >
                      {saving ? 'Creating...' : 'Continue as New Case →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Applicant Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Primary Applicant</h3>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Salaried Individual Details</span>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                  <FormField label="MOBILE NUMBER" name="business_mobile" required disabled={formData.mobile_verified}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="tel"
                        value={formData.business_mobile}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, business_mobile: val });
                        }}
                        className="form-control"
                        placeholder="9820012345"
                        disabled={formData.mobile_verified}
                      />
                      {!formData.mobile_verified ? (
                        <button type="button" onClick={handleSendPrimaryOtp} disabled={saving || !formData.business_mobile || !formData.business_pan} className="btn" style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '0 20px' }}>Send OTP</button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600, padding: '0 10px', whiteSpace: 'nowrap' }}>
                          <CheckCircle2 size={18} /> Verified
                          <button type="button" onClick={() => setFormData({ ...formData, mobile_verified: false })} style={{ marginLeft: 8, fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
                        </div>
                      )}
                    </div>
                  </FormField>

                  <FormField label="PAN NUMBER" name="business_pan" required disabled={!!caseId || formData.mobile_verified}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text"
                        value={formData.business_pan}
                        onChange={e => setFormData({ ...formData, business_pan: e.target.value.toUpperCase() })}
                        onBlur={() => checkPanDuplicate(formData.business_pan)}
                        className="form-control"
                        placeholder="ABCDE1234F"
                        disabled={!!caseId || formData.mobile_verified}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button type="button" onClick={handleVerifyPan} disabled={panVerifying || !formData.business_pan || formData.pan_verified} className="btn btn-secondary">
                        {panVerifying ? 'Wait...' : (formData.pan_verified ? 'Verified' : 'Verify PAN')}
                      </button>
                    </div>
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                  <FormField label="FULL NAME (AS PER PAN)" name="business_name" required>
                    <input type="text" value={formData.business_name} onChange={e => setFormData({ ...formData, business_name: e.target.value })} className="form-control" placeholder="Arjun Sharma" disabled={!!caseId} />
                  </FormField>

                  <FormField label="DATE OF BIRTH" name="dob">
                    <input
                      type="date"
                      value={formData.dob || ''}
                      onChange={e => setFormData({ ...formData, dob: e.target.value })}
                      className="form-control"
                    />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <FormField label="EMAIL ADDRESS" name="business_email" required>
                    <input
                      type="email"
                      value={formData.business_email}
                      onChange={e => setFormData({ ...formData, business_email: e.target.value })}
                      className="form-control"
                      placeholder="arjun@example.com"
                    />
                  </FormField>

                  <FormField label="PINCODE" name="pincode" required>
                    <input
                      type="text"
                      value={formData.pincode || ''}
                      onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                      className="form-control"
                      placeholder="e.g. 560026"
                      maxLength={6}
                    />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Co-Applicants Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Co-Applicants</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Add each co-applicant's details. You can specify if they are Salaried or Self-Employed.</p>
                </div>
                <button type="button" onClick={addCoApplicantRow} className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>+ Add Co-Applicant</button>
              </div>

              <div style={{ padding: 24 }}>
                {formData.applicants.filter(a => a.type === 'CO_APPLICANT').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius)', color: 'var(--text-tertiary)' }}>
                    No Co-Applicants appended to this profile yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {formData.applicants.map((app, realIdx) => {
                      if (app.type !== 'CO_APPLICANT') return null;
                      const coApplicantDisplayIdx = formData.applicants.filter((a, i) => a.type === 'CO_APPLICANT' && i < realIdx).length;

                      return (
                        <div key={realIdx} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', padding: 24, borderRadius: 'var(--radius)', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 18, right: 24, display: 'flex', gap: 12 }}>
                            <button type="button" onClick={() => removeApplicant(realIdx)} style={{ color: 'var(--error)', fontSize: 13, fontWeight: 600, border: 'none', background: 'none' }}>Remove ×</button>
                          </div>
                          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Applicant #{coApplicantDisplayIdx + 1}</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, alignItems: 'end', marginBottom: 16 }}>
                            <FormField label="EMPLOYMENT TYPE" name={`coemp_${realIdx}`}>
                              <select className="form-control" value={app.employment_type || 'SALARIED'} onChange={e => updateApplicantRow(realIdx, 'employment_type', e.target.value)}>
                                <option value="SALARIED">Salaried</option>
                                <option value="SELF_EMPLOYED">Self Employed</option>
                              </select>
                            </FormField>
                            <FormField label="FULL NAME" name={`coname_${realIdx}`}>
                              <input type="text" value={app.name || ''} onChange={e => updateApplicantRow(realIdx, 'name', e.target.value)} className="form-control" placeholder="Enter Full Name" />
                            </FormField>
                            <FormField label="DATE OF BIRTH" name={`codob_${realIdx}`}>
                              <input type="date" value={app.dob || ''} onChange={e => updateApplicantRow(realIdx, 'dob', e.target.value)} className="form-control" />
                            </FormField>
                            <FormField label="PINCODE" name={`copincode_${realIdx}`} required>
                              <input
                                type="text"
                                value={app.pincode || ''}
                                onChange={e => updateApplicantRow(realIdx, 'pincode', e.target.value)}
                                className="form-control"
                                placeholder="560026"
                                maxLength={6}
                              />
                            </FormField>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr', gap: 16, alignItems: 'end' }}>
                            <FormField label="PAN NUMBER" name={`copan_${realIdx}`}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input type="text" value={app.pan_number || ''} onChange={e => updateApplicantRow(realIdx, 'pan_number', e.target.value.toUpperCase())} className="form-control" style={{ textTransform: 'uppercase' }} disabled={app.otp_verified} />
                                {app.otp_verified && (
                                  <button type="button" onClick={() => handleVerifyPan(true, realIdx)} disabled={panVerifying || app.pan_verified} className="btn btn-secondary">
                                    {panVerifying ? 'Wait...' : (app.pan_verified ? 'Verified' : 'Verify PAN')}
                                  </button>
                                )}
                              </div>
                            </FormField>
                            <FormField label="MOBILE NUMBER" name={`comob_${realIdx}`}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input type="tel" value={app.mobile || ''} onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  updateApplicantRow(realIdx, 'mobile', val);
                                }} className="form-control" disabled={app.otp_verified} />
                              </div>
                            </FormField>
                            <FormField label="EMAIL ADDRESS" name={`coemail_${realIdx}`}>
                              <input type="email" value={app.email || ''} onChange={e => updateApplicantRow(realIdx, 'email', e.target.value)} className="form-control" placeholder="Optional" />
                            </FormField>
                            <FormField label="" name={`cobtn_${realIdx}`}>
                              {!app.otp_verified ? (
                                <button type="button" className="btn" style={{ background: 'var(--success)', color: 'white', border: 'none', width: '100%', justifyContent: 'center' }} onClick={() => handleSendCoapplicantOtp(realIdx)} disabled={saving}>Send OTP</button>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--success)', fontWeight: 600, padding: '10px 0', whiteSpace: 'nowrap', fontSize: 13 }}>
                                  <CheckCircle2 size={18} /> Verified
                                </div>
                              )}
                            </FormField>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-lg" type="submit" disabled={saving || !formData.mobile_verified} style={{ background: 'var(--success)', color: 'white', border: 'none' }}>
                {saving ? 'Processing...' : 'Continue to Financials →'}
              </button>
            </div>
          </form>
        )}

        {currentStep === 2 && (
          <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Bureau Verification */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Bureau Verification</h3>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Verify credit scores before analysis</p>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...formData.applicants].sort((a, b) => a.type === 'PRIMARY' ? -1 : 1).map((app, idx) => (
                    <DataPullProgress
                      key={app.id || idx}
                      label={app.name || (app.type === 'PRIMARY' ? 'Primary Borrower' : `Co-Applicant #${idx}`)}
                      status={app.bureau_fetched ? 'COMPLETE' : 'NOT_STARTED'}
                      description={app.cibil_score ? `Bureau Score: ${app.cibil_score}` : `${app.pan_number} • ${app.type}`}
                      onStart={() => handleRunBureau(app.id)}
                      loading={saving}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Salary Slip Upload section */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>📄 Salary Slip Upload <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>(Last 3 months — OCR auto-extracts data)</span></h3>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 40 }}>
                {formData.applicants.filter(a => a.id).map((app, idx) => (
                  <div key={app.id} style={{ borderBottom: idx < formData.applicants.filter(a => a.id).length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: idx < formData.applicants.filter(a => a.id).length - 1 ? 40 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                        {idx + 1}
                      </div>
                      <h4 style={{ fontSize: 16, fontWeight: 700 }}>
                        {toTitleCase(app.name) || app.pan_number || (app.type === 'PRIMARY' ? 'Primary Borrower' : `Co-Applicant #${idx}`)}
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 8 }}>({app.type === 'PRIMARY' ? 'Primary' : 'Co-Applicant'})</span>
                      </h4>
                    </div>

                    <SalarySlipUploader
                      caseId={caseId}
                      applicantId={app.id}
                      applicantName={toTitleCase(app.name) || app.pan_number}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setCurrentStep(1)}>← Back</button>
              <button className="btn btn-lg" type="submit" disabled={saving} style={{ background: 'var(--success)', color: 'white', border: 'none' }}>Continue to Product Selection →</button>
            </div>
          </form>
        )}

        {currentStep === 3 && (
          <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,var(--success-bg),transparent)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>🏦 Loan Product <span style={{ color: 'var(--error)', fontSize: 12 }}>*</span></h3>
                </div>
                <div style={{ padding: 24 }}>
                  <FormField label="SELECT PRODUCT" name="product_type" required>
                    <select
                      className="form-control"
                      value={formData.product_type}
                      onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                      required
                      style={{ border: formData.product_type ? '2px solid var(--success)' : undefined, background: formData.product_type ? 'var(--success-bg)' : undefined, color: formData.product_type ? 'var(--success)' : undefined, fontWeight: 600 }}
                    >
                      <option value="">— Select a loan product —</option>
                      <option value="HL">HL — Home Loan</option>
                      <option value="LAP">LAP — Loan Against Property</option>
                      <option value="PL">PL — Personal Loan</option>
                    </select>
                  </FormField>
                </div>
              </div>
            </div>

            {PROPERTY_REQUIRED.includes(formData.product_type) && (
              <div className="card">
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>🏡 Property &amp; Collateral Details</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Required for {formData.product_type}</span>
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
                    <FormField label="PROPERTY TYPE" name="property_type" required>
                      <select className="form-control" value={formData.property_type} onChange={e => setFormData({ ...formData, property_type: e.target.value })} required>
                        <option value="">— Select —</option>
                        <option value="Commercial — Office / Shop">Commercial — Office / Shop</option>
                        <option value="Residential — House / Flat">Residential — House / Flat</option>
                        <option value="Industrial — Factory / Warehouse">Industrial — Factory / Warehouse</option>
                        <option value="Plot / Land">Plot / Land</option>
                      </select>
                    </FormField>
                    <FormField label="OCCUPANCY STATUS" name="occupancy_status">
                      <select className="form-control" value={formData.occupancy_status} onChange={e => setFormData({ ...formData, occupancy_status: e.target.value })}>
                        <option value="Self Occupied">Self Occupied</option>
                        <option value="Rented Out">Rented Out</option>
                        <option value="Vacant">Vacant</option>
                      </select>
                    </FormField>
                    <FormField label="OWNERSHIP" name="ownership_type">
                      <select className="form-control" value={formData.ownership_type} onChange={e => setFormData({ ...formData, ownership_type: e.target.value })}>
                        <option value="Sole Owner">Sole Owner</option>
                        <option value="Joint Owner">Joint Owner</option>
                        <option value="Company Owned">Company Owned</option>
                      </select>
                    </FormField>
                  </div>
                  <div style={{ maxWidth: 300 }}>
                    <FormField label="MARKET VALUE (₹)" name="market_value" required>
                      <input type="number" className="form-control" placeholder="e.g. 8500000" value={formData.market_value} onChange={e => setFormData({ ...formData, market_value: e.target.value })} required min="1" />
                    </FormField>
                    <div style={{ fontSize: 11, color: 'black', marginTop: 4 }}>DSA estimate — lender does independent valuation</div>
                  </div>
                  <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--primary-subtle)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--primary-dark)' }}>
                    💡 Property location, title clearance, full address will be collected after the lender is identified.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setCurrentStep(2)}>← Back</button>
              <button className="btn btn-lg" type="submit" disabled={saving} style={{ background: 'var(--success)', color: 'white', border: 'none' }}>
                {saving ? 'Saving...' : 'Complete Salaried Customer Profile →'}
              </button>
            </div>
          </form>
        )}
      </div>

      {otpModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 18, color: 'var(--text-primary)' }}>Enter OTP</h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>Sent to {otpModal.mobile}</p>
            <input
              type="text"
              maxLength={6}
              value={otpModal.otpInput}
              onChange={e => setOtpModal(prev => ({ ...prev, otpInput: e.target.value.replace(/\D/g, '') }))}
              className="form-control"
              placeholder="123456"
              autoFocus
              style={{ letterSpacing: '8px', fontSize: 20, textAlign: 'center', fontWeight: 700, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleResendOtp} disabled={otpModal.loading}>
                Resend OTP
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setOtpModal(prev => ({ ...prev, isOpen: false }))} disabled={otpModal.loading}>Cancel</button>
                <button className="btn" onClick={handleVerifyOtpSubmit} disabled={otpModal.loading} style={{ background: 'var(--success)', color: 'white', border: 'none' }}>
                  {otpModal.loading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddSalariedCustomerWizardPage;
