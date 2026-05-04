import React, { useState, useEffect } from 'react';
import { Activity, Clock, FileText, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import api from '../api/axiosInstance';

const SuperadminApiLogsPage = () => {
   const [logs, setLogs] = useState([]);
   const [summary, setSummary] = useState(null);
   const [loading, setLoading] = useState(true);

   // Filters
   const [filters, setFilters] = useState({ page: 1, limit: 50, status: '', api_code: '' });
   const [totalPages, setTotalPages] = useState(1);

   useEffect(() => {
      fetchSummary();
   }, []);

   useEffect(() => {
      fetchLogs();
   }, [filters]);

   const fetchSummary = async () => {
      try {
         const res = await api.get(`/admin/api-logs/summary`);
         setSummary(res.data);
      } catch (e) {
         console.error("Summary load fail");
      }
   };

   const fetchLogs = async () => {
      try {
         setLoading(true);
         const q = new URLSearchParams(filters);
         const res = await api.get(`/admin/api-logs?${q.toString()}`);
         setLogs(res.data.logs || []);
         setTotalPages(res.data.totalPages || 1);
      } catch (err) {
         console.error(err);
      } finally {
         setLoading(false);
      }
   };

   const getStatusBadge = (status) => {
      switch (status) {
         case 'SUCCESS': return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: 'var(--success-subtle)', color: '#2E7D32', fontSize: 12, fontWeight: 600 }}><CheckCircle2 size={12} /> SUCCESS</span>;
         case 'FAILED': return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontSize: 12, fontWeight: 600 }}><XCircle size={12} /> FAILED</span>;
         case 'REFUNDED': return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.1)', color: '#9333ea', fontSize: 12, fontWeight: 600 }}><Activity size={12} /> REFUNDED</span>;
         case 'BLOCKED_INSUFFICIENT_CREDITS': return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#d97706', fontSize: 12, fontWeight: 600 }}><AlertCircle size={12} /> BLOCKED (NO CREDITS)</span>;
         default: return <span>{status}</span>;
      }
   };

   return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Activity size={28} color="var(--primary)" />
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>API Observability & Audits</h1>
         </div>

         {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
               <div className="card" style={{ padding: 20 }}>
                  <h4 style={{ color: 'var(--text-tertiary)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Total API Pings</h4>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{summary.total_api_calls.toLocaleString()}</div>
               </div>
               <div className="card" style={{ padding: 20 }}>
                  <h4 style={{ color: 'var(--text-tertiary)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Credits Consumed</h4>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--primary)' }}>{summary.total_credits_consumed.toLocaleString()}</div>
               </div>
               <div className="card" style={{ padding: 20 }}>
                  <h4 style={{ color: 'var(--text-tertiary)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Credits Refunded</h4>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: '#9333ea' }}>{summary.total_refunds.toLocaleString()}</div>
               </div>
               <div className="card" style={{ padding: 20 }}>
                  <h4 style={{ color: 'var(--text-tertiary)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Failed Executions</h4>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--error)' }}>{summary.total_failed_calls.toLocaleString()}</div>
               </div>
            </div>
         )}

         <div className="card" style={{ padding: '16px 24px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>FILTERS:</div>
            <select className="form-control" style={{ width: 200 }} value={filters.api_code} onChange={e => setFilters({ ...filters, api_code: e.target.value, page: 1 })}>
               <option value="">All APIs</option>
               <option value="BANK_ANALYSIS">Bank Analysis</option>
               <option value="GST_FETCH">GST Fetch</option>
               <option value="ITR_FETCH">ITR Fetch</option>
               <option value="BUREAU_PULL">Bureau Pull</option>
               <option value="PAN_FETCH">PAN Verify</option>
            </select>
            <select className="form-control" style={{ width: 200 }} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
               <option value="">All Statuses</option>
               <option value="SUCCESS">Success Only</option>
               <option value="REFUNDED">Refunded Only</option>
               <option value="BLOCKED_INSUFFICIENT_CREDITS">Blocked (Missing Funds)</option>
            </select>
         </div>

         <div className="card">
            <div style={{ overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                     <tr style={{ borderBottom: '2px solid var(--border)', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', backgroundColor: 'var(--bg-surface)' }}>
                        <th style={{ padding: '12px 16px' }}>Timestamp</th>
                        <th style={{ padding: '12px 16px' }}>DSA</th>
                        <th style={{ padding: '12px 16px' }}>API Triggered</th>
                        <th style={{ padding: '12px 16px' }}>Cost</th>
                        <th style={{ padding: '12px 16px' }}>Status</th>
                        <th style={{ padding: '12px 16px' }}>Customer / Trace</th>
                     </tr>
                  </thead>
                  <tbody style={{ fontSize: 13 }}>
                     {loading ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading Logs...</td></tr>
                     ) : logs.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No execution logs found</td></tr>
                     ) : logs.map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                           <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{new Date(l.timestamp).toLocaleString()}</td>
                           <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.tenant_name}</td>
                           <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{l.api_code}</td>
                           <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.credits_used}</td>
                           <td style={{ padding: '12px 16px' }}>{getStatusBadge(l.status)}</td>
                           <td style={{ padding: '12px 16px' }}>
                              {l.customer_name ? l.customer_name : <span style={{ color: 'var(--text-tertiary)' }}>System Gen</span>}
                              {l.error_message && <div style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>Error: {l.error_message}</div>}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
            {totalPages > 1 && (
               <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost btn-sm" disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>← Prev</button>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Page {filters.page} of {totalPages}</span>
                  <button className="btn btn-ghost btn-sm" disabled={filters.page === totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next →</button>
               </div>
            )}
         </div>

      </div>
   );
};

export default SuperadminApiLogsPage;
