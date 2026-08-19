import React, { useState, useEffect, useCallback } from 'react';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { listDocuments, downloadDocument } from '../api/documentHelper';
import Skeleton from '../components/ui/Skeleton';
import Panel from '../components/ui/Panel';
import MetricTile from '../components/ui/MetricTile';
import { PlusCircle, ChevronLeft, Zap, AlertTriangle, BarChart3, CheckCircle2, PenLine, X, FileDown, Trash2, Fingerprint } from 'lucide-react';
import { useCasePullStatus } from '../hooks/useCasePullStatus';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const GST_LIVE_PHASES = ['QUEUED', 'AWAITING_CUSTOMER', 'PROCESSING', 'GENERATING_REPORT', 'FINALIZING'];

const getCibilColor = (score) => {
  if (!score) return 'var(--text-tertiary)';
  if (score >= 750) return 'var(--success)';
  if (score >= 700) return 'var(--warning)';
  return 'var(--error)';
};

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44; // average month length

// Two independent facts per obligation, not a single status:
//  - "Availed within X months" — how recently the loan was taken (loan_start_date vs today)
//  - "O/s < X months" — approximate remaining tenure, estimated as
//    outstanding_amount / emi_per_month (a flat, interest-free estimate —
//    there's no stored maturity/tenure field to compute this exactly, this
//    is the agreed quick-screening heuristic)
// Each side always shows a label when the underlying data exists — including
// a "12+" fallback once a loan ages/outlasts both thresholds — so a row only
// goes blank on a side when that side's source data is genuinely missing
// (no loan_start_date, or EMI unverified/zero so remaining tenure can't be
// estimated at all).
const getObligationDetails = (obl) => {
  // Manual entries never have a loan_start_date — the "Add Loan Not in
  // Bureau" form doesn't collect one — so only the O/s-remaining half of
  // this heuristic could ever fire for them, showing a lopsided badge
  // instead of the "recency + remaining tenure" pair this column means to
  // convey. Show the plain "—" fallback for these instead.
  if (obl.source === 'MANUAL') return [];

  const details = [];

  if (obl.loan_start_date) {
    const monthsSinceStart = (Date.now() - new Date(obl.loan_start_date).getTime()) / MONTH_MS;
    if (monthsSinceStart <= 6) details.push({ label: 'Availed within 6 months', color: 'var(--info)', bg: 'var(--info-bg)' });
    else if (monthsSinceStart <= 12) details.push({ label: 'Availed within 12 months', color: 'var(--info)', bg: 'var(--info-bg)' });
    else details.push({ label: 'Availed 12+ months ago', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' });
  }

  if (obl.emi_per_month > 0 && obl.outstanding_amount != null) {
    const monthsRemaining = obl.outstanding_amount / obl.emi_per_month;
    if (monthsRemaining <= 6) details.push({ label: 'O/s < 6 months', color: 'var(--success)', bg: 'var(--success-bg)' });
    else if (monthsRemaining <= 12) details.push({ label: 'O/s < 12 months', color: 'var(--success)', bg: 'var(--success-bg)' });
    else details.push({ label: 'O/s 12+ months', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' });
  }

  return details;
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

const LOAN_TYPES = [
  'Home Loan', 'Car Loan', 'Business Loan', 'Personal Loan',
  'Two-Wheeler Loan', 'Education Loan', 'Gold Loan', 'Credit Card', 'Other'
];

// Step 5 of the case journey — rendered inline by AddCustomerWizardPage
// (not its own route), so it takes caseId/onNext/onBack as props instead of
// reading useParams()/navigating itself.
export default function BureauObligationsPage({ caseId, onNext, onBack, mode, walletBalance, bureauCost }) {
  const isMobile = useIsMobile();
  // MSME self-service borrowers don't see wallet-credit costs (DSA concept) —
  // same convention GstAnalyticsForm/ItrAnalyticsForm/BankStatementUpload use.
  const isMsme = mode === 'MSME_SELF_SERVICE';

  // GST can still be pulling in the background (kicked off on step 2, and
  // the case-wide GstPullStatusBanner keeps it visible on this step too) —
  // generating the ESR against an incomplete GST picture would bake a wrong
  // eligibility number in, so block it until that pull settles one way or
  // the other (finishes or fails).
  const { snapshot: pullSnapshot } = useCasePullStatus(caseId);
  const gstPending = GST_LIVE_PHASES.includes(pullSnapshot?.gst?.overall?.phase);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [data, setData]           = useState(null);
  const [editEmi, setEditEmi]     = useState({});         // { [oblId]: value }
  const [addingFor, setAddingFor] = useState(null);        // applicant_id
  const [retryingFor, setRetryingFor] = useState(null);     // applicant_id currently re-pulling bureau data
  const [newObl, setNewObl]       = useState({ lender_name: '', loan_type: '', loan_amount: '', outstanding_amount: '', emi_per_month: '', remarks: '' });
  // Every field in the "Add Loan Not in Bureau" form is mandatory — checked
  // as a string/select emptiness test (not truthiness) so a genuine "0" in
  // an amount field still counts as filled in.
  const isNewOblValid =
    newObl.lender_name.trim() !== '' &&
    newObl.loan_type !== '' &&
    newObl.loan_amount !== '' &&
    newObl.outstanding_amount !== '' &&
    newObl.emi_per_month !== '';

  const [deletingId, setDeletingId] = useState(null);       // obligation id currently being removed
  const [applicantNames, setApplicantNames] = useState({}); // { [applicantId]: verifiedName }
  const [bureauReports, setBureauReports] = useState({}); // { [applicantId]: documentRow }
  const [downloadingFor, setDownloadingFor] = useState(null); // applicant_id
  // Applicant ids whose most recent manual pull attempt failed — switches
  // that applicant's button from the initial "Pull Bureau Details" label to
  // a "Retry" label. Cleared again on a successful pull.
  const [bureauFailedFor, setBureauFailedFor] = useState(new Set());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // syncObligations() only re-parses obligations from a bureau report
      // that already exists for this case_id — it never triggers a fresh
      // (billed) CIBIL pull, so it's safe to run unconditionally here.
      await caseService.syncObligations(caseId);
      const [result, caseData] = await Promise.all([
        caseService.getObligations(caseId),
        caseService.getCaseById(caseId)
      ]);

      setData(result);
      // Obligations only return a display name that already falls back to a
      // role label ("Primary Borrower") when Applicant.name is unset — pull
      // the PAN-verified name from the full case record so we can show a
      // real name instead of that placeholder wherever it's available.
      const names = {};
      (caseData.applicants || []).forEach(a => {
        if (a.name || a.pan_verified_name) names[a.id] = a.name || a.pan_verified_name;
      });
      setApplicantNames(names);

      // The bureau vendor (Experian, via Signzy) hands back the actual report
      // file at pull time, which gets ingested into document storage per
      // applicant (see experian.service.js) — surface it here rather than
      // regenerating anything client-side.
      try {
        const docs = await listDocuments({ caseId });
        const reports = {};
        docs.filter(d => d.original_file_name?.startsWith('Experian_Report_'))
          .forEach(d => { reports[d.applicant_id] = d; });
        setBureauReports(reports);
      } catch (docErr) {
        // Non-fatal — obligations already loaded fine, just no download button.
      }

      return result;
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load bureau obligations');
      return null;
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  // `load()` also re-syncs bureau data and can re-run bureau verification —
  // necessary on initial mount, but massive overkill (and a jarring full-page
  // spinner, since it flips `loading` and this component returns a full-page
  // replacement while loading) for reflecting a single EMI edit or a manually
  // added obligation. Just re-fetch the already-correct server-aggregated
  // grouped/summary data instead, with no loading flag flip.
  const refreshObligations = useCallback(async () => {
    const result = await caseService.getObligations(caseId);
    setData(result);
    return result;
  }, [caseId]);

  const handleEmiBlur = async (oblId, val) => {
    if (val === undefined || val === null) return;
    try {
      await caseService.updateObligation(caseId, oblId, { emi_per_month: parseFloat(val) || 0 });
      await refreshObligations();
    } catch (e) {
      toast.error('Failed to update EMI');
    }
  };

  const handleAddObligation = async (applicant_id) => {
    if (!isNewOblValid) return toast.error('All fields are required to add a loan not in bureau');
    try {
      setSaving(true);
      await caseService.addObligation(caseId, { ...newObl, applicant_id });
      toast.success('Obligation added');
      setAddingFor(null);
      setNewObl({ lender_name: '', loan_type: '', loan_amount: '', outstanding_amount: '', emi_per_month: '', remarks: '' });
      await refreshObligations();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add obligation');
    } finally {
      setSaving(false);
    }
  };

  // Soft-deletes (backend marks the row CLOSED + excludes it from FOIR
  // rather than hard-deleting) — safe for both bureau-pulled and manually
  // added obligations alike, no source-based restriction on either end.
  const handleDeleteObligation = async (oblId) => {
    setDeletingId(oblId);
    try {
      await caseService.deleteObligation(caseId, oblId);
      toast.success('Obligation removed');
      await refreshObligations();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to remove obligation');
    } finally {
      setDeletingId(null);
    }
  };

  // The backend marks an applicant's bureau data as "fetched" as soon as the
  // credit-score check succeeds, even if the separate obligations pull came
  // back empty. Used both for the very first pull (button only shows once,
  // manually triggered — no more auto-fetch on mount) and for retrying a
  // failed/incomplete one; same vendor call either way.
  const handlePullBureau = async (applicantId) => {
    const before = (data?.grouped || []).find(g => g.applicant.id === applicantId)?.obligations?.length || 0;
    setRetryingFor(applicantId);
    try {
      const result = await caseService.runBureauVerification(caseId, applicantId);
      await caseService.syncObligations(caseId);
      const fresh = await load();
      const freshApplicant = (fresh?.grouped || []).find(g => g.applicant.id === applicantId)?.applicant;
      const after = (fresh?.grouped || []).find(g => g.applicant.id === applicantId)?.obligations?.length || 0;

      // bureau_fetched only flips true once the credit-score call itself
      // succeeds — that's what decides whether the pull button disappears
      // (per applicant) or switches to a "Retry" label.
      setBureauFailedFor(prev => {
        const next = new Set(prev);
        if (freshApplicant?.bureau_fetched) next.delete(applicantId);
        else next.add(applicantId);
        return next;
      });

      // Score and obligations are two independent vendor calls now (see
      // bureau.controller.js) — a failure in one no longer means the other
      // never ran, so check specifically what actually failed instead of
      // guessing at a PAN/DOB problem whenever the count comes back flat.
      const scoreError = result?.errors?.find(e => e.applicantId === applicantId && e.stage === 'SCORE');
      const obligationsError = result?.errors?.find(e => e.applicantId === applicantId && e.stage === 'OBLIGATIONS');
      if (scoreError) {
        toast.error(`Bureau score check failed: ${scoreError.error}`, { duration: 8000 });
      } else if (after > before) {
        toast.success(`Bureau data fetched — ${after - before} new obligation(s) found`);
      } else if (after > 0) {
        // Re-running the same PAN/DOB against the vendor legitimately returns
        // the same tradelines every time - a flat count here means the
        // applicant's obligations are already on file, not that the pull
        // failed. Only an actual zero total means the vendor found nothing.
        toast.success(`Bureau data fetched — ${after} obligation(s) already on file, no new ones since last pull`);
      } else if (obligationsError) {
        toast.error(`Obligations check failed: ${obligationsError.error}. This is a vendor/connectivity issue, not a problem with the applicant's data — try again shortly.`, { duration: 8000 });
      } else if (freshApplicant?.bureau_fetched) {
        toast.success('Bureau data fetched successfully.');
      } else {
        toast.error("Bureau pull ran but the vendor genuinely has no obligations on file for this applicant — this can be a legitimate 'no credit history' result, not necessarily missing data.", { duration: 6000 });
      }
    } catch (e) {
      setBureauFailedFor(prev => new Set(prev).add(applicantId));
      toast.error(e.response?.data?.error || 'Failed to fetch bureau data');
    } finally {
      setRetryingFor(null);
    }
  };

  const handleGenerateESR = async () => {
    if (gstPending) return toast.error('GST data is still being pulled — please wait for it to finish before generating the ESR.');
    try {
      setGenerating(true);
      await caseService.generateESR(caseId);
      toast.success('Eligibility Report generated!');
      onNext();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to generate ESR');
    } finally {
      setGenerating(false);
    }
  };

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

  if (loading) {
    return (
      <div className="bureau-obligations-page">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: 14 }}>
              <Skeleton width={70} height={10} style={{ marginBottom: 8 }} />
              <Skeleton width={50} height={20} />
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton width={180} height={15} />
          </div>
          <div style={{ padding: 0 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ padding: '14px 16px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                <Skeleton width={150} height={13} />
                <Skeleton width={80} height={13} style={{ marginLeft: 'auto' }} />
                <Skeleton width={80} height={13} />
                <Skeleton width={70} height={20} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { grouped = [], summary = {} } = data || {};
  const addLoanGridCols = isMobile ? '1fr' : '2fr 1.5fr 1fr 1fr 1fr auto';

  return (
    <div className="bureau-obligations-page">
      <style>{`
        .bureau-obligations-page .card,
        .bureau-obligations-page .btn,
        .bureau-obligations-page .form-control { border-radius: 0 !important; }
        /* Dark mode: the shared grey text tokens read too low-contrast on
           this data-heavy page (labels, table headers, dates) — bump them
           to white here specifically, without touching the global theme. */
        :root.dark .bureau-obligations-page {
          --text-secondary: #ffffff;
          --text-tertiary: #ffffff;
        }
        /* Light mode: same low-contrast grey complaint — use black instead. */
        :root:not(.dark) .bureau-obligations-page {
          --text-secondary: #000000;
          --text-tertiary: #000000;
        }
        @media (max-width: 768px) {
          .bureau-obligations-page .applicant-header { padding: 14px 16px !important; }
          .bureau-obligations-page .page-title { font-size: 20px !important; }
        }
      `}</style>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Bureau & Credit Obligations</h1>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>Step 5 of 7 — Review all applicant obligations before generating ESR</p>
        </div>
      </motion.div>

      {/* Info box */}
      <div style={{ padding: '14px 18px', background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 0, marginBottom: 20, fontSize: 13, color: 'var(--text-primary)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span><strong>Review all EMIs carefully.</strong> Obligations directly affect eligibility. Click the EMI field to edit if EMI amounts are different / Loan is closed. Use <strong>+ Add Loan</strong> to include any Loans not shown below.</span>
      </div>

      {/* Per-applicant cards */}
      {grouped.map(({ applicant, obligations: allObligations, total_emi, active_count }, idx) => {
        const obligations = allObligations.filter(o => Number(o.outstanding_amount) > 0);
        return (
        <Panel key={applicant.id} bodyPadding={0} delay={idx * 0.08} style={{ marginBottom: 20 }}>
          {/* Applicant header */}
          <div className="applicant-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: applicant.type === 'PRIMARY' ? 'linear-gradient(135deg, var(--success-bg), transparent)' : 'linear-gradient(135deg, var(--info-bg), transparent)' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)', overflowWrap: 'break-word' }}>
                {applicantNames[applicant.id] || applicant.name || (applicant.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Applicant')}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{applicant.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Borrower'}</span>
            </div>
            {/* Download sits left of the score so the Bureau Score stays the
                right-most element of the header, on both the DSA and MSME
                self-service journeys (same component, rendered inline by
                AddCustomerWizardPage for each). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              {bureauReports[applicant.id] && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadReport(applicant.id)}
                  disabled={downloadingFor === applicant.id}
                  title="Download the full bureau report for this applicant"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileDown size={13} />
                  {downloadingFor === applicant.id ? 'Downloading…' : 'Download Report'}
                </button>
              )}
              {/* No auto-fetch on mount anymore — this is the only trigger for
                  pulling bureau score + obligations. It disappears entirely
                  once the pull succeeds (bureau_fetched flips true); a failed
                  attempt keeps it visible with a "Retry" label instead. */}
              {!applicant.bureau_fetched && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handlePullBureau(applicant.id)}
                  disabled={retryingFor === applicant.id || (!isMsme && bureauCost != null && walletBalance < bureauCost)}
                  title={!isMsme && bureauCost != null && walletBalance < bureauCost ? `Insufficient credits. Wallet: ${walletBalance}, Required: ${bureauCost}.` : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Fingerprint size={13} className={retryingFor === applicant.id ? 'spin' : ''} />
                  {retryingFor === applicant.id
                    ? 'Pulling…'
                    : isMsme
                      ? (bureauFailedFor.has(applicant.id) ? 'Retry Bureau Pull' : 'Pull Bureau Details')
                      : (bureauFailedFor.has(applicant.id) ? `Retry Bureau Pull (~${bureauCost} Cr)` : `Pull Bureau Details (~${bureauCost} Cr)`)}
                </button>
              )}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: getCibilColor(applicant.cibil_score) }}>{applicant.cibil_score || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Bureau Score</div>
              </div>
            </div>
          </div>



          {/* Obligations */}
          {obligations.length > 0 ? (
            isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {obligations.map((obl, i) => (
                  <div key={obl.id} style={{ padding: '14px 16px', borderBottom: i < obligations.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{obl.lender_name || '—'}</span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        background: obl.needs_verification ? 'var(--warning-bg)' : 'var(--success-bg)',
                        color: obl.needs_verification ? 'var(--warning)' : 'var(--success)',
                        border: `1px solid ${obl.needs_verification ? 'var(--warning)' : 'var(--success)'}`,
                        padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
                      }}>
                        {obl.needs_verification ? <AlertTriangle size={11} /> : obl.source === 'MANUAL' ? <PenLine size={11} /> : <CheckCircle2 size={11} />}
                        {obl.needs_verification ? 'Verify' : (obl.source === 'MANUAL' ? 'Manual' : 'Active')}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{obl.loan_type || '—'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Loan Amount</span>
                      <strong>{fmt(obl.loan_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Outstanding</span>
                      <strong>{fmt(obl.outstanding_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 12, marginBottom: 8, gap: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Obligation Details</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        {getObligationDetails(obl).length > 0 ? getObligationDetails(obl).map(d => (
                          <span key={d.label} style={{ background: d.bg, color: d.color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{d.label}</span>
                        )) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>EMI / Month</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          style={{ width: 100, padding: '5px 0', background: 'transparent', border: 'none', borderBottom: obl.needs_verification ? '2px solid var(--warning)' : '2px solid var(--border)', borderRadius: 0, fontSize: 13, fontWeight: 600, color: obl.needs_verification ? 'var(--warning)' : 'var(--text-primary)', outline: 'none' }}
                          value={editEmi[obl.id] !== undefined ? editEmi[obl.id] : obl.emi_per_month}
                          onChange={e => setEditEmi({ ...editEmi, [obl.id]: e.target.value })}
                          onBlur={e => { handleEmiBlur(obl.id, e.target.value); setEditEmi(prev => { const n = { ...prev }; delete n[obl.id]; return n; }); }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/mo</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        onClick={() => handleDeleteObligation(obl.id)}
                        disabled={deletingId === obl.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4, fontSize: 12, fontWeight: 600 }}
                        title="Remove obligation"
                      >
                        <Trash2 size={14} />
                        {deletingId === obl.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div style={{ overflowX: 'auto', minWidth: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Lender', 'Type of Loan', 'Loan Amount', 'Outstanding', 'Obligation Details', 'EMI / Month', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {obligations.map(obl => (
                    <tr key={obl.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{obl.lender_name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{obl.loan_type || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{fmt(obl.loan_amount)}</td>
                      <td style={{ padding: '12px 14px' }}>{fmt(obl.outstanding_amount)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          {getObligationDetails(obl).length > 0 ? getObligationDetails(obl).map(d => (
                            <span key={d.label} style={{ background: d.bg, color: d.color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{d.label}</span>
                          )) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            style={{ width: 90, padding: '5px 0', background: 'transparent', border: 'none', borderBottom: obl.needs_verification ? '2px solid var(--warning)' : '2px solid var(--border)', borderRadius: 0, fontSize: 13, fontWeight: 600, color: obl.needs_verification ? 'var(--warning)' : 'var(--text-primary)', outline: 'none' }}
                            value={editEmi[obl.id] !== undefined ? editEmi[obl.id] : obl.emi_per_month}
                            onChange={e => setEditEmi({ ...editEmi, [obl.id]: e.target.value })}
                            onBlur={e => { handleEmiBlur(obl.id, e.target.value); setEditEmi(prev => { const n = { ...prev }; delete n[obl.id]; return n; }); }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/mo</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: obl.needs_verification ? 'var(--warning-bg)' : 'var(--success-bg)',
                          color: obl.needs_verification ? 'var(--warning)' : 'var(--success)',
                          border: `1px solid ${obl.needs_verification ? 'var(--warning)' : 'var(--success)'}`,
                          padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
                        }}>
                          {obl.needs_verification ? <AlertTriangle size={11} /> : obl.source === 'MANUAL' ? <PenLine size={11} /> : <CheckCircle2 size={11} />}
                          {obl.needs_verification ? 'Verify' : (obl.source === 'MANUAL' ? 'Manual' : 'Active')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          onClick={() => handleDeleteObligation(obl.id)}
                          disabled={deletingId === obl.id}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }}
                          title="Remove obligation"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          ) : (
            <div style={{ padding: '20px 24px' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                {applicant.bureau_fetched
                  ? 'No bureau obligations found for this applicant.'
                  : 'Bureau data not pulled yet for this applicant — use the button above.'}
              </span>
            </div>
          )}

          {/* Add loan row */}
          <AnimatePresence initial={false} mode="wait">
            {addingFor === applicant.id ? (
              <motion.div
                key="add-loan-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '16px 24px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: addLoanGridCols, gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>LENDER *</label>
                      <input className="form-control" placeholder="Bank / NBFC name" value={newObl.lender_name} onChange={e => setNewObl({ ...newObl, lender_name: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>LOAN TYPE *</label>
                      <select className="form-control" value={newObl.loan_type} onChange={e => setNewObl({ ...newObl, loan_type: e.target.value })}>
                        <option value="">— Type —</option>
                        {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>LOAN AMT (₹) *</label>
                      <input type="number" className="form-control" placeholder="0" value={newObl.loan_amount} onChange={e => setNewObl({ ...newObl, loan_amount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>OUTSTANDING *</label>
                      <input type="number" className="form-control" placeholder="0" value={newObl.outstanding_amount} onChange={e => setNewObl({ ...newObl, outstanding_amount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>EMI/MONTH *</label>
                      <input type="number" className="form-control" placeholder="0" value={newObl.emi_per_month} onChange={e => setNewObl({ ...newObl, emi_per_month: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAddObligation(applicant.id)} disabled={saving || !isNewOblValid} title={!isNewOblValid ? 'Fill in every field to add this loan' : undefined}>Add</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAddingFor(null)}><X size={14} /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="add-loan-trigger" style={{ padding: '10px 24px', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingFor(applicant.id)}>
                  <PlusCircle size={13} /> Add Loan Not in Bureau
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>
        );
      })}

      {/* Total Obligation Summary */}
      <Panel
        icon={BarChart3}
        accentColor="var(--warning)"
        title="Total Obligation Summary"
        delay={grouped.length * 0.08}
        style={{ marginBottom: 24, border: '2px solid var(--warning)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 16 }}>
          <MetricTile boxed size="lg" label="Primary Borrower EMI" value={fmt(grouped.find(g => g.applicant.type === 'PRIMARY')?.total_emi)} color="var(--error)" delay={0.05} />
          <MetricTile boxed size="lg" label="Co-Borrower EMIs" value={fmt(grouped.filter(g => g.applicant.type !== 'PRIMARY').reduce((s, g) => s + g.total_emi, 0))} color="var(--error)" delay={0.1} />
          <MetricTile boxed size="lg" highlight label="Combined Monthly EMI" value={fmt(summary.combined_emi_per_month)} color="var(--warning)" delay={0.15} />
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--primary-subtle)', borderRadius: 0, fontSize: 12, color: 'var(--primary-dark)' }}>
          Shared loans (appearing across multiple applicants) are counted once. Edit EMI values above if bureau data differs from actual.
        </div>
      </Panel>

      {/* Bottom nav */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ justifyContent: 'center', width: isMobile ? '100%' : undefined }}><ChevronLeft size={16} /> Back</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'stretch' : 'flex-end', gap: 6 }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleGenerateESR}
            disabled={generating || gstPending}
            title={gstPending ? 'GST data is still being pulled — this becomes available once that finishes.' : undefined}
            style={{ padding: '14px 36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: isMobile ? '100%' : undefined }}
          >
            <Zap size={18} />
            {generating ? 'Generating ESR...' : 'Generate Eligibility Summary Report'}
          </button>
          {gstPending && (
            <span style={{ fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> Waiting for GST pull to finish
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
