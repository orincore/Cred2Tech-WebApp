import React, { useState, useEffect, useCallback } from 'react';
import { caseService } from '../api/caseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { listDocuments, downloadDocument } from '../api/documentHelper';
import Skeleton from '../components/ui/Skeleton';
import Panel from '../components/ui/Panel';
import MetricTile from '../components/ui/MetricTile';
import { PlusCircle, ChevronLeft, Zap, AlertTriangle, BarChart3, CheckCircle2, PenLine, X, FileDown, Trash2, Fingerprint, RotateCcw } from 'lucide-react';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const getCibilColor = (score) => {
  if (!score) return 'var(--text-tertiary)';
  if (score >= 700) return 'var(--success)';
  if (score >= 650) return 'var(--warning)';
  return 'var(--error)';
};

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44; // average month length

// Two independent facts per obligation, not a single status:
//  - "Availed within X months" — how recently the loan was taken (loan_start_date vs today)
//  - "O/s < X months" — approximate remaining tenure, accurately estimated using
//    standard amortizing loan math (log formula) based on product ROI defaults.
// Each side always shows a label when the underlying data exists — including
// a "12+" fallback once a loan ages/outlasts both thresholds — so a row only
// goes blank on a side when that side's source data is genuinely missing
// (no loan_start_date, or EMI unverified/zero so remaining tenure can't be
// estimated at all).
const estimateRemainingTenure = (obl) => {
  const p = obl.outstanding_amount;
  const emi = obl.emi_per_month;
  
  if (!p || p <= 0 || !emi || emi <= 0) return 0;
  
  const TERMS_MAP = {
    "Loan Against Property": 9.50,
    "Housing Loan": 8.00,
    "Business Loan": 16.00,
    "Personal Loan": 13.00,
    "Auto Loan": 9.00,
    "Two Wheeler Loan": 9.00,
    "Commercial Vehicle": 9.00,
    "Consumer Loan": 8.00,
    "Agri Loan": 10.00,
    "Education Loan": 9.00,
    "Term loan": 9.50
  };
  
  const roi = TERMS_MAP[obl.loan_type];
  
  // Fall back to flat division for non-amortizing types or unknown types
  if (!roi || obl.loan_type === 'Credit Card' || obl.loan_type === 'Overdraft') {
    return p / emi;
  }
  
  const r = (roi / 100) / 12;
  
  // Protect against negative amortization / bad data (EMI < Interest)
  if (emi <= p * r) {
    return p / emi;
  }
  
  // Exact remaining months for amortizing loan: n = log(E / (E - P*r)) / log(1 + r)
  return Math.log(emi / (emi - p * r)) / Math.log(1 + r);
};

// True once a BUREAU-sourced obligation's EMI has been edited away from the
// figure the bureau actually reported (original_emi_per_month — null for a
// MANUAL entry, or for a legacy row from before this field existed and
// hasn't been re-synced since). Drives showing the "Revert" action in the
// same slot Delete occupies for a MANUAL row.
const emiWasEdited = (obl) =>
  obl.source === 'BUREAU' && obl.original_emi_per_month != null
  && Number(obl.emi_per_month) !== Number(obl.original_emi_per_month);

