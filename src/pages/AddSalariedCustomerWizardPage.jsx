import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { caseService } from '../api/caseService';
import { customerService } from '../api/customerService';
import { consentService } from '../api/consentService';
import { subscribeToConsentRequest } from '../lib/realtime';
import FormField from '../components/ui/FormField';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Search, CheckCircle2, Check, Pencil, Landmark, FileText, Lightbulb, AlertCircle } from 'lucide-react';
import api from '../api/axiosInstance';
import SalarySlipUploader from '../components/onboarding/SalarySlipUploader';
import DataPullProgress from '../components/onboarding/DataPullProgress';
import CaseWizardStepper, { SALARIED_ORIGIN_STEPS } from '../components/ui/CaseWizardStepper';
import Panel from '../components/ui/Panel';
import PullingIndicator from '../components/ui/PullingIndicator';
import { listDocuments, downloadDocument } from '../api/documentHelper';
import { toTitleCase, formatDate } from '../utils/helpers';
import { WIZARD_MAX_WIDTH } from '../constants/layout';

const PROPERTY_REQUIRED = ['LAP', 'HL'];

// Customer/Applicant.dob is stored as a Prisma DateTime column (encrypted at
// rest) — reading it back always yields a real Date, which Express's JSON
// serialization turns into a full ISO datetime string like
// "2003-06-29T00:00:00.000Z". A native <input type="date"> only accepts the
// bare "YYYY-MM-DD" form and silently renders blank for anything else — so
// without this, a DOB that was genuinely fetched and saved still shows as
// empty in the form. Slicing the ISO string is timezone-safe here since
// toISOString() always renders midnight UTC for a date-only value, so the
// calendar date never shifts.
const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const AddSalariedCustomerWizardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlCaseId = searchParams.get('caseId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  // Step 1 is split into two sub-pages (Personal Details, then Co-Applicants)
  // without affecting the overall wizard step count — the stepper still only
  // ever sees currentStep === 1 for both, matching AddCustomerWizardPage.
  const [step1SubPage, setStep1SubPage] = useState('business');
  const [caseId, setCaseId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    dsa_notes: '',
    property_type: '',
    occupancy_status: 'Self Occupied',
    ownership_type: 'Sole Owner',
    market_value: ''
  });

  // Synthetically-injected test/audit cases (dsa_notes tagged [BULK UPLOAD] —
  // same marker the backend's _isBulkUploadSnapshot() already recognizes)
  // carry fake PAN/mobile data. Live vendor pulls (bureau) for these would
  // waste quota and fail/misbehave against the real bureau API, so the pull
  // trigger on this page is disabled for them.
  const isBulkInjectedCase = /\[(BULK|LEGACY) UPLOAD\]/i.test(formData.dsa_notes || '');

  // Credit cost/wallet display — same convention AddCustomerWizardPage
  // already uses for its own paid pulls (Request Consent, Bureau, GST, ITR,
  // Bank). This page is DSA-only (see AppRouter's allowedRoles for
  // /customers/salaried/add), so unlike that page there's no isMsme branch
  // to skip the wallet gate for.
  const [costs, setCosts] = useState({ PAN_FETCH: 0, BUREAU_PULL: 0, BUREAU_OBLIGATIONS: 0 });
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    api.get('/wallet/api-costs')
      .then(res => {
        const data = res.data;
        const panFetch = data.find(d => d.api_code === 'PAN_FETCH')?.tenant_cost || 0;
        const bureauPull = data.find(d => d.api_code === 'BUREAU_PULL')?.tenant_cost || 0;
        const bureauObligations = data.find(d => d.api_code === 'BUREAU_OBLIGATIONS')?.tenant_cost || 0;
        setCosts({ PAN_FETCH: panFetch, BUREAU_PULL: bureauPull, BUREAU_OBLIGATIONS: bureauObligations });
      })
      .catch(err => console.error(err));

    api.get('/wallet/balance')
      .then(res => setWalletBalance(res.data.balance))
      .catch(console.error);
  }, []);

  const [panVerifying, setPanVerifying] = useState(false);
  const [panVerifyFailed, setPanVerifyFailed] = useState(false);
  // Per-co-applicant-row PAN verify-in-flight state — separate from the
  // primary's panVerifying so one co-applicant's auto-verify (or the
  // primary's) never shows every other row as "Verifying…" too. Same
  // convention AddCustomerWizardPage.jsx already uses.
  const [coappPanVerifyingMap, setCoappPanVerifyingMap] = useState({});

  // Customer consent gate — replaces the old mobile-OTP step entirely (see
  // handleRequestConsent below). Approval sets formData.mobile_verified, so
  // the existing "Verify PAN" button (already gated on that flag) needs no
  // further changes.
  const [consentRequest, setConsentRequest] = useState(null);
  const [consentRequesting, setConsentRequesting] = useState(false);
  const [consentRequestFailed, setConsentRequestFailed] = useState(false);

  // PAN here locks on `!!caseId || mobile_verified` — a compound condition
  // (not just "PAN itself verified"), so a plain "reset pan_verified"
  // toggle (like the main wizard uses) wouldn't actually unlock the input.
  // This flag overrides that lock directly instead.
  const [panEditUnlocked, setPanEditUnlocked] = useState(false);
  // Per-co-applicant-row PAN unlock — co-applicant PAN's disabled state is
  // tied to that row's own otp_verified (this file verifies mobile OTP
  // before PAN, unlike the primary section), so a plain "reset pan_verified"
  // toggle wouldn't unlock the input by itself. Keyed by applicant array index.
  const [coappPanEditUnlockedMap, setCoappPanEditUnlockedMap] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [bureauReports, setBureauReports] = useState({}); // { [applicantId]: documentRow }
  const [downloadingFor, setDownloadingFor] = useState(null); // applicant_id

  // Bureau reports (Experian PDF) get ingested into document storage per
  // applicant at pull time — fetch them once a case exists so a "Download
  // Report" button can appear next to a completed bureau pull.
  useEffect(() => {
    if (!caseId) return;
    listDocuments({ caseId })
      .then(docs => {
        const reports = {};
        docs.filter(d => d.original_file_name?.startsWith('Experian_Report_'))
          .forEach(d => { reports[d.applicant_id] = d; });
        setBureauReports(reports);
      })
      .catch(() => {}); // non-fatal — just no download button
  }, [caseId, formData.applicants]);

  const handleDownloadReport = async (applicantId) => {
    const doc = bureauReports[applicantId];
    if (!doc) return;
    setDownloadingFor(applicantId);
    try {
      await downloadDocument(doc.id, doc.original_file_name);
    } catch (e) {
      toast.error('Failed to download bureau report');
    } finally {
      setDownloadingFor(null);
    }
  };

  // Applicant.name is often unset for the primary borrower (it lives on
  // formData.business_name instead) — prefer a real name over the generic
  // "Primary Borrower" / "Co-Applicant #N" placeholder wherever one exists.
  const getApplicantDisplayName = (app, idx) => {
    const name = app.name || (app.type === 'PRIMARY' ? formData.business_name : '');
    if (name) return toTitleCase(name);
    return app.type === 'PRIMARY' ? 'Primary Borrower' : `Co-Applicant #${idx}`;
  };


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
        // `bureau_checks.length > 0` is true even for a FAILED pull attempt
        // (it's just "a row exists in bureau_verifications"), and
        // `obligations.length > 0` reflects the independent Experian pull,
        // not the credit score check — neither means the CIBIL score was
        // actually retrieved. The server's own `bureau_fetched` is only set
        // true on a successful score fetch; `cibil_score` presence is kept
        // as a defensive fallback for older records.
        bureau_fetched: app.bureau_fetched === true || !!app.cibil_score,
        has_ocr: app.salary_ocr_results?.length > 0
      }));

      setFormData({
        customer_id: caseData.customer?.id,
        business_pan: caseData.customer?.business_pan || '',
        // proprietor_name/pan_holder_name are always set from the plain PAN-verify
        // API's own name field, regardless of anything GST-derived — business_name
        // can end up holding a stale legal_business_name/trade_name (a GST artifact,
        // sometimes even a raw GST TRN placeholder string) left over from a
        // different flow, which is never applicable to a salaried customer.
        business_name: caseData.customer?.proprietor_name || caseData.customer?.pan_holder_name || caseData.customer?.business_name || '',
        business_mobile: (caseData.customer?.business_mobile || '').replace(/\D/g, ''),
        business_email: caseData.customer?.business_email || '',
        pincode: primaryApp?.pincode || caseData.customer?.pan_profiles?.[0]?.principal_pincode || '',
        dob: toDateInputValue(caseData.customer?.dob),
        // Sourced from THIS case's own primary Applicant row, not
        // caseData.customer.mobile_verified — that field lives on the shared
        // Customer record and is reused across every case for the same PAN,
        // which let a brand-new salaried case silently inherit "Consented"
        // from a completely different, unrelated case for the same customer.
        // Consent must be explicit per case (see the same fix already applied
        // in AddCustomerWizardPage.jsx, and case.service.js/consent.service.js).
        mobile_verified: primaryApp?.otp_verified || false,
        applicants: restoredApplicants.map(app => ({
          ...app,
          mobile: (app.mobile || '').replace(/\D/g, ''),
          dob: toDateInputValue(app.dob)
        })),
        product_type: caseData.product_type || '',
        dsa_notes: caseData.dsa_notes || '',
        property_type: caseData.property?.property_type || '',
        occupancy_status: caseData.property?.occupancy_status || 'Self Occupied',
        ownership_type: caseData.property?.ownership_type || 'Sole Owner',
        market_value: caseData.property?.market_value || '',
      });

      if (primaryApp?.otp_verified && restoredApplicants.length > 0) {
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

  // Replaces the old "Send OTP" button entirely — there is no separate
  // mobile OTP step anymore, it's folded into this one. Texts the customer
  // an OTP + consent link via SMS and opens a live subscription for the
  // approval, same as the business wizard.
  const handleRequestConsent = async () => {
    const mobile = formData.business_mobile?.trim();
    if (!mobile) {
      return toast.error('Mobile number is required to send the consent request.');
    }

    setConsentRequesting(true);
    setConsentRequestFailed(false);
    try {
      const draft = await ensureDraftSaved();
      const result = await consentService.requestConsent({
        customer_id: draft.targetCustomerId,
        case_id: draft.targetCaseId,
      });
      setConsentRequest({ id: result.id, status: result.status });
      toast.success(`Consent OTP sent via SMS to ${mobile}. Waiting for the customer to approve.`);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to send consent request';
      toast.error(errMsg);
      setConsentRequestFailed(true);
    } finally {
      setConsentRequesting(false);
    }
  };

  // Live: the moment the customer approves, this sets mobile_verified — the
  // same flag the old OTP-verify step used to set — so the "Verify PAN"
  // button (gated on mobile_verified) becomes available, unchanged.
  useEffect(() => {
    if (!consentRequest?.id || consentRequest.status === 'GRANTED') return;
    const unsubscribe = subscribeToConsentRequest(consentRequest.id, (payload) => {
      if (payload.status === 'GRANTED') {
        setConsentRequest((prev) => (prev ? { ...prev, status: 'GRANTED' } : prev));
        setFormData((prev) => ({ ...prev, mobile_verified: true }));
        toast.success('Customer approved — you can now verify PAN.');
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentRequest?.id]);

  // Same consent gate as the primary applicant, per co-applicant — a
  // co-applicant is a distinct person and can only consent for their own
  // PAN, so each gets their own request/email/link, keyed by row index.
  const [coappConsent, setCoappConsent] = useState({});
  const [coappConsentRequesting, setCoappConsentRequesting] = useState({});

  const handleRequestCoapplicantConsent = async (index) => {
    const app = formData.applicants[index];
    if (!app.pan_number || !app.mobile) return toast.error('PAN and Mobile required before requesting consent');

    setCoappConsentRequesting((prev) => ({ ...prev, [index]: true }));
    try {
      const { targetCaseId } = await ensureDraftSaved();

      let targetAppId = app.id;
      if (!targetAppId) {
        const savedApp = await caseService.addApplicant(targetCaseId, app);
        targetAppId = savedApp.id;
        const newArr = [...formData.applicants];
        newArr[index] = savedApp;
        setFormData((prev) => ({ ...prev, applicants: newArr }));
      }

      const result = await consentService.requestConsent({
        customer_id: formData.customer_id,
        case_id: targetCaseId,
        applicant_id: targetAppId,
      });
      setCoappConsent((prev) => ({ ...prev, [index]: { id: result.id, status: result.status } }));
      toast.success(`Consent OTP sent via SMS to ${app.mobile}. Waiting for them to approve.`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send consent request');
    } finally {
      setCoappConsentRequesting((prev) => ({ ...prev, [index]: false }));
    }
  };

  useEffect(() => {
    const unsubscribes = Object.entries(coappConsent).map(([idx, req]) => {
      if (!req?.id || req.status === 'GRANTED') return null;
      return subscribeToConsentRequest(req.id, (payload) => {
        if (payload.status !== 'GRANTED') return;
        setCoappConsent((prev) => ({ ...prev, [idx]: { ...prev[idx], status: 'GRANTED' } }));
        setFormData((prev) => {
          const list = [...prev.applicants];
          if (list[idx]) list[idx] = { ...list[idx], otp_verified: true };
          return { ...prev, applicants: list };
        });
        toast.success('Co-applicant approved — you can now verify their PAN.');
      });
    }).filter(Boolean);
    return () => unsubscribes.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coappConsent]);

  const handleVerifyPan = async (isCoapplicant = false, idx = null) => {
    if (typeof isCoapplicant === 'object') {
      isCoapplicant = false;
      idx = null;
    }

    const pan = isCoapplicant && idx !== null ? formData.applicants[idx]?.pan_number : formData.business_pan;
    if (!pan || pan.length < 10) return toast.error('Valid PAN required');

    if (isCoapplicant && idx !== null) setCoappPanVerifyingMap(prev => ({ ...prev, [idx]: true }));
    else { setPanVerifying(true); setPanVerifyFailed(false); }

    try {
      // Always persist the current PAN before verifying it — not just for a
      // brand-new case/applicant. Verifying only *checks* the value passed
      // in this request; for an already-verified record being corrected
      // (the whole point of the Edit button), the freshly-typed PAN was
      // still sitting in local state only, and would never reach the
      // database even after a successful re-verification.
      const draft = await ensureDraftSaved();
      const targetCaseId = draft.targetCaseId;
      const targetCustomerId = draft.targetCustomerId;

      let applicantId = isCoapplicant && idx !== null ? formData.applicants[idx]?.id : null;
      if (isCoapplicant && idx !== null) {
        const savedApp = await caseService.addApplicant(targetCaseId, formData.applicants[idx]);
        applicantId = savedApp.id;
        const list = [...formData.applicants];
        list[idx] = savedApp;
        setFormData(prev => ({ ...prev, applicants: list }));
      }

      const res = await api.post('/external/pan/verify', {
        pan,
        customer_id: targetCustomerId,
        case_id: targetCaseId,
        is_coapplicant: isCoapplicant,
        applicant_id: applicantId
      });
      const data = res.data;

      const entityName = data.name || '';
      const entityDob = toDateInputValue(data.dob);

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
      if (!isCoapplicant) setPanVerifyFailed(true);
    } finally {
      if (isCoapplicant && idx !== null) setCoappPanVerifyingMap(prev => ({ ...prev, [idx]: false }));
      else setPanVerifying(false);
    }
  };

  // Auto-verify the primary applicant's PAN the instant consent is granted —
  // no manual "Verify PAN" click needed, same as AddCustomerWizardPage's
  // auto-verify effect. Guarded by a ref (not formData) so a failed attempt
  // doesn't retry in a tight loop; re-editing the PAN value clears the guard.
  const panAutoVerifyAttempted = useRef(null);
  useEffect(() => {
    if (currentStep > 1) return;
    const pan = formData.business_pan;
    const ready = pan && pan.length === 10 && formData.mobile_verified && !isBulkInjectedCase;
    if (
      ready &&
      !formData.pan_verified &&
      !panVerifying &&
      panAutoVerifyAttempted.current !== pan
    ) {
      panAutoVerifyAttempted.current = pan;
      handleVerifyPan();
    } else if (!pan || pan.length !== 10) {
      panAutoVerifyAttempted.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, formData.business_pan, formData.mobile_verified, formData.pan_verified, panVerifying]);

  // Auto-verify each co-applicant's PAN once their own consent is granted —
  // same no-manual-click pattern as the primary above, guarded per-index so a
  // failed attempt doesn't retry in a tight loop.
  const coappPanAutoVerifyAttempted = useRef({});
  useEffect(() => {
    if (currentStep > 1 || isBulkInjectedCase) return;
    formData.applicants.forEach((app, idx) => {
      if (app.type !== 'CO_APPLICANT') return;
      const pan = app.pan_number;
      if (
        pan && pan.length === 10 &&
        app.otp_verified &&
        !app.pan_verified &&
        !coappPanVerifyingMap[idx] &&
        coappPanAutoVerifyAttempted.current[idx] !== pan
      ) {
        coappPanAutoVerifyAttempted.current[idx] = pan;
        handleVerifyPan(true, idx);
      } else if (!pan || pan.length !== 10) {
        coappPanAutoVerifyAttempted.current[idx] = null;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, formData.applicants, coappPanVerifyingMap]);


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

      // The primary applicant is created server-side (by /customers/salaried/start
      // on first save, or already existing on resume) — it never lives in
      // local co-applicant state, and on a brand-new case ensureDraftSaved's
      // own setFormData(...) hasn't landed yet by this point in the same
      // call, so formData.applicants here can't be trusted to contain it.
      // Source it fresh from savedCase instead, merging in formData.pincode
      // (the top-level field the user actually typed into) — without this
      // the pincode never reaches the Applicant row and reads back blank on
      // the next load.
      const savedApps = [];
      const primaryFromBackend = savedCase.applicants?.find(a => a.type === 'PRIMARY');
      if (primaryFromBackend) {
        const savedPrimary = await caseService.addApplicant(targetCaseId, {
          ...primaryFromBackend,
          pincode: formData.pincode
        });
        savedApps.push(savedPrimary);
      }

      const coApplicants = formData.applicants.filter(a => a.type === 'CO_APPLICANT' && a.pan_number);
      for (const app of coApplicants) {
        const savedApp = await caseService.addApplicant(targetCaseId, app);
        savedApps.push(savedApp);
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

      // status can be SUCCESS, PARTIAL_SUCCESS, or FAILED — PARTIAL_SUCCESS
      // covers "some applicants in this batch succeeded, this one didn't"
      // (e.g. a vendor-side error for this specific applicant's Experian
      // pull, which now provides both the score and obligations in one
      // call — see bureau.controller.js). That's not a completed bureau
      // check for THIS applicant even though the request as a whole didn't
      // throw, so success must be judged by whether their score actually
      // came back — not by the overall status string alone.
      const targetApp = formData.applicants.find(a => a.id === applicantId);
      const newScore = targetApp?.type === 'PRIMARY'
        ? data.applicantScore
        : data.coApplicantScores?.find(cs => cs.applicantId === applicantId)?.score;

      if (!newScore) {
        const pullError = data.errors?.find(e => e.applicantId === applicantId);
        toast.error(pullError?.error || 'Bureau score not returned for this applicant.');
        return;
      }

      toast.success('Bureau pull success!');

      const updatedApps = formData.applicants.map(a => {
        if (a.id !== applicantId) return a;
        return { ...a, bureau_fetched: true, cibil_score: newScore };
      });
      setFormData(prev => ({ ...prev, applicants: updatedApps }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bureau fetch failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    // a.bureau_fetched is now sourced correctly (see restoredApplicants /
    // handleRunBureau above) — it only reflects an actual successful score
    // fetch, not merely an attempted or partially-failed one.
    const anyBureauReady = formData.applicants.some(a => a.bureau_fetched || !!a.cibil_score);

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

  // Everything the customer can actually fill in BEFORE consent exists —
  // gates the Request Consent button itself. business_name/dob are
  // deliberately excluded: they're read-only, auto-fetched by PAN
  // verification, which itself only auto-fires once mobile_verified flips
  // true (see the panAutoVerifyAttempted-style effect for this page) —
  // requiring business_name here used to create an unbreakable deadlock
  // where consent could never be requested because business_name didn't
  // exist yet, and business_name could never exist because consent hadn't
  // been requested yet. Mirrors AddCustomerWizardPage's identical fix
  // (step1ConsentFieldsValid/step1BusinessFieldsValid).
  const step1ConsentFieldsValid = !!formData.business_pan
    && !!formData.business_mobile
    && !!formData.business_email
    && !!formData.pincode;
  // Everything above, PLUS business_name — by the time this is checked
  // (once consent is granted), PAN auto-verify has already run and filled
  // it in, so this only ever gates the *next* step (Save & Next), never
  // Request Consent.
  const step1FieldsValid = step1ConsentFieldsValid && !!formData.business_name;
  const step1Valid = step1FieldsValid && !!formData.mobile_verified;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><LoadingSpinner size={40} /></div>;

  return (
    <div className="wizard-page hide-scrollbar" style={{ height: '100%', overflowY: 'auto', padding: isMobile ? '84px 16px 24px' : '24px 20px' }}>
      <style>{`
        .wizard-page .card,
        .wizard-page .btn,
        .wizard-page .form-control,
        .wizard-page .modal-box,
        .wizard-page .notice {
          border-radius: 0 !important;
        }
        /* Dark mode: the shared grey text tokens read too low-contrast on
           this data-heavy page — bump them to white here specifically,
           without touching the global theme. */
        :root.dark .wizard-page {
          --text-secondary: #ffffff;
          --text-tertiary: #ffffff;
        }
        /* Light mode: same low-contrast grey complaint — use black instead. */
        :root:not(.dark) .wizard-page {
          --text-secondary: #000000;
          --text-tertiary: #000000;
        }
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Responsive form grids — mobile-first collapse of fixed columns */
        .wizard-page .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .wizard-page .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
        @media (max-width: 900px) {
          .wizard-page .grid-3 { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 640px) {
          .wizard-page .grid-2, .wizard-page .grid-3 { grid-template-columns: 1fr; gap: 16px; }
          .wizard-page .modal-box { padding: 24px 16px !important; }
          .wizard-page .card > div { padding: 14px 12px !important; }
          .wizard-page .coapp-box { padding: 14px 12px !important; }
          .wizard-page .wizard-footer-actions { flex-direction: column; align-items: stretch; }
          .wizard-page .wizard-footer-actions .btn { width: 100%; justify-content: center; }
        }
        @media (max-width: 400px) {
          .wizard-page { padding-left: 10px !important; padding-right: 10px !important; }
        }
      `}</style>
      <div style={{ maxWidth: WIZARD_MAX_WIDTH, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {caseId ? (formData.business_name ? toTitleCase(formData.business_name) : 'Resume Salaried Case') : 'Add Salaried Customer'}
          </h1>
        </div>
        {caseId && (
          <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} /> Auto-saved
          </div>
        )}
      </div>

      <CaseWizardStepper
        currentStep={currentStep}
        caseId={caseId}
        steps={SALARIED_ORIGIN_STEPS}
        onStepClick={(step) => {
          // This page only ever renders content for its own steps 1-3 —
          // steps 4-7 (Income Summary onward) live on AddCustomerWizardPage,
          // same handoff used after completing step 3 normally.
          if (step <= 3) setCurrentStep(step);
          else navigate(`/customers/add?caseId=${caseId}&step=${step}`);
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Step 1 sub-navigation — Personal Details / Co-Applicants, both still "Step 1" */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep1SubPage('business')}
                className={`btn btn-sm ${step1SubPage === 'business' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: '1 1 180px', fontWeight: 600 }}
              >
                1. Personal Details
              </button>
              <button
                type="button"
                onClick={() => setStep1SubPage('coapplicants')}
                className={`btn btn-sm ${step1SubPage === 'coapplicants' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: '1 1 180px', fontWeight: 600 }}
              >
                2. Co-Applicants
              </button>
            </div>

            {step1SubPage === 'business' && (
            <>
            {duplicateWarning && !caseId && (
              <div className="notice" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', padding: 20, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 0, background: 'var(--warning-bg)', border: '1px solid var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Search size={22} color="var(--warning)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: 15, color: 'var(--warning)', marginBottom: 2 }}>Existing customer found: {duplicateWarning.name || 'N/A'}</h4>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>PAN {duplicateWarning.pan} is already registered in your tenant. You can reuse the existing data for a new case.</p>
                      </div>
                      <button type="button" onClick={() => navigate(`/customers/${duplicateWarning.id}`)} className="btn btn-secondary btn-sm">View Existing Profile</button>
                    </div>

                    {duplicateWarning.summary && (
                      <div style={{ background: 'var(--bg-elevated)', borderRadius: 0, padding: 12, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', gridColumn: '1/-1', marginBottom: -4 }}>Reusable Data Available:</div>
                        {duplicateWarning.summary?.bureau?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> Bureau Score</div>}
                        {duplicateWarning.summary?.salary_ocr?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> Salary Slip OCR</div>}
                        {duplicateWarning.summary?.bank?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> Bank Statement</div>}
                      </div>
                    )}

                    <button type="button" className="btn btn-primary" onClick={handleContinueAsNewCase} disabled={saving}>
                      {saving ? 'Creating...' : 'Continue as New Case →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Applicant Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Primary Applicant</h3>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Salaried Individual Details</span>
              </div>

              <div style={{ padding: 24 }}>
                <div className="grid-2" style={{ marginBottom: 24 }}>
                  <FormField label="PAN Number" name="business_pan" required disabled={(!!caseId || formData.mobile_verified) && !panEditUnlocked}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={formData.business_pan}
                        onChange={e => setFormData({ ...formData, business_pan: e.target.value.toUpperCase() })}
                        onBlur={() => checkPanDuplicate(formData.business_pan)}
                        className="form-control"
                        placeholder="ABCDE1234F"
                        disabled={(!!caseId || formData.mobile_verified) && !panEditUnlocked}
                        style={{ textTransform: 'uppercase' }}
                      />
                      {formData.pan_verified ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> Verified
                          </span>
                          {/* A mistyped PAN must be correctable, not permanently
                              locked once a case exists — same "Edit" affordance
                              the mobile field already has. */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setPanEditUnlocked(true); setFormData(prev => ({ ...prev, pan_verified: false })); }}
                            title="Edit PAN number"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                        </div>
                      ) : panVerifying ? (
                        <PullingIndicator label="Verifying PAN…" />
                      ) : panVerifyFailed ? (
                        <span style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={13} /> PAN verification failed — fix and re-enter
                        </span>
                      ) : formData.mobile_verified ? (
                        // Reachable the instant the customer approves the
                        // consent request sent from the Mobile Number field
                        // below (mobile_verified is now set on consent
                        // grant) — the panAutoVerifyAttempted effect fires
                        // Verify PAN automatically from here, same as
                        // AddCustomerWizardPage's primary PAN auto-verify.
                        // No manual click needed (and none was ever safe
                        // before consent was granted, since that would pull
                        // the applicant's real name/DOB before they'd
                        // consented to it).
                        !isBulkInjectedCase && <PullingIndicator label="Queued…" />
                      ) : null}
                    </div>
                  </FormField>

                  <FormField label="Mobile Number" name="business_mobile" required disabled={formData.mobile_verified}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                      {formData.mobile_verified && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600, padding: '0 10px', whiteSpace: 'nowrap' }}>
                            <CheckCircle2 size={18} /> Verified
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setFormData({ ...formData, mobile_verified: false }); setConsentRequest(null); }}
                            title="Edit mobile number (you'll need to request consent again)"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </FormField>
                </div>

                <div className="grid-2">
                  <FormField label="Email Address" name="business_email" required>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        type="email"
                        value={formData.business_email}
                        onChange={e => setFormData({ ...formData, business_email: e.target.value })}
                        className="form-control"
                        placeholder="arjun@example.com"
                        style={{ flex: 1, minWidth: 160 }}
                      />
                      {/* The actual Request Consent action (and its
                          sending/waiting/resend states) now lives in this
                          sub-page's footer, in the same slot the Save & Next
                          button occupies once consent is granted — this
                          field just mirrors the end result once it lands. */}
                      {formData.mobile_verified && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600, padding: '0 10px', whiteSpace: 'nowrap' }}>
                          <CheckCircle2 size={18} /> Consented
                        </div>
                      )}
                    </div>
                  </FormField>

                  <FormField label="Pincode" name="pincode" required>
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

                {/* Hidden until consent is actually granted — before that,
                    business_name/dob are always empty (they're only ever
                    auto-fetched by PAN verification, which itself only
                    fires once mobile_verified flips true), so showing two
                    permanently-blank "Autofetched via PAN" fields up front
                    was just noise. Reusing index.css's existing slideUp
                    keyframe for the reveal keeps this consistent with the
                    rest of the app rather than introducing a new animation. */}
                {formData.mobile_verified && (
                  <div className="grid-2" style={{ marginTop: 24, animation: 'slideUp 0.35s ease' }}>
                    <FormField label="Full Name (As Per PAN)" name="business_name" disabled>
                      <input type="text" value={formData.business_name} onChange={e => setFormData({ ...formData, business_name: e.target.value })} className="form-control" placeholder="Autofetched via PAN" disabled />
                    </FormField>

                    {/* Never user-editable — always auto-fetched by PAN
                        verification by the time this is visible at all — so
                        a plain read-only text field (not a date-picker,
                        which implies an editable value) showing a
                        human-formatted date. */}
                    <FormField label="Date Of Birth" name="dob" disabled>
                      <input
                        type="text"
                        value={formData.dob ? formatDate(formData.dob) : ''}
                        className="form-control"
                        placeholder="Autofetched via PAN"
                        disabled
                        readOnly
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </div>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              {!formData.mobile_verified ? (
                consentRequesting ? (
                  <button type="button" disabled className="btn btn-primary btn-lg">Sending…</button>
                ) : consentRequest ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <PullingIndicator label="Waiting for customer to approve consent…" />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleRequestConsent} title="Resend the consent SMS">Resend</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestConsent}
                    disabled={saving || !step1ConsentFieldsValid || walletBalance < costs.PAN_FETCH}
                    className="btn btn-primary btn-lg"
                    title={!step1ConsentFieldsValid ? 'Complete every required field above before requesting consent' : walletBalance < costs.PAN_FETCH ? `Insufficient credits. Wallet: ${walletBalance}, Required: ${costs.PAN_FETCH}.` : undefined}
                  >
                    {`Request Consent (~${costs.PAN_FETCH} Cr)`}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => setStep1SubPage('coapplicants')}
                  disabled={!step1Valid}
                  title={!step1Valid ? 'Complete every required field before continuing' : undefined}
                >
                  Save & Next
                </button>
              )}
            </div>
            </>
            )}

            {step1SubPage === 'coapplicants' && (
            <>
            {/* Co-Applicants Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Co-Applicants</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Add each co-applicant's details. You can specify if they are Salaried or Self-Employed.</p>
                </div>
                <button type="button" onClick={addCoApplicantRow} className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>+ Add Co-Applicant</button>
              </div>

              <div style={{ padding: 24 }}>
                {formData.applicants.filter(a => a.type === 'CO_APPLICANT').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border-strong)', borderRadius: 0, color: 'var(--text-tertiary)' }}>
                    No Co-Applicants appended to this profile yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {formData.applicants.map((app, realIdx) => {
                      if (app.type !== 'CO_APPLICANT') return null;
                      const coApplicantDisplayIdx = formData.applicants.filter((a, i) => a.type === 'CO_APPLICANT' && i < realIdx).length;

                      return (
                        <div key={realIdx} className="coapp-box" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', padding: 24, borderRadius: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Applicant #{coApplicantDisplayIdx + 1}</h4>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeApplicant(realIdx)}>Remove ×</button>
                          </div>

                          <div className="grid-2" style={{ marginBottom: 16 }}>
                            <FormField label="PAN Number" name={`copan_${realIdx}`}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <input type="text" value={app.pan_number || ''} onChange={e => updateApplicantRow(realIdx, 'pan_number', e.target.value.toUpperCase())} className="form-control" style={{ textTransform: 'uppercase', flex: 1, minWidth: 140 }} disabled={app.otp_verified && !coappPanEditUnlockedMap[realIdx]} placeholder="ABCDE1234F" />
                                {app.pan_verified ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                      <CheckCircle2 size={16} /> Verified
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => {
                                        setCoappPanEditUnlockedMap(prev => ({ ...prev, [realIdx]: true }));
                                        updateApplicantRow(realIdx, 'pan_verified', false);
                                      }}
                                      title="Edit PAN number"
                                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <Pencil size={12} /> Edit
                                    </button>
                                  </div>
                                ) : coappPanVerifyingMap[realIdx] ? (
                                  <PullingIndicator label="Verifying PAN…" />
                                ) : app.otp_verified && !isBulkInjectedCase && (app.pan_number || '').length === 10 ? (
                                  // Auto-verified the instant this co-applicant's own
                                  // consent is granted (coappPanAutoVerifyAttempted
                                  // effect) — no manual click needed, same as the
                                  // primary applicant above.
                                  <PullingIndicator label="Queued…" />
                                ) : null}
                              </div>
                            </FormField>
                            <FormField label="Mobile Number" name={`comob_${realIdx}`}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <input type="tel" value={app.mobile || ''} onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  updateApplicantRow(realIdx, 'mobile', val);
                                }} className="form-control" placeholder="9820012345" style={{ flex: 1, minWidth: 140 }} disabled={app.otp_verified} />
                                {app.otp_verified && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 600, padding: '0 8px', whiteSpace: 'nowrap', fontSize: 12 }}>
                                    <CheckCircle2 size={16} /> Verified
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => { updateApplicantRow(realIdx, 'otp_verified', false); setCoappConsent(prev => { const next = { ...prev }; delete next[realIdx]; return next; }); }}
                                      title="Edit mobile number (you'll need to request consent again)"
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}
                                    >
                                      <Pencil size={12} /> Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            </FormField>
                          </div>

                          <div className="grid-3" style={{ marginBottom: 16 }}>
                            <FormField label="Employment Type" name={`coemp_${realIdx}`}>
                              <select className="form-control" value={app.employment_type || 'SALARIED'} onChange={e => updateApplicantRow(realIdx, 'employment_type', e.target.value)}>
                                <option value="SALARIED">Salaried</option>
                                <option value="SELF_EMPLOYED">Self Employed</option>
                                <option value="INCOME_NOT_CONSIDERED">Income not considered</option>
                              </select>
                            </FormField>
                            <FormField label="Pincode" name={`copincode_${realIdx}`} required>
                              <input
                                type="text"
                                value={app.pincode || ''}
                                onChange={e => updateApplicantRow(realIdx, 'pincode', e.target.value)}
                                className="form-control"
                                placeholder="560026"
                                maxLength={6}
                              />
                            </FormField>
                            <FormField label="Email" name={`coemail_${realIdx}`}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <input type="email" value={app.email || ''} onChange={e => updateApplicantRow(realIdx, 'email', e.target.value)} className="form-control" placeholder="name@example.com" style={{ flex: 1, minWidth: 140 }} />
                                {!app.otp_verified ? (
                                  coappConsentRequesting[realIdx] ? (
                                    <button type="button" disabled className="btn btn-primary btn-sm" style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>Sending…</button>
                                  ) : coappConsent[realIdx] ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <PullingIndicator label="Waiting for approval…" />
                                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRequestCoapplicantConsent(realIdx)} title="Resend the consent SMS">Resend</button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleRequestCoapplicantConsent(realIdx)}
                                      style={{ padding: '0 12px', whiteSpace: 'nowrap' }}
                                      disabled={saving || walletBalance < costs.PAN_FETCH}
                                      title={walletBalance < costs.PAN_FETCH ? `Insufficient credits. Wallet: ${walletBalance}, Required: ${costs.PAN_FETCH}.` : undefined}
                                    >
                                      {`Request Consent (~${costs.PAN_FETCH} Cr)`}
                                    </button>
                                  )
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>
                                    <CheckCircle2 size={16} /> Consented
                                  </div>
                                )}
                              </div>
                            </FormField>
                          </div>

                          <div className="grid-2">
                            <FormField label="Full Name" name={`coname_${realIdx}`}>
                              <input type="text" value={app.name || ''} onChange={e => updateApplicantRow(realIdx, 'name', e.target.value)} className="form-control" placeholder="Enter Full Name" />
                            </FormField>
                            <FormField label="Date Of Birth" name={`codob_${realIdx}`}>
                              <input type="date" value={app.dob || ''} onChange={e => updateApplicantRow(realIdx, 'dob', e.target.value)} className="form-control" />
                            </FormField>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep1SubPage('business')}>← Back to Personal Details</button>
              <button className="btn btn-primary btn-lg" type="submit" disabled={saving || !formData.mobile_verified}>
                {saving ? 'Processing...' : 'Save & Next'}
              </button>
            </div>
            </>
            )}
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
                      label={getApplicantDisplayName(app, idx)}
                      status={app.bureau_fetched ? 'COMPLETE' : 'NOT_STARTED'}
                      description={app.type === 'PRIMARY' ? 'Primary Applicant' : 'Co-Applicant'}
                      score={app.cibil_score}
                      onDownload={bureauReports[app.id] ? () => handleDownloadReport(app.id) : null}
                      downloading={downloadingFor === app.id}
                      onStart={() => handleRunBureau(app.id)}
                      loading={saving}
                      cost={costs.BUREAU_PULL + costs.BUREAU_OBLIGATIONS}
                      disabled={isBulkInjectedCase || walletBalance < (costs.BUREAU_PULL + costs.BUREAU_OBLIGATIONS)}
                      disabledTitle={isBulkInjectedCase ? undefined : `Insufficient credits. Wallet: ${walletBalance}, Required: ${costs.BUREAU_PULL + costs.BUREAU_OBLIGATIONS}.`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Salary Slip Upload section */}
            <div className="card">
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={15} /> Salary Slip Upload
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Last 3 months — OCR auto-extracts data</span>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {formData.applicants.filter(a => a.id).map((app, idx) => (
                  <div key={app.id} style={{ borderTop: idx > 0 ? '1px dashed var(--border)' : 'none', paddingTop: idx > 0 ? 12 : 0 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {getApplicantDisplayName(app, idx)}
                      <span style={{ fontWeight: 500, marginLeft: 6, color: 'var(--text-tertiary)' }}>({app.type === 'PRIMARY' ? 'Primary' : 'Co-Applicant'})</span>
                    </h4>

                    <SalarySlipUploader
                      caseId={caseId}
                      applicantId={app.id}
                      applicantName={getApplicantDisplayName(app, idx)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setCurrentStep(1)}>← Back</button>
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={saving || !formData.applicants.some(a => a.bureau_fetched || !!a.cibil_score)}
                title={!formData.applicants.some(a => a.bureau_fetched || !!a.cibil_score) ? 'Complete the bureau pull for at least one applicant before continuing' : undefined}
              >
                {saving ? 'Saving...' : 'Save & Next'}
              </button>
            </div>
          </form>
        )}

        {currentStep === 3 && (
          <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Panel icon={Landmark} accentColor="var(--warning)" title={<>Loan Product &amp; Collateral <span style={{ color: 'var(--error)', fontSize: 12 }}>*</span></>}>
              <div className="grid-3">
                <FormField label="Select Product" name="product_type" required>
                  <select
                    className="form-control"
                    value={formData.product_type}
                    onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                    required
                    style={{ border: formData.product_type ? '2px solid var(--warning)' : undefined, background: formData.product_type ? 'var(--warning-bg)' : undefined, color: formData.product_type ? 'var(--warning)' : undefined, fontWeight: 600 }}
                  >
                    <option value="">— Select a loan product —</option>
                    <option value="HL">HL — Home Loan</option>
                    <option value="LAP">LAP — Loan Against Property</option>
                    <option value="PL">PL — Personal Loan</option>
                  </select>
                </FormField>

                {PROPERTY_REQUIRED.includes(formData.product_type) && (
                  <>
                    <FormField label="Property Type" name="property_type" required>
                      <select className="form-control" value={formData.property_type} onChange={e => setFormData({ ...formData, property_type: e.target.value })} required>
                        <option value="">— Select —</option>
                        <option value="Commercial — Office / Shop">Commercial — Office / Shop</option>
                        <option value="Residential — House / Flat">Residential — House / Flat</option>
                        <option value="Industrial — Factory / Warehouse">Industrial — Factory / Warehouse</option>
                        <option value="Plot / Land">Plot / Land</option>
                      </select>
                    </FormField>
                    <FormField label="Occupancy Status" name="occupancy_status">
                      <select className="form-control" value={formData.occupancy_status} onChange={e => setFormData({ ...formData, occupancy_status: e.target.value })}>
                        <option value="Self Occupied">Self Occupied</option>
                        <option value="Rented Out">Rented Out</option>
                        <option value="Vacant">Vacant</option>
                      </select>
                    </FormField>
                    <FormField label="Ownership" name="ownership_type">
                      <select className="form-control" value={formData.ownership_type} onChange={e => setFormData({ ...formData, ownership_type: e.target.value })}>
                        <option value="Sole Owner">Sole Owner</option>
                        <option value="Joint Owner">Joint Owner</option>
                        <option value="Company Owned">Company Owned</option>
                      </select>
                    </FormField>
                    <div>
                      <FormField label="Market Value (₹)" name="market_value" required>
                        <input type="number" className="form-control" placeholder="e.g. 8500000" value={formData.market_value} onChange={e => setFormData({ ...formData, market_value: e.target.value })} required min="1" />
                      </FormField>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>DSA estimate — lender does independent valuation</div>
                    </div>
                  </>
                )}
              </div>

              {PROPERTY_REQUIRED.includes(formData.product_type) && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--primary-subtle)', borderRadius: 0, fontSize: 12, color: 'var(--primary-dark)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Lightbulb size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Property location, title clearance, full address will be collected after the lender is identified.</span>
                </div>
              )}
            </Panel>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setCurrentStep(2)}>← Back</button>
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={saving || !formData.product_type || (PROPERTY_REQUIRED.includes(formData.product_type) && (!formData.property_type || !formData.market_value))}
              >
                {saving ? 'Saving...' : 'Save & Next'}
              </button>
            </div>
          </form>
        )}
      </div>
      </div>

    </div>
  );
};

export default AddSalariedCustomerWizardPage;
