import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Send, ChevronLeft, X } from 'lucide-react';
import { msmeApi } from '../api/msmeService';
import SourcingConsentModal from '../components/msme/SourcingConsentModal';

const formatDynamicCurrency = (n) => {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (num >= 10000000) return `₹${(num / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatDynamicTenure = (months) => {
  if (months === null || months === undefined) return '—';
  const m = Number(months);
  if (m % 12 === 0) return `${m / 12} Years`;
  return `${(m / 12).toFixed(1)} Years`;
};

const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 };
const hintStyle = { fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 };

// Terms a lender card starts with: the lender's own eligible figures.
const defaultTerms = (lender) => ({
  amount: lender.final_eligible_loan_amount ? String(Math.round(lender.final_eligible_loan_amount)) : '',
  tenure: lender.max_tenure_months ? String(lender.max_tenure_months) : '',
  rate: lender.roi_min ? String(lender.roi_min) : '',
});

// Live EMI preview - recalculates as the customer adjusts amount, tenure or
// rate, so the effect is visible without submitting first.
const calcEmi = ({ amount, tenure, rate }) => {
  const P = Number(amount);
  const n = Number(tenure);
  const annualRate = Number(rate);
  if (!P || !n || !annualRate) return 0;
  const r = annualRate / 12 / 100;
  return Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
};

// Step 7 of the MSME self-service journey - rendered inline by
// AddCustomerWizardPage in place of the DSA's ProposalStep. The MSME states how
// much they need, and for how long, from each lender they ticked on step 6;
// all of them go to the Cred2Tech admin queue together. The assigned DSA then
// prepares the actual proposals against these stated terms (and each lender's
// real eligible amount/ROI/tenure).
export default function MsmeLoanTermsStep({ caseId, lenders = [], existingApplications = [], onRemoveLender, onBack }) {
  const navigate = useNavigate();
  // Terms per lender, keyed by dbLenderId.
  const [terms, setTerms] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Consent popup: null = closed, otherwise the server's {version, points}.
  const [consent, setConsent] = useState(null);
  const [consentError, setConsentError] = useState('');

  // Seed terms for newly added lenders only - never overwrite what was typed.
  useEffect(() => {
    setTerms((prev) => {
      const next = { ...prev };
      for (const l of lenders) if (!next[l.dbLenderId]) next[l.dbLenderId] = defaultTerms(l);
      return next;
    });
  }, [lenders]);

  const setField = (dbLenderId, field, value) =>
    setTerms((prev) => ({ ...prev, [dbLenderId]: { ...prev[dbLenderId], [field]: value } }));

  if (lenders.length === 0) {
    return (
      <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No lender selected</h3>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>Please go back and choose one or more banks to apply with.</p>
        <button className="btn btn-primary" onClick={onBack}>
          <ChevronLeft size={16} /> Back to Eligible Lenders
        </button>
      </div>
    );
  }

  // First problem found across all lenders, naming the lender it belongs to.
  const validate = () => {
    for (const l of lenders) {
      const t = terms[l.dbLenderId] || defaultTerms(l);
      const maxAmount = l.final_eligible_loan_amount || null;
      const maxTenure = l.max_tenure_months || null;
      const maxRate = l.roi_max || l.roi_min || null;
      if (!t.amount || Number(t.amount) <= 0) return `${l.lender_name}: enter the loan amount you need`;
      if (maxAmount && Number(t.amount) > maxAmount) return `${l.lender_name}: amount cannot exceed the eligible amount of ${formatDynamicCurrency(maxAmount)}`;
      if (!t.tenure || Number(t.tenure) <= 0) return `${l.lender_name}: enter the tenure you need`;
      if (maxTenure && Number(t.tenure) > maxTenure) return `${l.lender_name}: tenure cannot exceed the max tenure of ${maxTenure} months`;
      if (t.rate && maxRate && Number(t.rate) > maxRate) return `${l.lender_name}: interest rate cannot exceed ${maxRate}%`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const problem = validate();
    if (problem) return toast.error(problem);
    try {
      setSubmitting(true);
      const { data } = await msmeApi.getSourcingConsent(caseId, lenders.map((l) => l.dbLenderId));
      // Already accepted for this case (e.g. an earlier submit failed after
      // consent) - don't ask again.
      if (data.accepted) return await finishSubmit();
      setConsentError('');
      setConsent(data);   // the whole server-built wording, lender names and data list included
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not load the consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Runs only after the customer accepts: the consent is recorded first, and
  // only a recorded consent lets the case go on to the Cred2Tech queue.
  const handleAccept = async () => {
    try {
      setSubmitting(true);
      setConsentError('');
      await msmeApi.recordSourcingConsent(caseId, consent.version, lenders.map((l) => l.dbLenderId));
      setConsent(null);
      await finishSubmit();
    } catch (err) {
      setConsentError(err?.response?.data?.error || 'Failed to record your consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const finishSubmit = async () => {
    try {
      const res = await msmeApi.submitCase({
        caseId,
        applications: lenders.map((l) => {
          const t = terms[l.dbLenderId] || defaultTerms(l);
          return {
            esr_lender_id: l.dbLenderId,
            requested_amount: t.amount,
            tenure_months: t.tenure,
            interest_rate: t.rate || undefined,
          };
        }),
      });
      // Every lender is its own case with its own number.
      const created = res?.data?.lender_cases || [];
      toast.success(
        created.length
          ? `Submitted to Cred2Tech: ${created.map((c) => `CASE-${c.case_id} (${c.lender_name})`).join(', ')}`
          : 'Application submitted to Cred2Tech Team successfully!',
        { duration: 7000 }
      );
      // The cases list is where the new lender cases show up under this application.
      navigate('/msme/cases');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to submit application');
    }
  };

  const plural = lenders.length === 1 ? '' : 's';
  const hasExisting = existingApplications.length > 0;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {hasExisting
            ? `Add ${lenders.length} more lender${plural}`
            : lenders.length === 1 ? `Apply with ${lenders[0].lender_name}` : `Apply with ${lenders.length} lenders`}
        </h1>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 4, fontSize: 13 }}>
          Tell us how much you need from {lenders.length === 1 ? 'this lender' : 'each lender'} - our team will allocate this to a Sourcing Partner who prepares your actual proposal{plural}.
        </p>
      </div>

      {hasExisting && (
        <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Already with Cred2Tech ({existingApplications.length}) - these stay as they are</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {existingApplications.map((a) => (
              <div key={`${a.lender_id || ''}-${a.lender_name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>
                  {a.lender_name}
                  {a.child_case_id && <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}> · CASE-{a.child_case_id}</span>}
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {a.requested_amount != null ? formatDynamicCurrency(a.requested_amount) : '—'}
                  {a.tenure_months ? ` · ${formatDynamicTenure(a.tenure_months)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {lenders.map((lender) => {
          const t = terms[lender.dbLenderId] || defaultTerms(lender);
          const maxAmount = lender.final_eligible_loan_amount || null;
          const maxTenure = lender.max_tenure_months || null;
          const maxRate = lender.roi_max || lender.roi_min || null;
          const emi = calcEmi(t);
          const totalRepayment = emi * (Number(t.tenure) || 0);
          const totalInterest = Math.max(0, totalRepayment - (Number(t.amount) || 0));
          return (
            <div key={lender.dbLenderId} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{lender.lender_name}</div>
                {lenders.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveLender(lender.dbLenderId)}
                    disabled={submitting} title="Remove this lender from your application"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <X size={14} /> Remove
                  </button>
                )}
              </div>
              <div>
                <label style={labelStyle}>Loan Amount Needed (₹)</label>
                <input type="number" className="form-control" value={t.amount} onChange={e => setField(lender.dbLenderId, 'amount', e.target.value)} placeholder="e.g. 4000000" min="1" max={maxAmount || undefined} />
                {lender.final_eligible_loan_amount != null && (
                  <div style={hintStyle}>Eligible up to {formatDynamicCurrency(lender.final_eligible_loan_amount)}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Tenure Needed (months)</label>
                <input type="number" className="form-control" value={t.tenure} onChange={e => setField(lender.dbLenderId, 'tenure', e.target.value)} placeholder="e.g. 120" min="1" max={maxTenure || undefined} />
                {lender.max_tenure_months != null && (
                  <div style={hintStyle}>Max tenure {formatDynamicTenure(lender.max_tenure_months)}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Expected Interest Rate (% p.a., optional)</label>
                <input type="number" step="0.1" className="form-control" value={t.rate} onChange={e => setField(lender.dbLenderId, 'rate', e.target.value)} placeholder="e.g. 9.5" max={maxRate || undefined} />
                {lender.roi_min != null && (
                  <div style={hintStyle}>Lender range {lender.roi_min}%{lender.roi_max ? `–${lender.roi_max}%` : ''}</div>
                )}
              </div>

              {emi > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly EMI</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{formatDynamicCurrency(emi)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Interest</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{formatDynamicCurrency(totalInterest)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Repayment</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{formatDynamicCurrency(totalRepayment)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <button className="btn btn-ghost" type="button" onClick={onBack} disabled={submitting}>
          <ChevronLeft size={16} /> {lenders.length === 1 ? 'Back' : 'Add or change lenders'}
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={16} /> {submitting ? 'Submitting...' : hasExisting
            ? `Add ${lenders.length} Lender${plural} to My Application`
            : `Submit ${lenders.length} Application${plural} to Cred2Tech Team`}
        </button>
      </div>

      <SourcingConsentModal
        isOpen={!!consent}
        content={consent}
        submitting={submitting}
        error={consentError}
        onAccept={handleAccept}
        onClose={() => setConsent(null)}
      />
    </div>
  );
}
