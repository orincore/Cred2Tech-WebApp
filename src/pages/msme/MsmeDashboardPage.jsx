import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Sparkles, FolderOpen, BarChart3, Star, UserCircle,
  Sun, CloudSun, Moon, ArrowRight, Archive,
} from 'lucide-react';
import { msmeApi } from '../../api/msmeService';
import { useMsmeAuth } from '../../context/MsmeAuthContext';
import { toTitleCase, resolveEntityName } from '../../utils/helpers';
import { formatCompactINR, CASE_STAGE_LABELS } from '../../utils/helpers';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import DataPurgedBadge from '../../components/case/DataPurgedBadge';
import TravelingBorderButton from '../../components/TravelingBorderButton';
import EligibilityPaymentModal from '../../components/msme/EligibilityPaymentModal';
import { useEligibilityPayment } from '../../hooks/useEligibilityPayment';

const MsmeDashboardPage = () => {
  const { user } = useMsmeAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [cases, setCases] = useState([]);
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
    document.title = 'Cred2Tech | MSME Dashboard';
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      // "Your Allocated DSA" needs every case's own allocation, not just the
      // single activeCase getDashboard() returns — a customer can now have
      // several concurrent cases (see "New Case"), each possibly allocated
      // to a different tenant.
      const [dashRes, casesRes] = await Promise.all([msmeApi.getDashboard(), msmeApi.getCases()]);
      setDashboardData(dashRes.data);
      setCases(casesRes.data.cases || []);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEligibilityClick = () => {
    if (!dashboardData) return;
    startNewCase(dashboardData.hasUnclaimedPayment);
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  const { activeCase, emptyState, totalCasesCount } = dashboardData || {};
  // proprietor_name is a plain user-entered/KYC identity field; business_name/trade_name
  // are derived from GST vendor lookups and can end up holding a GST registration
  // reference number when the business never registered a real trade name — prefer
  // the reliable identity field first.
  const businessName = toTitleCase(resolveEntityName(activeCase?.customer, user?.name)) || 'User';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const primaryApplicant = activeCase?.applicants?.find(a => a.type === 'PRIMARY');
  const cibilScore = primaryApplicant?.cibil_score || null;

  const quickActions = [
    { label: 'My Cases', icon: FolderOpen, path: '/msme/cases' },
    { label: 'My Profile', icon: UserCircle, path: '/msme/profile' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>

      {/* Payment Modal */}
      <EligibilityPaymentModal
        isOpen={showPaymentModal}
        paymentConfig={paymentConfig}
        actionLoading={actionLoading}
        onCancel={closePaymentModal}
        onPayNow={initiatePayment}
      />

      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid var(--outline)',
          padding: isMobile ? '16px' : '24px 24px 20px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            MSME Portal
          </p>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            {greeting}, {businessName}{' '}
            {hour < 12 ? <Sun size={20} color="#f59e0b" /> : hour < 17 ? <CloudSun size={20} color="#f59e0b" /> : <Moon size={20} color="#6366f1" />}
          </h1>
        </div>
      </div>

      {/* Body */}
      <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 24 }}>
        {emptyState ? (
          <SectionCard delay={0.05}>
            <EmptyState
              icon={Sparkles}
              title="No Active Applications"
              description="You don't have any previous loan applications. Start a new eligibility check to discover offers across multiple lenders — without affecting your credit score."
              action={
                <TravelingBorderButton size="sm" onClick={handleStartEligibilityClick} disabled={actionLoading} className="rounded-none">
                  Run Eligibility
                </TravelingBorderButton>
              }
            />
          </SectionCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 24, alignItems: 'start' }}>

            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { title: 'Active Cases', value: String(cases.filter(c => c.stage !== 'CLOSED' && c.stage !== 'REJECTED').length), subtitle: 'This month', icon: FolderOpen, color: 'var(--info)' },
                  { title: 'Loan Applied', value: (activeCase.loan_amount || activeCase.sanctioned_amount) ? formatCompactINR(activeCase.loan_amount || activeCase.sanctioned_amount) : '—', subtitle: activeCase.product_type || 'Product TBD', icon: BarChart3, color: 'var(--success)' },
                  { title: 'Bureau Score', value: cibilScore || '—', subtitle: cibilScore ? (cibilScore >= 700 ? 'Good' : 'Fair') : 'Available after bureau pull', icon: Star, color: 'var(--warning)' },
                  { title: 'All Time Cases', value: totalCasesCount ?? '—', subtitle: 'Since you joined', icon: Archive, color: 'var(--role-admin)' },
                ].map((card, i) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <StatCard {...card} />
                  </motion.div>
                ))}
              </div>

              {/* Cases table — every case this customer has (see fetchDashboard's
                  note on why msmeApi.getCases() is fetched separately from
                  getDashboard()'s single activeCase), not just the latest one. */}
              <SectionCard title="My Loan Cases" subtitle={`${cases.length} loan application${cases.length === 1 ? '' : 's'}`} delay={0.2}>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Product</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map(c => {
                        const closed = c.stage === 'CLOSED' || c.stage === 'REJECTED';
                        // Purge is time-based, independent of stage — a purged case
                        // can still be non-terminal/unallocated, so it must be
                        // excluded from the "Continue" (resume wizard) branch
                        // explicitly rather than relying on `closed` alone.
                        const purged = !!c.data_purged_at;
                        return (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 700 }}>CASE-{c.id}</td>
                            <td>{c.product_type || 'TBD'}</td>
                            <td>{(c.loan_amount || c.sanctioned_amount) ? formatCompactINR(c.loan_amount || c.sanctioned_amount) : '—'}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                <Badge type="level" value={CASE_STAGE_LABELS[c.stage] || c.stage} />
                                {purged && <DataPurgedBadge />}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {closed ? (
                                <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate(`/msme/cases/${c.id}`)}>
                                  Track
                                </button>
                              ) : purged || c.assigned_dsa_user ? (
                                // Once a DSA is allocated, the case has moved past the
                                // self-service application wizard — the wizard's draft-
                                // restore logic doesn't cover that stage and just errors.
                                // Send them to the case status page instead. Purged
                                // cases are also always "View" — never resumable.
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <SectionCard title="Quick Actions" delay={0.28}>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quickActions.map(({ label, icon: Icon, path }) => (
                    <button
                      key={label}
                      className="btn btn-secondary"
                      style={{ borderRadius: 0, justifyContent: 'flex-start', width: '100%' }}
                      onClick={() => navigate(path)}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Your Allocated DSA" delay={0.36}>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {cases.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>No cases yet.</div>
                  ) : cases.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        paddingBottom: 14,
                        borderBottom: i < cases.length - 1 ? '1px solid var(--outline)' : 'none',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                        CASE-{c.id}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--on-surface)' }}>
                        {c.assigned_dsa_user?.tenant?.name || 'Cred2Tech Direct (Pending Allocation)'}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MsmeDashboardPage;
