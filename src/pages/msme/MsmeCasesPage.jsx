import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { msmeApi } from '../../api/msmeService';
import { useMsmeAuth } from '../../context/MsmeAuthContext';
import { formatCompactINR, CASE_STAGE_LABELS } from '../../utils/helpers';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import DataPurgedBadge from '../../components/case/DataPurgedBadge';
import TravelingBorderButton from '../../components/TravelingBorderButton';
import EligibilityPaymentModal from '../../components/msme/EligibilityPaymentModal';
import { useEligibilityPayment } from '../../hooks/useEligibilityPayment';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MsmeCasesPage = () => {
  const navigate = useNavigate();
  const { user } = useMsmeAuth();
  const [cases, setCases] = useState([]);
  // Whether there's a paid amount not yet claimed by any case — the only
  // thing allowed to skip the payment gateway for a genuinely NEW case (see
  // useEligibilityPayment.js). Not returned by getCases(), so fetched
  // alongside it.
  const [hasUnclaimedPayment, setHasUnclaimedPayment] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    actionLoading, showPaymentModal, paymentConfig,
    startNewCase, initiatePayment, closePaymentModal,
  } = useEligibilityPayment({ prefill: { name: user?.name, email: user?.email, mobile: user?.mobile } });

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = 'Cred2Tech | My Cases';
    (async () => {
      try {
        const [casesRes, dashboardRes] = await Promise.all([
          msmeApi.getCases(),
          msmeApi.getDashboard(),
        ]);
        setCases(casesRes.data.cases || []);
        setHasUnclaimedPayment(!!dashboardRes.data.hasUnclaimedPayment);
      } catch (err) {
        toast.error('Failed to load your cases');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNewCase = () => startNewCase(hasUnclaimedPayment);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  return (
    <div className="hide-scrollbar" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: isMobile ? 16 : 24 }}>
      <EligibilityPaymentModal
        isOpen={showPaymentModal}
        paymentConfig={paymentConfig}
        actionLoading={actionLoading}
        onCancel={closePaymentModal}
        onPayNow={initiatePayment}
      />
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              MSME Portal
            </p>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>My Cases</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {cases.length} case{cases.length === 1 ? '' : 's'} in total, across every application you've started with us.
            </p>
          </div>
          {/* Always available — protected by the same payment gate as the
              dashboard's "Run Eligibility" action (useEligibilityPayment):
              always opens a BLANK new case, never resumes whatever's
              currently in progress (that has its own "Continue" button per
              row below). Skips straight to the wizard only when there's a
              genuinely unclaimed payment; otherwise shows the Razorpay
              modal first. */}
          <TravelingBorderButton size="sm" onClick={handleNewCase} disabled={actionLoading} className="rounded-none">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> New Case
            </div>
          </TravelingBorderButton>
        </div>

        {cases.length === 0 ? (
          <SectionCard delay={0.05}>
            <EmptyState
              icon={Sparkles}
              title="No cases yet"
              description="You haven't started a loan application with us yet. Run an eligibility check to see what you qualify for."
              action={
                <TravelingBorderButton size="sm" onClick={handleNewCase} disabled={actionLoading} className="rounded-none">
                  Run Eligibility
                </TravelingBorderButton>
              }
            />
          </SectionCard>
        ) : (
          <SectionCard title="Case History" subtitle="Every application you've started, oldest to newest" delay={0.1}>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Product</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c, i) => {
                    const closed = c.stage === 'CLOSED' || c.stage === 'REJECTED';
                    // Purge is time-based, independent of stage — a purged
                    // case can still be non-terminal/unallocated, so it must
                    // be excluded from the "Continue" (resume wizard) branch
                    // explicitly rather than relying on `closed` alone.
                    const purged = !!c.data_purged_at;
                    return (
                      <motion.tr key={c.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.03 }}
                      >
                        <td data-label="Case ID" style={{ fontWeight: 700 }}>CASE-{c.id}</td>
                        <td data-label="Product">{c.product_type || 'TBD'}</td>
                        <td data-label="Amount">
                          {c.total_disbursed_amount > 0
                            ? formatCompactINR(c.total_disbursed_amount)
                            : c.sanctioned_amount
                              ? formatCompactINR(c.sanctioned_amount)
                              : (c.loan_amount || c.sanctioned_amount)
                                ? formatCompactINR(c.loan_amount || c.sanctioned_amount)
                                : '—'}
                        </td>
                        <td data-label="Status">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <Badge type="level" value={CASE_STAGE_LABELS[c.stage] || c.stage} />
                            {purged && <DataPurgedBadge />}
                          </div>
                        </td>
                        <td data-label="Last Updated" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatDate(c.updated_at)}</td>
                        <td data-label="Action" style={{ textAlign: 'right' }}>
                          {closed || purged || c.assigned_dsa_user ? (
                            // Once a DSA is allocated, the case has moved past the
                            // self-service application wizard — its draft-restore
                            // logic doesn't cover that stage and just errors.
                            // Purged cases are also always "View" — never resumable.
                            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate(`/msme/cases/${c.id}`)}>
                              View
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ borderRadius: 0 }}
                              onClick={() => navigate(`/msme/onboarding?caseId=${c.id}`)}
                            >
                              Continue <ArrowRight size={13} />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
};

export default MsmeCasesPage;
