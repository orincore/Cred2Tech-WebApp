import React, { useState, useEffect, useCallback } from 'react';
import { Target, ChevronDown, ChevronUp, FileText, X, Edit, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { salesIncentiveService } from '../api/salesIncentiveService';
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
  CALCULATED: { label: 'Calculated', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  APPROVED: { label: 'Approved', color: 'var(--info)', bg: 'var(--info-bg)' },
  PAID: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
  REJECTED: { label: 'Rejected', color: 'var(--error)', bg: 'var(--error-bg)' },
  ON_HOLD: { label: 'On Hold', color: 'var(--warning)', bg: 'var(--warning-bg)' },
};

const VALID_TRANSITIONS = {
  CALCULATED: ['APPROVED', 'REJECTED', 'ON_HOLD'],
  ON_HOLD: ['CALCULATED', 'REJECTED'],
  APPROVED: ['PAID', 'REJECTED'],
  PAID: [],
  REJECTED: [],
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' };
  return <span className="badge" style={{ color: m.color, background: m.bg }}>{m.label}</span>;
}

function UpdateStatusModal({ entry, onClose, onSuccess }) {
  const allowedNext = VALID_TRANSITIONS[entry.status] || [];
  const [newStatus, setNewStatus] = useState(allowedNext[0] || '');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newStatus) return;
    if (newStatus === 'REJECTED' && !remarks.trim()) {
      toast.error('Remarks are mandatory when rejecting a payout.');
      return;
    }
    setSaving(true);
    try {
      await salesIncentiveService.updatePayoutStatus(entry.id, { status: newStatus, remarks });
      toast.success('Incentive status updated');
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const caseLabel = `${entry.case_display_id || `CASE-${entry.case_id}`} · ${entry.customer_name || 'Customer'} · ${entry.user?.name || 'Employee'}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 0, background: 'var(--role-admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={16} color="var(--role-admin)" />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Update Incentive Status</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            {caseLabel}
          </div>

          <div className="form-group">
            <label className="form-label">New Status</label>
            {allowedNext.length === 0 ? (
              <div className="notice notice-error">Cannot update a terminal state.</div>
            ) : (
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="form-control">
                {allowedNext.map(s => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Remarks {newStatus === 'REJECTED' && <span className="required">*</span>}</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes..." rows={3} className="form-control" style={{ resize: 'vertical' }} />
          </div>
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

function SummaryRow({ label, data }) {
  return (
    <tr>
      <td data-label="Period" style={{ fontWeight: label === 'Older' ? 700 : 600 }}>{label}</td>
      <td data-label="Cases Disbursed" style={{ textAlign: 'center' }}>{data.cases || 0}</td>
      <td data-label="Disbursement Volume" style={{ textAlign: 'center' }}>{fmt(data.volume || 0)}</td>
      <td data-label="Payout Eligible" style={{ textAlign: 'center', color: 'var(--success)' }}>{fmt(data.payout_eligible || 0)}</td>
      <td data-label="Paid Dues" style={{ textAlign: 'center', color: 'var(--success)' }}>{fmt(data.paid_dues || 0)}</td>
      <td data-label="Pending" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--error)' }}>{fmt(data.pending || 0)}</td>
    </tr>
  );
}

function EmployeeCard({ employee, ledgers, onUpdate, isAdmin }) {
  const [expanded, setExpanded] = useState(true);
  const totalVolume = ledgers.reduce((s, l) => s + parseFloat(l.base_amount || 0), 0);
  const totalPayout = ledgers.reduce((s, l) => s + parseFloat(l.calculated_incentive || 0), 0);
  const hasPending = ledgers.some(l => l.status === 'CALCULATED');

  return (
    <div className="card employee-card" style={{ overflow: 'hidden' }}>
      <div className="group-header" onClick={() => setExpanded(!expanded)} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={14} color="var(--error)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{employee.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {ledgers.length} cases · Volume: {fmt(totalVolume)} · Payout: {fmt(totalPayout)}
              {hasPending && <span style={{ color: 'var(--warning)', fontWeight: 600 }}> · Pending action</span>}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Details</button>
      </div>

      {expanded && (
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, borderTop: '1px solid var(--border)' }}>
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Disb. Amt</th>
                <th style={{ textAlign: 'right' }}>Payout</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                {isAdmin && <th style={{ textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {ledgers.map(l => {
                const caseNum = l.case_display_id || `CASE-${l.case_id}`;
                const payout = parseFloat(l.calculated_incentive || 0);
                return (
                  <tr key={l.id}>
                    <td data-label="Case ID" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{caseNum}</td>
                    <td data-label="Customer">{l.customer_name || '—'}</td>
                    <td data-label="Product">{l.product_type || l.case_entity?.product_type || '—'}</td>
                    <td data-label="Disb. Amt" style={{ textAlign: 'right' }}>{fmt(l.base_amount)}</td>
                    <td data-label="Payout" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmt(payout)}</td>
                    <td data-label="Status" style={{ textAlign: 'center' }}><StatusBadge status={l.status} /></td>
                    {isAdmin && (
                      <td data-label="Action" style={{ textAlign: 'center' }}>
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

export default function SalesIncentivePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'DSA_ADMIN';

  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState([]);
  const [summary, setSummary] = useState({ current_month: {}, previous_month: {}, older: {} });
  const [availableMonths, setAvailableMonths] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rules, setRules] = useState([]);
  const [syncingLevel, setSyncingLevel] = useState(null);
  const [filters, setFilters] = useState({ month: '', user_id: '', product: '', search: '' });
  const [updateModal, setUpdateModal] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    hierarchy_level: 'L1', commission_type: 'PERCENTAGE', commission_value: '',
    calculation_base: 'DISBURSED_AMOUNT', volume_slabs: [], case_count_slabs: [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.month) params.month = filters.month;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.product) params.product = filters.product;
      if (filters.search) params.search = filters.search;

      const resPayouts = await salesIncentiveService.getPayouts(params);
      setLedgers(resPayouts.ledgers || resPayouts.data || []);
      setSummary(resPayouts.summary || { current_month: {}, previous_month: {}, older: {} });
      const months = resPayouts.availableMonths || [];
      setAvailableMonths(months);
      if (!filters.month && months.length > 0) {
        setFilters(prev => ({ ...prev, month: months[0] }));
      }

      if (isAdmin) {
        const [resEmployees, resRules] = await Promise.all([
          salesIncentiveService.getEmployeesConfig(),
          salesIncentiveService.getRules(),
        ]);
        setEmployees(resEmployees || []);
        setRules(resRules || []);
      } else {
        setEmployees([]);
        setRules([]);
      }
    } catch (e) {
      toast.error('Failed to load sales incentive data');
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRuleId) {
        await salesIncentiveService.updateRule(editingRuleId, ruleForm);
        toast.success('Rule updated');
      } else {
        await salesIncentiveService.createRule(ruleForm);
        toast.success('Rule created');
      }
      setRuleForm({ hierarchy_level: 'L1', commission_type: 'PERCENTAGE', commission_value: '', calculation_base: 'DISBURSED_AMOUNT', volume_slabs: [], case_count_slabs: [] });
      setEditingRuleId(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save rule');
    }
  };

  const handleCancelEdit = () => {
    setRuleForm({ hierarchy_level: 'L1', commission_type: 'PERCENTAGE', commission_value: '', calculation_base: 'DISBURSED_AMOUNT', volume_slabs: [], case_count_slabs: [] });
    setEditingRuleId(null);
  };

  const handleSyncIncentives = async (hierarchyLevel) => {
    try {
      setSyncingLevel(hierarchyLevel);
      const res = await salesIncentiveService.syncMissingIncentives(hierarchyLevel);
      toast.success(res.message || 'Synced successfully');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to sync missing incentives');
    } finally {
      setSyncingLevel(null);
    }
  };

  const grouped = ledgers.reduce((acc, l) => {
    const uid = l.user_id || user?.id || 'self';
    if (!acc[uid]) acc[uid] = { user: l.user || user || { name: 'My Incentives' }, ledgers: [] };
    acc[uid].ledgers.push(l);
    return acc;
  }, {});

  return (
    <div className="si-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .si-page .card, .si-page .btn, .si-page .badge, .si-page .form-control,
        .si-page .modal-box, .si-page .table-wrapper, .si-page table { border-radius: 0 !important; }
        /* Match CustomersListPage's table density for cross-page consistency */
        .si-page th { padding: 10px 8px !important; font-size: 10px !important; font-weight: 800 !important; }
        .si-page td { padding: 12px 8px !important; font-size: 12px !important; }
        @media (max-width: 768px) {
          .si-page > div { padding: 80px 24px 24px !important; }
          /* 2-per-row grid instead of each filter field stacking full-width —
             cuts the filter panel's height roughly in half on mobile. */
          .si-page .filter-bar { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px 10px !important; padding: 10px 12px !important; align-items: end; }
          .si-page .filter-bar > div { min-width: 0 !important; }
          .si-page .filter-bar .search-field { grid-column: 1 / -1; }
          .si-page .filter-bar .form-label { margin-bottom: 3px !important; }
          /* Each employee/summary group is ONE real card — header and its
             case rows together, with a visible border + strong shadow so it
             clearly lifts off the page and reads as a distinct section. Rows
             inside stay flat with a thin divider, like a normal table —
             giving every row its own separate elevation made the whole list
             busy without making section boundaries any clearer, and stacked
             extra margins around it just added dead space. One clean bordered
             box per group is simpler and reads better. */
          .si-page .employee-card, .si-page .summary-card { background: var(--bg-surface) !important; border: 1px solid var(--border) !important; box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08) !important; }
          .si-page .list-wrap { background: transparent !important; border: none !important; box-shadow: none !important; }
          .si-page table, .si-page thead, .si-page tbody, .si-page tr, .si-page td { display: block; width: 100%; }
          .si-page table { background: transparent !important; }
          .si-page thead { display: none; }
          .si-page tbody { display: flex !important; flex-direction: column; gap: 0; }
          .si-page tbody tr { border: none !important; background: transparent !important; box-shadow: none !important; padding: 4px 14px; }
          .si-page tbody tr + tr { border-top: 1px solid var(--border) !important; }
          .si-page tbody td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0 !important; border-bottom: 1px solid var(--border); text-align: right; white-space: normal; }
          .si-page tbody td:last-child { border-bottom: none; }
          .si-page tbody td > div { align-items: flex-end; }
          .si-page tbody td::before { content: attr(data-label); font-weight: 700; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; flex-shrink: 0; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <PageHeader title="Sales Incentive" subtitle="Performance incentives & bonuses for team members — tracking & payout" />
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <button className="btn btn-secondary" onClick={() => setShowConfigModal(true)}>
            <FileText size={14} /> Rule Configuration
          </button>
        </div>
      )}

      <div className="card summary-card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        {/* Compact filter toolbar — merged into the same card as the summary table below */}
        <div className="filter-bar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Month</label>
            <select
              value={filters.month || 'all'}
              onChange={e => setFilters({ ...filters, month: e.target.value === 'all' ? 'all' : e.target.value })}
              className="form-control"
              style={{ padding: '5px 10px', fontSize: 12 }}
              disabled={availableMonths.length === 0}
            >
              {availableMonths.length === 0 && <option value="">No data available</option>}
              {availableMonths.length > 0 && <option value="all">All Months</option>}
              {availableMonths.map(m => (
                <option key={m} value={m}>{new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div style={{ flex: 1, minWidth: 140 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Team Member</label>
              <select value={filters.user_id} onChange={e => setFilters({ ...filters, user_id: e.target.value })} className="form-control" style={{ padding: '5px 10px', fontSize: 12 }}>
                <option value="">All Members</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 120 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Product</label>
            <input type="text" placeholder="ALL, LAP, HL..." value={filters.product} onChange={e => setFilters({ ...filters, product: e.target.value })} className="form-control" style={{ padding: '5px 10px', fontSize: 12 }} />
          </div>
          <div className="search-field" style={{ flex: 2, minWidth: 170 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Search</label>
            <input type="text" placeholder="Customer name, case ID..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} className="form-control" style={{ padding: '5px 10px', fontSize: 12 }} />
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th style={{ textAlign: 'center' }}>Cases Disbursed</th>
                <th style={{ textAlign: 'center' }}>Disbursement Volume</th>
                <th style={{ textAlign: 'center' }}>Payout Eligible</th>
                <th style={{ textAlign: 'center' }}>Paid Dues</th>
                <th style={{ textAlign: 'center' }}>Pending</th>
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

      <div className="card list-wrap" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><LoadingSpinner size={32} /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <EmptyState icon={Target} title="No incentive records found" description="Try adjusting your filters." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
            {Object.entries(grouped).map(([uid, group]) => (
              <EmployeeCard key={uid} employee={group.user} ledgers={group.ledgers} onUpdate={setUpdateModal} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>

      {updateModal && <UpdateStatusModal entry={updateModal} onClose={() => setUpdateModal(null)} onSuccess={() => { setUpdateModal(null); fetchData(); }} />}

      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-box" style={{ maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Incentive Rules Configuration</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowConfigModal(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleRuleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24, background: 'var(--bg-elevated)', padding: 16, borderRadius: 0 }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Level</label>
                  <select required value={ruleForm.hierarchy_level} onChange={e => setRuleForm({ ...ruleForm, hierarchy_level: e.target.value })} className="form-control">
                    <option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option><option value="L4">L4</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={ruleForm.commission_type} onChange={e => setRuleForm({ ...ruleForm, commission_type: e.target.value })} className="form-control">
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed (₹)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Value</label>
                  <input required type="number" step="0.01" min="0" value={ruleForm.commission_value} onChange={e => setRuleForm({ ...ruleForm, commission_value: e.target.value })} className="form-control" />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Base</label>
                  <select value={ruleForm.calculation_base} onChange={e => setRuleForm({ ...ruleForm, calculation_base: e.target.value })} className="form-control">
                    <option value="DISBURSED_AMOUNT">Disbursed Amount</option>
                    <option value="LENDER_COMMISSION">Lender Commission</option>
                    <option value="DSA_NET_COMMISSION">DSA Net Commission</option>
                    <option value="PROCESSING_FEE">Processing Fee</option>
                    <option value="FIXED_PER_CASE">Fixed Per Case</option>
                  </select>
                </div>
                <div style={{ flexBasis: '100%', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  {editingRuleId && <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">Cancel</button>}
                  <button type="submit" className="btn btn-primary">{editingRuleId ? 'Update' : 'Add'}</button>
                </div>
              </form>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Level</th><th>Base</th><th>Value</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map(r => (
                      <tr key={r.id}>
                        <td data-label="Level" style={{ fontWeight: 700 }}>{r.hierarchy_level}</td>
                        <td data-label="Base">{r.calculation_base.replace(/_/g, ' ')}</td>
                        <td data-label="Value" style={{ fontWeight: 600, color: 'var(--success)' }}>
                          {r.commission_type === 'PERCENTAGE' ? `${r.commission_value}%` : `₹${r.commission_value}`}
                        </td>
                        <td data-label="Status"><StatusBadge status={r.status} /></td>
                        <td data-label="Action">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                            <button
                              onClick={() => {
                                setEditingRuleId(r.id);
                                setRuleForm({
                                  hierarchy_level: r.hierarchy_level,
                                  commission_type: r.commission_type,
                                  commission_value: r.commission_value,
                                  calculation_base: r.calculation_base,
                                  volume_slabs: r.volume_slabs || [],
                                  case_count_slabs: r.case_count_slabs || [],
                                });
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--primary)', padding: 0 }}
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleSyncIncentives(r.hierarchy_level)}
                              disabled={syncingLevel === r.hierarchy_level}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--success)', padding: 0 }}
                            >
                              <RefreshCw size={13} style={{ animation: syncingLevel === r.hierarchy_level ? 'spin 1s linear infinite' : 'none' }} />
                              {syncingLevel === r.hierarchy_level ? 'Syncing...' : 'Sync Past'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rules.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No rules configured</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
