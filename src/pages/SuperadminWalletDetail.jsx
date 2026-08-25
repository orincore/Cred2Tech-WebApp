import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Wallet, FileText, BarChart2, AlertCircle, Calendar, ShieldAlert, Award } from 'lucide-react';
import api from '../api/axiosInstance';
import Badge from '../components/ui/Badge';
import FormField from '../components/ui/FormField';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SectionCard from '../components/ui/SectionCard';
import DataTable from '../components/DataTable';

// Same breakpoint hook as SuperadminWalletManager.jsx (this page's list view)
// so the pair behaves identically on mobile.
const useResponsive = () => {
   const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
   useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth <= 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
   }, []);
   return { isMobile };
};

const TABS = [
   { key: 'ALLOCATION', label: 'Wallet & Credit Allocation', icon: Wallet },
   { key: 'HISTORY', label: 'Transaction History', icon: FileText },
   { key: 'USAGE', label: 'API Usage Breakdown', icon: BarChart2 },
];

const SuperadminWalletDetail = () => {
   const { dsaId } = useParams();
   const navigate = useNavigate();
   const { isMobile } = useResponsive();

   const [loading, setLoading] = useState(true);
   const [detail, setDetail] = useState(null);
   const [activeTab, setActiveTab] = useState('ALLOCATION'); // ALLOCATION | HISTORY | USAGE

   // Tab States
   const [ledger, setLedger] = useState([]);
   const [apiUsage, setApiUsage] = useState([]);

   // Allocation Form State
   const [allocation, setAllocation] = useState({ credits: '', remarks: '', loading: false });

   useEffect(() => {
      fetchDetail();
      fetchLedger();
      fetchApiUsage();
   }, [dsaId]);

   const fetchDetail = async () => {
      try {
         const res = await api.get(`/admin/wallet/tenants/${dsaId}/wallet`);
         setDetail(res.data);
      } catch (err) {
         toast.error("Failed to load DSA wallet detail");
      } finally {
         setLoading(false);
      }
   };

   const fetchLedger = async () => {
      try {
         const res = await api.get(`/admin/wallet/tenants/${dsaId}/wallet/ledger?limit=100`);
         setLedger(res.data.ledger || []);
      } catch (err) {
         console.error("Failed to fetch ledger", err);
      }
   };

   const fetchApiUsage = async () => {
      try {
         const res = await api.get(`/admin/logs/${dsaId}/summary/mtd`);
         setApiUsage(res.data.usage || []);
      } catch (err) {
         console.error("Failed to fetch API usage", err);
      }
   };

   const handleAllocate = async (e) => {
      e.preventDefault();
      if (!allocation.credits || allocation.credits <= 0) return toast.error("Enter valid positive credits");
      if (!allocation.remarks) return toast.error("Enter a reason");

      try {
         setAllocation(prev => ({ ...prev, loading: true }));
         await api.post(`/admin/wallet/tenants/${dsaId}/wallet/topup`, {
            credits: parseInt(allocation.credits, 10),
            remarks: allocation.remarks
         });
         toast.success('Successfully allocated credits!');
         setAllocation({ credits: '', remarks: '', loading: false });
         fetchDetail();
         fetchLedger();
      } catch (err) {
         toast.error(err.response?.data?.error || err.message);
         setAllocation(prev => ({ ...prev, loading: false }));
      }
   };

   if (loading) return <LoadingSpinner fullPage />;

   if (!detail) {
      return (
         <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 12 }}>
            <Wallet size={40} color="var(--on-muted)" />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>Wallet not found</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/wallets')} style={{ color: 'var(--primary)' }}>
               ← Back to all wallets
            </button>
         </div>
      );
   }

   const { tenant, wallet } = detail;

   // Derived Data
   const allocationLedger = ledger.filter(l => l.transaction_type === 'CREDIT' && l.reference_type === 'ADMIN_TOPUP');

   // Aggregate API Usage by Code
   const apiBreakdown = apiUsage.reduce((acc, curr) => {
      if (!acc[curr.api_code]) {
         acc[curr.api_code] = { calls: 0, cost: 0, failed: 0 };
      }
      if (curr.status === 'FAILED') {
         acc[curr.api_code].failed += curr.count;
      } else {
         acc[curr.api_code].calls += curr.count;
         acc[curr.api_code].cost += curr.credits_used;
      }
      return acc;
   }, {});

   return (
      <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
         {/* ─── Top header ─── */}
         <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
            <div style={{ minWidth: 0 }}>
               <button
                  onClick={() => navigate('/admin/wallets')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '4px 0', fontSize: 12, fontWeight: 700, color: 'var(--on-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
               >
                  <ArrowLeft size={14} /> All DSA Wallets
               </button>
               <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
                  {tenant.name}
               </h1>
               <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {tenant.code} · {tenant.city}
                  <Badge variant={tenant.status === 'ACTIVE' ? 'success' : 'neutral'}>{tenant.status}</Badge>
               </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
               <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Balance</div>
               <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.15 }}>₹{wallet.balance.toLocaleString('en-IN')}</div>
            </div>
         </div>

         {/* ─── Info bar ─── */}
         <div style={{ borderBottom: '1px solid var(--outline)', padding: '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <ShieldAlert size={16} color="var(--primary)" />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
               <strong style={{ color: 'var(--on-surface)' }}>Super Admin only.</strong> Allocate free credits, review transaction history, and monitor API usage for this DSA.
            </p>
         </div>

         {/* ─── Tabs ─── */}
         <div style={{ display: 'flex', borderBottom: '2px solid var(--outline)', padding: isMobile ? '0 16px' : '0 20px', background: 'var(--bg)', flexShrink: 0, overflowX: 'auto' }}>
            {TABS.map(t => (
               <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                     padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13,
                     borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                     marginBottom: -2,
                     color: activeTab === t.key ? 'var(--primary)' : 'var(--on-muted)',
                     background: 'transparent', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
                     cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
               >
                  <t.icon size={15} /> {t.label}
               </button>
            ))}
         </div>

         {/* ─── Content ─── */}
         <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : '24px 20px' }}>

            {/* ALLOCATION TAB */}
            {activeTab === 'ALLOCATION' && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                     <StatCard title="Current Balance" value={`₹${wallet.balance.toLocaleString('en-IN')}`} icon={Wallet} color="var(--primary)" />
                     <StatCard title="Spent This Month" value={`₹${wallet.spent_this_month.toLocaleString('en-IN')}`} icon={Calendar} color="var(--error)" />
                     <StatCard title="Free Credits (Lifetime)" value={`₹${wallet.lifetime_free_credits.toLocaleString('en-IN')}`} icon={Award} color="var(--success)" />
                  </div>

                  <SectionCard
                     title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wallet size={16} /> Allocate Free Credits</span>}
                     actions={<span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', background: '#FEF3C7', padding: '4px 10px', whiteSpace: 'nowrap' }}>Super Admin Only — ₹0 cost</span>}
                  >
                     <div style={{ padding: isMobile ? 16 : 20 }}>
                        <div className="notice notice-warning" style={{ marginBottom: 20, fontSize: 13 }}>
                           <AlertCircle size={16} style={{ flexShrink: 0 }} />
                           Free credits are added to <strong>{tenant.name}'s</strong> wallet at no charge. Every allocation is logged in the audit trail with a mandatory reason.
                        </div>

                        <form onSubmit={handleAllocate}>
                           <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 16, marginBottom: 16 }}>
                              <FormField label="Credit Amount (₹)">
                                 <input type="number" min="1" className="form-control" placeholder="e.g. 500" value={allocation.credits} onChange={e => setAllocation({ ...allocation, credits: e.target.value })} />
                              </FormField>
                              <FormField label="Reason *">
                                 <input type="text" className="form-control" placeholder="Enter reason for allocation" value={allocation.remarks} onChange={e => setAllocation({ ...allocation, remarks: e.target.value })} />
                              </FormField>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button type="submit" className="btn btn-primary" disabled={allocation.loading}>
                                 {allocation.loading ? 'Allocating...' : 'Allocate Credits'}
                              </button>
                           </div>
                        </form>
                     </div>
                  </SectionCard>

                  <SectionCard title="Free Credit Log for this DSA">
                     <DataTable
                        columns={[
                           { key: 'created_at', label: 'Date', render: (l) => new Date(l.created_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' }) },
                           { key: 'amount', label: 'Credits', render: (l) => <span style={{ fontWeight: 700 }}>₹{l.amount.toLocaleString('en-IN')}</span> },
                           { key: 'remarks', label: 'Reason', whiteSpace: 'normal' },
                        ]}
                        data={allocationLedger}
                        isMobile={isMobile}
                        rowKey="id"
                        hoverRows={false}
                        emptyState={
                           <div style={{ textAlign: 'center', padding: 32, color: 'var(--on-muted)', fontSize: 13 }}>No free credit allocations found.</div>
                        }
                     />
                  </SectionCard>
               </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'HISTORY' && (
               <SectionCard title="Transaction History">
                  <DataTable
                     columns={[
                        { key: 'created_at', label: 'Timestamp', render: (l) => (
                           <span style={{ color: 'var(--on-muted)', fontSize: 13 }}>
                              {new Date(l.created_at).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                           </span>
                        )},
                        { key: 'reference_type', label: 'Type', render: (l) => (
                           <Badge variant={l.transaction_type === 'CREDIT' ? 'success' : 'neutral'}>{l.reference_type}</Badge>
                        )},
                        { key: 'amount', label: 'Impact', render: (l) => (
                           <span style={{ fontWeight: 700, color: l.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)' }}>
                              {l.transaction_type === 'CREDIT' ? '+' : '-'}₹{l.amount.toLocaleString('en-IN')}
                           </span>
                        )},
                        { key: 'remarks', label: 'Reference', render: (l) => (
                           <span style={{ color: 'var(--on-muted)', fontSize: 13 }}>{l.remarks || l.api_log_id || '—'}</span>
                        )},
                        { key: 'balance_after', label: 'Balance After', render: (l) => (
                           <span style={{ fontWeight: 700 }}>₹{l.balance_after.toLocaleString('en-IN')}</span>
                        )},
                     ]}
                     data={ledger}
                     isMobile={isMobile}
                     rowKey="id"
                     emptyState={
                        <div style={{ textAlign: 'center', padding: 32, color: 'var(--on-muted)', fontSize: 13 }}>No transactions found.</div>
                     }
                  />
               </SectionCard>
            )}

            {/* USAGE TAB */}
            {activeTab === 'USAGE' && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
                     {['ITR_FETCH', 'GST_FETCH', 'BUREAU_CIBIL', 'BANKING_AA'].map(code => {
                        const data = apiBreakdown[code] || { calls: 0, cost: 0 };
                        return (
                           <StatCard
                              key={code}
                              title={`${code.replace('_', ' ')} (MTD)`}
                              value={data.calls}
                              subtitle={`₹${data.cost.toLocaleString('en-IN')} cost`}
                              icon={FileText}
                              color="var(--primary)"
                           />
                        );
                     })}
                  </div>

                  <SectionCard title="API Usage by Type — Month-to-Date">
                     <DataTable
                        columns={[
                           { key: 'api_code', label: 'API Type', render: (row) => <span style={{ fontWeight: 700, color: 'var(--on-muted)' }}>{row.api_code}</span> },
                           { key: 'calls', label: 'Calls (MTD)', render: (row) => <span style={{ fontWeight: 700 }}>{row.calls}</span> },
                           { key: 'cost', label: 'Cost (MTD)', render: (row) => <span style={{ fontWeight: 700 }}>₹{row.cost.toLocaleString('en-IN')}</span> },
                           { key: 'failed', label: 'Failed/Refunded', render: (row) => <span style={{ color: 'var(--on-muted)' }}>{row.failed}</span> },
                        ]}
                        data={Object.entries(apiBreakdown).map(([api_code, data]) => ({ api_code, ...data }))}
                        isMobile={isMobile}
                        rowKey="api_code"
                        emptyState={
                           <div style={{ textAlign: 'center', padding: 32, color: 'var(--on-muted)', fontSize: 13 }}>No API usage data for this month.</div>
                        }
                     />
                  </SectionCard>
               </div>
            )}
         </div>
      </div>
   );
};

export default SuperadminWalletDetail;
