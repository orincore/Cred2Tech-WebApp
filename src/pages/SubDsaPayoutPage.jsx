import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, CheckSquare, Square, FileText, Clock, AlertCircle, RefreshCw, X, Users2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getPayouts, updatePayoutStatus, generateInvoice, getPayoutHistory, getSubDsaUsers } from '../api/subDsaPayoutService';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const STATUS_META = {
  DRAFT: { label: 'Draft', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  INVOICE_RAISED: { label: 'Invoice Raised', color: 'var(--info)', bg: 'var(--info-bg)' },
  UNDER_REVIEW: { label: 'Under Review', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  RECONCILED: { label: 'Reconciled', color: 'var(--success)', bg: 'var(--success-bg)' },
  PDD_PENDING: { label: 'PDD Pending', color: 'var(--error)', bg: 'var(--error-bg)' },
  PAID: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
  REJECTED: { label: 'Rejected', color: 'var(--error)', bg: 'var(--error-bg)' },
};

const VALID_TRANSITIONS = {
  DRAFT: ['INVOICE_RAISED', 'PDD_PENDING', 'REJECTED'],
  INVOICE_RAISED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['RECONCILED', 'REJECTED'],
  RECONCILED: ['PAID', 'REJECTED'],
  PDD_PENDING: ['RECONCILED', 'REJECTED'],
  PAID: [],
  REJECTED: ['DRAFT'],
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' };
  return <span className="badge" style={{ color: m.color, background: m.bg }}>{m.label}</span>;
}

function UpdateStatusModal({ entry, onClose, onSuccess }) {
  const allowedNext = VALID_TRANSITIONS[entry.status] || [];
  const [newStatus, setNewStatus] = useState(allowedNext[0] || '');
  const [remarks, setRemarks] = useState('');
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { getPayoutHistory(entry.id).then(setHistory).catch(() => {}); }, [entry.id]);

  const handleSave = async () => {
    if (!newStatus) return;
    if (newStatus === 'REJECTED' && !remarks.trim()) {
      toast.error('Remarks are mandatory when rejecting a payout.');
      return;
    }
    setSaving(true);
    try {
      await updatePayoutStatus(entry.id, newStatus, remarks);
      toast.success('Payout status updated');
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Failed to update status');
    } finally { setSaving(false); }
  };

  const caseLabel = `${entry.case_display_id || `CASE-${entry.case_id}`} · ${entry.customer_name || 'Customer'} · ${entry.user?.name || 'SubDSA'}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 0, background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} color="var(--info)" />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Update Payout Status</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            {caseLabel}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Current status:</span>
            <StatusBadge status={entry.status} />
          </div>

          <div className="form-group">
            <label className="form-label">New Status</label>
            {allowedNext.length === 0 ? (
              <div className="notice notice-error">This record is in a terminal state and cannot be updated.</div>
            ) : (
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="form-control">
                {allowedNext.map(s => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Remarks {newStatus === 'REJECTED' && <span className="required">*</span>}</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes..." rows={3} className="form-control" style={{ resize: 'vertical' }} />
          </div>

          {history.length > 0 && (
            <div>
              <button onClick={() => setShowHistory(!showHistory)} className="btn btn-ghost btn-sm" style={{ color: 'var(--info)', padding: 0 }}>
                <Clock size={13} /> {showHistory ? 'Hide' : 'Show'} status history ({history.length})
              </button>
              {showHistory && (
                <div style={{ marginTop: 10, borderLeft: '2px solid var(--border)', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map((h, i) => (
                    <div key={i} style={{ fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {h.old_status && <StatusBadge status={h.old_status} />}
                        <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                        <StatusBadge status={h.new_status} />
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>by {h.updated_by?.name || 'System'}</span>
                      </div>
                      {h.remarks && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{h.remarks}</div>}
                      <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>{new Date(h.updated_at).toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {allowedNext.length > 0 && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !newStatus} style={{ minWidth: 130, justifyContent: 'center' }}>
              {saving ? <LoadingSpinner size={16} color="currentColor" /> : 'Save Status →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GenerateInvoiceModal({ selectedIds, allLedgers, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false);
  const selectedRows = allLedgers.filter(l => selectedIds.includes(l.id));
  const partners = [...new Set(selectedRows.map(l => l.sub_dsa_user_id))];
  const months = [...new Set(selectedRows.map(l => l.payout_period || l.calculation_metadata?.payout_period).filter(Boolean))];
  const validSelection = selectedRows.length === selectedIds.length && partners.length === 1 && months.length === 1 && selectedRows.every(l => l.status === 'DRAFT');
  const subDsaUserId = partners[0];
  const monthYear = months[0];

  const handleGenerate = async () => {
    if (!validSelection) {
      toast.error('Select only DRAFT entries for one Sub-DSA and one payout month.');
      return;
    }
    setSaving(true);
    try {
      const res = await generateInvoice(parseInt(subDsaUserId), monthYear, selectedIds);
      toast.success(`Invoice ${res.invoice_number} generated for ₹${parseFloat(res.total_payout).toLocaleString('en-IN')}`);
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Invoice generation failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Generate SubDSA Invoice</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="notice notice-warning">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {selectedIds.length} entry(ies) selected. All must be in DRAFT status.
          </div>
          <div style={{ fontSize: 13, color: validSelection ? 'var(--text-secondary)' : 'var(--error)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, padding: '10px 14px' }}>
            {validSelection ? `Invoice will be generated for ${selectedRows[0]?.user?.name || 'selected Sub-DSA'} / ${monthYear}.` : 'Selection must contain only DRAFT entries for one Sub-DSA and one payout month.'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={saving || !validSelection}>
            {saving ? <LoadingSpinner size={16} color="currentColor" /> : '🧾 Generate Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, data }) {
  return (
    <tr>
      <td data-label="Period" style={{ textAlign: 'left', fontWeight: label === 'Older' ? 700 : 500 }}>{label}</td>
      <td data-label="Cases Disbursed" style={{ textAlign: 'center' }}>{data.cases}</td>
      <td data-label="Disbursement Volume" style={{ textAlign: 'center' }}>{fmt(data.volume)}</td>
      <td data-label="Payout Eligible" style={{ textAlign: 'center', color: 'var(--success)' }}>{fmt(data.payout_eligible)}</td>
      <td data-label="Subvention" style={{ textAlign: 'center', color: 'var(--error)' }}>{data.subvention > 0 ? `-${fmt(data.subvention)}` : '—'}</td>
      <td data-label="Paid Dues" style={{ textAlign: 'center', color: 'var(--success)' }}>{fmt(data.paid_dues)}</td>
      <td data-label="Pending" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--error)' }}>{fmt(data.pending)}</td>
    </tr>
  );
}

function SubDsaCard({ subDsa, ledgers, selectedIds, onToggleSelect, onUpdate, isAdmin }) {
  const [expanded, setExpanded] = useState(true);
  const totalVolume = ledgers.reduce((s, l) => s + parseFloat(l.dsa_earned_amount || 0), 0);
  const totalPayout = ledgers.reduce((s, l) => s + parseFloat(l.sub_dsa_payout || 0), 0);
  const hasPddPending = ledgers.some(l => l.status === 'PDD_PENDING');

  return (
    <div className="card subdsa-card" style={{ overflow: 'hidden' }}>
      <div className="group-header" onClick={() => setExpanded(!expanded)} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 0, background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--info)' }}>
            {(subDsa.name || 'S').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {subDsa.name}
              {hasPddPending && <span className="badge" style={{ color: 'var(--error)', background: 'var(--error-bg)', fontSize: 11 }}>⚠ PDD Pending</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {ledgers.length} cases · Volume: {fmt(totalVolume)} · Payout: {fmt(totalPayout)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)' }}>
          <span style={{ fontSize: 12 }}>{expanded ? 'Hide' : 'Show'} Details</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, borderTop: '1px solid var(--border)' }}>
          <table>
            <thead>
              <tr>
                {isAdmin && <th style={{ width: 36 }} />}
                <th>Case ID</th><th>Customer</th><th>Product</th>
                <th style={{ textAlign: 'right' }}>Disb. Amt</th>
                <th style={{ textAlign: 'right' }}>Payout</th>
                <th style={{ textAlign: 'right' }}>Subvention</th>
                <th style={{ textAlign: 'right' }}>Net Payable</th>
                <th>Status</th>
                {isAdmin && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {ledgers.map(l => {
                const caseNum = l.case_display_id || `CASE-${l.case_id}`;
                const subvent = parseFloat(l.subvention_amount || 0);
                const isSelected = selectedIds.includes(l.id);
                const canSelect = l.status === 'DRAFT';
                return (
                  <tr key={l.id} style={{ background: isSelected ? 'var(--info-bg)' : undefined }}>
                    {isAdmin && (
                      <td data-label="Select" style={{ textAlign: 'center' }}>
                        {canSelect ? (
                          <button onClick={() => onToggleSelect(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            {isSelected ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--text-tertiary)" />}
                          </button>
                        ) : <div style={{ width: 16, height: 16 }} />}
                      </td>
                    )}
                    <td data-label="Case ID" style={{ fontWeight: 700, color: 'var(--info)' }}>{caseNum}</td>
                    <td data-label="Customer">
                      {l.customer_name || '—'}
                      {l.status === 'PDD_PENDING' && <span className="badge" style={{ marginLeft: 6, fontSize: 10, color: 'var(--error)', background: 'var(--error-bg)' }}>PDD</span>}
                    </td>
                    <td data-label="Product">{l.product_type || l.calculation_metadata?.product_type || '—'}</td>
                    <td data-label="Disb. Amt" style={{ textAlign: 'right' }}>{fmt(l.dsa_earned_amount)}</td>
                    <td data-label="Payout" style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{fmt(l.sub_dsa_payout)}</td>
                    <td data-label="Subvention" style={{ textAlign: 'right', color: subvent > 0 ? 'var(--error)' : 'var(--text-tertiary)' }}>{subvent > 0 ? `-${fmt(subvent)}` : '—'}</td>
                    <td data-label="Net Payable" style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(l.net_payable)}</td>
                    <td data-label="Status"><StatusBadge status={l.status} /></td>
                    {isAdmin && (
                      <td data-label="Action">
                        {(VALID_TRANSITIONS[l.status] || []).length > 0 && (
                          <button className="btn btn-secondary btn-sm" onClick={() => onUpdate(l)}>Update</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SubDsaPayoutPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'DSA_ADMIN';

  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState([]);
  const [summary, setSummary] = useState({ current_month: {}, previous_month: {}, older: {} });
  const [availableMonths, setAvailableMonths] = useState([]);
  const [subDsaUsers, setSubDsaUsers] = useState([]);
  const [filters, setFilters] = useState({ month: '', sub_dsa_user_id: '', status: '', product: '', search: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [updateModal, setUpdateModal] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.month) params.month = filters.month;
      if (filters.sub_dsa_user_id) params.sub_dsa_user_id = filters.sub_dsa_user_id;
      if (filters.status) params.status = filters.status;
      if (filters.product) params.product = filters.product;
      if (filters.search) params.search = filters.search;

      const res = await getPayouts(params);
      setLedgers(res.ledgers || []);
      setSelectedIds(prev => prev.filter(id => (res.ledgers || []).some(l => l.id === id && l.status === 'DRAFT')));
      setSummary(res.summary || { current_month: {}, previous_month: {}, older: {} });
      const months = res.availableMonths || [];
      setAvailableMonths(months);
      if (!filters.month && months.length > 0) {
        setFilters(prev => ({ ...prev, month: months[0] }));
      }
    } catch (e) {
      toast.error('Failed to load payout records');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (isAdmin) getSubDsaUsers().then(setSubDsaUsers).catch(() => {});
  }, [isAdmin]);

  const grouped = ledgers.reduce((acc, l) => {
    const uid = l.sub_dsa_user_id;
    if (!acc[uid]) acc[uid] = { user: l.user, ledgers: [] };
    acc[uid].ledgers.push(l);
    return acc;
  }, {});

  const toggleSelect = (id) => {
    const row = ledgers.find(l => l.id === id);
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      const currentRows = ledgers.filter(l => prev.includes(l.id));
      const rowMonth = row?.payout_period || row?.calculation_metadata?.payout_period;
      const samePartner = currentRows.every(l => l.sub_dsa_user_id === row?.sub_dsa_user_id);
      const sameMonth = currentRows.every(l => (l.payout_period || l.calculation_metadata?.payout_period) === rowMonth);
      if (currentRows.length && (!samePartner || !sameMonth)) {
        toast.error('Invoice selection must stay within one Sub-DSA and one payout month.');
        return prev;
      }
      return [...prev, id];
    });
  };

  return (
    <div className="sd-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .sd-page .card, .sd-page .btn, .sd-page .badge, .sd-page .form-control,
        .sd-page .modal-box, .sd-page .table-wrapper, .sd-page table { border-radius: 0 !important; }
        /* Match CustomersListPage's table density for cross-page consistency */
        .sd-page th { padding: 10px 8px !important; font-size: 10px !important; font-weight: 800 !important; }
        .sd-page td { padding: 12px 8px !important; font-size: 12px !important; }
        .sd-page .filter-bar .form-control { border-radius: 999px !important; padding-left: 18px !important; padding-right: 18px !important; }
        @media (max-width: 768px) {
          .sd-page > div { padding: 80px 24px 24px !important; }
          /* 2-per-row grid instead of each filter field stacking full-width —
             cuts the filter panel's height roughly in half on mobile. */
          .sd-page .filter-bar { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px 10px !important; padding: 10px 12px !important; align-items: end; }
          .sd-page .filter-bar > div { min-width: 0 !important; }
          .sd-page .filter-bar .search-field { grid-column: 1 / -1; }
          .sd-page .filter-bar .form-label { margin-bottom: 3px !important; }
          /* Each Sub-DSA/summary group is ONE real card — header and its case
             rows together, with a visible border + strong shadow so it
             clearly lifts off the page and reads as a distinct section. Rows
             inside stay flat with a thin divider, like a normal table —
             giving every row its own separate elevation made the whole list
             busy without making section boundaries any clearer, and stacked
             extra margins around it just added dead space. One clean bordered
             box per group is simpler and reads better. */
          .sd-page .subdsa-card, .sd-page .summary-card { background: var(--bg-surface) !important; border: 1px solid var(--border) !important; box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08) !important; }
          .sd-page .list-wrap { background: transparent !important; border: none !important; box-shadow: none !important; }
          .sd-page table, .sd-page thead, .sd-page tbody, .sd-page tr, .sd-page td { display: block; width: 100%; }
          .sd-page table { background: transparent !important; }
          .sd-page thead { display: none; }
          .sd-page tbody { display: flex !important; flex-direction: column; gap: 0; }
          .sd-page tbody tr { border: none !important; background: transparent !important; box-shadow: none !important; padding: 4px 14px; }
          .sd-page tbody tr + tr { border-top: 1px solid var(--border) !important; }
          .sd-page tbody td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0 !important; border-bottom: 1px solid var(--border); text-align: right; white-space: normal; }
          .sd-page tbody td:last-child { border-bottom: none; }
          .sd-page tbody td::before { content: attr(data-label); font-weight: 700; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; flex-shrink: 0; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <PageHeader title="Sub DSA Payout" subtitle="Commission payable to Sub-DSA partners — case-wise tracking & payout status" />

      <div className="card filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ minWidth: 140 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Month</label>
          <select className="form-control" style={{ padding: '6px 14px', fontSize: 12 }} value={filters.month || 'all'} onChange={e => setFilters(p => ({ ...p, month: e.target.value === 'all' ? 'all' : e.target.value }))} disabled={availableMonths.length === 0}>
            {availableMonths.length === 0 && <option value="">No data available</option>}
            {availableMonths.length > 0 && <option value="all">All Months</option>}
            {availableMonths.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</option>)}
          </select>
        </div>
        {isAdmin && (
          <div style={{ minWidth: 150 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Sub-DSA</label>
            <select className="form-control" style={{ padding: '6px 14px', fontSize: 12 }} value={filters.sub_dsa_user_id} onChange={e => setFilters(p => ({ ...p, sub_dsa_user_id: e.target.value }))}>
              <option value="">All Sub-DSAs</option>
              {subDsaUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ minWidth: 140 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Invoice Status</label>
          <select className="form-control" style={{ padding: '6px 14px', fontSize: 12 }} value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 120 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Product</label>
          <input type="text" placeholder="ALL, LAP, HL..." value={filters.product} onChange={e => setFilters(p => ({ ...p, product: e.target.value }))} className="form-control" style={{ padding: '6px 14px', fontSize: 12 }} />
        </div>
        <div className="search-field" style={{ flex: 1, minWidth: 180 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Search</label>
          <input type="text" placeholder="Customer name, case ID..." value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} className="form-control" style={{ padding: '6px 14px', fontSize: 12 }} />
        </div>
        {isAdmin && selectedIds.length > 0 && (
          <button className="btn btn-primary btn-sm search-field" onClick={() => setInvoiceModal(true)} style={{ justifyContent: 'center' }}>
            <FileText size={14} /> Generate Invoice ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="card summary-card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Period</th>
                <th style={{ textAlign: 'center' }}>Cases Disbursed</th>
                <th style={{ textAlign: 'center' }}>Disbursement Volume</th>
                <th style={{ textAlign: 'center', color: 'var(--success)' }}>Payout Eligible</th>
                <th style={{ textAlign: 'center', color: 'var(--error)' }}>Subvention</th>
                <th style={{ textAlign: 'center', color: 'var(--success)' }}>Paid Dues</th>
                <th style={{ textAlign: 'center', color: 'var(--error)' }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="Current Month" data={summary.current_month || {}} />
              <SummaryRow label="Previous Month" data={summary.previous_month || {}} />
              <SummaryRow label="Older" data={summary.older || {}} />
            </tbody>
          </table>
        </div>
      </div>

      {loading && ledgers.length === 0 ? (
        <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><LoadingSpinner size={32} /></div>
      ) : (
        <div className="card list-wrap" style={{ overflow: 'hidden' }}>

          {Object.keys(grouped).length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No payout records found"
              description="Payout entries are created automatically when a Sub-DSA's case is disbursed and commission is recorded."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
              {Object.entries(grouped).map(([uid, group]) => (
                <SubDsaCard
                  key={uid}
                  subDsa={group.user || { name: 'Unknown' }}
                  ledgers={group.ledgers}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onUpdate={setUpdateModal}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {updateModal && (
        <UpdateStatusModal entry={updateModal} onClose={() => setUpdateModal(null)} onSuccess={() => { setUpdateModal(null); fetchData(); }} />
      )}
      {invoiceModal && (
        <GenerateInvoiceModal
          selectedIds={selectedIds}
          allLedgers={ledgers}
          onClose={() => setInvoiceModal(false)}
          onSuccess={() => { setInvoiceModal(false); setSelectedIds([]); fetchData(); }}
        />
      )}
      </div>
    </div>
  );
}
