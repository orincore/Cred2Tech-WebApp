import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Sparkles, FolderOpen, BarChart3, Star, UserCircle,
  ShieldCheck, Sun, CloudSun, Moon, ArrowRight, Archive,
} from 'lucide-react';
import { msmeApi } from '../../api/msmeService';
import { useMsmeAuth } from '../../context/MsmeAuthContext';
import { loadRazorpay } from '../../utils/razorpay';
import { toTitleCase, resolveEntityName } from '../../utils/helpers';
import { getErrorMessage, formatCompactINR, CASE_STAGE_LABELS } from '../../utils/helpers';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import TravelingBorderButton from '../../components/TravelingBorderButton';

const MsmeDashboardPage = () => {
  const { user } = useMsmeAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);

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
      const res = await msmeApi.getDashboard();
      setDashboardData(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const goToOnboarding = () => {
    navigate(dashboardData?.activeCase
      ? `/msme/onboarding?caseId=${dashboardData.activeCase.id}`
      : '/msme/onboarding');
  };

  const handleStartEligibilityClick = async () => {
    if (!dashboardData) return;
    if (dashboardData.paymentStatus === 'PAID') {
      goToOnboarding();
    } else {
      setActionLoading(true);
      try {
        const conf = await msmeApi.getPaymentConfig();
        setPaymentConfig(conf.data);
        setShowPaymentModal(true);
      } catch (err) {
        toast.error('Failed to load pricing');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const initiatePayment = async () => {
    try {
      setActionLoading(true);
      const Razorpay = await loadRazorpay();
      const orderRes = await msmeApi.createPaymentOrder();
      const { order_id, amount_paise, currency, key_id } = orderRes.data;

      const options = {
        key: key_id,
        amount: amount_paise,
        currency: currency,
        name: 'Cred2Tech',
        description: 'Eligibility Assessment Fee',
        order_id: order_id,
        handler: async function (response) {
          const verifyData = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };
          // Razorpay has already captured the payment by the time this handler
          // fires, so a failed verify call here must not be reported as a plain
          // "failed" — retry transient network blips before surfacing the
          // backend's actual error, otherwise a momentary blip after a real
          // charge reads to the user as a lost payment.
          let lastErr;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await msmeApi.verifyPayment(verifyData);
              toast.success('Payment successful!');
              setShowPaymentModal(false);
              setActionLoading(false);
              // Not goToOnboarding() — that reads dashboardData.activeCase,
              // which is stale from before this payment and (once an old
              // case exists) would resume editing the wrong, already
              // finished case instead of starting the new one just paid
              // for. A fresh payment always means no case is linked yet.
              navigate('/msme/onboarding');
              return;
            } catch (err) {
              lastErr = err;
              if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          }
          toast.error(
            `${getErrorMessage(lastErr)} If the amount was deducted, refresh in a moment — if it still doesn't reflect, contact support with payment ID ${response.razorpay_payment_id}.`,
            { duration: 8000 }
          );
          setActionLoading(false);
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: { color: '#4F46E5' },
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response) {
        toast.error(`Payment Failed: ${response.error.description}`);
        setActionLoading(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to initiate payment');
      setActionLoading(false);
    }
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
  const caseClosed = activeCase && (activeCase.stage === 'CLOSED' || activeCase.stage === 'REJECTED');

  const quickActions = [
    { label: 'My Cases', icon: FolderOpen, path: '/msme/cases' },
    { label: 'My Profile', icon: UserCircle, path: '/msme/profile' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && paymentConfig && (
          <div className="modal-overlay">
            <motion.div
              className="modal-box"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{ borderRadius: 0, textAlign: 'center' }}
            >
              <div style={{
                width: 52, height: 52, margin: '0 auto 16px', background: 'var(--primary-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShieldCheck size={26} color="var(--primary)" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>Eligibility Assessment</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                To check your eligibility across multiple lenders and receive a detailed report, a one-time assessment fee is required. This data is valid for 90 days.
              </p>

              <div style={{ background: 'var(--bg-elevated)', padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>Amount Due</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>₹{paymentConfig.amount_inr}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>One-time payment · Valid for 90 days</div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', borderRadius: 0 }}
                  onClick={() => setShowPaymentModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center', borderRadius: 0 }}
                  onClick={initiatePayment}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  { title: 'Active Cases', value: activeCase ? '1' : '0', subtitle: 'This month', icon: FolderOpen, color: 'var(--info)' },
                  { title: 'Loan Applied', value: activeCase.loan_amount ? formatCompactINR(activeCase.loan_amount) : '—', subtitle: activeCase.product_type || 'Product TBD', icon: BarChart3, color: 'var(--success)' },
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

              {/* Cases table */}
              <SectionCard title="My Loan Cases" subtitle="Your active loan application" delay={0.2}>
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
                      <tr>
                        <td style={{ fontWeight: 700 }}>CASE-{activeCase.id}</td>
                        <td>{activeCase.product_type || 'TBD'}</td>
                        <td>{activeCase.loan_amount ? formatCompactINR(activeCase.loan_amount) : '—'}</td>
                        <td><Badge type="level" value={CASE_STAGE_LABELS[activeCase.stage] || activeCase.stage} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {caseClosed ? (
                            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate(`/msme/cases/${activeCase.id}`)}>
                              Track
                            </button>
                          ) : activeCase.assigned_dsa_user ? (
                            // Once a DSA is allocated, the case has moved past the
                            // self-service application wizard — the wizard's draft-
                            // restore logic doesn't cover that stage and just errors.
                            // Send them to the case status page instead.
                            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate(`/msme/cases/${activeCase.id}`)}>
                              View
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ borderRadius: 0 }}
                              onClick={() => navigate(`/msme/onboarding?caseId=${activeCase.id}`)}
                            >
                              Continue <ArrowRight size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
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
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--on-surface)', marginBottom: 4 }}>
                    {activeCase?.assigned_dsa_user?.name || 'Cred2Tech Direct (Pending Allocation)'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--on-muted)', marginBottom: 12 }}>Support Team</div>
                  <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>
                    This case is managed by the agent above.
                  </div>
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
