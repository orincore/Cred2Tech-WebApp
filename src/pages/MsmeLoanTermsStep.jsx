import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Send, ChevronLeft } from 'lucide-react';
import { msmeApi } from '../api/msmeService';

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

// Step 7 of the MSME self-service journey - rendered inline by
// AddCustomerWizardPage in place of the DSA's ProposalStep. The MSME states
// how much they need and for how long before the case goes to the Cred2Tech
// admin queue; the assigned DSA prepares the actual proposal against these
// stated terms (and the lender's real eligible amount/ROI/tenure).
export default function MsmeLoanTermsStep({ caseId, lender, onBack }) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [rate, setRate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const maxAmount = lender?.final_eligible_loan_amount || null;
  const maxTenure = lender?.max_tenure_months || null;
  const maxRate = lender?.roi_max || lender?.roi_min || null;

  useEffect(() => {
    if (lender) {
      setAmount(lender.final_eligible_loan_amount ? String(Math.round(lender.final_eligible_loan_amount)) : '');
      setTenure(lender.max_tenure_months ? String(lender.max_tenure_months) : '');
      setRate(lender.roi_min ? String(lender.roi_min) : '');
    }
  }, [lender]);

  // Live EMI preview - recalculates automatically whenever amount, tenure, or
  // rate changes, so the MSME sees the effect of adjusting any one of them
  // without needing to submit first.
  const emi = useMemo(() => {
    const P = Number(amount);
    const n = Number(tenure);
    const annualRate = Number(rate);
    if (!P || !n || !annualRate) return 0;
    const r = annualRate / 12 / 100;
    return Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  }, [amount, tenure, rate]);
  const totalRepayment = emi * (Number(tenure) || 0);
  const totalInterest = Math.max(0, totalRepayment - (Number(amount) || 0));

  if (!lender) {
    return (
      <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No lender selected</h3>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>Please go back and choose a bank to apply with.</p>
        <button className="btn btn-primary" onClick={onBack}>
          <ChevronLeft size={16} /> Back to Eligible Lenders
        </button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Enter the loan amount you need');
    if (maxAmount && Number(amount) > maxAmount) return toast.error(`Amount cannot exceed the eligible amount of ${formatDynamicCurrency(maxAmount)}`);
    if (!tenure || Number(tenure) <= 0) return toast.error('Enter the tenure you need');
    if (maxTenure && Number(tenure) > maxTenure) return toast.error(`Tenure cannot exceed the max tenure of ${maxTenure} months`);
    if (rate && maxRate && Number(rate) > maxRate) return toast.error(`Interest rate cannot exceed the lender's rate of ${maxRate}%`);
    try {
      setSubmitting(true);
      await msmeApi.selectLender(lender.dbLenderId);
      await msmeApi.submitCase({
        caseId,
        requested_amount: amount,
        tenure_months: tenure,
        interest_rate: rate || undefined
      });
      toast.success('Application submitted to Cred2Tech Team successfully!');
      navigate('/msme/dashboard');
    } catch (err) {
      toast.error('Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Apply with {lender.lender_name}</h1>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 4, fontSize: 13 }}>
          Tell us how much you need - our team will allocate this to a DSA partner who prepares your actual proposal for {lender.lender_name}.
        </p>
      </div>

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Loan Amount Needed (₹)</label>
          <input type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 4000000" min="1" max={maxAmount || undefined} />
          {lender.final_eligible_loan_amount != null && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Eligible up to {formatDynamicCurrency(lender.final_eligible_loan_amount)}</div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Tenure Needed (months)</label>
          <input type="number" className="form-control" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="e.g. 120" min="1" max={maxTenure || undefined} />
          {lender.max_tenure_months != null && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Max tenure {formatDynamicTenure(lender.max_tenure_months)}</div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Expected Interest Rate (% p.a., optional)</label>
          <input type="number" step="0.1" className="form-control" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 9.5" max={maxRate || undefined} />
          {lender.roi_min != null && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Lender range {lender.roi_min}%{lender.roi_max ? `–${lender.roi_max}%` : ''}</div>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-ghost" type="button" onClick={onBack} disabled={submitting}>
          <ChevronLeft size={16} /> Back
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={16} /> {submitting ? 'Submitting...' : 'Submit to Cred2Tech Team'}
        </button>
      </div>
    </div>
  );
}
