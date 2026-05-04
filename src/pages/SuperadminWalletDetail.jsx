import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Wallet, FileText, BarChart2, Bell, AlertCircle, Calendar } from 'lucide-react';
import api from '../api/axiosInstance';
import Badge from '../components/ui/Badge';
import FormField from '../components/ui/FormField';

const SuperadminWalletDetail = () => {
   const { dsaId } = useParams();
   const navigate = useNavigate();
   
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
      if (!allocation.remarks) return toast.error("Select a reason");
      
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

   if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
   if (!detail) return <div style={{ padding: 40, textAlign: 'center' }}>Wallet not found</div>;

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
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <button onClick={() => navigate('/admin/wallets')} className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }}>
                     <ArrowLeft size={16} /> Back
                  </button>
                  <h1 style={{ fontSize: 24, fontWeight: 700 }}>{tenant.name}</h1>
               </div>
               <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 64 }}>
                  {tenant.code} · {tenant.city} · <Badge variant={tenant.status === 'ACTIVE' ? 'success' : 'neutral'}>{tenant.status}</Badge>
               </p>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Current Balance</div>
               <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>₹{wallet.balance.toLocaleString('en-IN')}</div>
            </div>
         </div>

         {/* Tabs */}
         <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
            <button 
               className={`tab-btn ${activeTab === 'ALLOCATION' ? 'active' : ''}`}
               onClick={() => setActiveTab('ALLOCATION')}
               style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, borderBottom: activeTab === 'ALLOCATION' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'ALLOCATION' ? 'var(--primary)' : 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}
            >
               <Wallet size={16} /> Wallet & Credit Allocation
            </button>
            <button 
               className={`tab-btn ${activeTab === 'HISTORY' ? 'active' : ''}`}
               onClick={() => setActiveTab('HISTORY')}
               style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, borderBottom: activeTab === 'HISTORY' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'HISTORY' ? 'var(--primary)' : 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}
            >
               <FileText size={16} /> Transaction History
            </button>
            <button 
               className={`tab-btn ${activeTab === 'USAGE' ? 'active' : ''}`}
               onClick={() => setActiveTab('USAGE')}
               style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, borderBottom: activeTab === 'USAGE' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'USAGE' ? 'var(--primary)' : 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}
            >
               <BarChart2 size={16} /> API Usage Breakdown
            </button>
         </div>

         {/* ALLOCATION TAB */}
         {activeTab === 'ALLOCATION' && (
            <div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  <div className="card card-padded" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                     <div style={{ width: 48, height: 48, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                        <Wallet size={24} />
                     </div>
                     <div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>₹{wallet.balance.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Current Balance</div>
                     </div>
                  </div>
                  <div className="card card-padded" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                     <div style={{ width: 48, height: 48, borderRadius: 8, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                        <Calendar size={24} />
                     </div>
                     <div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>₹{wallet.spent_this_month.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Spent This Month</div>
                     </div>
                  </div>
                  <div className="card card-padded" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                     <div style={{ width: 48, height: 48, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                        <Badge variant="success">NEW</Badge>
                     </div>
                     <div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>₹{wallet.lifetime_free_credits.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Free Credits (Lifetime)</div>
                     </div>
                  </div>
               </div>

               <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                     <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Wallet size={18} /> Allocate Free Credits</h3>
                     <span style={{ fontSize: 12, fontWeight: 600, color: '#D97706', background: '#FEF3C7', padding: '4px 8px', borderRadius: 12 }}>Super Admin Only — ₹0 cost</span>
                  </div>
                  
                  <div className="notice notice-warning" style={{ marginBottom: 24, fontSize: 13 }}>
                     <AlertCircle size={16} style={{ flexShrink: 0 }} />
                     Free credits are added to <strong>{tenant.name}'s</strong> wallet at no charge. Every allocation is logged in the audit trail with a mandatory reason.
                  </div>

                  <form onSubmit={handleAllocate}>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
                        <FormField label="Credit Amount (₹)">
                           <input type="number" min="1" className="form-control" placeholder="e.g. 500" value={allocation.credits} onChange={e => setAllocation({...allocation, credits: e.target.value})} />
                        </FormField>
                        <FormField label="Reason *">
                           <select className="form-control" value={allocation.remarks} onChange={e => setAllocation({...allocation, remarks: e.target.value})}>
                              <option value="">— Select reason (mandatory) —</option>
                              <option value="Trial / Onboarding support">Trial / Onboarding support</option>
                              <option value="Compensation for failed API">Compensation for failed API</option>
                              <option value="Volume discount bonus">Volume discount bonus</option>
                              <option value="Manual correction">Manual correction</option>
                           </select>
                        </FormField>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary" disabled={allocation.loading} style={{ background: '#7C3AED', borderColor: '#7C3AED' }}>
                           {allocation.loading ? 'Allocating...' : 'Allocate Credits'}
                        </button>
                     </div>
                  </form>
               </div>

               <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                     <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Free Credit Log for this DSA</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                     <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                           <th style={{ padding: '12px 24px' }}>Date</th>
                           <th style={{ padding: '12px 24px' }}>Credits</th>
                           <th style={{ padding: '12px 24px' }}>Reason</th>
                        </tr>
                     </thead>
                     <tbody>
                        {allocationLedger.map(l => (
                           <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{new Date(l.created_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                              <td style={{ padding: '16px 24px', fontWeight: 700 }}>₹{l.amount.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{l.remarks}</td>
                           </tr>
                        ))}
                        {allocationLedger.length === 0 && (
                           <tr><td colSpan="3" style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>No free credit allocations found.</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* HISTORY TAB */}
         {activeTab === 'HISTORY' && (
            <div className="card" style={{ padding: 0 }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                     <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                        <th style={{ padding: '16px 24px' }}>Timestamp</th>
                        <th style={{ padding: '16px 24px' }}>Type</th>
                        <th style={{ padding: '16px 24px' }}>Impact</th>
                        <th style={{ padding: '16px 24px' }}>Reference</th>
                        <th style={{ padding: '16px 24px' }}>Balance After</th>
                     </tr>
                  </thead>
                  <tbody>
                     {ledger.map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                           <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                              {new Date(l.created_at).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                           </td>
                           <td style={{ padding: '16px 24px' }}>
                              <Badge variant={l.transaction_type === 'CREDIT' ? 'success' : 'neutral'}>{l.reference_type}</Badge>
                           </td>
                           <td style={{ padding: '16px 24px', fontWeight: 700, color: l.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)' }}>
                              {l.transaction_type === 'CREDIT' ? '+' : '-'}₹{l.amount.toLocaleString('en-IN')}
                           </td>
                           <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>{l.remarks || l.api_log_id || '—'}</td>
                           <td style={{ padding: '16px 24px', fontWeight: 600 }}>₹{l.balance_after.toLocaleString('en-IN')}</td>
                        </tr>
                     ))}
                     {ledger.length === 0 && (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>No transactions found.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         )}

         {/* USAGE TAB */}
         {activeTab === 'USAGE' && (
            <div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                  {['ITR_FETCH', 'GST_FETCH', 'BUREAU_CIBIL', 'BANKING_AA'].map(code => {
                     const data = apiBreakdown[code] || { calls: 0, cost: 0 };
                     return (
                        <div key={code} className="card card-padded" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                           <div style={{ width: 48, height: 48, borderRadius: 8, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                              <FileText size={24} />
                           </div>
                           <div>
                              <div style={{ fontSize: 24, fontWeight: 800 }}>{data.calls}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{code.replace('_', ' ')} (MTD)</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#10B981', background: '#ECFDF5', padding: '2px 6px', borderRadius: 8, display: 'inline-block' }}>
                                 ₹{data.cost.toLocaleString('en-IN')} cost
                              </div>
                           </div>
                        </div>
                     )
                  })}
               </div>

               <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                     <h3 style={{ fontSize: 16, fontWeight: 700 }}>API Usage by Type — Month-to-Date</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                     <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                           <th style={{ padding: '16px 24px' }}>API Type</th>
                           <th style={{ padding: '16px 24px' }}>Calls (MTD)</th>
                           <th style={{ padding: '16px 24px' }}>Cost (MTD)</th>
                           <th style={{ padding: '16px 24px' }}>Failed/Refunded</th>
                        </tr>
                     </thead>
                     <tbody>
                        {Object.keys(apiBreakdown).length > 0 ? Object.entries(apiBreakdown).map(([code, data]) => (
                           <tr key={code} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)' }}>{code}</td>
                              <td style={{ padding: '16px 24px', fontWeight: 600 }}>{data.calls}</td>
                              <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)' }}>₹{data.cost.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{data.failed}</td>
                           </tr>
                        )) : (
                           <tr><td colSpan="4" style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>No API usage data for this month.</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         )}
      </div>
   );
};

export default SuperadminWalletDetail;
