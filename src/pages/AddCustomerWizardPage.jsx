import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { customerService } from '../api/customerService';
import { caseService } from '../api/caseService';
import { otpService } from '../api/otpService';
import FormField from '../components/ui/FormField';
import OtpInput from '../components/OtpInput';
import { toast } from 'react-hot-toast';
import Skeleton from '../components/ui/Skeleton';
import { Search, CheckCircle2, ChevronRight, Check, AlertCircle, Landmark, SatelliteDish, Clock, Pencil } from 'lucide-react';
import GstAnalyticsForm from '../components/GstAnalyticsForm';
import ItrAnalyticsForm from '../components/ItrAnalyticsForm';
import BankStatementUpload from '../components/BankStatementUpload';
import SalarySlipUploader from '../components/onboarding/SalarySlipUploader';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import CaseWizardStepper, { CASE_WIZARD_STEPS, SALARIED_ORIGIN_STEPS } from '../components/ui/CaseWizardStepper';
import GstPullStatusBanner from '../components/case/GstPullStatusBanner';
import Panel from '../components/ui/Panel';
import PullingIndicator from '../components/ui/PullingIndicator';
import { msmeApi } from '../api/msmeService';
import { WIZARD_MAX_WIDTH } from '../constants/layout';
import { toTitleCase, resolveEntityName, isUsableEntityName } from '../utils/helpers';
import IncomeSummaryStep from './IncomeSummaryPage';
import BureauObligationsStep from './BureauObligationsPage';
import EsrStep from './EsrPage';
import ProposalStep from './ProposalPage';
import MsmeLoanTermsStep from './MsmeLoanTermsStep';



