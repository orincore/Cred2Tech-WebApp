import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Briefcase, Search } from 'lucide-react';
import api from '../api/axiosInstance';
import Badge from '../components/ui/Badge';

const SuperadminWalletManager = () => {
   const navigate = useNavigate();
   const [wallets, setWallets] = useState([]);
   const [loading, setLoading] = useState(true);
   const [page, setPage] = useState(1);
   const [totalPages, setTotalPages] = useState(1);
   const [searchTerm, setSearchTerm] = useState('');

   useEffect(() => { fetchWallets(); }, [page]);

   const fetchWallets = async () => {
      try {
         setLoading(true);
         const res = await api.get(`/admin/wallet/tenants/wallets?page=${page}&limit=50`);
         setWallets(res.data.tenants || []);
         setTotalPages(res.data.totalPages || 1);
      } catch (err) { toast.error("Failed to load wallets"); }
      finally { setLoading(false); }
   };

   const filteredWallets = wallets.filter(w => 
      w.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.mobile.includes(searchTerm)
   );

   if (loading && wallets.length === 0) return <div style={{ padding: 40, textAlign: 'center' }}>Loading wallets...</div>;

   return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Briefcase size={28} color="var(--primary)" />
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>DSA Wallets Management</h1>
         </div>

         <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Wallet Management</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Search a DSA to view wallet, transactions, API usage & allocate credit</p>
            <div className="card card-padded">
               <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  Search DSA by name or mobile number
               </label>
               <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                     <input
                        type="text"
                        placeholder="Type DSA name or 10-digit mobile..."
                        className="form-control"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                     />
                  </div>
                  <button className="btn btn-outline" style={{ gap: 8 }}>
                     <Search size={16} /> Search
                  </button>
               </div>
               <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Tip: Search by first name, last name, or mobile number — then click the DSA to open their wallet details.
               </p>
            </div>
         </div>

         <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: 16, fontWeight: 700 }}>All DSA Wallets</h3>
               <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Click a name to open full detail</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
               <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                     <th style={{ padding: '16px 24px' }}>DSA Name</th>
                     <th style={{ padding: '16px 24px' }}>Code</th>
                     <th style={{ padding: '16px 24px' }}>Mobile</th>
                     <th style={{ padding: '16px 24px' }}>City</th>
                     <th style={{ padding: '16px 24px' }}>Balance</th>
                     <th style={{ padding: '16px 24px' }}>Last Recharge</th>
                     <th style={{ padding: '16px 24px' }}>Status</th>
                     <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {filteredWallets.map(t => (
                     <tr key={t.tenant_id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => navigate(`/admin/wallets/${t.tenant_id}`)} className="table-row-hover">
                        <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline' }}>{t.tenant_name}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{t.code}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{t.mobile}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{t.city}</td>
                        <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                           ₹{t.wallet_balance.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                           {t.last_transaction_date ? new Date(t.last_transaction_date).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Never'}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                           <Badge variant={t.wallet_balance > 0 ? (t.status === 'ACTIVE' ? 'success' : 'neutral') : 'warning'}>
                              {t.wallet_balance <= 0 ? 'Low Balance' : (t.status === 'ACTIVE' ? 'Active' : 'Inactive')}
                           </Badge>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                           <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/wallets/${t.tenant_id}`); }} className="btn btn-outline btn-xs" style={{ borderRadius: 20 }}>Open</button>
                        </td>
                     </tr>
                  ))}
                  {filteredWallets.length === 0 && (
                     <tr><td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>No DSA wallets found matching your search.</td></tr>
                  )}
               </tbody>
            </table>

            {totalPages > 1 && (
               <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Page {page} of {totalPages}</span>
                  <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
               </div>
            )}
         </div>


      </div>
   );
};

export default SuperadminWalletManager;
