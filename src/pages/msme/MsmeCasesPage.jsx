import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, CornerDownRight, Plus, Sparkles } from 'lucide-react';
import { msmeApi } from '../../api/msmeService';
import { useMsmeAuth } from '../../context/MsmeAuthContext';
import { formatCompactINR } from '../../utils/helpers';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CaseStageBadge from '../../components/msme/CaseStageBadge';
import DataPurgedBadge from '../../components/case/DataPurgedBadge';
import TravelingBorderButton from '../../components/TravelingBorderButton';
import EligibilityPaymentModal from '../../components/msme/EligibilityPaymentModal';
import { useEligibilityPayment } from '../../hooks/useEligibilityPayment';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Same amount rule as the desktop table: disbursed, else sanctioned, else requested.
const amountOf = (c) => {
  if (c.total_disbursed_amount > 0) return formatCompactINR(c.total_disbursed_amount);
  if (c.sanctioned_amount) return formatCompactINR(c.sanctioned_amount);
  if (c.loan_amount) return formatCompactINR(c.loan_amount);
  return '—';
};

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
    actionLoading, showPaymentModal, paymentConfig, gstin, setGstin,
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

  // Each lender the customer applied with is its own standalone case (own
  // number, allocated to its own DSA). Only the customer sees how they relate:
  // a lender case carries msme_lender_application_as_child pointing at the main
  // application it was created under, and is listed beneath it.
  const mainIds = new Set(cases.filter(c => !c.msme_lender_application_as_child).map(c => c.id));
  const lenderCasesOf = (mainId) => cases
    .filter(c => c.msme_lender_application_as_child?.case_id === mainId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  // A lender case whose main application is not in the list still gets a row.
  const orphanLenderCases = cases.filter(c => c.msme_lender_application_as_child && !mainIds.has(c.msme_lender_application_as_child.case_id));
  const rows = [
    ...cases.filter(c => !c.msme_lender_application_as_child).flatMap(main => {
      const lenderCases = lenderCasesOf(main.id);
      return [{ kase: main, level: 0, lenderCount: lenderCases.length }, ...lenderCases.map(c => ({ kase: c, level: 1, lenderCount: 0 }))];
    }),
    ...orphanLenderCases.map(c => ({ kase: c, level: 0, lenderCount: 0 })),
  ];
  const applicationCount = cases.filter(c => !c.msme_lender_application_as_child).length;
  const lenderCaseCount = cases.length - applicationCount;

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  return (
    <div className="hide-scrollbar msme-cases-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: isMobile ? 10 : 24 }}>
      {/* Phones: the cards use the whole screen width, so drop the bordered
          panel that wrapped the table and keep only a plain heading. The
          layout's .page-content adds 16px of side padding on phones for every
          page; cancel it here so only this page's own 10px remains. */}
      <style>{`
        /* Status pills are sharp-edged, matching the rest of this portal's square corners. */
        .msme-cases-page .badge { border-radius: 0 !important; }
        /* Larger screens: a denser table so all seven columns fit without
           sideways scrolling (smaller type, tighter cells and buttons). */
        @media (min-width: 769px) {
          .msme-cases-page h1 { font-size: 20px !important; }
          .msme-cases-page table { width: 100%; }
          .msme-cases-page table th { padding: 8px 10px !important; font-size: 11px !important; white-space: nowrap; }
          .msme-cases-page table td { padding: 8px 10px !important; font-size: 12px !important; }
          .msme-cases-page .msme-case-btn { width: 88px !important; height: 28px !important; font-size: 12px !important; gap: 4px !important; }
        }
        @media (max-width: 768px) {
          .msme-cases-page { margin: 0 -16px; width: calc(100% + 32px); }
          .msme-cases-section { border: none !important; background: transparent !important; overflow: visible !important; }
          .msme-cases-section > div:first-child { padding: 0 2px 10px !important; border-bottom: none !important; }
        }
      `}</style>
      <EligibilityPaymentModal
        isOpen={showPaymentModal}
        paymentConfig={paymentConfig}
        gstin={gstin}
        onGstinChange={setGstin}
        actionLoading={actionLoading}
        onCancel={closePaymentModal}
        onPayNow={initiatePayment}
      />
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>My Cases</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {applicationCount} application{applicationCount === 1 ? '' : 's'}
              {lenderCaseCount > 0 && <> with {lenderCaseCount} lender case{lenderCaseCount === 1 ? '' : 's'}</>}
              {' '}in total, across every application you've started with us.
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
          <SectionCard className="msme-cases-section" title="Case History" subtitle="Every application you've started, oldest to newest" delay={0.1}>
            {isMobile ? (
              // Phones: one card per case instead of a wide table. Lender cases
              // are indented under their main application.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rows.map(({ kase: c, level, lenderCount }, i) => {
                  const closed = c.stage === 'CLOSED' || c.stage === 'REJECTED';
                  const inProgress = !closed && !c.assigned_dsa_user && !c.msme_submitted_at;
                  const purged = !!c.data_purged_at;
                  const lender = level > 0
                    ? (c.msme_lender_application_as_child?.lender_name || c.lender_name || '—')
                    : lenderCount > 0
                      ? `${lenderCount} lender${lenderCount === 1 ? '' : 's'}`
                      : (c.lender_name || '—');
                  const buttonStyle = { borderRadius: 0, flex: 1, height: 38, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' };
                  const fact = (label, value) => (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div>
                    </div>
                  );
                  return (
                    <motion.div key={c.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                      style={{
                        padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
                        background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
                        borderLeft: level ? '3px solid var(--primary)' : '1.5px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 800 }}>
                            {level > 0 && <CornerDownRight size={14} color="var(--text-tertiary)" />}
                            CASE-{c.id}
                          </div>
                          {level === 0 && lenderCount > 0 && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 2 }}>Main application</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                          <CaseStageBadge stage={c.stage} />
                          {purged && <DataPurgedBadge />}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Lender</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: level ? 'var(--primary)' : 'var(--text-primary)' }}>{lender}</div>
                        </div>
                        {fact('Product', c.product_type || 'TBD')}
                        {fact('Amount', amountOf(c))}
                        {fact('Last Updated', formatDate(c.updated_at))}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" style={buttonStyle} onClick={() => navigate(`/msme/cases/${c.id}`)}>
                          View
                        </button>
                        {!purged && (
                          <button className="btn btn-primary btn-sm" style={buttonStyle} onClick={() => navigate(`/msme/onboarding?caseId=${c.id}`)}>
                            {inProgress ? 'Continue' : 'Update'} <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Lender</th>
                    <th>Product</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ kase: c, level, lenderCount }, i) => {
                    const closed = c.stage === 'CLOSED' || c.stage === 'REJECTED';
                    const inProgress = !closed && !c.assigned_dsa_user && !c.msme_submitted_at;
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
                        <td data-label="Case ID" style={{ fontWeight: 700, paddingLeft: level ? 28 : undefined, background: level ? 'var(--bg-elevated)' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {level > 0 && <CornerDownRight size={14} color="var(--text-tertiary)" />}
                            CASE-{c.id}
                          </div>
                          {level === 0 && lenderCount > 0 && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              Main application
                            </div>
                          )}
                        </td>
                        <td data-label="Lender" style={{ fontWeight: level ? 700 : 500, color: level ? 'var(--primary)' : 'var(--text-secondary)' }}>
                          {level > 0
                            ? (c.msme_lender_application_as_child?.lender_name || c.lender_name || '—')
                            : lenderCount > 0
                              ? `${lenderCount} lender${lenderCount === 1 ? '' : 's'}`
                              : (c.lender_name || '—')}
                        </td>
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
                            <CaseStageBadge stage={c.stage} />
                            {purged && <DataPurgedBadge />}
                          </div>
                        </td>
                        <td data-label="Last Updated" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatDate(c.updated_at)}</td>
                        <td data-label="Action" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {/* View is always available. The wizard stays reachable on
                              every stage (same rule as MsmeCaseDetailPage's "Update
                              Application") so the customer can fix or add details
                              any time - "Continue" while still drafting, "Update"
                              once submitted/allocated/closed. Only a purged case is
                              permanently read-only: its data is gone, and
                              AddCustomerWizardPage blocks resuming it anyway. */}
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                            <button className="btn btn-secondary btn-sm msme-case-btn" style={{ borderRadius: 0, width: 112, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }} onClick={() => navigate(`/msme/cases/${c.id}`)}>
                              View
                            </button>
                            {!purged && (
                              <button
                                className="btn btn-primary btn-sm msme-case-btn"
                                style={{ borderRadius: 0, width: 112, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}
                                onClick={() => navigate(`/msme/onboarding?caseId=${c.id}`)}
                              >
                                {inProgress ? 'Continue' : 'Update'} <ArrowRight size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
};

export default MsmeCasesPage;
