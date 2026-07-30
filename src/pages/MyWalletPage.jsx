import React, { useEffect, useState } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import api from '../api/axiosInstance';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

const formatDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const MyWalletPage = () => {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/wallet/balance').then(res => setBalance(res.data.balance)).catch(() => setBalance(null)),
      api.get('/wallet/transactions').then(res => setTransactions(Array.isArray(res.data) ? res.data : [])).catch(() => setTransactions([])),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mw-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .mw-page .card, .mw-page .table-wrapper, .mw-page table { border-radius: 0 !important; }
        @media (max-width: 768px) {
          .mw-page > div { padding: 80px 24px 24px !important; }
          .mw-page table, .mw-page thead, .mw-page tbody, .mw-page tr, .mw-page td { display: block; width: 100%; }
          .mw-page thead { display: none; }
          .mw-page tbody { display: flex !important; flex-direction: column; gap: 10px; }
          .mw-page tbody tr { border: none !important; padding: 4px 14px; }
          .mw-page tbody tr + tr { border-top: 1px solid var(--outline) !important; margin-top: 4px; }
          .mw-page tbody td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0 !important; border-bottom: 1px solid var(--outline); text-align: right; white-space: normal; }
          .mw-page tbody td:last-child { border-bottom: none; }
          .mw-page tbody td::before { content: attr(data-label); font-weight: 700; color: var(--on-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; flex-shrink: 0; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <PageHeader title="My Wallet" subtitle="Your credit balance and transaction history" />

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', border: '1px solid var(--outline)', flexShrink: 0 }}>
            <Wallet size={22} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--on-surface)', lineHeight: 1 }}>
              {loading ? '—' : (balance !== null ? balance.toLocaleString('en-IN') : '—')} Credits
            </div>
            <div style={{ fontSize: 13, color: 'var(--on-muted)', marginTop: 6 }}>Current balance</div>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Transaction History</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>Loading…</div>
          ) : transactions.length === 0 ? (
            <EmptyState icon={Wallet} title="No transactions yet" description="Your wallet credit and debit history will appear here." />
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Impact</th>
                    <th>Reference</th>
                    <th>Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td data-label="Timestamp">{formatDateTime(t.created_at)}</td>
                      <td data-label="Type">
                        <span className="badge" style={{
                          color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)',
                          background: t.transaction_type === 'CREDIT' ? 'var(--success-bg)' : 'var(--error-bg)',
                        }}>
                          {t.transaction_type === 'CREDIT' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                          {t.reference_type}
                        </span>
                      </td>
                      <td data-label="Impact" style={{ fontWeight: 700, color: t.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)' }}>
                        {t.transaction_type === 'CREDIT' ? '+' : '-'}{t.amount.toLocaleString('en-IN')}
                      </td>
                      <td data-label="Reference">{t.remarks || t.api_code || '—'}</td>
                      <td data-label="Balance After" style={{ fontWeight: 600 }}>{t.balance_after.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyWalletPage;