const getObligationDetails = (obl) => {
  const details = [];

  // Flagged ahead of the manual-source early return below so it's never
  // suppressed regardless of source — a row the backend decided not to
  // count toward the totals (because the bureau reported the same loan
  // again elsewhere) must stay visible here, not silently disappear from
  // the number while still showing in the list with no explanation.
  if (obl.is_counted === false) {
    details.push({
      label: 'Duplicate — not counted',
      color: 'var(--warning)',
      bg: 'var(--warning-bg)',
      title: obl.duplicate_info?.note
        ? `${obl.duplicate_info.note} Review row #${obl.duplicate_info.paired_with_id} — if this is actually a separate loan, edit this row's EMI to include it.`
        : undefined
    });
  }

  // Manual entries never have a loan_start_date — the "Add Loan Not in
  // Bureau" form doesn't collect one — so only the O/s-remaining half of
  // this heuristic could ever fire for them, showing a lopsided badge
  // instead of the "recency + remaining tenure" pair this column means to
  // convey. Show the plain "—" fallback for these instead.
  if (obl.source === 'MANUAL') return details;

  if (obl.loan_start_date) {
    const monthsSinceStart = (Date.now() - new Date(obl.loan_start_date).getTime()) / MONTH_MS;
    if (monthsSinceStart <= 6) details.push({ label: 'Availed within 6 months', color: 'var(--info)', bg: 'var(--info-bg)' });
    else if (monthsSinceStart <= 12) details.push({ label: 'Availed within 12 months', color: 'var(--info)', bg: 'var(--info-bg)' });
    else details.push({ label: 'Availed 12+ months ago', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' });
  }

  if (obl.emi_per_month > 0 && obl.outstanding_amount != null) {
    const monthsRemaining = estimateRemainingTenure(obl);
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

// A Proprietorship's PAN (and a plain "Individual" applicant's) IS the
// person's own PAN, so a bureau pull against the primary borrower returns
// that person's real credit history. Every other constitution (Partnership,
// LLP, Pvt/Public Ltd, HUF, Trust, AOP/BOI, etc.) is a distinct legal entity
// with no personal credit file of its own — pulling bureau against it is
// meaningless, so those cases must get their credit picture from a
// co-applicant (a director/partner/authorized individual) instead. Matched
// as a substring, case-insensitively, since the PAN/GST vendor's
// constitution_of_business text isn't a fixed enum on our side (e.g. "Sole
// Proprietorship" vs "Proprietorship").
const BUREAU_ELIGIBLE_ENTITY_RE = /individual|proprietor/i;

// Step 5 of the case journey — rendered inline by AddCustomerWizardPage
// (not its own route), so it takes caseId/onNext/onBack as props instead of
// reading useParams()/navigating itself.
export default function BureauObligationsPage({ caseId, onNext, onBack, mode, walletBalance, bureauCost, onAddCoApplicant }) {
  const isMobile = useIsMobile();
  // MSME self-service borrowers don't see wallet-credit costs (DSA concept) —
  // same convention GstAnalyticsForm/ItrAnalyticsForm/BankStatementUpload use.
  const isMsme = mode === 'MSME_SELF_SERVICE';

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
  const [revertingId, setRevertingId] = useState(null);      // obligation id currently being reverted to its bureau-reported EMI
  const [applicantNames, setApplicantNames] = useState({}); // { [applicantId]: verifiedName }
  // Customer.entity_type (the persisted constitution-of-business, e.g.
  // "Proprietorship" / "Partnership" / "Private Limited Company") — drives
  // whether the primary borrower even gets a bureau-pull option below. Null
  // until the case loads, and stays null for older cases that predate this
  // field — treated as bureau-eligible (fail open) rather than blocking a
  // case we genuinely don't know the entity type for.
  const [entityType, setEntityType] = useState(null);
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
      setEntityType(caseData.customer?.entity_type || null);
      // Obligations only return a display name that already falls back to a
      // role label ("Primary Borrower") when Applicant.name is unset — pull
      // the PAN-verified name from the full case record so we can show a
      // real name instead of that placeholder wherever it's available.
      const names = {};
      const reports = {};
      (caseData.applicants || []).forEach(a => {
        if (a.name || a.pan_verified_name) names[a.id] = a.name || a.pan_verified_name;
      });
      setApplicantNames(names);

      // Every bureau pull (BEFISC, Signzy CIBIL fallback, or the older
      // Experian flow) snapshots its report into S3-backed document storage
      // at pull time — see befiscBureau.service.js / signzyCibil.service.js.
      // The vendor's own link (BEFISC's webtoken URL especially) is single-use
      // and expires within hours, so the stored document is the only copy
      // that stays downloadable/shareable later. listDocuments returns newest
      // first, so the first match per applicant is always their latest report.
      try {
        const docs = await listDocuments({ caseId });
        docs.filter(d => d.document_type === 'CIBIL_REPORT_PDF' || d.original_file_name?.startsWith('Experian_Report_'))
          .forEach(d => { if (!reports[d.applicant_id]) reports[d.applicant_id] = d; });
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

  // Brings a BUREAU obligation's EMI back to the real bureau-reported figure
  // (obl.original_emi_per_month — captured once at first sync and never
  // touched again, see obligations.service.js) after a DSA has edited it away
  // from that value. Goes through the exact same updateObligation call as a
  // normal manual edit, so the reverted figure is actually persisted (and
  // feeds ESR/FOIR like any other edit) rather than just resetting what's
  // shown on screen.
  const handleRevertEmi = async (oblId, originalValue) => {
    setRevertingId(oblId);
    try {
      await caseService.updateObligation(caseId, oblId, { emi_per_month: originalValue });
      toast.success('EMI reverted to the bureau-reported figure');
      await refreshObligations();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to revert EMI');
    } finally {
      setRevertingId(null);
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

      // bureau_fetched only flips true once the Experian pull actually
      // returns a usable score — that's what decides whether the pull
      // button disappears (per applicant) or switches to a "Retry" label.
      setBureauFailedFor(prev => {
        const next = new Set(prev);
        if (freshApplicant?.bureau_fetched) next.delete(applicantId);
        else next.add(applicantId);
        return next;
      });

      // Score and obligations both come from one Experian pull now (see
      // bureau.controller.js — the separate CIBIL score check was dropped),
      // so a single vendor error covers both; check what actually failed
      // instead of guessing at a PAN/DOB problem whenever the count comes
      // back flat.
      const obligationsError = result?.errors?.find(e => e.applicantId === applicantId && e.stage === 'OBLIGATIONS');
      if (after > before) {
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

  // Recomputed every render off `data`/`entityType` state (both cheap,
  // already-loaded values) rather than memoized — this page re-renders on
  // every obligation edit anyway, and a stale flag here would either wrongly
  // block a case that just added its co-applicant or wrongly let one through.
  const bureauBlockedForPrimary = !!entityType && !BUREAU_ELIGIBLE_ENTITY_RE.test(entityType);
  const hasCoApplicant = (data?.grouped || []).some(g => g.applicant.type !== 'PRIMARY');
  const mustAddCoApplicant = bureauBlockedForPrimary && !hasCoApplicant;

  const handleGenerateESR = async () => {
    if (mustAddCoApplicant) return toast.error(`${entityType} entities have no personal credit history of their own — add a co-applicant before generating the Eligibility Summary Report.`, { duration: 6000 });
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
    if (!doc?.id) return;

    // Always the S3-stored copy — BEFISC's webtoken URL and any raw vendor
    // pdfUrl are single-use/short-lived, so this document is the only thing
    // that stays downloadable (or shareable) after the pull itself.
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

      {/* Co-applicant required notice — only for entities with no personal
          credit history of their own (see BUREAU_ELIGIBLE_ENTITY_RE). Shown
          until at least one co-applicant exists on the case. */}
      {mustAddCoApplicant && (
        <div style={{ padding: '14px 18px', background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 0, marginBottom: 20, fontSize: 13, color: 'var(--text-primary)', display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>Co-applicant required.</strong> {entityType} is a business entity with no personal credit history of its own, so bureau/credit obligations can only be pulled for a co-applicant. Add at least one co-applicant to continue.
            </span>
          </div>
          {onAddCoApplicant && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onAddCoApplicant} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              + Add Co-Applicant
            </button>
          )}
        </div>
      )}

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
              {bureauReports[applicant.id]?.id ? (
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
              ) : applicant.bureau_fetched && (
                /* Bureau was pulled but the PDF snapshot failed (Puppeteer/S3
                   error at pull time). Re-pulling fetches a fresh vendor token
                   and attempts the snapshot again — same flow as the first pull. */
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handlePullBureau(applicant.id)}
                  disabled={retryingFor === applicant.id}
                  title="Report PDF was not saved during the original pull — click to re-pull and capture it"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'var(--warning)', color: 'var(--warning)' }}
                >
                  <RotateCcw size={13} className={retryingFor === applicant.id ? 'icon-loading' : ''} />
                  {retryingFor === applicant.id ? 'Re-pulling…' : 'Re-pull Report'}
                </button>
              )}
              {/* Primary borrower of a non-individual/non-proprietor entity has
                  no personal PAN to pull a credit file against — no button,
                  no "not fetched" dead-end, just the reason and where to fix
                  it (the co-applicant-required notice above). */}
              {applicant.type === 'PRIMARY' && bureauBlockedForPrimary ? (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 220, textAlign: 'right', lineHeight: 1.4 }}>
                  Not applicable for {entityType} — pull bureau for a co-applicant instead.
                </span>
              ) : (
                // No auto-fetch on mount anymore — this is the only trigger for
                // pulling bureau score + obligations. It disappears entirely
                // once the pull succeeds (bureau_fetched flips true); a failed
                // attempt keeps it visible with a "Retry" label instead.
                !applicant.bureau_fetched && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handlePullBureau(applicant.id)}
                    disabled={retryingFor === applicant.id || (!isMsme && bureauCost != null && walletBalance < bureauCost)}
                    title={!isMsme && bureauCost != null && walletBalance < bureauCost ? `Insufficient credits. Wallet: ${walletBalance}, Required: ${bureauCost}.` : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Fingerprint size={13} className={retryingFor === applicant.id ? 'icon-loading' : ''} />
                    {retryingFor === applicant.id
                      ? 'Pulling…'
                      : isMsme
                        ? (bureauFailedFor.has(applicant.id) ? 'Retry Bureau Pull' : 'Pull Bureau Details')
                        : (bureauFailedFor.has(applicant.id) ? `Retry Bureau Pull (~${bureauCost} Cr)` : `Pull Bureau Details (~${bureauCost} Cr)`)}
                  </button>
                )
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
                          <span key={d.label} title={d.title} style={{ background: d.bg, color: d.color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{d.label}</span>
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
                    {/* Delete is manual-entry-only — an API-fetched (BUREAU)
                        obligation would just come right back on the next
                        bureau sync, so deleting it here would be silently
                        undone rather than actually removing it. A BUREAU row
                        gets a Revert action in this same slot instead, once
                        its EMI has actually been edited away from the
                        bureau-reported figure. */}
                    {obl.source === 'MANUAL' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        onClick={() => handleDeleteObligation(obl.id)}
                        disabled={deletingId === obl.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4, fontSize: 12, fontWeight: 600 }}
                        title="Delete obligation"
                      >
                        <Trash2 size={14} />
                        {deletingId === obl.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                    ) : emiWasEdited(obl) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        onClick={() => handleRevertEmi(obl.id, obl.original_emi_per_month)}
                        disabled={revertingId === obl.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--info)', cursor: 'pointer', padding: 4, fontSize: 12, fontWeight: 600 }}
                        title={`Revert to the bureau-reported EMI (${fmt(obl.original_emi_per_month)}/mo)`}
                      >
                        <RotateCcw size={14} />
                        {revertingId === obl.id ? 'Reverting…' : 'Revert'}
                      </button>
                    </div>
                    )}
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
                            <span key={d.label} title={d.title} style={{ background: d.bg, color: d.color, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{d.label}</span>
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
                        {/* Manual-entry-only — see the mobile view's own
                            comment on why an API-fetched (BUREAU) row can't
                            be deleted here. It gets a Revert action in this
                            same slot instead, once its EMI has actually been
                            edited away from the bureau-reported figure. */}
                        {obl.source === 'MANUAL' ? (
                          <button
                            onClick={() => handleDeleteObligation(obl.id)}
                            disabled={deletingId === obl.id}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }}
                            title="Remove obligation"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : emiWasEdited(obl) && (
                          <button
                            onClick={() => handleRevertEmi(obl.id, obl.original_emi_per_month)}
                            disabled={revertingId === obl.id}
                            style={{ background: 'none', border: 'none', color: 'var(--info)', cursor: 'pointer', padding: 4 }}
                            title={`Revert to the bureau-reported EMI (${fmt(obl.original_emi_per_month)}/mo)`}
                          >
                            <RotateCcw size={15} className={revertingId === obl.id ? 'icon-loading' : ''} />
                          </button>
                        )}
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
                  : applicant.type === 'PRIMARY' && bureauBlockedForPrimary
                    ? `Bureau pull isn't available for ${entityType} — no personal credit file exists for this entity.`
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
            disabled={generating || mustAddCoApplicant}
            title={mustAddCoApplicant ? `Add a co-applicant — ${entityType} has no personal credit history of its own.` : undefined}
            style={{ padding: '14px 36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: isMobile ? '100%' : undefined }}
          >
            <Zap size={18} />
            {generating ? 'Generating ESR...' : 'Generate Eligibility Summary Report'}
          </button>
          {mustAddCoApplicant ? (
            <span style={{ fontSize: 12, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> Add a co-applicant to continue
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