// Customer/Applicant.dob is stored as a Prisma DateTime column (encrypted at
// rest) — reading it back always yields a real Date, which Express's JSON
// serialization turns into a full ISO datetime string like
// "2003-06-29T00:00:00.000Z". A native <input type="date"> only accepts the
// bare "YYYY-MM-DD" form and silently renders blank for anything else — so
// without this, a DOB that was genuinely fetched and saved (verified against
// the DB directly) still shows as empty in the form. Slicing the ISO string
// is timezone-safe here since toISOString() always renders midnight UTC for
// a date-only value, so the calendar date never shifts.
const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const AddCustomerWizardPage = ({ mode = 'DSA' }) => {
  // MSME self-service: the borrower fills the wizard themselves after OTP
  // login + payment. Their mobile is already verified at login, and wallet
  // credits are a DSA concept that doesn't apply to them.
  const isMsme = mode === 'MSME_SELF_SERVICE';
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlCaseId = searchParams.get('caseId');
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  // Step 1 is split into two sub-pages (Business Entity, then Co-Applicants)
  // without affecting the overall wizard step count — CaseWizardStepper still
  // only ever sees currentStep === 1 for both.
  const [step1SubPage, setStep1SubPage] = useState('business');
  // Step 2 is split into three sub-pages (GST, then ITR, then Bank Statements)
  // the same way — currentStep stays 2 for all three.
  const [step2SubPage, setStep2SubPage] = useState('gst');
  const [caseId, setCaseId] = useState(null);
  // Only exists once a proposal has actually been created from step 6 — step
  // 7 (ProposalStep) is unreachable until then, same as the old route-based
  // journey (/cases/:id/proposals/:pid required an id that only ever came
  // from a "create proposal" action).
  const [proposalId, setProposalId] = useState(searchParams.get('proposalId') || null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // All 7 steps live in this one mounted component now — switching steps is
  // always a local state change, never a route navigation, so effects that
  // only run "while mounted" (PAN/GST/bureau auto-fetch) stay alive across
  // the whole journey. The URL's ?step= (and &proposalId=) just mirror
  // whatever step/proposal is current, the same way ?caseId= already does,
  // so a saved/shared link resumes at the right place.
  const goToStep = (step, extra = {}) => {
    setCurrentStep(step);
    const params = new URLSearchParams(location.search);
    params.set('step', String(step));
    if (extra.proposalId) params.set('proposalId', String(extra.proposalId));
    navigate(`?${params.toString()}`, { replace: true });
  };

  const handleProposalCreated = (newProposalId) => {
    setProposalId(newProposalId);
    goToStep(7, { proposalId: newProposalId });
  };

  // MSME self-service customers never create/send a proposal themselves - step
  // 6 lets them pick a bank card, which moves to step 7 (MsmeLoanTermsStep)
  // instead of the DSA's ProposalStep - there they state how much they need
  // before the case goes to the Cred2Tech admin queue for allocation to a DSA
  // (who then creates and sends the actual proposal).
  const [applyLender, setApplyLender] = useState(null);
  const handleApplyForLoan = (lender) => {
    setApplyLender(lender);
    goToStep(7);
  };

  const [formData, setFormData] = useState({
    customer_id: null,
    business_pan: '',
    business_name: '',
    proprietor_name: '',
    dob: '',
    business_mobile: '',
    business_email: '',
    pincode: '',
    is_professional: false,
    profession_type: '',
    mobile_verified: false,
    is_locked: false,
    // True only for cases that originated from the salaried wizard
    // (case.category === 'SALARIED') — drives which stepper labels show.
    is_salaried: false,
    pan_verified: false,
    linked_gstins: [],
    applicants: [],
    product_type: '',
    dsa_notes: '',
    // Property (Step 3)
    property_type: '',
    occupancy_status: 'Self Occupied',
    ownership_type: 'Sole Owner',
    market_value: ''
  });

  const [costs, setCosts] = useState({ GST_FETCH: 0, ITR_ANALYTICS: 0, BANK_ANALYSIS: 0 });
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
     if (isMsme) return; // wallet/credits are DSA-only

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
  }, [isMsme]);

  // A brand-new case (urlCaseId unset) must start completely blank — no
  // prefill from the borrower's login mobile, and none of the synced_*
  // fields pushed in from scheme.cred2tech.com (PAN/DOB/business
  // name/email/pincode via ssoProfileSync). This used to prefill those as a
  // convenience for a customer who'd already onboarded on the sibling app,
  // but it meant a genuinely new case could silently pick up another case's
  // (or the sibling app's) PAN/mobile before the customer had typed
  // anything — every field, including Mobile Number, now requires the
  // customer to type and verify it fresh for each new case. An existing
  // case's restoreSession() below remains authoritative for resumed cases.

  const [panVerifying, setPanVerifying] = useState(false);
  const [panVerifyFailed, setPanVerifyFailed] = useState(false);
  const [gstFetching, setGstFetching] = useState(false);
  const [gstFetchFailed, setGstFetchFailed] = useState(false);
  const [coappPanVerifyingMap, setCoappPanVerifyingMap] = useState({});
  const [bureauLoadingMap, setBureauLoadingMap] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [suggestedCoApplicants, setSuggestedCoApplicants] = useState([]);

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

  // Steps 1-3 in this component are the self-employed Business Entity / GST
  // / ITR / Bank flow — a salaried-origin case never had that data and must
  // not render it (or trigger its auto-verify/auto-fetch effects) just
  // because the stepper's steps 1-3 are shown/clickable for context. Bounce
  // back to the salaried wizard, which owns that content, instead.
  useEffect(() => {
    if (formData.is_salaried && caseId && currentStep <= 3) {
      navigate(`/customers/salaried/add?caseId=${caseId}`, { replace: true });
    }
  }, [formData.is_salaried, caseId, currentStep, navigate]);

  const restoreSession = async (preserveStep = false) => {
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

      // A purged case's data must never be loaded into this fully-editable
      // form — the backend already rejects the mutating calls this wizard
      // makes (see Cred2Tech/backend's requireCaseAccess middleware /
      // casePurgeGuard.js), but that alone would surface as a confusing
      // mid-edit error on whichever step the user reaches first. Redirect
      // to the case's own read-only detail page instead, which already
      // shows the purge banner + "Create New Case" CTA.
      if (caseData.data_purged_at) {
        toast.error("This case's data has been permanently purged and can no longer be edited.");
        navigate(isMsme ? `/msme/cases/${targetCaseId}` : `/cases/${targetCaseId}`, { replace: true });
        setLoading(false);
        return;
      }

      // Primary source of truth for PAN verification is the primary
      // applicant's own `pan_verified` flag — but that flag is per-CASE
      // (a fresh Applicant row per case), while a CustomerPanProfile is
      // per-CUSTOMER. A customer with a second case for the same PAN (e.g.
      // via "New Case") has a brand-new, never-verified applicant row even
      // though the PAN/GST data is already known — without this, every
      // reopen of that second case silently re-ran PAN verify + GST fetch
      // (backend-cached, so no real re-cost/re-pull, but still two
      // redundant "success" toasts and network round-trips every time).
      // Exception: if THIS case has its own PAN_RESET activity log entry,
      // an admin deliberately forced re-verification for it — a stale
      // cached profile for the same PAN must not silently satisfy that
      // until a fresh /external/pan/verify actually succeeds again (which
      // flips primaryApp.pan_verified back to true directly, independent
      // of this check).
      const primaryApp = caseData.applicants?.find(a => a.type === 'PRIMARY');
      const matchingPanProfile = caseData.customer?.pan_profiles?.find(p => p.pan === caseData.customer.business_pan) || null;
      const wasResetOnThisCase = caseData.activity_logs?.some(l => l.activity_type === 'PAN_RESET');
      const panVerifiedNow = !!primaryApp?.pan_verified || (!!matchingPanProfile && !wasResetOnThisCase);
      const currentPanProfile = panVerifiedNow ? matchingPanProfile : null;

      setCaseId(caseData.id);
      setFormData({
        customer_id: caseData.customer?.id,
        // Classification lives on the Case itself, not the Customer — the
        // same PAN/customer can have one salaried case and one MSME case at
        // the same time without either affecting the other.
        is_salaried: caseData.category === 'SALARIED',
        business_pan: caseData.customer?.business_pan || '',
        // proprietor_name is a plain user-entered/KYC identity field; business_name
        // is derived from GST vendor lookups and can end up holding a GST
        // registration TRN (reference number) when the business never registered
        // a real trade name yet - prefer the reliable identity field first, same
        // as the case header / MSME dashboard greeting already do.
        business_name: toTitleCase(resolveEntityName(caseData.customer)) || '',
        proprietor_name: caseData.customer?.proprietor_name || '',
        dob: toDateInputValue(caseData.customer?.dob),
        business_mobile: caseData.customer?.business_mobile || '',
        business_email: caseData.customer?.business_email || '',
        // Falls back to the verified PAN's own KYC pincode (principal_pincode)
        // when the applicant row itself was never manually filled in - the
        // salaried wizard already does this (see AddSalariedCustomerWizardPage);
        // this page was missing it, so a case with PAN/GST verified but no
        // manually-typed pincode rendered the field blank even though the
        // case has a usable pincode on file.
        pincode: primaryApp?.pincode || currentPanProfile?.principal_pincode || '',
        is_professional: caseData.customer?.is_professional || false,
        profession_type: caseData.customer?.profession_type || '',
        // Trust the persisted flag for MSME too now — the backend seeds it
        // true at customer creation from the login-verified mobile, and
        // flips it true again via the same OTP flow DSA uses if the
        // customer edits the number away from that default (see
        // customer.service.js createOrAttachCustomer and otp.service.js
        // verifyOtp). Forcing this to always read true regardless of the DB
        // value used to be how MSME mobile edits were silently allowed to
        // reach the backend unverified.
        mobile_verified: caseData.customer?.mobile_verified || false,
        is_locked: !!caseData.is_locked,
        pan_verified: panVerifiedNow,
        pan_profile: currentPanProfile,
        linked_gstins: currentPanProfile?.gstin_records || [],
        applicants: (caseData.applicants || []).map(a => ({ ...a, dob: toDateInputValue(a.dob) })),
        product_type: caseData.product_type || '',
        dsa_notes: caseData.dsa_notes || '',
        property_type: caseData.property?.property_type || '',
        occupancy_status: caseData.property?.occupancy_status || 'Self Occupied',
        ownership_type: caseData.property?.ownership_type || 'Sole Owner',
        market_value: caseData.property?.market_value || '',
        // Not gated on panVerifiedNow (unlike pan_profile above) — a
        // completed GST pull stays valid data even if the PAN was reset
        // afterwards, so it must keep showing as done rather than
        // resurrecting the "empty state next to a completed pull"
        // contradiction this was part of.
        gst_completed: caseData.data_pull_status?.gst_status === 'COMPLETE',
        itr_completed: caseData.data_pull_status?.itr_status === 'COMPLETE',
        // NOTE: the backend strips `customer.itr_analytics` / `customer.bank_statements`
        // (see case.service.js getCaseById) and relocates the latest record to
        // `business_financials.*` — reading the old path here always returned null,
        // which is why these showed "Pending" forever even after completion.
        customer_itr_profile: caseData.business_financials?.itr_analytics || null,
        customer_bank_profile: caseData.business_financials?.bank_statements || null
      });
      setSuggestedCoApplicants(caseData.suggested_co_applicants || []);

      // Only dispatch to a step on initial load. Callers re-syncing data
      // mid-edit (PAN reset, applicant reuse/removal) pass preserveStep=true
      // so the user isn't yanked away from the step they're actively on.
      if (!preserveStep) {
        // A URL with ?step= (a saved/shared link, or returning from a full
        // reload) resumes at that exact step. Otherwise always start at step
        // 1 - do NOT guess a "further along" step from data already present
        // (e.g. an applicant existing as soon as PAN is verified), since that
        // silently skipped the user past step 1 without them clicking Next.
        const stepParam = parseInt(searchParams.get('step'), 10);
        setCurrentStep(stepParam >= 1 && stepParam <= 7 ? stepParam : 1);
        const pid = searchParams.get('proposalId');
        if (pid) setProposalId(pid);
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
      business_email: formData.business_email,
      dob: formData.dob,
      is_professional: formData.is_professional === 'true' || formData.is_professional === true,
      profession_type: (formData.is_professional === 'true' || formData.is_professional === true) ? formData.profession_type : null
    });
    targetCustomerId = customer.id;

    // Callers that need the applicant list right after this call (e.g.
    // handleStep1Submit, to save the pincode onto the PRIMARY applicant)
    // can't rely on formData.applicants — when a case is newly created
    // below, the setFormData() call is async, so formData.applicants in
    // the caller's own closure is still the stale (pre-creation) value on
    // the very next line. Returning the up-to-date list here instead of
    // making the caller re-read formData avoids that stale-closure trap.
    let targetApplicants = formData.applicants;

    if (!targetCaseId) {
      const newCase = await caseService.createCase(customer.id);
      targetCaseId = newCase.id;
      // Keep any co-applicant rows the user already added on the
      // coapplicants sub-page (those exist only in formData.applicants
      // until saved) - a brand-new case can't have a PRIMARY in there yet,
      // so this is purely additive, not a dedupe.
      targetApplicants = [
        ...(newCase.applicants || []),
        ...formData.applicants.filter(a => a.type !== 'PRIMARY')
      ];

      setCaseId(targetCaseId);
      setFormData(prev => ({
        ...prev,
        customer_id: targetCustomerId,
        applicants: targetApplicants // Sync the newly created PRIMARY applicant
      }));
      navigate(`?caseId=${targetCaseId}`, { replace: true });
      localStorage.setItem('draftCaseId', targetCaseId);
    }

    return { targetCaseId, targetCustomerId, targetApplicants };
  };

  const handleVerifyPan = async (isCoapplicant = false, idx = null) => {
    // Prevent React onClick passing the synthetic event object as the first parameter
    if (typeof isCoapplicant === 'object') {
        isCoapplicant = false;
        idx = null;
    }

    const pan = isCoapplicant ? formData.applicants[idx]?.pan_number : formData.business_pan;
    if (!pan || pan.length < 10) return toast.error('Valid PAN required');

    if (isCoapplicant) setCoappPanVerifyingMap(prev => ({ ...prev, [idx]: true }));
    else { setPanVerifying(true); setPanVerifyFailed(false); }

    try {
      // Always persist the current PAN before verifying it — not just for a
      // brand-new case/applicant. Verifying only *checks* the value passed
      // in this request; for an already-verified record being corrected
      // (the whole point of the Edit button), the freshly-typed PAN was
      // still sitting in local state only. Without saving it first, a
      // successful re-verification never actually reached the database —
      // the old, wrong PAN stayed on file even though the UI showed
      // "Verified" again.
      const draft = await ensureDraftSaved();
      const targetCaseId = draft.targetCaseId;
      const targetCustomerId = draft.targetCustomerId;

      let applicantId = isCoapplicant ? formData.applicants[idx]?.id : null;
      if (isCoapplicant) {
        const savedApp = await caseService.addApplicant(targetCaseId, formData.applicants[idx]);
        applicantId = savedApp.id;
        const list = [...formData.applicants];
        list[idx] = savedApp;
        setFormData(prev => ({ ...prev, applicants: list }));
      }

      const res = await api.post(`/external/pan/verify`, {
        pan,
        customer_id: targetCustomerId,
        case_id: targetCaseId,
        is_coapplicant: isCoapplicant,
        applicant_id: applicantId
      });
      const data = res.data;

      const entityName = data.name || '';
      const entityDob = toDateInputValue(data.dob);

      if (isCoapplicant) {
        const list = [...formData.applicants];
        list[idx] = {
          ...list[idx],
          id: applicantId,
          name: entityName && !list[idx].name ? entityName : list[idx].name,
          dob: entityDob || list[idx].dob,
          pan_verified: true,
        };
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

    } catch(err) {
      const errMsg = err.response?.data?.error_message || err.response?.data?.error || err.message || 'Failed to verify PAN';
      toast.error(errMsg);
      if (!isCoapplicant) setPanVerifyFailed(true);
    } finally {
      if (isCoapplicant) setCoappPanVerifyingMap(prev => ({ ...prev, [idx]: false }));
      else setPanVerifying(false);
    }
  };

  // MSME self-service only — the business email in this form IS the logged-
  // in customer's own contact email (unlike DSA mode, where this same field
  // belongs to a customer the DSA is entering on someone else's behalf).
  // Synced on blur, not every keystroke, so /msme/profile stops showing the
  // OTP-registration placeholder ({mobile}@direct.cred2tech.local) forever
  // once the customer actually types a real one here — the endpoint that
  // used to do this (updateBusinessDetails) is dead code the wizard never
  // calls, so nothing was ever syncing it back to the User record.
  const handleBusinessEmailBlur = async () => {
    if (!isMsme) return;
    const email = formData.business_email?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    try {
      await msmeApi.updateProfile({ email });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update your account email');
    }
  };

  const handleFetchGst = async () => {
    if (!formData.business_pan || formData.business_pan.length < 10) return toast.error('Valid PAN required');
    if (!formData.customer_id || !caseId) return toast.error('Please verify PAN first to generate a case');

    try {
      setGstFetching(true);
      setGstFetchFailed(false);
      const res = await api.post(`/external/pan/fetch`, {
        pan: formData.business_pan,
        customer_id: formData.customer_id,
        case_id: caseId
      });
      const data = res.data;

      setFormData(prev => ({ ...prev, pan_profile: data, linked_gstins: data.gst_records || [] }));
      toast.success('GST Records Fetched Successfully!');
    } catch (err) {
      const errMsg = err.response?.data?.error_message || err.response?.data?.error || err.message || 'Failed to fetch GST';
      toast.error(errMsg);
      setGstFetchFailed(true);
    } finally {
      setGstFetching(false);
    }
  };

  // Auto-verify the primary business PAN once it's a full 10 characters —
  // no manual "Verify PAN" click needed. Also waits for Mobile Number, since
  // ensureDraftSaved() (called internally to create the draft case) requires
  // both PAN and Mobile — firing on PAN alone would show a premature error
  // if Mobile hasn't been filled in yet. Guarded by a ref (not formData) so
  // a failed attempt doesn't retry in a tight loop; re-editing the PAN value
  // clears the guard and allows a fresh attempt.
  const panAutoVerifyAttempted = useRef(null);
  useEffect(() => {
    // Steps 4-7 render inline in this same component now, but this
    // auto-progression only makes sense while actually on steps 1-3 —
    // data collection is already complete by the time a case reaches step
    // 4+, so this must not re-fire just because the wizard remounts/deep
    // links straight into a later step (it did, live, before this guard).
    // Salaried-origin cases never have real steps 1-3 here at all (that
    // content belongs to AddSalariedCustomerWizardPage) — the redirect
    // effect above bounces them away, but skip here too in case that
    // hasn't landed yet on this render.
    if (currentStep > 3 || formData.is_salaried) return;
    const pan = formData.business_pan;
    // Mobile must be a genuine 10-digit number, not just non-empty — this
    // gate fires ensureDraftSaved()/createCase(), which snapshots
    // formData.business_mobile onto the new Applicant row right then. A
    // truthy-only check let this fire on the very first digit typed (e.g.
    // mobile "8"), permanently baking a 1-digit mobile onto the applicant —
    // later edits to the field only ever update Customer.business_mobile,
    // never that already-created Applicant row, so bureau/obligation pulls
    // silently kept failing against an invalid mobile number forever after.
    const ready = pan && pan.length === 10 && formData.business_mobile.length === 10;
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
  }, [currentStep, formData.business_pan, formData.business_mobile, formData.pan_verified, panVerifying, formData.is_salaried]);

  // Auto-fetch GST records right after PAN verification succeeds — no manual
  // "Fetch GST" click needed. Same guard pattern as above.
  //
  // handleFetchGst() itself requires caseId + formData.customer_id and bails
  // out silently (just a toast) without them — but pan_verified can flip true
  // in the same render pass where ensureDraftSaved()'s caseId/customer_id
  // updates are still landing, so this effect could previously fire one
  // render before those were actually set. Since the "attempted" guard was
  // marked *before* that fetch, it would never retry — visibly it just looked
  // like "GST never showed up" until the whole page (and this ref) reloaded.
  // Gating readiness on caseId/customer_id too means the effect simply waits
  // for the next render instead of burning its one attempt early.
  const gstAutoFetchAttempted = useRef(null);
  useEffect(() => {
    // GST is a self-employed/business concept — never applicable to a
    // salaried-origin case, even if its PAN happens to be verified.
    if (currentStep > 3 || formData.is_salaried) return;
    const pan = formData.business_pan;
    if (
      formData.pan_verified &&
      pan &&
      !formData.pan_profile &&
      !gstFetching &&
      caseId &&
      formData.customer_id &&
      gstAutoFetchAttempted.current !== pan
    ) {
      gstAutoFetchAttempted.current = pan;
      handleFetchGst();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, formData.pan_verified, formData.pan_profile, gstFetching, formData.business_pan, caseId, formData.customer_id, formData.is_salaried]);

  // Auto-verify each co-applicant's PAN once it's a full 10 characters — same
  // no-manual-click pattern as the primary PAN above, guarded per-index so a
  // failed attempt doesn't retry in a tight loop.
  const coappPanAutoVerifyAttempted = useRef({});
  useEffect(() => {
    if (currentStep > 3) return;
    formData.applicants.forEach((app, idx) => {
      if (app.type !== 'CO_APPLICANT') return;
      const pan = app.pan_number;
      if (
        pan && pan.length === 10 &&
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

  const checkPanDuplicate = async (pan) => {
    // Tenant-wide duplicate lookup is a DSA workflow; MSME borrowers must not
    // query (or be shown) other customers' records.
    if (isMsme) return;
    if (!pan || pan.length !== 10) return;
    try {
      const res = await api.get('/customers/check-existing-by-pan', { params: { pan } });
      if (res.data?.existingCustomerFound && res.data.customer?.id) {
        setDuplicateWarning({
          id: res.data.customer.id,
          name: res.data.customer.business_name,
          pan: res.data.customer.business_pan,
          mobile: res.data.customer.business_mobile,
          summary: res.data.reusable_summary
        });
      } else {
        setDuplicateWarning(null);
      }
    } catch (err) {
      if (err.response?.status === 404) setDuplicateWarning(null);
      else console.error('[PAN duplicate check]', err);
    }
  };

  const handleContinueAsNewCase = async () => {
    if (!duplicateWarning) return;
    try {
      setSaving(true);
      const res = await api.post('/cases/create-from-existing', { customer_id: duplicateWarning.id });
      const newCaseId = res.data.id;
      toast.success('New case created with existing customer data!');
      setDuplicateWarning(null);
      navigate(`/customers/add?caseId=${newCaseId}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create new case from existing customer.');
    } finally {
      setSaving(false);
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
      applicants: [...prev.applicants, { type: 'CO_APPLICANT', pan_number: '', name: '', mobile: '', email: '', pincode: '', employment_type: 'SELF_EMPLOYED', otp_verified: false, pan_verified: false }]
    }));
  };

  const updateApplicantRow = (idx, field, val) => {
    const list = [...formData.applicants];
    list[idx] = { ...list[idx], [field]: val };
    setFormData(prev => ({...prev, applicants: list}));
  };

  const removeApplicant = async (index) => {
    const app = formData.applicants[index];
    if (!app) {
      // Defensive: an out-of-sync index would otherwise throw here silently
      // (uncaught inside a React event handler just logs to console — the
      // button visibly does nothing, which is exactly the "dummy button"
      // symptom reported for this control).
      toast.error('Could not find that applicant — please refresh and try again.');
      return;
    }
    if (app.id) {
      if (!window.confirm('Are you sure you want to remove this applicant from the current case?')) return;
      try {
        setSaving(true);
        await caseService.removeApplicant(caseId, app.id);
        toast.success('Applicant removed from case.');
        await restoreSession(true);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to remove applicant');
      } finally {
        setSaving(false);
      }
    } else {
      const arr = [...formData.applicants];
      arr.splice(index, 1);
      setFormData(prev => ({ ...prev, applicants: arr }));
      toast.success('Co-applicant removed.');
    }
  };

  const handleReuseApplicant = async (sourceAppId) => {
    try {
      setSaving(true);
      await caseService.reuseApplicant(caseId, sourceAppId);
      toast.success('Applicant added from past case successfully!');
      await restoreSession(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reuse applicant');
    } finally {
      setSaving(false);
    }
  };

  const goToCoApplicants = () => {
    if (!formData.business_pan) return toast.error("Business PAN is required.");
    if (!formData.mobile_verified) return toast.error("Primary Business Mobile must be verified before proceeding.");
    setStep1SubPage('coapplicants');
  };

  // Pincode (and every other field on this sub-page) otherwise only reaches
  // the backend via handleStep1Submit, which fires solely from the Step 1
  // form's own "Continue" button. CaseWizardStepper's onStepClick lets a
  // user jump straight to any already-unlocked step (any step, once a case
  // exists — see isStepUnlocked there), bypassing that submit entirely, so
  // a pincode typed and then left via the stepper was silently never saved.
  // Persisting on blur closes that gap without needing to touch the
  // stepper's own free-navigation behavior.
  const handlePincodeBlur = async () => {
    if (!caseId) return; // no case yet - handleStep1Submit will persist it once one exists
    const primaryApp = formData.applicants.find(a => a.type === 'PRIMARY');
    if (!primaryApp?.id || primaryApp.pincode === formData.pincode) return;
    try {
      const savedApp = await caseService.addApplicant(caseId, { ...primaryApp, pincode: formData.pincode, dob: primaryApp.dob || formData.dob });
      setFormData(prev => ({
        ...prev,
        applicants: prev.applicants.map(a => a.type === 'PRIMARY' ? savedApp : a)
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save pincode');
    }
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!formData.business_pan) return toast.error("Business PAN is required.");
    if (!formData.mobile_verified) return toast.error("Primary Business Mobile must be verified before proceeding.");
    // Bureau/credit checks need PAN + DOB together for every applicant - PAN
    // alone isn't enough for the vendor to match a record, which otherwise
    // only surfaces later as a confusing "no obligations found" bureau error.
    if (!formData.dob) return toast.error("Date of Birth / Incorporation is required.");
    const coApplicantMissingDob = formData.applicants.find(a => a.type === 'CO_APPLICANT' && a.pan_number && !a.dob);
    if (coApplicantMissingDob) return toast.error(`Date of Birth is required for co-applicant ${coApplicantMissingDob.name || coApplicantMissingDob.pan_number}.`);

    try {
      setSaving(true);
      // Use the applicants list handed back by ensureDraftSaved(), not
      // formData.applicants directly - for a brand-new case that list was
      // just created inside ensureDraftSaved() and formData.applicants
      // here would still be the stale pre-creation value (see comment
      // there), silently skipping this entire loop and dropping the
      // pincode the user just typed.
      const { targetCaseId, targetApplicants } = await ensureDraftSaved();

      const savedApps = [];
      for (let app of targetApplicants) {
        if (app.pan_number) {
          if (app.type === 'PRIMARY') {
            // formData.dob is the customer-level DOB captured from PAN
            // verification - it never otherwise reaches the primary
            // Applicant row, which is what the bureau/credit check actually
            // reads. Without this, the bureau vendor gets a null DOB and
            // silently returns "no obligations found" for a real applicant.
            //
            // formData.business_pan (Customer-level) and this applicant
            // row's own pan_number are two independently-tracked fields
            // that only start out in sync — copied once at case-creation
            // time, never kept in lockstep afterwards. Reconciling them
            // here on every submit is what actually makes editing the PAN
            // field take effect on the primary applicant's identity (and
            // not just the customer record) — addApplicant's own
            // identity-changed check then resets pan_verified correctly.
            app = { ...app, pincode: formData.pincode, dob: app.dob || formData.dob, pan_number: formData.business_pan || app.pan_number };
          }
          const savedApp = await caseService.addApplicant(targetCaseId, app);
          savedApps.push(savedApp);
        }
      }
      setFormData(prev => ({ ...prev, applicants: savedApps }));

      goToStep(2);
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
      
      setFormData(prev => ({...prev, gst_completed: true }));
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
    if (bureauLoadingMap[applicantId]) return; // prevent double-click race
    try {
      setBureauLoadingMap(prev => ({ ...prev, [applicantId]: true }));
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

      // Update local state to reflect bureau_fetched and the new score
      const updatedApps = formData.applicants.map(a => {
        if (a.id === applicantId) {
          const newScore = a.type === 'PRIMARY' ? data.applicantScore : data.coApplicantScores?.find(cs => cs.applicantId === a.id)?.score;
          return { ...a, bureau_fetched: true, cibil_score: newScore || a.cibil_score };
        }
        return a;
      });
      setFormData(prev => ({ ...prev, applicants: updatedApps }));
    } catch(err) {
      toast.error(err.response?.data?.error || "Bureau fetch failed");
    } finally {
      setBureauLoadingMap(prev => ({ ...prev, [applicantId]: false }));
    }
  };

  // Auto-fetch bureau for any eligible applicant not already fetched — no manual
  // "Run Bureau" click needed. Guarded by a per-applicant "attempted" ref so a
  // failed pull doesn't retry forever on every re-render.
  const bureauAutoAttempted = useRef(new Set());
  useEffect(() => {
    formData.applicants.forEach((app) => {
      const eligible = app.otp_verified || (app.type === 'PRIMARY' && formData.mobile_verified);
      if (
        app.id &&
        eligible &&
        !app.bureau_fetched &&
        !bureauLoadingMap[app.id] &&
        !bureauAutoAttempted.current.has(app.id)
      ) {
        bureauAutoAttempted.current.add(app.id);
        handleRunBureau(app.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.applicants, formData.mobile_verified]);

  const handleStep2Submit = async (e) => { e.preventDefault(); goToStep(3); };

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
        dsa_notes: formData.dsa_notes || null,
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
      // Steps 4-7 render inline in this same component now (no more
      // /cases/:id/* routes to navigate to) — the full reload this used to
      // do for MSME existed only to rehydrate the main AuthProvider before
      // crossing into that separate, main-ProtectedRoute-gated route tree.
      // Since that crossing no longer happens, a plain step change is safe
      // for both MSME and DSA.
      goToStep(4);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save product details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: isMobile ? '84px 16px 24px' : '24px 20px' }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton width={160} height={16} />
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: isMobile ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 24 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton width={100} height={10} style={{ marginBottom: 8 }} />
                  <Skeleton height={38} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton width={140} height={16} />
          </div>
          <div style={{ padding: 24 }}>
            <Skeleton height={90} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-page hide-scrollbar" style={{ height: '100%', overflowY: 'auto', padding: (isMobile && !isMsme) ? '84px 16px 24px' : isMobile ? '24px 16px' : '24px 20px' }}>
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
          /* Cards eat too much of the already-narrow phone viewport with their
             desktop-tuned 24px padding — tighten header/body padding so the
             form fields inside actually have room to breathe. */
          .wizard-page .card > div { padding: 14px 12px !important; }
          .wizard-page .coapp-box { padding: 14px 12px !important; }
          /* Footer nav buttons (Back / Next / Continue) — side-by-side with
             space-between breaks down at phone widths since both labels are
             long; stack them full-width instead. */
          .wizard-page .wizard-footer-actions { flex-direction: column; align-items: stretch; }
          .wizard-page .wizard-footer-actions .btn { width: 100%; justify-content: center; }
        }
        @media (max-width: 400px) {
          .wizard-page { padding-left: 10px !important; padding-right: 10px !important; }
        }
      `}</style>
      {/* Every step shares one centered column (see WIZARD_MAX_WIDTH), so the
          stepper, header and content keep identical gutters from step 1 to 7. */}
      <div style={{ maxWidth: WIZARD_MAX_WIDTH, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {caseId ? ((formData.proprietor_name || formData.business_name) ? toTitleCase(formData.proprietor_name || formData.business_name) : "Resume Draft Case") : "Add New Customer / New Case"}
          </h1>
        </div>
        {caseId && (
          <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} /> Auto-saved
          </div>
        )}
      </div>

      {/* Stepper — all 7 steps of the case journey render inline in this
          single component now, so jumping steps is always just goToStep. */}
      <CaseWizardStepper
        currentStep={currentStep}
        caseId={caseId}
        proposalId={proposalId}
        steps={formData.is_salaried ? SALARIED_ORIGIN_STEPS : CASE_WIZARD_STEPS}
        onStepClick={(step) => goToStep(step)}
      />

      {/* Case-wide, not step-scoped — stays visible while a GST pull kicked
          off on step 2 keeps running in the background on any other step. */}
      {!formData.is_salaried && <GstPullStatusBanner caseId={caseId} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Step 1 sub-navigation — Business Entity / Co-Applicants, both still "Step 1" */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep1SubPage('business')}
                className={`btn btn-sm ${step1SubPage === 'business' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: '1 1 180px', fontWeight: 600 }}
              >
                1. Business Entity / Applicant
              </button>
              <button
                type="button"
                onClick={goToCoApplicants}
                className={`btn btn-sm ${step1SubPage === 'coapplicants' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: '1 1 180px', fontWeight: 600 }}
              >
                2. Co-Applicants
              </button>
            </div>

            {step1SubPage === 'business' && (
            <>
            {duplicateWarning && !caseId && !isMsme && (
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
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${duplicateWarning.id}`)}>View Existing Profile</button>
                    </div>

                    {duplicateWarning.summary && (
                      <div style={{ background: 'var(--bg-elevated)', borderRadius: 0, padding: 12, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', gridColumn: '1/-1', marginBottom: -4 }}>Reusable Data Available:</div>
                        {duplicateWarning.summary?.gst?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> GST Data</div>}
                        {duplicateWarning.summary?.itr?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> ITR Analytics</div>}
                        {duplicateWarning.summary?.bank?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> Bank Statement</div>}
                        {duplicateWarning.summary?.bureau?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> Bureau Score</div>}
                        {duplicateWarning.summary?.salary_ocr?.available && <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} color="var(--success)" /> Salary OCR</div>}
                      </div>
                    )}

                    <button type="button" className="btn btn-primary" onClick={handleContinueAsNewCase} disabled={saving}>
                      {saving ? 'Creating...' : 'Continue as New Case →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Business Entity Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Business Entity</h3>

              </div>
              
              <div style={{ padding: 24 }}>
                <div className="grid-2" style={{ marginBottom: 24 }}>
                  <FormField label="PAN Number" name="business_pan" required disabled={!!caseId && formData.pan_verified}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={formData.business_pan}
                        onChange={e => setFormData({...formData, business_pan: e.target.value.toUpperCase()})}
                        onBlur={() => checkPanDuplicate(formData.business_pan)}
                        className="form-control"
                        placeholder="E.G. AABCE1234F"
                        disabled={!!caseId && formData.pan_verified}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {formData.pan_verified ? (
                          <>
                            <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> PAN Verified
                            </span>
                            {/* A mistyped PAN must be correctable, not permanently
                                locked — same "Edit" affordance the mobile field
                                already has just below. Unlocking here re-runs
                                verification against whatever gets typed next
                                (the backend resets pan_verified once the value
                                actually changes), so this never leaves a stale
                                "Verified" badge on a corrected PAN. */}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setFormData(prev => ({ ...prev, pan_verified: false }))}
                              title="Edit PAN number"
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Pencil size={13} /> Edit
                            </button>
                          </>
                        ) : panVerifying ? (
                          <PullingIndicator label="Verifying PAN…" />
                        ) : panVerifyFailed ? (
                          <span style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={13} /> PAN verification failed — fix and re-enter
                          </span>
                        ) : formData.business_pan?.length === 10 ? (
                          <PullingIndicator label={formData.business_mobile ? 'Queued…' : 'Add mobile number to continue…'} />
                        ) : null}

                        {formData.pan_verified && (
                          // `gst_completed` (the real, backend-confirmed GST pull
                          // status — see GstAnalyticsForm / data_pull_status.gst_status)
                          // always takes priority over `pan_profile` (just the
                          // PAN→GSTIN lookup, a separate and much weaker signal
                          // that can stay empty forever — e.g. a manually-entered
                          // GSTIN never populates it — even after a real GST pull
                          // has succeeded). Checking pan_profile first was exactly
                          // why this badge got stuck on a permanent, misleading
                          // "Queued…" once gst_completed was already true.
                          formData.gst_completed ? (
                            <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> GST Pulled
                            </span>
                          ) : formData.pan_profile ? (
                            <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> GSTIN Found
                            </span>
                          ) : gstFetching ? (
                            <PullingIndicator label="Looking up GSTIN…" />
                          ) : gstFetchFailed ? (
                            <span style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertCircle size={13} /> No GSTIN on file — enter manually below
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>
                  </FormField>

                  <FormField label="Mobile Number" name="business_mobile" required disabled={formData.mobile_verified}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input type="tel" value={formData.business_mobile} onChange={e => setFormData({...formData, business_mobile: e.target.value})} className="form-control" placeholder="9820012345" disabled={formData.mobile_verified} />
                      {!formData.mobile_verified ? (
                        <button type="button" onClick={handleSendPrimaryOtp} disabled={saving || !formData.business_mobile || !formData.business_pan} className="btn btn-primary" style={{ padding: '0 20px' }}>Send OTP</button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600, padding: '0 10px', whiteSpace: 'nowrap' }}>
                            <CheckCircle2 size={18} /> Verified
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setFormData(prev => ({ ...prev, mobile_verified: false }))}
                            title="Edit mobile number"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </FormField>
                </div>

                <div className="grid-3" style={{ marginBottom: 24 }}>
                  <FormField label="Email Address" name="business_email" required>
                    <input type="email" value={formData.business_email} onChange={e => setFormData({...formData, business_email: e.target.value})} onBlur={handleBusinessEmailBlur} className="form-control" placeholder="admin@company.in" />
                  </FormField>

                  <FormField label="Pincode" name="pincode" required>
                    <input type="text" value={formData.pincode || ''} onChange={e => setFormData({...formData, pincode: e.target.value})} onBlur={handlePincodeBlur} className="form-control" placeholder="e.g. 560026" maxLength={6} />
                  </FormField>

                  <FormField label="Are You A Professional?" name="is_professional">
                    <select
                      className="form-control"
                      value={formData.is_professional === true || formData.is_professional === 'true' ? 'true' : 'false'}
                      onChange={e => {
                        const isProf = e.target.value === 'true';
                        setFormData({ ...formData, is_professional: isProf, profession_type: isProf ? formData.profession_type : '' });
                      }}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </FormField>
                </div>

                <div className="grid-2" style={{ marginBottom: 24 }}>
                  <FormField label="Business Name / Full Name" name="business_name" disabled={formData.pan_verified}>
                    <input
                      type="text"
                      value={formData.business_name}
                      onChange={e => setFormData({ ...formData, business_name: e.target.value })}
                      className="form-control"
                      placeholder={formData.pan_verified ? 'Autofetched via PAN' : 'Autofetched via PAN or enter manually'}
                      disabled={formData.pan_verified}
                    />
                  </FormField>

                  <FormField label="Date Of Birth / Incorporation" name="dob" required disabled={formData.pan_verified}>
                    <input
                      type="date"
                      value={formData.dob || ''}
                      onChange={e => setFormData({ ...formData, dob: e.target.value })}
                      className="form-control"
                      required
                      disabled={formData.pan_verified}
                    />
                  </FormField>
                </div>

                {(formData.is_professional === true || formData.is_professional === 'true') && (
                  <div className="grid-2">
                    <FormField label="Select Your Profession" name="profession_type" required>
                      <select className="form-control" value={formData.profession_type || ''} onChange={e => setFormData({ ...formData, profession_type: e.target.value })}>
                        <option value="">Select Profession</option>
                        <option value="CA">CA</option>
                        <option value="Lawyer">Lawyer</option>
                        <option value="Doctor">Doctor</option>
                        <option value="Other">Other</option>
                      </select>
                    </FormField>
                  </div>
                )}

                
              </div>
            </div>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={goToCoApplicants}
                disabled={!formData.mobile_verified}
              >
                Next: Co-Applicants →
              </button>
            </div>
            </>
            )}

            {step1SubPage === 'coapplicants' && (
            <>
            {/* Co-Applicants Card */}
            <div className="card">
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Co-Applicants</h3>
                </div>
                <button type="button" onClick={addCoApplicantRow} className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>+ Add Co-Applicant</button>
              </div>
              
              <div style={{ padding: 24 }}>
                {suggestedCoApplicants && suggestedCoApplicants.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 12 }}>Suggested Co-Applicants from Past Cases</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {suggestedCoApplicants.map((suggestion, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{suggestion.name || 'Unnamed Co-Applicant'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                              PAN: {suggestion.pan_number ? `${suggestion.pan_number.substring(0, 2)}******${suggestion.pan_number.substring(8)}` : 'N/A'} • Mobile: {suggestion.mobile}
                              {suggestion.relationship_to_primary && ` • ${suggestion.relationship_to_primary}`}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {suggestion.bureau_available && <span style={{ fontSize: 11, background: 'var(--info-bg)', color: 'var(--info)', padding: '2px 8px', borderRadius: 0 }}>Bureau Available</span>}
                              {suggestion.documents_available && <span style={{ fontSize: 11, background: 'var(--info-bg)', color: 'var(--info)', padding: '2px 8px', borderRadius: 0 }}>Documents</span>}
                              {suggestion.income_available && <span style={{ fontSize: 11, background: 'var(--info-bg)', color: 'var(--info)', padding: '2px 8px', borderRadius: 0 }}>Income</span>}
                              {suggestion.salary_ocr_available && <span style={{ fontSize: 11, background: 'var(--info-bg)', color: 'var(--info)', padding: '2px 8px', borderRadius: 0 }}>Salary OCR</span>}
                              {suggestion.obligations_available && <span style={{ fontSize: 11, background: 'var(--info-bg)', color: 'var(--info)', padding: '2px 8px', borderRadius: 0 }}>Obligations</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReuseApplicant(suggestion.source_applicant_id)}
                            disabled={saving}
                            className="btn btn-secondary btn-sm"
                            style={{ fontWeight: 600, color: 'var(--primary)', borderColor: 'var(--primary)' }}
                          >
                            Use in this case
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {formData.applicants.filter(a => a.type === 'CO_APPLICANT').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border-strong)', borderRadius: 0, color: 'var(--text-tertiary)' }}>
                    No Co-Applicants appended to this profile yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {formData.applicants.map((app, realIdx) => {
                      if (app.type !== 'CO_APPLICANT') return null;
                      const coApplicantIdx = formData.applicants.filter((a, i) => a.type === 'CO_APPLICANT' && i < realIdx).length;
                      return (
                      <div key={realIdx} className="coapp-box" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', padding: 24, borderRadius: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Applicant #{coApplicantIdx + 1}</h4>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeApplicant(realIdx)}
                          >
                            Remove ×
                          </button>
                        </div>
                        <div className="grid-2" style={{ marginBottom: 16 }}>
                          <FormField label="PAN Number" name={`copan_${realIdx}`} required>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={app.pan_number || ''}
                                onChange={e => updateApplicantRow(realIdx, 'pan_number', e.target.value.toUpperCase())}
                                className="form-control"
                                style={{ textTransform: 'uppercase', flex: 1, minWidth: 140 }}
                                disabled={app.pan_verified}
                                placeholder="E.G. AABCE1234F"
                              />
                              {app.pan_verified ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                    <CheckCircle2 size={16} /> Verified
                                  </span>
                                  {/* Same correction affordance as the primary
                                      applicant's PAN — a wrong co-applicant PAN
                                      shouldn't be permanently stuck once verified. */}
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => updateApplicantRow(realIdx, 'pan_verified', false)}
                                    title="Edit PAN number"
                                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <Pencil size={12} /> Edit
                                  </button>
                                </div>
                              ) : coappPanVerifyingMap[realIdx] ? (
                                <PullingIndicator label="Verifying PAN…" />
                              ) : (app.pan_number || '').length === 10 ? (
                                <PullingIndicator label="Queued…" />
                              ) : null}
                            </div>
                          </FormField>
                          <FormField label="Mobile Number" name={`comob_${realIdx}`}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <input type="tel" value={app.mobile || ''} onChange={e => updateApplicantRow(realIdx, 'mobile', e.target.value)} className="form-control" placeholder="9820012345" style={{ flex: 1, minWidth: 140 }} disabled={app.otp_verified} />
                              {!app.otp_verified ? (
                                <button type="button" className="btn btn-primary" onClick={() => handleSendCoapplicantOtp(realIdx)} style={{ padding: '0 16px', whiteSpace: 'nowrap' }} disabled={saving}>Send OTP</button>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 600, padding: '0 8px', whiteSpace: 'nowrap', fontSize: 12 }}>
                                  <CheckCircle2 size={16} /> Verified
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => updateApplicantRow(realIdx, 'otp_verified', false)}
                                    title="Edit mobile number"
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
                            <select className="form-control" value={app.employment_type || 'SELF_EMPLOYED'} onChange={e => updateApplicantRow(realIdx, 'employment_type', e.target.value)}>
                              <option value="SELF_EMPLOYED">Self Employed</option>
                              <option value="SALARIED">Salaried</option>
                              <option value="INCOME_NOT_CONSIDERED">Income not considered</option>
                            </select>
                          </FormField>
                          <FormField label="Pincode" name={`copincode_${realIdx}`} required>
                            <input type="text" value={app.pincode || ''} onChange={e => updateApplicantRow(realIdx, 'pincode', e.target.value)} className="form-control" placeholder="560026" maxLength={6} />
                          </FormField>
                          <FormField label="Email" name={`coemail_${realIdx}`}>
                            <input type="email" value={app.email || ''} onChange={e => updateApplicantRow(realIdx, 'email', e.target.value)} className="form-control" placeholder="name@example.com" />
                          </FormField>
                        </div>
                        <div className="grid-2">
                          <FormField label="Full Name" name={`coname_${realIdx}`} disabled={app.pan_verified}>
                            <input
                              type="text"
                              value={app.name || ''}
                              onChange={e => updateApplicantRow(realIdx, 'name', e.target.value)}
                              className="form-control"
                              placeholder={app.pan_verified ? 'Autofetched' : 'Enter Full Name'}
                              disabled={app.pan_verified}
                            />
                          </FormField>
                          <FormField label="Date Of Birth" name={`codob_${realIdx}`} required disabled={app.pan_verified}>
                            <input
                              type="date"
                              value={app.dob || ''}
                              onChange={e => updateApplicantRow(realIdx, 'dob', e.target.value)}
                              className="form-control"
                              required
                              disabled={app.pan_verified}
                            />
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
              <button type="button" className="btn btn-ghost" onClick={() => setStep1SubPage('business')}>← Back to Business Entity</button>
              <button className="btn btn-primary btn-lg" type="submit" disabled={saving || !formData.mobile_verified}>
                {saving ? 'Processing...' : 'Continue to Financials →'}
              </button>
            </div>
            </>
            )}
          </form>
        )}

        {currentStep === 2 && (
          <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Step 2 sub-navigation — GST / ITR / Bank Statements, all still "Step 2" */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep2SubPage('gst')}
                className={`btn btn-sm ${step2SubPage === 'gst' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: '1 1 140px', fontWeight: 600 }}
              >
                1. GST
              </button>
              <button
                type="button"
                onClick={() => setStep2SubPage('itr')}
                className={`btn btn-sm ${step2SubPage === 'itr' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: '1 1 140px', fontWeight: 600 }}
              >
                2. ITR
              </button>
              <button
                type="button"
                onClick={() => setStep2SubPage('bank')}
                className={`btn btn-sm ${step2SubPage === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: '1 1 140px', fontWeight: 600 }}
              >
                3. Bank Statements
              </button>
            </div>

            {step2SubPage === 'gst' && (
            <>
            <div className="card">
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                 <h3 style={{ fontSize: 16, fontWeight: 700 }}>GST Profile</h3>
               </div>
                {/* This strip is about the PAN→GSTIN lookup (linked_gstins) only —
                    a separate, weaker signal than the real GST pull. It must not
                    render once the real pull (gst_completed) has succeeded, or it
                    contradicts the "GST data pulled successfully" panel rendered
                    by GstAnalyticsForm right below it (the exact bug reported: an
                    empty-state message and a success panel shown at the same time). */}
                {!formData.gst_completed && (!formData.linked_gstins || formData.linked_gstins.length === 0) && (
                  <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)' }}>
                    {gstFetching ? (
                      <PullingIndicator label="Fetching GST records for this PAN…" />
                    ) : gstFetchFailed ? (
                      <>
                        <span style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 10px', borderRadius: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={13} /> GST fetch failed — no records loaded for this PAN yet
                        </span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleFetchGst}>Retry GST Fetch</button>
                      </>
                    ) : (
                      <>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No GST records loaded yet for this PAN.</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleFetchGst} disabled={!formData.pan_verified}>Fetch GST Records</button>
                      </>
                    )}
                  </div>
                )}
                <div style={{ padding: 0 }}>
                  <GstAnalyticsForm
                     caseId={caseId}
                     customerId={formData.customer_id}
                     linkedGstins={formData.linked_gstins}
                     gstCompleted={formData.gst_completed}
                     onComplete={() => setFormData(prev => ({...prev, gst_completed: true}))}
                     onRemoved={() => setFormData(prev => ({...prev, gst_completed: false}))}
                     onboardingMode={mode}
                  />
                </div>
            </div>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => { goToStep(1); setStep1SubPage('coapplicants'); }}>← Back to Co-Applicants</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep2SubPage('itr')}>
                Next: ITR Analytics →
              </button>
            </div>
            </>
            )}

            {step2SubPage === 'itr' && (
            <>
            <div className="card">
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                 <div>
                   <h3 style={{ fontSize: 16, fontWeight: 700 }}>ITR Analytics</h3>
                 </div>
               </div>
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <ItrAnalyticsForm
                      caseId={caseId}
                      customerId={formData.customer_id}
                      applicantId={null}
                      applicantType="PRIMARY"
                      applicantName={toTitleCase(formData.proprietor_name || formData.business_name) || formData.business_pan || 'Primary Business'}
                      prefillPan={formData.business_pan}
                      walletBalance={walletBalance}
                      itrCost={costs.ITR_ANALYTICS}
                      existingRecord={formData.customer_itr_profile}
                      onComplete={(data) => setFormData(prev => ({...prev, itr_completed: true, itr_analytics: data}))}
                      onRemoved={() => setFormData(prev => ({...prev, itr_completed: false, itr_analytics: null}))}
                      mode={mode}
                  />

                  {formData.applicants && formData.applicants.filter(a => a.type === 'CO_APPLICANT' && a.employment_type !== 'SALARIED' && a.employment_type !== 'INCOME_NOT_CONSIDERED').map((coApp, idx) => (
                      <ItrAnalyticsForm
                          key={idx}
                          caseId={caseId}
                          customerId={formData.customer_id}
                          applicantId={coApp.id}
                          applicantType="CO_APPLICANT"
                          applicantName={toTitleCase(coApp.name) || coApp.pan_number || `Co-Applicant ${idx + 1}`}
                          prefillPan={coApp.pan_number || ''}
                          walletBalance={walletBalance}
                          itrCost={costs.ITR_ANALYTICS}
                          existingRecord={coApp.itr_analytics?.[0] || null}
                          onComplete={(data) => console.log(`Co-App ${idx} ITR complete`)}
                          mode={mode}
                      />
                  ))}


               </div>
            </div>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep2SubPage('gst')}>← Back to GST</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep2SubPage('bank')}>
                Next: Bank Statements →
              </button>
            </div>
            </>
            )}

            {step2SubPage === 'bank' && (
            <>
            {/* Bank Statement Section */}
            <div className="card">
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                   <h3 style={{ fontSize: 16, fontWeight: 700 }}>Bank Statement Upload</h3>
                 </div>
                 <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Upload 12-month bank statement for each applicant — PDF only</p>
               </div>
               <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <BankStatementUpload 
                      caseId={caseId}
                      customerId={formData.customer_id}
                      applicantId={null} 
                      applicantType="PRIMARY"
                      applicantName={toTitleCase(formData.proprietor_name || formData.business_name) || formData.business_pan || 'Primary Business'}
                      walletBalance={walletBalance}
                      analyzeCost={costs.BANK_ANALYSIS}
                      existingStatus={formData.customer_bank_profile}
                      onComplete={(status, payload) => console.log('Primary bank complete')}
                      mode={mode}
                  />
                  
                  {/* Bank statement analysis is a business-income concept — a
                      salaried co-applicant's income comes from the Salary Slip
                      OCR section below instead, so it's excluded here the same
                      way it already is from ITR Analytics above. */}
                  {formData.applicants && formData.applicants.filter(a => a.type === 'CO_APPLICANT' && a.employment_type !== 'SALARIED' && a.employment_type !== 'INCOME_NOT_CONSIDERED').map((coApp, idx) => (
                      <BankStatementUpload
                          key={idx}
                          caseId={caseId}
                          customerId={formData.customer_id}
                          applicantId={coApp.id}
                          applicantType="CO_APPLICANT"
                          applicantName={toTitleCase(coApp.name) || coApp.pan_number || `Co-Applicant ${idx+1}`}
                          walletBalance={walletBalance}
                          analyzeCost={costs.BANK_ANALYSIS}
                          existingStatus={coApp.bank_statements?.[0] || null}
                          onComplete={(status, payload) => console.log(`Co-App ${idx} bank complete`)}
                          mode={mode}
                      />
                  ))}
                  
                  
               </div>
            </div>

            {formData.applicants.some(a => a.type === 'CO_APPLICANT' && a.employment_type === 'SALARIED') && (
              <div className="card">
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Salary Slip OCR</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Last 3 slips — auto-parsed via OCR</span>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {formData.applicants.filter(a => a.type === 'CO_APPLICANT' && a.employment_type === 'SALARIED').map((app, idx) => (
                    <div key={app.id || idx} style={{ borderTop: idx > 0 ? '1px dashed var(--border)' : 'none', paddingTop: idx > 0 ? 12 : 0 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{app.name || app.pan_number || `Applicant ${idx + 1}`}</h4>
                      <SalarySlipUploader caseId={caseId} applicantId={app.id} applicantName={toTitleCase(app.name) || app.pan_number} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="wizard-footer-actions" style={{ display: 'flex', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 10 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setStep2SubPage('itr')}>← Back to ITR Analytics</button>
              <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>Continue to Product Selection →</button>
            </div>
            </>
            )}
          </form>
        )}
        {currentStep === 3 && (
          <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Loan Product — merges Property & Collateral Details into a single field grid when required */}
            <Panel icon={Landmark} accentColor="var(--warning)" delay={0} title={<>Loan Product & collateral <span style={{ color: 'var(--error)', fontSize: 12 }}>*</span></>}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 20 }}>
                <FormField label="Select Product" name="product_type" required>
                  <select
                    className="form-control"
                    value={formData.product_type}
                    onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                    required
                    style={{ border: formData.product_type ? '2px solid var(--warning)' : undefined, background: formData.product_type ? 'var(--warning-bg)' : undefined, color: formData.product_type ? 'var(--warning)' : undefined, fontWeight: 600 }}
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

                <FormField label="Additional Requirements / Notes" name="dsa_notes">
                  <textarea rows={3} className="form-control" placeholder="Any specific requirements..." value={formData.dsa_notes} onChange={e => setFormData({ ...formData, dsa_notes: e.target.value })} />
                </FormField>

                {/* Property & Collateral fields — only for LAP / HL */}
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
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Estimate — lender does independent valuation</div>
                    </div>
                  </>
                )}
              </div>
            </Panel>

            <div className="wizard-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              <button className="btn btn-ghost" type="button" onClick={() => goToStep(2)}>← Back</button>
              <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Next: Income Summary →'}
              </button>
            </div>
          </form>
        )}

        {/* Steps 4-7 — formerly separate /cases/:id/* routed pages, now
            rendered inline so they share this component's mount lifetime
            (auto-fetch effects, etc.) instead of tearing down on navigation. */}
        {currentStep === 4 && (
          <IncomeSummaryStep caseId={caseId} onNext={() => goToStep(5)} isSalaried={formData.is_salaried} />
        )}
        {currentStep === 5 && (
          <BureauObligationsStep caseId={caseId} onNext={() => goToStep(6)} onBack={() => goToStep(4)} />
        )}
        {currentStep === 6 && (
          <EsrStep
            caseId={caseId}
            onOpenProposal={handleProposalCreated}
            isMsme={isMsme}
            onApplyForLoan={handleApplyForLoan}
          />
        )}
        {currentStep === 7 && (
          isMsme ? (
            <MsmeLoanTermsStep caseId={caseId} lender={applyLender} onBack={() => goToStep(6)} />
          ) : (
            <ProposalStep caseId={caseId} proposalId={proposalId} onBack={() => goToStep(6)} isMsme={isMsme} isSalaried={formData.is_salaried} />
          )
        )}
      </div>

      {/* OTP Modal */}
      {otpModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-box hide-scrollbar" style={{ width: 'min(480px, calc(100vw - 32px))', maxWidth: 480, padding: '32px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
               <h3 style={{ fontSize: 20, fontWeight: 700 }}>Verify Mobile OTP</h3>
             </div>
             <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
               We've sent a 6-digit verification code to <strong>{otpModal.mobile}</strong>.
             </p>
             <FormField label="Enter 6-Digit OTP" name="otpInput">
               <OtpInput
                 length={6}
                 value={otpModal.otpInput}
                 onChange={(v) => setOtpModal(prev => ({ ...prev, otpInput: v }))}
                 onEnter={handleVerifyOtpSubmit}
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
    </div>
  );
};

export default AddCustomerWizardPage;
