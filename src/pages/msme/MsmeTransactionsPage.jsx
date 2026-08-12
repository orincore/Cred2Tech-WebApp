import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Receipt } from 'lucide-react';
import { msmeApi } from '../../api/msmeService';
import { formatCompactINR } from '../../utils/helpers';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';

const formatDateTime = (d) => d
  ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

const PURPOSE_LABELS = {
  DIRECT_MSME_ELIGIBILITY: 'Eligibility Check',
};

const MsmeTransactionsPage = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = 'Cred2Tech | Transactions';
    (async () => {
      try {
        const res = await msmeApi.getPayments();
        setPayments(res.data.payments || []);
      } catch (err) {
        toast.error('Failed to load your payment history');
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

  return (
    <div className="hide-scrollbar" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: isMobile ? 16 : 24 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            MSME Portal
          </p>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Transactions</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
            {payments.length} payment{payments.length === 1 ? '' : 's'} across every eligibility check and case you've started with us.
          </p>
        </div>

        {payments.length === 0 ? (
          <SectionCard delay={0.05}>
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="You haven't made any payments yet. They'll show up here once you start a new case."
            />
          </SectionCard>
        ) : (
          <SectionCard title="Payment History" subtitle="Every payment attempt, newest first" delay={0.1}>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Purpose</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Case</th>
                    <th>Payment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <motion.tr key={p.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                    >
                      <td data-label="Date" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatDateTime(p.created_at)}</td>
                      <td data-label="Purpose">{PURPOSE_LABELS[p.purpose] || p.purpose}</td>
                      <td data-label="Amount" style={{ fontWeight: 700 }}>{formatCompactINR(p.amount_inr)}</td>
                      <td data-label="Status">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <Badge type="paymentStatus" value={p.status} />
                          {p.status === 'FAILED' && p.failure_reason && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.failure_reason}</span>
                          )}
                        </div>
                      </td>
                      <td data-label="Case">
                        {p.case_id ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ borderRadius: 0 }}
                            onClick={() => navigate(`/msme/cases/${p.case_id}`)}
                          >
                            CASE-{p.case_id}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td data-label="Payment ID" style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'monospace' }}>
                        {p.razorpay_payment_id || '—'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
};

export default MsmeTransactionsPage;
