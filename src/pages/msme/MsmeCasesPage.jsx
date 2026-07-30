import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, Sparkles } from 'lucide-react';
import { msmeApi } from '../../api/msmeService';
import { formatCompactINR, CASE_STAGE_LABELS } from '../../utils/helpers';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import TravelingBorderButton from '../../components/TravelingBorderButton';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MsmeCasesPage = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

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
        const res = await msmeApi.getCases();
        setCases(res.data.cases || []);
      } catch (err) {
        toast.error('Failed to load your cases');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  // A customer can only have one case in flight at a time (mirrors the
  // backend's dashboard.activeCase — the same non-CLOSED/REJECTED check that
  // gates payment on the /msme/onboarding route). Once every case they've
  // ever opened is CLOSED or REJECTED, offer a way back into a fresh
  // application from this page — it routes through MsmePaymentGate, so a
  // new case always requires paying the assessment fee again first.
  const hasActiveCase = cases.some(c => c.stage !== 'CLOSED' && c.stage !== 'REJECTED');

  return (
    <div className="hide-scrollbar" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: isMobile ? 16 : 24 }}>
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
          {cases.length > 0 && !hasActiveCase && (
            <TravelingBorderButton size="sm" onClick={() => navigate('/msme/onboarding')} className="rounded-none">
              Start New Case
            </TravelingBorderButton>
          )}
        </div>

        {cases.length === 0 ? (
          <SectionCard delay={0.05}>
            <EmptyState
              icon={Sparkles}
              title="No cases yet"
              description="You haven't started a loan application with us yet. Run an eligibility check to see what you qualify for."
              action={
                <TravelingBorderButton size="sm" onClick={() => navigate('/msme/dashboard')} className="rounded-none">
                  Go to Dashboard
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
                              : c.loan_amount
                                ? formatCompactINR(c.loan_amount)
                                : '—'}
                        </td>
                        <td data-label="Status"><Badge type="level" value={CASE_STAGE_LABELS[c.stage] || c.stage} /></td>
                        <td data-label="Last Updated" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatDate(c.updated_at)}</td>
                        <td data-label="Action" style={{ textAlign: 'right' }}>
                          {closed ? (
                            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate(`/msme/cases/${c.id}`)}>
                              View
                            </button>
                          ) : c.assigned_dsa_user ? (
                            // Once a DSA is allocated, the case has moved past the
                            // self-service application wizard — its draft-restore
                            // logic doesn't cover that stage and just errors.
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
