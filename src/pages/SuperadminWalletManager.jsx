import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Briefcase, Search, ShieldAlert, Eye } from 'lucide-react';
import api from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext';
import DataTable from '../components/DataTable';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Responsive hook
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile, isTablet };
};

const SuperadminWalletManager = () => {
   const navigate = useNavigate();
   const { isMobile, isTablet } = useResponsive();
   const { theme } = useTheme();
   const isDark = theme === 'dark';
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

   const filtered = useMemo(() => {
      return wallets.filter(w => 
         w.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
         w.mobile.includes(searchTerm)
      );
   }, [wallets, searchTerm]);

   /* ---- label style shared across filters ---- */
   const labelSm = { fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
   const underlineInput = (active) => ({
      background: 'transparent', border: 'none',
      borderBottom: `2px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
      outline: 'none', width: '100%', padding: '6px 0',
      fontSize: 13, fontWeight: 600, color: 'var(--on-surface)',
      transition: 'border-color 0.2s',
   });

   if (loading && wallets.length === 0) return <LoadingSpinner fullPage />;

   return (
      <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
         {/* ─── Top header ─── */}
         <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
            <div>
               <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Admin › DSA Wallets
               </p>
               <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
                  DSA Wallets Management
               </h1>
               <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
                  Search a DSA to view wallet, transactions, API usage & allocate credit
               </p>
            </div>
         </div>

         {/* ─── Info bar ─── */}
         <div style={{ borderBottom: '1px solid var(--outline)', padding: '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <ShieldAlert size={16} color="#4f46e5" />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
               <strong style={{ color: 'var(--on-surface)' }}>Super Admin only.</strong> Search by DSA name or mobile number to view wallet details and allocate credits.
            </p>
         </div>

         {/* ─── Filter row ─── */}
         <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '16px' : '20px 20px', display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
            {/* Search */}
            <div style={{ flex: 2, minWidth: 200, maxWidth: 360 }}>
               <span style={labelSm}>Search DSA</span>
               <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 0, bottom: 9, color: '#94a3b8' }} />
                  <input
                     type="text"
                     placeholder="DSA name or mobile number…"
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     style={{ ...underlineInput(false), paddingLeft: 20 }}
                     onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                     onBlur={e => e.target.style.borderBottomColor = '#e2e8f0'}
                  />
               </div>
            </div>
         </div>

         {/* ─── Content ─── */}
         {loading ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
               <LoadingSpinner fullPage />
            </div>
         ) : filtered.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
               <Briefcase size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
               <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No DSA wallets found</h3>
               <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>Try adjusting your search.</p>
            </div>
         ) : (
            <>
               {/* Sub-header */}
               <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>All DSA Wallets</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{filtered.length} wallets</span>
               </div>

               {/* Table */}
               <DataTable
                  columns={[
                     { key: 'tenant_name', label: 'DSA Name', render: (t) => (
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5', cursor: 'pointer' }}>{t.tenant_name}</span>
                     )},
                     { key: 'code', label: 'Code', render: (t) => t.code },
                     { key: 'mobile', label: 'Mobile', render: (t) => t.mobile },
                     { key: 'city', label: 'City', render: (t) => t.city },
                     { key: 'wallet_balance', label: 'Balance', render: (t) => (
                        <span style={{ fontWeight: 700, color: t.wallet_balance <= 0 ? '#f43f5e' : '#10b981', fontSize: 13 }}>
                           ₹{t.wallet_balance.toLocaleString('en-IN')}
                        </span>
                     )},
                     { key: 'last_transaction_date', label: 'Last Recharge', render: (t) => (
                        t.last_transaction_date ? new Date(t.last_transaction_date).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Never'
                     )},
                     { key: 'status', label: 'Status', render: (t) => {
                        const isLow = t.wallet_balance <= 0;
                        const isActive = t.status === 'ACTIVE';
                        return (
                           <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isLow ? '#f43f5e' : (isActive ? '#10b981' : '#f43f5e'), flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: isLow ? '#f43f5e' : (isActive ? '#10b981' : '#f43f5e'), whiteSpace: 'nowrap' }}>
                                 {isLow ? 'Low Balance' : (isActive ? 'Active' : 'Inactive')}
                              </span>
                           </div>
                        );
                     }},
                     { key: 'action', label: 'Action', align: 'center', render: (t) => (
                        <button
                           onClick={(e) => { e.stopPropagation(); navigate(`/admin/wallets/${t.tenant_id}`); }}
                           style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              background: 'transparent', border: 'none',
                              padding: '5px 10px', fontSize: 11, fontWeight: 700,
                              color: 'var(--on-surface)', cursor: 'pointer', transition: 'all 0.15s',
                              borderRadius: 4, whiteSpace: 'nowrap',
                           }}
                           onMouseEnter={e => { e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.background = 'var(--surface-low)'; }}
                           onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                           <Eye size={11} />
                           Open
                        </button>
                     )},
                  ]}
                  data={filtered}
                  isMobile={isMobile}
                  hoverRows={true}
                  onRowClick={(t) => navigate(`/admin/wallets/${t.tenant_id}`)}
               />

               {/* Pagination */}
               {totalPages > 1 && (
                  <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--outline)', background: 'var(--bg)' }}>
                     <button 
                        className="btn btn-ghost btn-sm" 
                        disabled={page === 1} 
                        onClick={() => setPage(page - 1)}
                        style={{ fontSize: 12, color: 'var(--on-surface)' }}
                     >
                        ← Prev
                     </button>
                     <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>Page {page} of {totalPages}</span>
                     <button 
                        className="btn btn-ghost btn-sm" 
                        disabled={page === totalPages} 
                        onClick={() => setPage(page + 1)}
                        style={{ fontSize: 12, color: 'var(--on-surface)' }}
                     >
                        Next →
                     </button>
                  </div>
               )}
            </>
         )}
      </div>
   );
};

export default SuperadminWalletManager;
