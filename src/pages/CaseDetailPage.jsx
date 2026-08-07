import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { caseService } from '../api/caseService';
import { getTenantLenders } from '../api/tenantLenderService';
import { viewDocument, downloadDocument } from '../api/documentHelper';
import { getUsers } from '../api/userService';
import {
  ArrowLeft, FileText, Download, CheckCircle2, AlertCircle, Users, X, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toTitleCase, formatStatusLabel, resolveEntityName, isUsableEntityName } from '../utils/helpers';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CaseFeedbackModal from '../components/case/CaseFeedbackModal';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { isMobile };
};

const formatCurrency = (val) => {
  if (!val) return '₹0';
  const n = Number(val);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

// Lightweight relative-time formatter (date-fns isn't a dependency in this app)
const formatRelative = (dateStr) => {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const STAGE_COLORS = {
  LEAD_CREATED:         { light: ['#FEF3C7', '#92400E'], dark: ['#78350F', '#FDE68A'] },
  DATA_COLLECTION:      { light: ['#E0F2FE', '#0369A1'], dark: ['#0c4a6e', '#7dd3fc'] },
  LEAD_SENT_TO_LENDER:  { light: ['#F3E8FF', '#6B21A8'], dark: ['#4c1d95', '#d8b4fe'] },
  ESR_GENERATED:        { light: ['#FFEDD5', '#C2410C'], dark: ['#7c2d12', '#fdba74'] },
  APPROVED:             { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  DISBURSED:            { light: ['#DCFCE7', '#166534'], dark: ['#14532d', '#86efac'] },
  PARTLY_DISBURSED:     { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  CLOSED:               { light: ['#F3F4F6', '#374151'], dark: ['#1f2937', '#d1d5db'] },
  REJECTED:             { light: ['#FEE2E2', '#991B1B'], dark: ['#7f1d1d', '#fca5a5'] },
  DRAFT:                { light: ['#F3F4F6', '#6B7280'], dark: ['#1f2937', '#9ca3af'] },
};
const STAGE_LABELS = {
  LEAD_CREATED: 'Lead Created', DATA_COLLECTION: 'Data Pulled', LEAD_SENT_TO_LENDER: 'Lead Sent to Lender',
  ESR_GENERATED: 'Login Done', APPROVED: 'Sanctioned', DISBURSED: 'Disbursed',
  PARTLY_DISBURSED: 'Partly Disbursed', CLOSED: 'Closed', REJECTED: 'Rejected', DRAFT: 'Draft',
};
const STAGE_OPTIONS = [
  { id: 'LEAD_CREATED', label: 'Lead Created' },
  { id: 'LEAD_SENT_TO_LENDER', label: 'Lead Sent' },
  { id: 'ESR_GENERATED', label: 'Login Done' },
  { id: 'APPROVED', label: 'Sanctioned' },
  { id: 'PARTLY_DISBURSED', label: 'Partly Disbursed' },
  { id: 'DISBURSED', label: 'Fully Disbursed' },
  { id: 'CLOSED', label: 'Closed' },
  { id: 'REJECTED', label: 'Rejected' },
];
const STAGE_STEPS = [
  { id: 'LEAD_CREATED', label: 'Lead Created' },
  { id: 'LEAD_SENT_TO_LENDER', label: 'Lead Sent' },
  { id: 'ESR_GENERATED', label: 'Login Done' },
  { id: 'APPROVED', label: 'Sanctioned' },
  { id: 'DISBURSED', label: 'Disbursed' },
  { id: 'CLOSED', label: 'Closed' },
];
const STAGE_ORDER = {
  DRAFT: 1, LEAD_CREATED: 2, DATA_COLLECTION: 3, INCOME_REVIEWED: 4,
  LEAD_SENT_TO_LENDER: 5, ESR_GENERATED: 6, IN_REVIEW: 7,
  APPROVED: 8, PARTLY_DISBURSED: 9, DISBURSED: 10, CLOSED: 11, REJECTED: 11,
};

const TABS = ['Overview', 'Co-Borrowers', 'Documents', 'Sanction & Disbursement', 'Activity Log'];

const DataRow = ({ label, value, valueColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    <strong style={{ color: valueColor || 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{value}</strong>
  </div>
);

const EmptyRow = ({ icon: Icon, text }) => (
  <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-tertiary)' }}>
    <Icon size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
    <div style={{ fontSize: 13 }}>{text}</div>
  </div>
);

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  // MSME direct-portal borrowers can view their own case, but the DSA
  // pipeline/wizard routes are off-limits — route them back to their portal.
  const isMsme = localStorage.getItem('roleName') === 'MSME_CUSTOMER';
  const backPath = isMsme ? '/msme/dashboard' : '/customers';
  const wizardPath = isMsme ? `/msme/onboarding?caseId=${id}` : `/customers/add?caseId=${id}`;
  // Steps 4-7 of the case journey render inline inside AddCustomerWizardPage
  // now — jump straight to the right step via the same entry point.
  const journeyPath = (step) => `${wizardPath}&step=${step}`;

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isMobile } = useResponsive();

  const [caseData, setCaseData] = useState(null);

  // An MSME case's PRIMARY applicant IS the business, and is deliberately
  // created without a `name` (case.service.js createCase) — the business
  // identity lives on the customer record instead. Only the salaried flow
  // copies a name onto the applicant row. Without this fallback the
  // Co-Borrowers tab renders the primary borrower as "Unnamed Applicant".
  const applicantDisplayName = (app) =>
    toTitleCase(app.name)
    || (app.type === 'PRIMARY' ? toTitleCase(resolveEntityName(caseData?.customer)) : '')
    || 'Unnamed Applicant';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [showStageModal, setShowStageModal] = useState(false);
  const [selectedStage, setSelectedStage] = useState('');
  const [disbursementSummary, setDisbursementSummary] = useState(null);
  const [tenantLenders, setTenantLenders] = useState([]);
  const [summaryDownloading, setSummaryDownloading] = useState(false);

  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackConfirmation, setRollbackConfirmation] = useState(false);

  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    product_type: '', property_type: '', occupancy_status: '', ownership_type: '', market_value: ''
  });

  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateUserId, setAllocateUserId] = useState('');

  // Case-journey feedback popup — only opens when a disbursement action just
  // now crossed into PARTLY_DISBURSED/DISBURSED (see handleUpdateStage's use
  // of recordDisbursement's `stage_changed` flag), never on every tranche.
  const [caseFeedbackPrompt, setCaseFeedbackPrompt] = useState(null); // { type: 'PARTIAL' | 'FULL' } | null
  const [dsaUsers, setDsaUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [sanctionForm, setSanctionForm] = useState({
    loan_account_number: '', sanction_date: new Date().toISOString().split('T')[0],
    sanctioned_amount: '', confirmed_roi: '', processing_fee: '', remarks: '',
    lender_name: '', product_type: '', tenant_lender_id: '',
  });

  const [disbursementForm, setDisbursementForm] = useState({
    amount: '', disbursement_date: new Date().toISOString().split('T')[0],
    next_disbursement_due_date: '', remarks: '', pdd_pending: false,
    pdd_documents: [{ document_name: '', due_date: '' }], loan_account_number: '',
  });

  const fetchDisbursementSummary = useCallback(async () => {
    try {
      const data = await caseService.getDisbursementSummary(id);
      setDisbursementSummary(data);
      if (data.sanction) {
        setSanctionForm({
          loan_account_number: data.sanction.loan_account_number || '',
          sanction_date: data.sanction.sanction_date?.split('T')[0] || '',
          sanctioned_amount: data.sanction.sanction_amount || data.summary.sanctioned_amount || '',
          confirmed_roi: data.sanction.confirmed_roi || '',
          processing_fee: data.sanction.processing_fee || '',
          remarks: data.sanction.remarks || '',
          lender_name: data.sanction.lender_name || '',
          product_type: data.sanction.product_type || '',
          tenant_lender_id: data.sanction.tenant_lender_id || '',
        });
      }
    } catch {
      // No disbursement data yet — fine, form stays empty.
    }
  }, [id]);

  const fetchCase = useCallback(async () => {
    try {
      setLoading(true);
      const data = await caseService.getCaseById(id);
      setCaseData(data);
      if (data && !disbursementSummary?.sanction) {
        setSanctionForm(prev => ({
          ...prev,
          lender_name: prev.lender_name || data.lender_name || '',
          product_type: prev.product_type || data.product_type || '',
          tenant_lender_id: prev.tenant_lender_id || data.tenant_lender_id || '',
        }));
      }
      if (data) {
        setPropertyForm({
          product_type: data.product_type || '',
          property_type: data.property?.property_type || '',
          occupancy_status: data.property?.occupancy_status || '',
          ownership_type: data.property?.ownership_type || '',
          market_value: data.property?.market_value || '',
        });
      }
    } catch (error) {
      toast.error('Failed to load case details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCase();
    fetchDisbursementSummary();
    getTenantLenders().then(d => setTenantLenders(d.filter(l => l.is_active))).catch(console.error);
  }, [fetchCase, fetchDisbursementSummary]);

  const handleAllocateClick = async () => {
    setShowAllocateModal(true);
    setLoadingUsers(true);
    try {
      setDsaUsers(await getUsers());
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    if (!allocateUserId) return toast.error('Please select an employee.');
    try {
      await caseService.allocateDsaUser(id, allocateUserId);
      toast.success('Case successfully allocated');
      setShowAllocateModal(false);
      fetchCase();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to allocate case');
    }
  };

  const handleSaveProperty = async (e) => {
    e.preventDefault();
    if (!propertyForm.product_type) return toast.error('Please select a loan product.');
    const needsProperty = ['LAP', 'HL'].includes(propertyForm.product_type);
    if (needsProperty && !propertyForm.property_type) return toast.error('Property type is required for LAP/HL.');
    if (needsProperty && !propertyForm.market_value) return toast.error('Market value is required for LAP/HL.');

    try {
      const payload = {
        product_type: propertyForm.product_type,
        property: needsProperty ? {
          property_type: propertyForm.property_type,
          occupancy_status: propertyForm.occupancy_status,
          ownership_type: propertyForm.ownership_type,
          market_value: parseFloat(propertyForm.market_value),
        } : null,
      };
      await caseService.updateProductProperty(id, payload);
      toast.success('Property & product details updated!');
      setShowPropertyModal(false);
      fetchCase();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update property details.');
    }
  };

  const handleDownloadLoanApplicationSummary = async () => {
    try {
      setSummaryDownloading(true);
      toast.loading('Generating Loan Application Summary...', { id: 'loan-summary-download' });
      await caseService.downloadLoanApplicationSummary(id);
      toast.success('Loan Application Summary downloaded', { id: 'loan-summary-download' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to download Loan Application Summary', { id: 'loan-summary-download' });
    } finally {
      setSummaryDownloading(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!selectedStage) return toast.error('Please select a stage');
    const isBackward = STAGE_ORDER[selectedStage] < STAGE_ORDER[caseData.stage];

    try {
      if (isBackward) {
        if (!hasRole('DSA_ADMIN')) return toast.error('Only DSA Admin can rollback financial stages.');
        if (!rollbackReason) return toast.error('Rollback reason is required.');
        if (!rollbackConfirmation) return toast.error('Please confirm the rollback action.');
        await caseService.rollbackCaseStage(id, { target_stage: selectedStage, reason: rollbackReason, confirmation: rollbackConfirmation });
        toast.success(`Stage rolled back to ${STAGE_LABELS[selectedStage]}`);
      } else if (selectedStage === 'APPROVED') {
        if (caseData.stage !== 'ESR_GENERATED' && caseData.stage !== 'APPROVED') {
          return toast.error('Case must be Login Done before sanction.');
        }
        await caseService.sanctionCase(id, sanctionForm);
        toast.success('Case sanctioned successfully');
      } else if (['PARTLY_DISBURSED', 'DISBURSED'].includes(selectedStage)) {
        if (!disbursementSummary?.sanction) return toast.error('Case must be sanctioned before disbursement.');
        if (!disbursementSummary.sanction.loan_account_number && !disbursementForm.loan_account_number) {
          return toast.error('Loan account number is required before disbursement can proceed.');
        }
        if (!disbursementForm.disbursement_date) return toast.error('Disbursement date is required.');

        const sanctionDate = new Date(disbursementSummary.sanction.sanction_date);
        const disbDate = new Date(disbursementForm.disbursement_date);
        sanctionDate.setHours(0, 0, 0, 0);
        disbDate.setHours(0, 0, 0, 0);
        if (disbDate < sanctionDate) return toast.error('Disbursement date cannot be earlier than sanction date.');

        if (selectedStage === 'PARTLY_DISBURSED') {
          if (!disbursementForm.next_disbursement_due_date) return toast.error('Next disbursement due date is required for part disbursement.');
          const nextDisbDate = new Date(disbursementForm.next_disbursement_due_date);
          nextDisbDate.setHours(0, 0, 0, 0);
          if (nextDisbDate <= disbDate) return toast.error('Next disbursement date must be later than part disbursement date.');
        }

        const payload = { ...disbursementForm, pdd_tasks: disbursementForm.pdd_pending ? disbursementForm.pdd_documents : [] };
        const idempotencyKey = `manual_${id}_${Date.now()}`;
        const disbResult = await caseService.recordDisbursement(id, payload, idempotencyKey);
        toast.success(`Disbursement recorded: ${selectedStage === 'DISBURSED' ? 'Full' : 'Partial'}`);
        // Backend-computed, not just "which option did the DSA pick" — a
        // second partial tranche re-selects PARTLY_DISBURSED without the
        // case actually changing stage again, and shouldn't re-prompt.
        if (disbResult?.stage_changed && ['DISBURSED', 'PARTLY_DISBURSED'].includes(disbResult.stage)) {
          setCaseFeedbackPrompt({ type: disbResult.stage === 'DISBURSED' ? 'FULL' : 'PARTIAL' });
        }
      } else {
        await caseService.updateCaseStage(id, selectedStage);
        toast.success(`Stage updated to ${STAGE_LABELS[selectedStage]}`);
      }

      setShowStageModal(false);
      fetchCase();
      fetchDisbursementSummary();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update stage');
    }
  };

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner size={36} />
    </div>
  );
  if (!caseData) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Case not found.</p>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(backPath)}><ArrowLeft size={14} /> {isMsme ? 'Back to Dashboard' : 'Back to Pipeline'}</button>
    </div>
  );

  const stageColors = STAGE_COLORS[caseData.stage] || STAGE_COLORS.DRAFT;
  const [stageBg, stageColor] = isDark ? stageColors.dark : stageColors.light;
  const isBackward = selectedStage && STAGE_ORDER[selectedStage] < STAGE_ORDER[caseData.stage];
  const isFinancialRollback = isBackward && STAGE_ORDER[caseData.stage] >= STAGE_ORDER.APPROVED;
  const currentStepIndex = STAGE_STEPS.findIndex(s => s.id === caseData.stage);

  return (
    <div className="case-detail-page hide-scrollbar" style={{ height: '100%', overflowY: 'auto', padding: '24px 20px' }}>
      <style>{`
        .case-detail-page .card, .case-detail-page .btn, .case-detail-page .form-control,
        .case-detail-page .modal-box, .case-detail-page .notice {
          border-radius: 0 !important;
        }
        .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate(backPath)}>{isMsme ? 'My Dashboard' : 'Customer List'}</span>
            <span>/</span>
            <span style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate(isMsme ? '/msme/cases' : '/customers')}>{isMsme ? 'My Cases' : 'All Cases'}</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            CASE-{caseData.id} — {toTitleCase(resolveEntityName(caseData.customer, isUsableEntityName(caseData.customer_name) ? caseData.customer_name : ''))}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {caseData.lender_name || 'Unassigned'} · {caseData.product_type || 'N/A'} · {formatCurrency(caseData.loan_amount)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {hasRole('DSA_ADMIN') && caseData?.lead_source === 'DIRECT_MSME' && (
            <button className="btn btn-secondary btn-sm" onClick={handleAllocateClick}><Users size={13} /> Allocate to Employee</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(wizardPath)}>Open Wizard</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPropertyModal(true)}>Edit Property Details</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(journeyPath(5))}>View &amp; Edit Obligations</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(journeyPath(4))}>Income Summary</button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadLoanApplicationSummary} disabled={summaryDownloading}>
            <Download size={13} /> {summaryDownloading ? 'Preparing...' : 'Loan Application Summary'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(journeyPath(6))}>Generate ESR</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowStageModal(true)}>Update Stage</button>
        </div>
      </div>

      {caseData.parent_case_id && (
        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          <FileText size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700 }}>Lender Specific Case</div>
            <div style={{ marginTop: 2 }}>
              This is a cloned snapshot for <strong>{caseData.lender_name}</strong>. The original source case is{' '}
              <span style={{ fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate(`/cases/${caseData.parent_case_id}`)}>
                CASE-{caseData.parent_case_id}
              </span>.
            </div>
          </div>
        </div>
      )}

      {/* Case Progress */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Case Progress</p>
          <span style={{ background: stageBg, color: stageColor, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{STAGE_LABELS[caseData.stage]}</span>
        </div>

        <div className="hide-scrollbar" style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4 }}>
          {STAGE_STEPS.map((step, idx) => {
            const isDone = currentStepIndex >= idx;
            const isCurrent = caseData.stage === step.id;
            return (
              <React.Fragment key={step.id}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                  <div style={{
                    width: 30, height: 30, border: isCurrent ? '2px solid var(--primary)' : '2px solid var(--border)',
                    background: isDone ? (isCurrent ? 'var(--primary)' : 'var(--success)') : 'var(--bg-surface)',
                    color: isDone ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  }}>
                    {isDone && !isCurrent ? <Check size={14} strokeWidth={3} /> : idx + 1}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', marginTop: 6, color: isCurrent ? 'var(--primary)' : isDone ? 'var(--success)' : 'var(--text-tertiary)' }}>
                    {step.label}
                  </div>
                </div>
                {idx < STAGE_STEPS.length - 1 && (
                  <div style={{ width: 50, height: 2, background: currentStepIndex > idx ? 'var(--success)' : 'var(--border)', margin: '0 2px 18px 2px', flexShrink: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          Case can be marked <strong>Rejected</strong> at any stage — rejection auto-closes the case.
        </div>
      </div>

      {/* Tabs */}
      <div className="hide-scrollbar" style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20, overflowX: 'auto', overflowY: 'hidden' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 18px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-tertiary)',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Case Details</h3>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DataRow label="Industry" value={caseData.customer?.industry || 'N/A'} />
              <DataRow label="Entity Type" value={caseData.entity_type || caseData.customer?.entity_type || 'N/A'} />
              <DataRow label="Business Vintage" value={caseData.customer?.business_vintage ? `${caseData.customer.business_vintage} Years` : 'N/A'} />
              <DataRow label="Bureau Score" value={caseData.cibil_score || 'Pending'} valueColor={caseData.cibil_score >= 700 ? 'var(--success)' : 'var(--warning)'} />
              <DataRow label="Lender" value={caseData.lender_name || 'Not Selected'} />
              <DataRow label="Loan Amount" value={formatCurrency(caseData.loan_amount)} />
              <DataRow label="DSA Notes" value={caseData.dsa_notes || '—'} />
            </div>
          </div>

          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Property &amp; Collateral</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPropertyModal(true)}>Edit</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <DataRow label="Property Type" value={caseData.property?.property_type || 'N/A'} />
                <DataRow label="Occupancy" value={caseData.property?.occupancy_status || 'N/A'} />
                <DataRow label="Property Value" value={caseData.property?.market_value ? `₹${Number(caseData.property.market_value).toLocaleString('en-IN')}` : 'N/A'} />
                <DataRow label="Location" value={caseData.property?.address || 'N/A'} />
                <DataRow label="LTV Ratio" value={(caseData.loan_amount && caseData.property?.market_value) ? `${((caseData.loan_amount / caseData.property.market_value) * 100).toFixed(1)}%` : '—'} />
              </div>
              <div className="notice" style={{ background: 'var(--primary-subtle)', color: 'var(--primary-dark)', border: '1px solid var(--primary-light)' }}>
                Property value entered by DSA. Lender will conduct independent property valuation during underwriting.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Co-Borrowers */}
      {activeTab === 'Co-Borrowers' && (
        !caseData.applicants?.length ? <div className="card"><EmptyRow icon={Users} text="No applicants on this case." /></div> :
        isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {caseData.applicants.map(app => (
              <div key={app.id} className="card card-padded">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{applicantDisplayName(app)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{app.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Borrower / Guarantor'}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: app.cibil_score >= 700 ? 'var(--success)' : 'var(--warning)' }}>{app.cibil_score || '—'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>PAN: {app.pan_number || '—'}</div>
                {app.bureau_fetched ? <span style={{ color: 'var(--success)', fontSize: 11, fontWeight: 600 }}>✓ Bureau Fetched</span> : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Pending Pull</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup><col style={{ width: '28%' }} /><col style={{ width: '20%' }} /><col style={{ width: '17%' }} /><col style={{ width: '18%' }} /><col style={{ width: '17%' }} /></colgroup>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                  {['Name / Entity', 'Role', 'PAN', 'Status', 'Bureau Score'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caseData.applicants.map(app => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 600 }}>{applicantDisplayName(app)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{app.type}</div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{app.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Borrower / Guarantor'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{app.pan_number || '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {app.bureau_fetched ? <span style={{ color: 'var(--success)', fontSize: 11, fontWeight: 600 }}>✓ Bureau Fetched</span> : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Pending Pull</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: app.cibil_score >= 700 ? 'var(--success)' : 'var(--warning)' }}>{app.cibil_score || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Documents */}
      {activeTab === 'Documents' && (
        <div className="card card-padded">
          {caseData.documents?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
              {caseData.documents.map(doc => (
                <div key={doc.id} style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={18} color="var(--text-tertiary)" />
                    <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{doc.original_file_name || doc.document_type}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                    <button onClick={() => viewDocument(doc.id)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', padding: 0 }}>View</button>
                    <button onClick={() => downloadDocument(doc.id, doc.original_file_name)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Download</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyRow icon={FileText} text="No documents uploaded yet." />}
        </div>
      )}

      {/* Sanction & Disbursement */}
      {activeTab === 'Sanction & Disbursement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard title="Sanctioned Amount" value={formatCurrency(disbursementSummary?.summary?.sanctioned_amount)} color="var(--primary)" />
            <StatCard title="Total Disbursed" value={formatCurrency(disbursementSummary?.summary?.total_disbursed_amount)} color="var(--success)" />
            <StatCard title="Remaining Balance" value={formatCurrency(disbursementSummary?.summary?.remaining_disbursement_amount)} color="var(--warning)" />
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Disbursement History</h3>
            </div>
            {!disbursementSummary?.disbursements?.length ? <EmptyRow icon={FileText} text="No disbursements recorded yet." /> : (
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup><col style={{ width: '18%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '22%' }} /><col style={{ width: '20%' }} /></colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                    {['Tranche', 'Amount', 'Date', 'Next Due', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disbursementSummary.disbursements.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', textAlign: 'center' }}>Tranche #{d.tranche_number}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{formatCurrency(d.amount)}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{d.disbursement_date?.split('T')[0]}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{d.next_disbursement_due_date?.split('T')[0] || '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}><span style={{ padding: '3px 10px', background: 'var(--success-bg)', color: 'var(--success)', fontSize: 11, fontWeight: 700 }}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Activity Log */}
      {activeTab === 'Activity Log' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>System Activity Log</h3>
            </div>
            <div style={{ padding: 20 }}>
              {caseData.activity_logs?.length > 0 ? caseData.activity_logs.map(log => (
                <div key={log.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13 }}><strong>{formatStatusLabel(log.activity_type)}</strong>: {log.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{formatRelative(log.created_at)} · User ID: {log.performed_by_user_id || 'System'}</div>
                  </div>
                </div>
              )) : <EmptyRow icon={FileText} text="No activity recorded yet." />}
            </div>
          </div>

          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Stage Transition History</h3>
            </div>
            <div style={{ padding: 20 }}>
              {caseData.stage_history?.length > 0 ? caseData.stage_history.map(history => (
                <div key={history.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13 }}>Transitioned from <strong>{formatStatusLabel(history.old_stage)}</strong> to <strong>{formatStatusLabel(history.new_stage)}</strong></div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{formatRelative(history.changed_at)} · Updated by User: {history.changed_by || 'System'}</div>
                  </div>
                </div>
              )) : <EmptyRow icon={FileText} text="No stage history found." />}
            </div>
          </div>
        </div>
      )}

      {/* ── Update Stage Modal ── */}
      {showStageModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowStageModal(false); }}>
          <div className="modal-box hide-scrollbar" style={{ maxWidth: 560, width: '96vw', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Update Case Stage</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowStageModal(false)}><X size={18} /></button>
            </div>

            <div style={{ padding: 24 }}>
              <div className="notice" style={{ background: 'var(--primary-subtle)', color: 'var(--primary-dark)', border: '1px solid var(--primary-light)', marginBottom: 20 }}>
                Current stage: <strong>{STAGE_LABELS[caseData.stage]}</strong> · CASE-{caseData.id}
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Select New Stage</label>
                <select
                  className="form-control"
                  value={selectedStage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStage(val);
                    if (val === 'DISBURSED' && disbursementSummary?.summary?.remaining_disbursement_amount) {
                      setDisbursementForm(prev => ({ ...prev, amount: disbursementSummary.summary.remaining_disbursement_amount }));
                    }
                  }}
                >
                  <option value="">— Choose Stage —</option>
                  {STAGE_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              {isBackward && (
                <div className="notice notice-error" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <AlertCircle size={20} />
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Backward Stage Rollback</h4>
                  </div>
                  {!hasRole('DSA_ADMIN') ? (
                    <div style={{ fontWeight: 600 }}>Only DSA Admin can perform a backward stage rollback. Please contact your administrator.</div>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 16px 0', lineHeight: 1.5 }}>
                        You are moving the case backwards. This is a sensitive operation.
                        {isFinancialRollback && ' Depending on the target stage, active disbursements and PDD tasks will be CANCELLED, and the Case Sanction may be archived and removed.'}
                      </p>
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Rollback Reason *</label>
                        <textarea className="form-control" value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)} placeholder="Explain why this case is being rolled back..." style={{ minHeight: 60 }} />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={rollbackConfirmation} onChange={(e) => setRollbackConfirmation(e.target.checked)} style={{ marginTop: 2 }} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>I confirm that I understand the financial and audit implications of rolling back this case.</span>
                      </label>
                    </>
                  )}
                </div>
              )}

              {!isBackward && ['APPROVED', 'PARTLY_DISBURSED', 'DISBURSED'].includes(selectedStage) && (
                <div style={{ marginBottom: 24, padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700 }}>Loan Sanction Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">
                        Lender Name
                        {sanctionForm.lender_name && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-subtle)', padding: '1px 6px' }}>AUTO-FILLED</span>}
                      </label>
                      {sanctionForm.lender_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1.5px solid var(--primary-light)', background: 'var(--primary-subtle)', minHeight: 36 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{sanctionForm.lender_name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>Locked</span>
                        </div>
                      ) : (
                        <select
                          className="form-control"
                          value={sanctionForm.tenant_lender_id || ''}
                          onChange={(e) => {
                            const selected = tenantLenders.find(l => String(l.id) === e.target.value);
                            setSanctionForm({ ...sanctionForm, tenant_lender_id: e.target.value, lender_name: selected ? selected.lender_name : '' });
                          }}
                        >
                          <option value="">— Select Lender —</option>
                          {tenantLenders.map(l => <option key={l.id} value={l.id}>{l.lender_name}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Product Type
                        {sanctionForm.product_type && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-subtle)', padding: '1px 6px' }}>AUTO-FILLED</span>}
                      </label>
                      {sanctionForm.product_type ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1.5px solid var(--primary-light)', background: 'var(--primary-subtle)', minHeight: 36 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{sanctionForm.product_type}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>Locked</span>
                        </div>
                      ) : (
                        <input type="text" className="form-control" value={sanctionForm.product_type} onChange={(e) => setSanctionForm({ ...sanctionForm, product_type: e.target.value })} placeholder="e.g. LAP, HL, BL" />
                      )}
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Loan Account Number (Optional)</label>
                      <input type="text" className="form-control" value={sanctionForm.loan_account_number} onChange={(e) => setSanctionForm({ ...sanctionForm, loan_account_number: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sanctioned Amount (₹)</label>
                      <input type="number" className="form-control" value={sanctionForm.sanctioned_amount} onChange={(e) => setSanctionForm({ ...sanctionForm, sanctioned_amount: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sanction Date</label>
                      <input type="date" className="form-control" value={sanctionForm.sanction_date} onChange={(e) => setSanctionForm({ ...sanctionForm, sanction_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirmed ROI (%)</label>
                      <input type="number" step="0.01" className="form-control" value={sanctionForm.confirmed_roi} onChange={(e) => setSanctionForm({ ...sanctionForm, confirmed_roi: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Processing Fee (₹)</label>
                      <input type="number" className="form-control" value={sanctionForm.processing_fee} onChange={(e) => setSanctionForm({ ...sanctionForm, processing_fee: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {!isBackward && ['PARTLY_DISBURSED', 'DISBURSED'].includes(selectedStage) && (
                <div style={{ marginBottom: 24, padding: 20, background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
                  <h4 style={{ margin: '0 0 20px 0', fontSize: 14, fontWeight: 700, color: 'var(--warning)' }}>
                    {selectedStage === 'PARTLY_DISBURSED' ? 'Part Disbursement Details' : 'Final Disbursement Details'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Loan Account Number *</label>
                      <input
                        type="text" className="form-control"
                        value={disbursementSummary?.sanction?.loan_account_number || disbursementForm.loan_account_number || ''}
                        disabled={!!disbursementSummary?.sanction?.loan_account_number || selectedStage === 'DISBURSED'}
                        onChange={(e) => setDisbursementForm({ ...disbursementForm, loan_account_number: e.target.value })}
                        placeholder="e.g. LN123456789"
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label className="form-label">Amount Being Disbursed Now (₹) *</label>
                        <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
                          Remaining: {formatCurrency(disbursementSummary?.summary?.remaining_disbursement_amount || sanctionForm.sanctioned_amount)}
                        </span>
                      </div>
                      <input type="number" className="form-control" value={disbursementForm.amount} readOnly={selectedStage === 'DISBURSED'} onChange={(e) => setDisbursementForm({ ...disbursementForm, amount: e.target.value })} placeholder="e.g. 6000000" />
                      <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                        Must be {selectedStage === 'PARTLY_DISBURSED' ? 'less than' : 'equal to'} remaining sanctioned amount
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Disbursement Date</label>
                      <input type="date" className="form-control" value={disbursementForm.disbursement_date} onChange={(e) => setDisbursementForm({ ...disbursementForm, disbursement_date: e.target.value })} />
                    </div>
                    {selectedStage === 'PARTLY_DISBURSED' && (
                      <div className="form-group">
                        <label className="form-label">Next Disbursement Due Date</label>
                        <input type="date" className="form-control" value={disbursementForm.next_disbursement_due_date} onChange={(e) => setDisbursementForm({ ...disbursementForm, next_disbursement_due_date: e.target.value })} />
                        <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 4 }}>Expected date for the remaining balance</div>
                      </div>
                    )}
                    <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                      <div className="notice notice-warning">
                        This case will automatically appear in the <strong>Part Disbursement</strong> module with the pending balance and next due date.
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-surface)', border: '1.5px dashed var(--border)' }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 700 }}>Post-Disbursement Documents (PDD)</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 16px 0' }}>Are there any Post-Disbursement Documents pending from this customer?</p>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <input type="radio" checked={disbursementForm.pdd_pending} onChange={() => setDisbursementForm({ ...disbursementForm, pdd_pending: true })} /> Yes
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <input type="radio" checked={!disbursementForm.pdd_pending} onChange={() => setDisbursementForm({ ...disbursementForm, pdd_pending: false })} /> No
                      </label>
                    </div>
                    {disbursementForm.pdd_pending && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {disbursementForm.pdd_documents.map((pdd, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 10 }}>
                            <input
                              type="text" className="form-control" placeholder="Document Name (e.g. Original RC)" value={pdd.document_name}
                              onChange={(e) => { const newDocs = [...disbursementForm.pdd_documents]; newDocs[idx].document_name = e.target.value; setDisbursementForm({ ...disbursementForm, pdd_documents: newDocs }); }}
                            />
                            <input
                              type="date" className="form-control" value={pdd.due_date}
                              onChange={(e) => { const newDocs = [...disbursementForm.pdd_documents]; newDocs[idx].due_date = e.target.value; setDisbursementForm({ ...disbursementForm, pdd_documents: newDocs }); }}
                            />
                            <button
                              onClick={() => setDisbursementForm({ ...disbursementForm, pdd_documents: disbursementForm.pdd_documents.filter((_, i) => i !== idx) })}
                              style={{ border: 'none', background: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 18 }}
                            >×</button>
                          </div>
                        ))}
                        <button
                          onClick={() => setDisbursementForm({ ...disbursementForm, pdd_documents: [...disbursementForm.pdd_documents, { document_name: '', due_date: '' }] })}
                          className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
                        >+ Add Another Document</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {['REJECTED', 'CLOSED'].includes(selectedStage) && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">{selectedStage === 'REJECTED' ? 'Rejection Reason' : 'Closure Remarks'}</label>
                  <textarea className="form-control" placeholder="Enter details..." style={{ minHeight: 80 }} />
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-elevated)', position: 'sticky', bottom: 0 }}>
              <button className="btn btn-ghost" onClick={() => setShowStageModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateStage} disabled={!selectedStage || (isBackward && (!hasRole('DSA_ADMIN') || !rollbackConfirmation || !rollbackReason))}>
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocate Modal ── */}
      {showAllocateModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAllocateModal(false); }}>
          <form onSubmit={handleAllocateSubmit} className="modal-box" style={{ maxWidth: 450, width: '92vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Allocate Case to Employee</h3>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Select Employee</label>
              {loadingUsers ? <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading users...</p> : (
                <select className="form-control" value={allocateUserId} onChange={(e) => setAllocateUserId(e.target.value)} required>
                  <option value="">- Select -</option>
                  {dsaUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.name})</option>)}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAllocateModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loadingUsers || !allocateUserId}>Allocate</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit Property Modal ── */}
      {showPropertyModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPropertyModal(false); }}>
          <form onSubmit={handleSaveProperty} className="modal-box hide-scrollbar" style={{ maxWidth: 500, width: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Edit Property &amp; Product</h3>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowPropertyModal(false)}><X size={18} /></button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Loan Product & collateral</label>
                <select className="form-control" value={propertyForm.product_type} onChange={(e) => setPropertyForm(prev => ({ ...prev, product_type: e.target.value }))} required>
                  <option value="">- Select a loan product -</option>
                  <option value="HL">HL - Home Loan</option>
                  <option value="LAP">LAP - Loan Against Property</option>
                  <option value="PL">PL - Personal Loan</option>
                  <option value="BL">BL - Business Loan</option>
                </select>
              </div>

              {['LAP', 'HL'].includes(propertyForm.product_type) && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Property Type *</label>
                      <select className="form-control" value={propertyForm.property_type} onChange={(e) => setPropertyForm(prev => ({ ...prev, property_type: e.target.value }))} required>
                        <option value="">- Select -</option>
                        <option value="Commercial — Office / Shop">Commercial — Office / Shop</option>
                        <option value="Residential — House / Flat">Residential — House / Flat</option>
                        <option value="Industrial — Factory / Warehouse">Industrial — Factory / Warehouse</option>
                        <option value="Plot / Land">Plot / Land</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Occupancy</label>
                      <select className="form-control" value={propertyForm.occupancy_status} onChange={(e) => setPropertyForm(prev => ({ ...prev, occupancy_status: e.target.value }))}>
                        <option value="Self Occupied">Self Occupied</option>
                        <option value="Rented Out">Rented Out</option>
                        <option value="Vacant">Vacant</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Ownership</label>
                      <select className="form-control" value={propertyForm.ownership_type} onChange={(e) => setPropertyForm(prev => ({ ...prev, ownership_type: e.target.value }))}>
                        <option value="Sole Owner">Sole Owner</option>
                        <option value="Joint Owner">Joint Owner</option>
                        <option value="Company Owned">Company Owned</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Market Value *</label>
                      <input type="number" className="form-control" value={propertyForm.market_value} onChange={(e) => setPropertyForm(prev => ({ ...prev, market_value: e.target.value }))} required />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-elevated)', position: 'sticky', bottom: 0 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowPropertyModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      <CaseFeedbackModal
        isOpen={!!caseFeedbackPrompt}
        onClose={() => setCaseFeedbackPrompt(null)}
        caseId={id}
        disbursementType={caseFeedbackPrompt?.type}
        caseLabel={resolveEntityName(caseData?.customer)}
      />
    </div>
  );
}
