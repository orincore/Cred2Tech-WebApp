import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { customerService } from '../api/customerService';
import { caseService } from '../api/caseService';
import { otpService } from '../api/otpService';
import FormField from '../components/ui/FormField';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Search, CheckCircle2, ChevronRight, Check, AlertCircle } from 'lucide-react';
import GstAnalyticsForm from '../components/GstAnalyticsForm';
import ItrAnalyticsForm from '../components/ItrAnalyticsForm';
import BankStatementUpload from '../components/BankStatementUpload';
import api from '../api/axiosInstance';

const AddCustomerWizardPage = () => {
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
    mobile_verified: false,
    applicants: [],
    product_type: '',
    // Property (Step 3)
    property_type: '',
    occupancy_status: 'Self Occupied',
    ownership_type: 'Sole Owner',
    market_value: ''
  });

  const [costs, setCosts] = useState({ GST_FETCH: 0, ITR_ANALYTICS: 0, BANK_ANALYSIS: 0 });
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
     api.get('/wallet/api-costs')
       .then(res => {
          const data = res.data;
          const gst = data.find(d => d.api_code === 'GST_FETCH')?.tenant_cost || 0;
          const itr = data.find(d => d.api_code === 'ITR_ANALYTICS')?.tenant_cost || 0;
          const bank = data.find(d => d.api_code === 'BANK_ANALYSIS')?.tenant_cost || 0;
          setCosts({ GST_FETCH: gst, ITR_ANALYTICS: itr, BANK_ANALYSIS: bank });
       })
       .catch(err => console.error(err));

     api.get('/wallet/balance')
       .then(res => setWalletBalance(res.data.balance))
       .catch(console.error);
  }, []);

  const [panVerifying, setPanVerifying] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState(null);

  // OTP Modal State
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
  }, []);

  const restoreSession = async () => {
    try {
      setLoading(true);
      // If the URL has a caseId, use it to restore. If not, the user clicked "Add New Customer" so start fresh.
      const targetCaseId = urlCaseId;
      
      if (!targetCaseId) {
        localStorage.removeItem('draftCaseId');
        setLoading(false);
        return; 
      }

      const caseData = await caseService.getCaseById(targetCaseId);
      
      if (caseData.stage === 'LEAD_CREATED') {
        toast.success("This case is already active.");
        localStorage.removeItem('draftCaseId');
        navigate('/customers', { replace: true });
        return;
      }

      setCaseId(caseData.id);
      setFormData({
        customer_id: caseData.customer?.id,
        business_pan: caseData.customer?.business_pan || '',
        business_name: caseData.customer?.business_name || '',
        business_mobile: caseData.customer?.business_mobile || '',
        business_email: caseData.customer?.business_email || '',
        mobile_verified: caseData.customer?.mobile_verified || false,
        applicants: caseData.applicants || [],
        product_type: caseData.product_type || '',
        property_type: caseData.property?.property_type || '',
        occupancy_status: caseData.property?.occupancy_status || 'Self Occupied',
        ownership_type: caseData.property?.ownership_type || 'Sole Owner',
        market_value: caseData.property?.market_value || '',
        gst_completed: caseData.data_pull_status?.gst_status === 'COMPLETE',
        gst_profile: caseData.customer?.gst_profiles?.[0]?.raw_response || null,
        itr_completed: caseData.data_pull_status?.itr_status === 'COMPLETE',
        customer_itr_profile: caseData.customer?.itr_analytics?.[0] || null,
        customer_bank_profile: caseData.customer?.bank_statements?.[0] || null
      });

      if (caseData.applicants && caseData.applicants.length > 0) {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }

    } catch (error) {
      toast.error('Failed to restore case draft.');
    } finally {
      setLoading(false);
    }
  };

  const ensureDraftSaved = async () => {
    let targetCaseId = caseId;
    let targetCustomerId = formData.customer_id;

    if (!formData.business_pan || !formData.business_mobile) {
      throw new Error("Business PAN and Mobile are required first");
    }
    
    // Always upsert the customer data so email/name updates are preserved
    const customer = await customerService.createOrAttach({
      customer_id: formData.customer_id,
      business_pan: formData.business_pan,
      business_name: formData.business_name,
      business_mobile: formData.business_mobile,
      business_email: formData.business_email
    });
    targetCustomerId = customer.id;

    if (!targetCaseId) {
      const newCase = await caseService.createCase(customer.id);
      targetCaseId = newCase.id;
      
      setCaseId(targetCaseId);
      setFormData(prev => ({
        ...prev, 
        customer_id: targetCustomerId,
        applicants: newCase.applicants || [] // Sync the newly created PRIMARY applicant
      }));
      navigate(`?caseId=${targetCaseId}`, { replace: true });
      localStorage.setItem('draftCaseId', targetCaseId);
    }
    
    return { targetCaseId, targetCustomerId };
  };

  const handleVerifyPan = async (isCoapplicant = false, idx = null) => {
    // Prevent React onClick passing the synthetic event object as the first parameter
    if (typeof isCoapplicant === 'object') {
        isCoapplicant = false;
        idx = null;
    }

    if (!formData.business_pan || formData.business_pan.length < 10) return toast.error('Valid PAN required');
    if (!formData.customer_id || !caseId) return toast.error('Please verify mobile first to generate a case');
    setPanVerifying(true);
    
    try {
      const res = await api.post(`/external/pan/fetch`, { 
        pan: isCoapplicant ? formData.applicants[idx].pan_number : formData.business_pan, 
        customer_id: formData.customer_id,
        case_id: caseId
      });
      const data = res.data;

      const entityName = data.providerResponse?.data?.full_name || data.providerResponse?.data?.entityName || '';
      
      setFormData(prev => ({
         ...prev,
         business_name: entityName && !prev.business_name ? entityName : prev.business_name,
         pan_profile: data
      }));

      toast.success('PAN Verified Successfully!');

    } catch(err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to verify PAN';
      toast.error(errMsg);
    } finally {
      setPanVerifying(false);
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
    } catch(e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendCoapplicantOtp = async (index) => {
    const app = formData.applicants[index];
    if (!app.pan_number || !app.mobile) return toast.error("PAN and Mobile required for Co-Applicant OTP");
    
    try {
      setSaving(true);
      const { targetCaseId } = await ensureDraftSaved();
      
      let targetAppId = app.id;
      if (!targetAppId) {
        const savedApp = await caseService.addApplicant(targetCaseId, app);
        targetAppId = savedApp.id;
        const newArr = [...formData.applicants];
        newArr[index] = savedApp;
        setFormData(prev => ({...prev, applicants: newArr}));
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
    } catch(err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send OTP');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyOtpSubmit = async () => {
    if (otpModal.otpInput.length < 6) return toast.error("Enter valid 6-digit OTP");
    try {
      setOtpModal(prev => ({...prev, loading: true}));
      await otpService.verifyOtp({
        otp: otpModal.otpInput,
        target_type: otpModal.targetType,
        target_id: otpModal.targetId
      });
      
      toast.success("Verified Successfully!");
      
      if (otpModal.targetType === 'CUSTOMER') {
        setFormData(prev => ({...prev, mobile_verified: true}));
      } else {
        const newArr = [...formData.applicants].map(a => 
          a.id === otpModal.targetId ? { ...a, otp_verified: true } : a
        );
        setFormData(prev => ({...prev, applicants: newArr}));
      }
      setOtpModal({ isOpen: false, targetType: null, targetId: null, mobile: '', purpose: '', otpInput: '', loading: false });
    } catch(err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setOtpModal(prev => ({...prev, loading: false}));
    }
  };

  const handleResendOtp = async () => {
    try {
      setOtpModal(prev => ({...prev, loading: true}));
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
      setOtpModal(prev => ({...prev, loading: false}));
    }
  };

  const addCoApplicantRow = () => {
    setFormData(prev => ({
      ...prev,
      applicants: [...prev.applicants, { type: 'CO_APPLICANT', pan_number: '', mobile: '', email: '', otp_verified: false }]
    }));
  };

  const updateApplicantRow = (idx, field, val) => {
    const list = [...formData.applicants];
    list[idx] = { ...list[idx], [field]: val };
    setFormData(prev => ({...prev, applicants: list}));
  };

  const removeApplicant = (index) => {
    // Note: If they have ID, they are in the DB. Removing from UI won't delete unless backend is hit. Placeholder for now.
    const arr = [...formData.applicants];
    arr.splice(index, 1);
    setFormData(prev => ({ ...prev, applicants: arr }));
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!formData.business_pan) return toast.error("Business PAN is required.");
    if (!formData.mobile_verified) return toast.error("Primary Business Mobile must be verified before proceeding.");

    try {
      setSaving(true);
      const { targetCaseId } = await ensureDraftSaved();
      
      const savedApps = [];
      for (const app of formData.applicants) {
        if (app.pan_number) {
          const savedApp = await caseService.addApplicant(targetCaseId, app);
          savedApps.push(savedApp);
        }
      }
      setFormData(prev => ({ ...prev, applicants: savedApps }));

      setCurrentStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateGst = async (months) => {
    if (!formData.customer_id) return toast.error("Customer ID missing. Please go back and resave.");
    
    try {
      setSaving(true);
      const res = await api.post(`/external/gst-fetch`, {
         customer_id: formData.customer_id, case_id: caseId,
         months, gstin: formData.gstin || '27XXXXX1234X1Z5'
      });
      const data = res.data;
      
      setFormData(prev => ({...prev, gst_completed: true, gst_profile: data.gstProfile }));
      toast.success("GST Report Generated successfully!");
    } catch (err) {
      if (err.message.includes('Insufficient credits')) toast.error("Insufficient Credits - Top Up Required!", { duration: 5000 });
      else toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateItr = async (years) => {
    if (!formData.customer_id) return toast.error("Customer ID missing.");
    
    try {
      setSaving(true);
      const res = await api.post(`/external/itr-fetch`, {
         customer_id: formData.customer_id, case_id: caseId,
         years, pan: formData.business_pan
      });
      const data = res.data;

      setFormData(prev => ({...prev, itr_completed: true, itr_profile: data.itrProfile }));
      toast.success("ITR Report Generated successfully!");
    } catch (err) {
      if (err.message.includes('Insufficient credits')) toast.error("Insufficient Credits - Top Up Required!", { duration: 5000 });
      else toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunBureau = async (applicantId) => {
    if (!caseId) return toast.error("Case ID missing");
    if (saving) return; // prevent double-click race
    try {
      setSaving(true);
      const res = await api.post(`/verification/bureau/run/${caseId}`, { applicantId });
      const data = res.data;

      if (data.status === 'FAILED') {
        const errMsg = data.errors?.[0]?.error || 'Bureau fetch failed';
        toast.error(errMsg);
        return;
      }

      if (data.status === 'PARTIAL_SUCCESS') {
        toast.error(`Partial failure: ${data.errors?.[0]?.error || 'Some applicants failed'}`);
      } else {
        toast.success("Bureau pull success!");
      }

      // Update local state to reflect bureau_fetched
      const updatedApps = formData.applicants.map(a => 
        a.id === applicantId ? { ...a, bureau_fetched: true } : a
      );
      setFormData(prev => ({ ...prev, applicants: updatedApps }));
    } catch(err) {
      toast.error(err.response?.data?.error || "Bureau fetch failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Submit = async (e) => { e.preventDefault(); setCurrentStep(3); };

  const PROPERTY_REQUIRED = ['LAP', 'HL'];

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    if (!formData.product_type) return toast.error('Please select a loan product.');
    const needsProperty = PROPERTY_REQUIRED.includes(formData.product_type);
    if (needsProperty && !formData.property_type) return toast.error('Property type is required for LAP/HL.');
    if (needsProperty && !formData.market_value)  return toast.error('Market value is required for LAP/HL.');

    try {
      setSaving(true);
      const payload = {
        product_type: formData.product_type,
        property: needsProperty ? {
          property_type:    formData.property_type,
          occupancy_status: formData.occupancy_status,
          ownership_type:   formData.ownership_type,
          market_value:     parseFloat(formData.market_value)
        } : null
      };
      await caseService.updateProductProperty(caseId, payload);
      localStorage.removeItem('draftCaseId');
      toast.success('Product & property saved!');
      navigate(`/cases/${caseId}/income-summary`);
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{caseId ? "Resume Draft Case" : "Add New Customer / New Case"}</h1>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>Step {currentStep} of 3 — {currentStep === 1 ? 'Business Entity & Co-Applicants' : currentStep === 2 ? 'Financial Data' : 'Product Selection'}</p>
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
        {[ { step: 1, label: "PAN & Contacts" }, { step: 2, label: "GST / ITR / Bank" }, { step: 3, label: "Product & Property" } ].map((s) => {
          const isActive = currentStep === s.step;
          const isPast = currentStep > s.step;
          return (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface)', zIndex: 1, padding: '0 10px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'var(--primary)' : isPast ? 'var(--bg-surface)' : 'var(--bg-elevated)', border: isPast ? '2px solid var(--primary)' : 'none', color: isActive ? 'white' : isPast ? 'var(--primary)' : 'var(--text-tertiary)', fontWeight: 600, fontSize: 13 }}>
                {isPast ? <Check size={16} strokeWidth={3} /> : s.step}
              </div>
              <span style={{ fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontSize: 14 }}>{s.label}</span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {existingCustomer && !formData.mobile_verified && (
              <div className="notice" style={{ background: '#FFF3E0', borderColor: '#FFB74D', color: '#E65100', padding: '16px 20px', alignItems: 'center' }}>
                <Search size={22} color="#F57C00" style={{ marginRight: 8 }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Existing customer found: {existingCustomer.business_name || 'N/A'}</h4>
                  <p style={{ opacity: 0.85, fontSize: 13 }}>PAN {existingCustomer.business_pan} exists. Please verify Mobile OTP to proceed and attach new case.</p>
                </div>
              </div>
            )}

            {/* Business Entity Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Business Entity</h3>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Enter PAN — profile fetched automatically</span>
              </div>
              
              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                  <FormField label="PAN NUMBER" name="business_pan" required disabled={!!caseId || formData.mobile_verified}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="text" value={formData.business_pan} onChange={e => setFormData({...formData, business_pan: e.target.value.toUpperCase()})} className="form-control" placeholder="E.G. AABCE1234F" disabled={!!caseId || formData.mobile_verified} style={{ textTransform: 'uppercase' }} />
                      {formData.mobile_verified && (
                        <button type="button" onClick={handleVerifyPan} disabled={panVerifying || !formData.business_pan || formData.pan_profile?.status === 'SUCCESS'} className="btn btn-secondary">
                          {panVerifying ? 'Wait...' : (formData.pan_profile?.status === 'SUCCESS' ? 'Verified' : 'Verify pan')}
                        </button>
                      )}
                    </div>
                  </FormField>
                  
                  <FormField label="MOBILE NUMBER" name="business_mobile" required disabled={formData.mobile_verified}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="tel" value={formData.business_mobile} onChange={e => setFormData({...formData, business_mobile: e.target.value})} className="form-control" placeholder="9820012345" disabled={formData.mobile_verified} />
                      {!formData.mobile_verified ? (
                        <button type="button" onClick={handleSendPrimaryOtp} disabled={saving || !formData.business_mobile || !formData.business_pan} className="btn btn-primary" style={{ padding: '0 20px' }}>Send OTP</button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600, padding: '0 10px', whiteSpace: 'nowrap' }}>
                          <CheckCircle2 size={18} /> Verified
                        </div>
                      )}
                    </div>
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <FormField label="EMAIL ADDRESS" name="business_email" required>
                    <input type="email" value={formData.business_email} onChange={e => setFormData({...formData, business_email: e.target.value})} className="form-control" placeholder="admin@company.in" />
                  </FormField>
                </div>

                <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--primary-subtle)', borderRadius: 'var(--radius)', color: 'var(--primary-dark)', fontSize: 12 }}>
                  📌 After entering PAN and Mobile, trigger 'Send OTP' to lock your draft and verify ownership.
                </div>
              </div>
            </div>

            {/* Co-Applicants Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Co-Applicants</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Add each co-applicant's PAN, mobile and email. Bureau is pulled via OTP consent on their mobile.</p>
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
                    {formData.applicants.filter(a => a.type === 'CO_APPLICANT').map((app, idx) => (
                      <div key={idx} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', padding: 24, borderRadius: 'var(--radius)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 18, right: 24, display: 'flex', gap: 12 }}>
                           <button type="button" onClick={() => removeApplicant(idx)} style={{ color: 'var(--error)', fontSize: 13, fontWeight: 600, border: 'none', background: 'none' }}>Remove ×</button>
                        </div>
                        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Applicant #{idx + 1}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 16, alignItems: 'end' }}>
                          <FormField label="PAN NUMBER" name={`copan_${idx}`}>
                            <input type="text" value={app.pan_number || ''} onChange={e => updateApplicantRow(idx, 'pan_number', e.target.value)} className="form-control" style={{ textTransform: 'uppercase' }} disabled={app.otp_verified} />
                          </FormField>
                          <FormField label="MOBILE NUMBER" name={`comob_${idx}`}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input type="tel" value={app.mobile || ''} onChange={e => updateApplicantRow(idx, 'mobile', e.target.value)} className="form-control" disabled={app.otp_verified} />
                              {!app.otp_verified ? (
                                <button type="button" className="btn btn-primary" onClick={() => handleSendCoapplicantOtp(idx)} style={{ padding: '0 16px', whiteSpace: 'nowrap' }} disabled={saving}>Send OTP</button>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 600, padding: '0 8px', whiteSpace: 'nowrap', fontSize: 12 }}>
                                  <CheckCircle2 size={16} /> Verified
                                </div>
                              )}
                            </div>
                          </FormField>
                          <FormField label="EMAIL" name={`coemail_${idx}`}>
                            <input type="email" value={app.email || ''} onChange={e => updateApplicantRow(idx, 'email', e.target.value)} className="form-control" />
                          </FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-primary btn-lg" type="submit" disabled={saving || !formData.mobile_verified}>
                {saving ? 'Processing...' : 'Continue to Financials →'}
              </button>
            </div>
          </form>
        )}

        {currentStep === 2 && ( 
          <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Bureau Section - NEW */}
            <div className="card">
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <h3 style={{ fontSize: 16, fontWeight: 700 }}>Bureau Verification</h3>
                   <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Verify credit scores before analysis</p>
                 </div>
                 <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Check OTP status in Step 1 if disabled</div>
               </div>
               <div style={{ padding: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {formData.applicants.sort((a,b) => a.type === 'PRIMARY' ? -1 : 1).map((app, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                           <div style={{ width: 8, height: 8, borderRadius: '50%', background: app.bureau_fetched ? 'var(--success)' : 'var(--warning)' }} />
                           <div>
                             <p style={{ fontSize: 14, fontWeight: 600 }}>{app.type === 'PRIMARY' ? 'Primary Borrower' : `Co-Applicant #${formData.applicants.filter(x => x.type === 'CO_APPLICANT').indexOf(app) + 1}`}</p>
                             <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{app.pan_number || 'PAN Pending'} • {app.type}</p>
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                           {app.cibil_score && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>CIBIL: {app.cibil_score}</span>}
                           <button 
                             type="button"
                             className={`btn btn-sm ${app.bureau_fetched ? 'btn-secondary' : 'btn-primary'}`}
                             onClick={() => handleRunBureau(app.id)}
                             disabled={saving || !app.otp_verified || app.bureau_fetched}
                           >
                             {app.bureau_fetched ? 'Verified' : 'Run Bureau'}
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="card">
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                 <h3 style={{ fontSize: 16, fontWeight: 700 }}>GST Profile</h3>
                 <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Extrapolated from Business PAN: {formData.business_pan}</p>
               </div>
                <div style={{ padding: 0 }}>
                  <GstAnalyticsForm 
                     caseId={caseId} 
                     customerId={formData.customer_id} 
                     onComplete={() => setFormData(prev => ({...prev, gst_completed: true}))} 
                  />
                </div>
            </div>

            <div className="card">
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <h3 style={{ fontSize: 16, fontWeight: 700 }}>ITR Analytics</h3>
                   <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Structured financial analytics via ITR portal credentials</p>
                 </div>
                 <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>One fetch per applicant — PAN + portal password</p>
               </div>
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <ItrAnalyticsForm
                      caseId={caseId}
                      customerId={formData.customer_id}
                      applicantId={null}
                      applicantType="PRIMARY"
                      applicantName={formData.business_name || formData.business_pan || 'Primary Business'}
                      prefillPan={formData.business_pan}
                      walletBalance={walletBalance}
                      itrCost={costs.ITR_ANALYTICS}
                      existingRecord={formData.customer_itr_profile}
                      onComplete={(data) => setFormData(prev => ({...prev, itr_completed: true, itr_analytics: data}))}
                  />

                  {formData.applicants && formData.applicants.map((coApp, idx) => (
                      <ItrAnalyticsForm
                          key={idx}
                          caseId={caseId}
                          customerId={formData.customer_id}
                          applicantId={coApp.id}
                          applicantType="CO_APPLICANT"
                          applicantName={coApp.pan_number || `Co-Applicant ${idx + 1}`}
                          prefillPan={coApp.pan_number || ''}
                          walletBalance={walletBalance}
                          itrCost={costs.ITR_ANALYTICS}
                          existingRecord={coApp.itr_analytics?.[0] || null}
                          onComplete={(data) => console.log(`Co-App ${idx} ITR complete`)}
                      />
                  ))}

                  <div style={{ padding: '14px 16px', background: 'var(--primary-subtle)', borderRadius: 'var(--radius)', border: '1px solid #d0ccff', color: 'var(--primary-dark)', fontSize: 13 }}>
                    ITR Analytics includes P&L, Balance Sheet, Ratio Analysis, and an Excel report downloadable per applicant.
                  </div>
               </div>
            </div>

            {/* Bank Statement Section */}
            <div className="card">
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                   <div style={{ fontSize: 20 }}>🏢</div> 
                   <h3 style={{ fontSize: 16, fontWeight: 700 }}>Bank Statement Upload</h3>
                 </div>
                 <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Upload 12-month bank statement for each applicant — PDF or Excel</p>
               </div>
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <BankStatementUpload 
                      caseId={caseId}
                      customerId={formData.customer_id}
                      applicantId={null} 
                      applicantType="PRIMARY"
                      applicantName={formData.business_name || formData.business_pan || 'Primary Business'}
                      walletBalance={walletBalance}
                      analyzeCost={costs.BANK_ANALYSIS}
                      existingStatus={formData.customer_bank_profile}
                      onComplete={(status, payload) => console.log('Primary bank complete')}
                  />
                  
                  {formData.applicants && formData.applicants.map((coApp, idx) => (
                      <BankStatementUpload 
                          key={idx}
                          caseId={caseId}
                          customerId={formData.customer_id}
                          applicantId={coApp.id} 
                          applicantType="CO_APPLICANT"
                          applicantName={coApp.pan_number || `Co-Applicant ${idx+1}`}
                          walletBalance={walletBalance}
                          analyzeCost={costs.BANK_ANALYSIS}
                          existingStatus={coApp.bank_statements?.[0] || null}
                          onComplete={(status, payload) => console.log(`Co-App ${idx} bank complete`)}
                      />
                  ))}
                  
                  <div style={{ padding: '16px', background: 'var(--primary-subtle)', borderRadius: 'var(--radius)', border: '1px solid #d0ccff', color: 'var(--primary-dark)', fontSize: 13, marginTop: 8 }}>
                    Bank statement analysis (average monthly balance, credits, debits) will appear in the next step's income summary.
                  </div>
               </div>
            </div>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setCurrentStep(1)}>← Back</button>
              <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>Continue to Product Selection →</button>
            </div>
          </form> 
        )}
        {currentStep === 3 && (
          <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Top row: Product + Data Pull Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Loan Product Card */}
              <div className="card">
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,#FFF5EB,transparent)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--warning)' }}>🏦 Loan Product <span style={{ color: 'var(--error)', fontSize: 12 }}>*</span></h3>
                </div>
                <div style={{ padding: 24 }}>
                  <FormField label="SELECT PRODUCT" name="product_type" required>
                    <select
                      className="form-control"
                      value={formData.product_type}
                      onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                      required
                      style={{ border: formData.product_type ? '2px solid var(--warning)' : undefined, background: formData.product_type ? '#FFF5EB' : undefined, color: formData.product_type ? 'var(--warning)' : undefined, fontWeight: 600 }}
                    >
                      <option value="">— Select a loan product —</option>
                      <option value="LAP">LAP — Loan Against Property</option>
                      <option value="HL">HL — Home Loan</option>
                      <option value="WC">Working Capital (CC / OD)</option>
                      <option value="TL">Term Loan (MSME / BL)</option>
                      <option value="ML">Machinery / Equipment Finance</option>
                      <option value="BL">Business Loan (Unsecured)</option>
                      <option value="Other">Other — Specify</option>
                    </select>
                  </FormField>
                  <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--primary-subtle)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--primary-dark)' }}>
                    💡 Loan amount &amp; tenure will be captured after the lender is identified via ESR.
                  </div>
                </div>
              </div>

              {/* Data Pull Status */}
              <div className="card">
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>📡 Data Pull Status</h3>
                </div>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Bureau Pull',     done: formData.applicants.every(a => a.bureau_fetched), sub: `${formData.applicants.filter(a => a.bureau_fetched).length} of ${formData.applicants.length} fetched` },
                    { label: 'GST Report',      done: formData.gst_completed,  sub: formData.gst_completed ? 'Generated' : 'Not yet generated' },
                    { label: 'ITR Report',      done: formData.itr_completed,  sub: formData.itr_completed ? 'Generated' : 'Not yet generated' },
                    { label: 'Bank Statement',  done: !!formData.customer_bank_profile, sub: formData.customer_bank_profile ? 'Uploaded' : 'Not yet uploaded' }
                  ].map(({ label, done, sub }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: done ? '#F0FFF4' : '#FFFBF0', borderRadius: 8, border: `1px solid ${done ? '#9AE6B4' : '#F6E05E'}` }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: done ? 'var(--success)' : 'var(--warning)' }}>{done ? '✅ Done' : '⏳ Pending'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Property Details — only for LAP / HL */}
            {PROPERTY_REQUIRED.includes(formData.product_type) && (
              <div className="card">
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>🏢 Property &amp; Collateral Details</h3>
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
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>DSA estimate — lender does independent valuation</div>
                  </div>
                  <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--primary-subtle)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--primary-dark)' }}>
                    💡 Property location, title clearance, full address will be collected after the lender is identified.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setCurrentStep(2)}>← Back</button>
              <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Next: Income Summary →'}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* OTP Modal */}
      {otpModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-base)', padding: '32px 40px', borderRadius: '12px', width: '100%', maxWidth: 480, margin: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
               <h3 style={{ fontSize: 20, fontWeight: 700 }}>Verify Mobile OTP</h3>
             </div>
             <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
               We've sent a 6-digit verification code to <strong>{otpModal.mobile}</strong>.
             </p>
             <FormField label="ENTER 6-DIGIT OTP" name="otpInput">
               <input 
                 autoFocus
                 type="text" 
                 pattern="\d*"
                 maxLength={6}
                 className="form-control" 
                 value={otpModal.otpInput} 
                 onChange={e => setOtpModal(prev => ({...prev, otpInput: e.target.value.replace(/\D/g, '')}))} 
                 style={{ fontSize: 24, letterSpacing: '0.5em', textAlign: 'center', padding: '16px 0', fontFamily: 'monospace' }} 
               />
             </FormField>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleResendOtp} disabled={otpModal.loading}>
                   Resend OTP
                </button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setOtpModal(prev => ({...prev, isOpen: false}))} disabled={otpModal.loading}>
                     Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleVerifyOtpSubmit} disabled={otpModal.loading || otpModal.otpInput.length < 6}>
                     {otpModal.loading ? 'Verifying...' : 'Verify →'}
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCustomerWizardPage;
