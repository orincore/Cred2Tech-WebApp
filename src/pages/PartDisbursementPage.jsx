import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  TrendingUp, Calendar, CheckCircle2, PieChart, Search, X, Building2,
} from 'lucide-react';
import { caseService } from '../api/caseService';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const formatCr = (val) => {
  const num = parseFloat(val) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function PartDisbursementPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ cases: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [saving, setSaving] = useState(false);

  const [trancheForm, setTrancheForm] = useState({
    amount: '',
    disbursement_date: new Date().toISOString().split('T')[0],
    next_disbursement_due_date: '',
    remarks: '',
    pdd_pending: false,
    pdd_documents: [{ document_name: '', due_date: '' }],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await caseService.getPartialDisbursements();
      setData(result);
    } catch (error) {
      toast.error('Failed to load partial disbursements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenUpdate = (caseObj) => {
    setSelectedCase(caseObj);
    setTrancheForm({
      amount: caseObj.remaining_disbursement_amount,
      disbursement_date: new Date().toISOString().split('T')[0],
      next_disbursement_due_date: '',
      remarks: '',
      pdd_pending: false,
      pdd_documents: [{ document_name: '', due_date: '' }],
    });
    setShowUpdateModal(true);
  };

  const balanceAfter = selectedCase
    ? (parseFloat(selectedCase.remaining_disbursement_amount) || 0) - (parseFloat(trancheForm.amount) || 0)
    : 0;

  const handleSaveTranche = async () => {
    const amount = parseFloat(trancheForm.amount);
    if (!trancheForm.amount || isNaN(amount) || amount <= 0) return toast.error('Please enter a valid disbursement amount');
    if (amount > (parseFloat(selectedCase.remaining_disbursement_amount) || 0)) {
      return toast.error('Amount cannot exceed the remaining pending balance');
    }
    if (balanceAfter > 0 && !trancheForm.next_disbursement_due_date) {
      return toast.error('A new due date is required for the remaining balance');
    }

    setSaving(true);
    try {
      const validPddDocs = trancheForm.pdd_documents.filter(d => d.document_name.trim());
      const payload = {
        amount: trancheForm.amount,
        disbursement_date: trancheForm.disbursement_date,
        next_disbursement_due_date: trancheForm.next_disbursement_due_date || null,
        remarks: trancheForm.remarks,
        pdd_tasks: trancheForm.pdd_pending ? validPddDocs : [],
      };
      const idempotencyKey = `webapp_${selectedCase.id}_${Date.now()}`;
      await caseService.recordDisbursement(selectedCase.id, payload, idempotencyKey);
      toast.success('Disbursement recorded successfully');
      setShowUpdateModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record disbursement');
    } finally {
      setSaving(false);
    }
  };

  const addPddRow = () => setTrancheForm(f => ({ ...f, pdd_documents: [...f.pdd_documents, { document_name: '', due_date: '' }] }));
  const removePddRow = (idx) => setTrancheForm(f => ({ ...f, pdd_documents: f.pdd_documents.filter((_, i) => i !== idx) }));
  const updatePddRow = (idx, field, value) => setTrancheForm(f => ({
    ...f,
    pdd_documents: f.pdd_documents.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
  }));

  const filteredCases = (data?.cases || []).filter(c =>
    c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id?.toString().includes(searchTerm)
  );

  const stats = data?.stats || {};

  return (
    <div className="pd-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .pd-page .card, .pd-page .btn, .pd-page .badge, .pd-page .form-control,
        .pd-page .modal-box, .pd-page .table-wrapper, .pd-page table { border-radius: 0 !important; }
        /* Match CustomersListPage's table density for cross-page consistency */
        .pd-page th { padding: 10px 8px !important; font-size: 10px !important; font-weight: 800 !important; }
        .pd-page td { padding: 12px 8px !important; font-size: 12px !important; }
        /* Stacked-card table on narrow screens — no horizontal scroll needed */
        @media (max-width: 768px) {
          .pd-page > div { padding: 80px 24px 24px !important; }
          /* The wrapping .card currently paints a solid surface behind the whole
             table, so the gaps between stacked row-cards showed that fill instead
             of the page's own background. Strip its chrome so each row-card
             floats independently on the page background. */
          .pd-page > div > .card { background: transparent !important; border: none !important; box-shadow: none !important; }
          .pd-page .search-box { width: 100% !important; }
          /* Compact 2-up stat tiles instead of 4 tall full-width cards. */
          .pd-page .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .pd-page .stat-grid > div { padding: 10px !important; min-height: 72px !important; gap: 2px !important; }
          .pd-page .stat-grid > div p:first-of-type { font-size: 9px !important; }
          .pd-page .stat-grid > div p:nth-of-type(2) { font-size: 16px !important; margin-top: 1px !important; }
          .pd-page .stat-grid > div p:last-of-type { font-size: 9px !important; white-space: normal !important; }
          .pd-page .stat-grid > div > div:last-child > div:last-child { width: 24px !important; height: 24px !important; margin-left: 6px !important; }
          .pd-page table, .pd-page thead, .pd-page tbody, .pd-page tr, .pd-page td { display: block; width: 100%; }
          .pd-page table { background: transparent !important; }
          .pd-page thead { display: none; }
          .pd-page tbody { display: flex !important; flex-direction: column; gap: 14px; }
          /* var(--border) sits almost on top of the page's own background
             color, so a plain 1px border barely reads as a card edge — bump
             the shadow so each row visibly lifts off the page. */
          .pd-page tbody tr { border: 1px solid var(--border) !important; background: var(--bg-surface) !important; box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08) !important; margin-bottom: 0 !important; padding: 4px 14px; }
          /* Label-above, content-below instead of label-left/value-right — a
             row-flex on td broke any cell with more than one child element
             (e.g. Disbursed's amount + progress-bar row got flattened into a
             broken side-by-side layout instead of staying stacked). */
          .pd-page tbody td { display: block; padding: 10px 0; border-bottom: 1px solid var(--border); text-align: left; white-space: normal; }
          .pd-page tbody td:last-child { border-bottom: none; }
          .pd-page tbody td::before { content: attr(data-label); display: block; font-weight: 700; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <PageHeader
        title="Part Disbursement"
        subtitle="Track and update pending disbursement tranches across all cases"
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div className="search-box" style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by customer name or case ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
            style={{ paddingLeft: 38, width: '100%' }}
          />
        </div>
      </div>

      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          title="Total Pending Volume"
          value={formatCr(stats.totalPendingVolume)}
          subtitle={`${stats.pendingCount || 0} cases pending`}
          icon={TrendingUp}
          color="var(--primary)"
          loading={loading}
        />
        <StatCard
          title="Due This Month"
          value={formatCr(stats.dueThisMonthVolume)}
          subtitle={`${stats.dueThisMonthCount || 0} case(s) due in ${new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })}`}
          icon={Calendar}
          color="var(--warning)"
          loading={loading}
        />
        <StatCard
          title="Disbursed This Month"
          value={formatCr(stats.volumeDisbursedThisMonth)}
          subtitle={`${stats.tranchesThisMonth || 0} tranche(s) recorded`}
          icon={CheckCircle2}
          color="var(--success)"
          loading={loading}
        />
        <StatCard
          title="Closing Balance"
          value={formatCr((stats.totalPendingVolume || 0) - (stats.dueThisMonthVolume || 0))}
          subtitle="Total pending after this month"
          icon={PieChart}
          color="var(--role-admin)"
          loading={loading}
        />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size={32} />
          </div>
        ) : filteredCases.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No pending disbursements"
            description={searchTerm ? 'No cases match your search.' : 'All sanctioned cases are fully disbursed.'}
          />
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Lender / Product</th>
                  <th>Sanctioned</th>
                  <th>Disbursed</th>
                  <th>Pending Amount</th>
                  <th>Next Due Date</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const sanctioned = parseFloat(c.sanctioned_amount) || 0;
                  const disbursed = parseFloat(c.total_disbursed_amount) || 0;
                  const disbursedPct = sanctioned > 0 ? (disbursed / sanctioned) * 100 : 0;
                  const isOverdue = c.next_disbursement_due_date && new Date(c.next_disbursement_due_date) < new Date();

                  return (
                    <tr key={c.id}>
                      <td data-label="Customer">
                        <div
                          onClick={() => navigate(`/cases/${c.id}`)}
                          style={{ fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}
                        >
                          {c.customer_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>CASE-{c.id}</div>
                      </td>
                      <td data-label="Lender / Product">
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.lender_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.product_type}</div>
                      </td>
                      <td data-label="Sanctioned" style={{ fontWeight: 700 }}>{formatCr(c.sanctioned_amount)}</td>
                      <td data-label="Disbursed">
                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCr(c.total_disbursed_amount)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 0, flexShrink: 0 }}>
                            <div style={{ width: `${Math.min(100, disbursedPct)}%`, height: '100%', background: 'var(--success)', borderRadius: 0 }} />
                          </div>
                          {disbursedPct.toFixed(0)}% disbursed
                        </div>
                      </td>
                      <td data-label="Pending Amount" style={{ fontWeight: 700, color: 'var(--warning)' }}>{formatCr(c.remaining_disbursement_amount)}</td>
                      <td data-label="Next Due Date">
                        {c.next_disbursement_due_date ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: isOverdue ? 'var(--error)' : 'var(--text-primary)' }}>
                              <Calendar size={13} /> {new Date(c.next_disbursement_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: isOverdue ? 'var(--error)' : 'var(--warning)' }}>
                              {isOverdue ? 'Overdue' : 'Due soon'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>Not scheduled</span>
                        )}
                      </td>
                      <td data-label="Action" style={{ textAlign: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenUpdate(c)}>
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpdateModal && selectedCase && (
        <div className="modal-overlay" onClick={() => !saving && setShowUpdateModal(false)}>
          <div className="modal-box" style={{ maxWidth: 620, padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Record New Disbursement</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {selectedCase.customer_name} · {selectedCase.lender_name} · CASE-{selectedCase.id}
                </p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowUpdateModal(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Sanctioned</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCr(selectedCase.sanctioned_amount)}</div>
                </div>
                <div style={{ padding: 14, background: 'var(--success-bg)', borderRadius: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--success)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Disbursed So Far</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)' }}>{formatCr(selectedCase.total_disbursed_amount)}</div>
                </div>
                <div style={{ padding: 14, background: 'var(--warning-bg)', borderRadius: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--warning)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Balance Pending</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--warning)' }}>{formatCr(selectedCase.remaining_disbursement_amount)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">New Disbursement Amount (₹) <span className="required">*</span></label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={trancheForm.amount}
                    onChange={(e) => setTrancheForm({ ...trancheForm, amount: e.target.value })}
                    placeholder="e.g. 4000000"
                  />
                  <span className="form-hint">Max pending balance: {formatCr(selectedCase.remaining_disbursement_amount)}</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Disbursement <span className="required">*</span></label>
                  <input
                    type="date"
                    className="form-control"
                    value={trancheForm.disbursement_date}
                    onChange={(e) => setTrancheForm({ ...trancheForm, disbursement_date: e.target.value })}
                  />
                </div>
              </div>

              {balanceAfter > 0 && (
                <div className="notice notice-warning" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: 20 }}>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Balance pending after this disbursement:</strong> after ₹{(parseFloat(trancheForm.amount) || 0).toLocaleString('en-IN')},
                    a balance of <strong>{formatCr(balanceAfter)}</strong> will remain.
                  </div>
                  <label className="form-label" style={{ marginBottom: 6 }}>New Due Date for Balance Amount <span className="required">*</span></label>
                  <input
                    type="date"
                    className="form-control"
                    value={trancheForm.next_disbursement_due_date}
                    onChange={(e) => setTrancheForm({ ...trancheForm, next_disbursement_due_date: e.target.value })}
                  />
                  <span className="form-hint" style={{ marginTop: 4 }}>The case stays in Part Disbursement until the balance is fully cleared.</span>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={trancheForm.pdd_pending}
                    onChange={(e) => setTrancheForm({ ...trancheForm, pdd_pending: e.target.checked })}
                  />
                  Post-disbursement documents (PDD) are pending for this tranche
                </label>
                {trancheForm.pdd_pending && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {trancheForm.pdd_documents.map((doc, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Document name (e.g. Property Insurance)"
                          value={doc.document_name}
                          onChange={(e) => updatePddRow(idx, 'document_name', e.target.value)}
                          style={{ flex: '2 1 160px' }}
                        />
                        <input
                          type="date"
                          className="form-control"
                          value={doc.due_date}
                          onChange={(e) => updatePddRow(idx, 'due_date', e.target.value)}
                          style={{ flex: '1 1 130px' }}
                        />
                        <button className="btn btn-ghost btn-icon" onClick={() => removePddRow(idx)} disabled={trancheForm.pdd_documents.length === 1}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addPddRow}>+ Add document</button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-control"
                  placeholder="Any remarks for this disbursement tranche..."
                  value={trancheForm.remarks}
                  onChange={(e) => setTrancheForm({ ...trancheForm, remarks: e.target.value })}
                  style={{ minHeight: 80, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={() => setShowUpdateModal(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTranche} disabled={saving} style={{ minWidth: 160, justifyContent: 'center' }}>
                {saving ? <LoadingSpinner size={16} color="currentColor" /> : 'Save Disbursement →'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
