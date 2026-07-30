import React, { useState, useEffect } from 'react';
import {
  Search, Clock, CheckCircle, XCircle, FileText, AlertCircle, X, RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getPddTasks, updatePddStatus } from '../api/pddService';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_TABS = ['ALL', 'PENDING', 'COLLECTED', 'WAIVED'];

function StatusBadge({ status, isOverdue }) {
  if (status === 'PENDING' && isOverdue) {
    return <span className="badge" style={{ color: 'var(--error)', background: 'var(--error-bg)' }}><AlertCircle size={12} /> Overdue</span>;
  }
  if (status === 'PENDING') {
    return <span className="badge" style={{ color: 'var(--warning)', background: 'var(--warning-bg)' }}><Clock size={12} /> Pending</span>;
  }
  if (status === 'RECEIVED') {
    return <span className="badge" style={{ color: 'var(--success)', background: 'var(--success-bg)' }}><CheckCircle size={12} /> Collected</span>;
  }
  if (status === 'WAIVED') {
    return <span className="badge" style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}><XCircle size={12} /> Waived</span>;
  }
  return <span className="badge" style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>{status}</span>;
}

export default function PddManagementPage() {
  const { user } = useAuth();
  const canWaive = user?.role === 'DSA_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, collected: 0, waived: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalForm, setModalForm] = useState({ status: '', collection_date: '', collected_by: '', waiver_reason: '', remarks: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await getPddTasks({ status: activeTab, search });
      if (res.success) {
        setTasks(res.data);
        setSummary(res.summary);
      }
    } catch (err) {
      toast.error('Failed to load PDD tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab, search]);

  useEffect(() => {
    const handler = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const openModal = (task) => {
    setSelectedTask(task);
    setModalForm({
      status: task.status === 'RECEIVED' ? 'COLLECTED' : task.status,
      collection_date: task.collection_date ? new Date(task.collection_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      collected_by: task.collected_by || user?.name || '',
      waiver_reason: task.waiver_reason || '',
      remarks: task.remarks || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { status: modalForm.status, remarks: modalForm.remarks };
      if (modalForm.status === 'COLLECTED') {
        payload.collection_date = modalForm.collection_date;
        payload.collected_by = modalForm.collected_by;
      } else if (modalForm.status === 'WAIVED') {
        payload.waiver_reason = modalForm.waiver_reason;
      }
      await updatePddStatus(selectedTask.pdd_task_id, payload);
      toast.success('PDD status updated successfully');
      closeModal();
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = Object.values(tasks.reduce((acc, task) => {
    if (!acc[task.case_id]) {
      acc[task.case_id] = {
        case_id: task.case_id,
        case_code: task.case_code,
        customer_name: task.customer_name,
        customer_mobile: task.customer_mobile,
        loan_amount: task.loan_amount,
        employee_name: task.employee_name,
        documents: [],
      };
    }
    acc[task.case_id].documents.push(task);
    return acc;
  }, {}));

  return (
    <div className="pdd-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .pdd-page .card, .pdd-page .btn, .pdd-page .badge, .pdd-page .form-control,
        .pdd-page .modal-box, .pdd-page .table-wrapper, .pdd-page table { border-radius: 0 !important; }
        /* Match CustomersListPage's table density for cross-page consistency */
        .pdd-page th { padding: 10px 8px !important; font-size: 10px !important; font-weight: 800 !important; }
        .pdd-page td { padding: 12px 8px !important; font-size: 12px !important; }
        .pdd-page .filter-pill { border-radius: 999px !important; }
        @media (max-width: 768px) {
          .pdd-page > div { padding: 80px 24px 24px !important; }
          /* The outer list-wrapping .card painted a solid surface behind every
             case-card, so the gap between them showed that fill instead of the
             page's own background. Strip its chrome; each case-card already has
             its own background and floats on its own. */
          .pdd-page > div > .card { background: transparent !important; border: none !important; box-shadow: none !important; }
          /* Each case (header + its documents) reads as ONE elevated card.
             Previously each document row carried its own faint border/shadow
             while the header above it had none — and that border color sat
             almost on top of the page background color, so the "card" edge
             was nearly invisible in practice. Put the elevation on the case
             as a whole with a stronger, clearly visible shadow instead. */
          .pdd-page .case-card { background: var(--bg-surface) !important; border: 1px solid var(--border) !important; box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08) !important; }
          .pdd-page .search-box { min-width: 0 !important; }
          /* Compact 3-up KPI tiles instead of 2-up (5 tiles → 2 rows instead of 3). */
          .pdd-page .kpi-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
          .pdd-page .kpi-grid > div { padding: 8px !important; }
          .pdd-page .kpi-grid > div > div:nth-child(2) { font-size: 9px !important; margin-bottom: 3px !important; }
          .pdd-page .kpi-grid > div > div:nth-child(3) { font-size: 17px !important; }
          .pdd-page table, .pdd-page thead, .pdd-page tbody, .pdd-page tr, .pdd-page td { display: block; width: 100%; }
          .pdd-page table { background: transparent !important; }
          .pdd-page thead { display: none; }
          .pdd-page tbody { display: flex !important; flex-direction: column; gap: 10px; }
          .pdd-page tbody tr { border: none !important; background: transparent !important; box-shadow: none !important; padding: 4px 14px; }
          .pdd-page tbody tr + tr { border-top: 1px solid var(--border) !important; margin-top: 4px; }
          .pdd-page tbody td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0 !important; border-bottom: 1px solid var(--border); text-align: right; white-space: normal; font-size: 12px !important; }
          .pdd-page tbody td:last-child { border-bottom: none; }
          .pdd-page tbody td::before { content: attr(data-label); font-weight: 700; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; flex-shrink: 0; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <PageHeader title="PDD Management" subtitle="Post-disbursement document tracking and collection follow-up" />

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ position: 'relative', flex: 1, minWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by customer, case ID or mobile..."
            className="form-control"
            style={{ paddingLeft: 38, paddingTop: 11, paddingBottom: 11, background: 'var(--bg-surface)' }}
          />
        </div>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total PDDs', value: summary.total, color: 'var(--primary)' },
          { label: 'Pending', value: summary.pending, color: 'var(--warning)' },
          { label: 'Overdue', value: summary.overdue, color: 'var(--error)' },
          { label: 'Collected', value: summary.collected, color: 'var(--success)' },
          { label: 'Waived', value: summary.waived, color: 'var(--text-tertiary)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value ?? 0}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {STATUS_TABS.map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`btn btn-sm filter-pill ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 999, whiteSpace: 'nowrap' }}
            >
              {tab === 'ALL' ? 'All Documents' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size={32} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileText} title="No documents found" description="Try adjusting your filters or search term." />
        </div>
      ) : isMobile ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grouped.map(c => (
              <div key={c.case_id} className="card case-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, background: 'var(--bg-surface)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.customer_name || 'Unknown Customer'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.case_code} · {c.customer_mobile}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{c.loan_amount?.toLocaleString('en-IN') || 'N/A'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.employee_name}</div>
                  </div>
                </div>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>Document</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.documents.map(doc => (
                        <tr key={doc.pdd_task_id}>
                          <td data-label="Document" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{doc.document_name}</td>
                          <td data-label="Due Date" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(doc.due_date)}</td>
                          <td data-label="Status"><StatusBadge status={doc.status} isOverdue={doc.is_overdue} /></td>
                          <td data-label="Action" style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => openModal(doc)}
                              className="btn btn-sm"
                              style={{ background: doc.status === 'PENDING' ? 'var(--primary)' : 'var(--role-admin)', color: '#fff', borderRadius: 0 }}
                            >
                              {doc.status === 'PENDING' ? 'Update' : 'Edit'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Desktop: flat single table, one row per document — styled to exactly
           match CustomersListPage's desktop table (sticky 2px-bordered header,
           centered fixed-width columns, flat 1px row separators, no per-row
           card boxing). */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} /><col style={{ width: '12%' }} /><col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                {['Case / Customer', 'Loan Amount', 'Employee', 'Document', 'Due Date', 'Status', 'Action'].map(h => (
                  <th key={h} style={{
                    position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)',
                    padding: '10px 8px', fontSize: 10, fontWeight: 800, color: 'var(--on-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
                    borderBottom: '2px solid var(--outline)', boxShadow: '0 2px 0 var(--outline)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map(doc => {
                const cellStyle = { padding: '12px 8px', verticalAlign: 'middle', fontSize: 12, wordBreak: 'break-word', whiteSpace: 'normal', textAlign: 'center' };
                return (
                  <tr key={doc.pdd_task_id} style={{ borderBottom: '1px solid var(--outline)' }}>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{doc.customer_name || 'Unknown Customer'}</div>
                      <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 2 }}>{doc.case_code} · {doc.customer_mobile}</div>
                    </td>
                    <td style={cellStyle}>₹{doc.loan_amount?.toLocaleString('en-IN') || 'N/A'}</td>
                    <td style={cellStyle}>{doc.employee_name || '—'}</td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{doc.document_name}</div>
                    </td>
                    <td style={cellStyle}>{formatDate(doc.due_date)}</td>
                    <td style={cellStyle}><StatusBadge status={doc.status} isOverdue={doc.is_overdue} /></td>
                    <td style={cellStyle}>
                      <button
                        onClick={() => openModal(doc)}
                        className="btn btn-sm"
                        style={{ background: doc.status === 'PENDING' ? 'var(--primary)' : 'var(--role-admin)', color: '#fff', borderRadius: 0 }}
                      >
                        {doc.status === 'PENDING' ? 'Update' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Update PDD Status</h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal} aria-label="Close"><X size={18} /></button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="notice notice-info" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 6 }}>
                  <span>{selectedTask?.customer_name}</span>
                  <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>{selectedTask?.case_code}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Document:</span>
                  <strong>{selectedTask?.document_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Loan Amount:</span>
                  <strong>₹{selectedTask?.loan_amount?.toLocaleString('en-IN') || 'N/A'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Collection Status <span className="required">*</span></label>
                  <select
                    required
                    value={modalForm.status}
                    onChange={e => setModalForm({ ...modalForm, status: e.target.value })}
                    className="form-control"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="COLLECTED">Collected</option>
                    {canWaive && <option value="WAIVED">Waived</option>}
                  </select>
                </div>

                {modalForm.status === 'COLLECTED' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Collection Date <span className="required">*</span></label>
                      <input type="date" required className="form-control"
                        value={modalForm.collection_date}
                        onChange={e => setModalForm({ ...modalForm, collection_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Collected By <span className="required">*</span></label>
                      <input type="text" required placeholder="Name of collector" className="form-control"
                        value={modalForm.collected_by}
                        onChange={e => setModalForm({ ...modalForm, collected_by: e.target.value })} />
                    </div>
                  </div>
                )}

                {modalForm.status === 'WAIVED' && (
                  <div className="form-group">
                    <label className="form-label">Waiver Reason <span className="required">*</span></label>
                    <textarea required rows={2} placeholder="Provide reason for waiving..." className="form-control"
                      style={{ resize: 'vertical' }}
                      value={modalForm.waiver_reason}
                      onChange={e => setModalForm({ ...modalForm, waiver_reason: e.target.value })} />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Remarks (Optional)</label>
                  <textarea rows={2} placeholder="Any additional notes..." className="form-control"
                    style={{ resize: 'vertical' }}
                    value={modalForm.remarks}
                    onChange={e => setModalForm({ ...modalForm, remarks: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 130, justifyContent: 'center' }}>
                  {submitting ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
