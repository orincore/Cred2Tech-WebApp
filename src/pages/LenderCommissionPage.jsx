import React, { useState, useEffect } from 'react';
import { Landmark, ChevronDown, ChevronUp, X, Printer, FileText, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getLenderCommissions, getInvoiceCandidates, previewInvoice, updateLedgerStatus, syncMissingLenderCommissions,
} from '../api/commissionOperationsService';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const formatCurrency = (amount) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const STATUS_META = {
  PENDING: { label: 'Pending', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  INVOICED: { label: 'Invoice Raised', color: 'var(--info)', bg: 'var(--info-bg)' },
  PAID: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
  CANCELLED: { label: 'Rejected', color: 'var(--error)', bg: 'var(--error-bg)' },
};

// Backend accepts any status value with no transition validation (see
// commissionOperations.controller.js#updateLedgerStatus) — this map keeps the
// UI from offering illegal jumps (e.g. PAID back to PENDING), matching the
// state-machine pattern already enforced server-side for sales incentives
// and sub-DSA payouts.
const VALID_TRANSITIONS = {
  PENDING: ['INVOICED', 'CANCELLED'],
  INVOICED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: ['PENDING'],
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' };
  return <span className="badge" style={{ color: m.color, background: m.bg }}>{m.label}</span>;
}

// ── Update Status Modal ──────────────────────────────────────────────────────
function UpdateInvoiceStatusModal({ caseData, onClose, onSuccess }) {
  const allowedNext = VALID_TRANSITIONS[caseData.status] || [];
  const [status, setStatus] = useState(allowedNext[0] || caseData.status);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!status) return;
    setLoading(true);
    try {
      for (const l of caseData.ledgers) {
        await updateLedgerStatus(l.id, status, remarks);
      }
      toast.success('Status updated');
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Update Status</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>{caseData.caseId} · {caseData.customer}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Current status:</span>
          <StatusBadge status={caseData.status} />
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">New Status</label>
          {allowedNext.length === 0 ? (
            <div className="notice notice-error">This record is in a terminal state and cannot be updated.</div>
          ) : (
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-control">
              {allowedNext.map(s => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
            </select>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Remarks (Optional)</label>
          <textarea className="form-control" style={{ resize: 'vertical' }} placeholder="Add internal notes..." rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {allowedNext.length > 0 && (
            <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ minWidth: 120, justifyContent: 'center' }}>
              {loading ? <LoadingSpinner size={16} color="currentColor" /> : 'Save Status'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Generate Invoice Modal (2-step) ──────────────────────────────────────────
function GenerateInvoiceModal({ onClose, availableMonths, availableLenders, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ month: availableMonths[0] || '', lenderName: '', product: 'All Products' });
  const [candidates, setCandidates] = useState([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (filters.lenderName && filters.month) {
      (async () => {
        try {
          setCandidateLoading(true);
          const res = await getInvoiceCandidates(filters.lenderName, filters.product, filters.month);
          if (res.success) setCandidates(res.data);
        } catch (e) {
          toast.error('Failed to load pending cases');
        } finally {
          setCandidateLoading(false);
        }
      })();
    } else {
      setCandidates([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.lenderName, filters.month, filters.product]);

  const handleSelectAll = (e) => {
    setSelectedCaseIds(e.target.checked ? new Set(candidates.map(c => c.id)) : new Set());
  };
  const handleSelectCase = (id) => {
    const newSet = new Set(selectedCaseIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedCaseIds(newSet);
  };

  const handlePreview = async () => {
    if (selectedCaseIds.size === 0) return toast.error('Select at least one case to invoice');
    const ledgerIds = [];
    candidates.forEach(c => { if (selectedCaseIds.has(c.id)) ledgerIds.push(...c.ledger_ids); });
    try {
      setLoading(true);
      const res = await previewInvoice(ledgerIds, filters.lenderName, filters.month);
      if (res.success) { setPreviewData(res.data); setStep(2); }
    } catch (e) {
      toast.error('Failed to generate invoice preview');
    } finally { setLoading(false); }
  };

  const handleMarkInvoiced = async () => {
    const ledgerIds = [];
    candidates.forEach(c => { if (selectedCaseIds.has(c.id)) ledgerIds.push(...c.ledger_ids); });
    try {
      setLoading(true);
      for (const ledgerId of ledgerIds) {
        await updateLedgerStatus(ledgerId, 'INVOICED', `Invoice ${previewData.invoice_number}`);
      }
      toast.success(`Invoice ${previewData.invoice_number} generated`);
      onSuccess();
    } catch (e) {
      toast.error('Error marking as invoiced');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: step === 1 ? 700 : 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{step === 1 ? 'Generate Invoice' : 'Preview Tax Invoice'}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {step === 1 ? 'Select pending cases to include in this invoice' : 'Please review the invoice before finalizing'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {step === 1 ? (
          <>
            <div style={{ padding: 24, flex: 1, overflowY: 'auto', background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Lender</label>
                  <select className="form-control" value={filters.lenderName} onChange={(e) => setFilters({ ...filters, lenderName: e.target.value })}>
                    <option value="">-- Select Lender --</option>
                    {availableLenders.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Month</label>
                  <select className="form-control" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })}>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Product</label>
                  <select className="form-control" value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })}>
                    <option value="All Products">All Products</option>
                    <option value="LAP">LAP</option>
                    <option value="HL">Home Loan</option>
                  </select>
                </div>
              </div>

              {candidateLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><LoadingSpinner size={24} /></div>
              ) : !filters.lenderName ? (
                <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Select a lender to view pending cases</div>
              ) : candidates.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No pending commission records found for this selection.</div>
              ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th><input type="checkbox" checked={selectedCaseIds.size === candidates.length && candidates.length > 0} onChange={handleSelectAll} /></th>
                          <th>Case ID</th>
                          <th>Customer</th>
                          <th style={{ textAlign: 'right' }}>Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map(c => (
                          <tr key={c.id}>
                            <td data-label="Select"><input type="checkbox" checked={selectedCaseIds.has(c.id)} onChange={() => handleSelectCase(c.id)} /></td>
                            <td data-label="Case ID" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.caseId}</td>
                            <td data-label="Customer">{c.customer}</td>
                            <td data-label="Commission" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(c.payout)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Selected: <strong>{selectedCaseIds.size}</strong> cases</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handlePreview} disabled={selectedCaseIds.size === 0 || loading}>
                  {loading ? <LoadingSpinner size={16} color="currentColor" /> : 'Preview Invoice'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: 24, flex: 1, overflowY: 'auto', overflowX: 'auto', background: 'var(--bg-elevated)' }}>
              <div style={{ background: 'var(--bg-surface)', padding: 32, borderRadius: 0, maxWidth: 760, minWidth: 480, margin: '0 auto', color: '#111827' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111827', paddingBottom: 20, marginBottom: 20 }}>
                  <div>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: 22 }}>TAX INVOICE</h1>
                    <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.6 }}>
                      <div><strong>Invoice No:</strong> {previewData?.invoice_number}</div>
                      <div><strong>Date:</strong> {previewData?.invoice_date}</div>
                      <div><strong>Period:</strong> {previewData?.month}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{previewData?.tenant?.name}</div>
                    <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.6 }}>
                      <div>State: {previewData?.tenant?.state}</div>
                      <div>PAN: {previewData?.tenant?.pan}</div>
                      <div>GSTIN: {previewData?.tenant?.gst}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#6B7280', textTransform: 'uppercase' }}>Billed To:</h3>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{previewData?.lender_name}</div>
                  <div style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>Commission & incentives for {previewData?.month}</div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                      <th style={{ padding: 10, textAlign: 'left' }}>Case ID</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Customer</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Product</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData?.cases?.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td style={{ padding: 10 }}>{c.caseId}</td>
                        <td style={{ padding: 10, color: '#4B5563' }}>{c.customer}</td>
                        <td style={{ padding: 10, color: '#4B5563' }}>{c.product}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <table style={{ width: 280, fontSize: 14 }}>
                    <tbody>
                      <tr><td style={{ padding: 6, color: '#4B5563' }}>Subtotal</td><td style={{ padding: 6, textAlign: 'right' }}>{formatCurrency(previewData?.subtotal)}</td></tr>
                      <tr><td style={{ padding: 6, color: '#4B5563', borderBottom: '1px solid #E5E7EB' }}>GST (18%)</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #E5E7EB' }}>{formatCurrency(previewData?.gst)}</td></tr>
                      <tr><td style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15 }}>Total Amount</td><td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{formatCurrency(previewData?.total)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back to Selection</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
                <button className="btn btn-primary" onClick={handleMarkInvoiced} disabled={loading}>
                  {loading ? <LoadingSpinner size={16} color="currentColor" /> : 'Mark as Invoiced'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Lender cases table + card ────────────────────────────────────────────────
function LenderCommissionCasesTable({ cases, onUpdateClick }) {
  if (!cases || cases.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No commission records found for this period.</div>;
  }
  return (
    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Case ID</th><th>Customer</th><th>Product</th>
            <th style={{ textAlign: 'right' }}>Disb. Amt</th>
            <th style={{ textAlign: 'right' }}>Gross Comm</th>
            <th style={{ textAlign: 'center' }}>Subvention</th>
            <th style={{ textAlign: 'right' }}>Net Payable</th>
            <th style={{ textAlign: 'center' }}>Status</th>
            <th style={{ textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, idx) => (
            <tr key={c.id || idx}>
              <td data-label="Case ID" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.caseId}</td>
              <td data-label="Customer">{c.customer} {c.pddPending && <span style={{ color: 'var(--warning)', fontSize: 11, marginLeft: 4 }}>⚠ PDD</span>}</td>
              <td data-label="Product" style={{ color: 'var(--text-secondary)' }}>{c.product}</td>
              <td data-label="Disb. Amt" style={{ textAlign: 'right' }}>{formatCurrency(c.disbAmt)}</td>
              <td data-label="Gross Comm" style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(c.payout)}</td>
              <td data-label="Subvention" style={{ textAlign: 'center', color: 'var(--error)' }}>{c.subvention ? formatCurrency(c.subvention) : '—'}</td>
              <td data-label="Net Payable" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(c.netPayable)}</td>
              <td data-label="Status" style={{ textAlign: 'center' }}><StatusBadge status={c.status} /></td>
              <td data-label="Action" style={{ textAlign: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onUpdateClick(c); }}>Update</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LenderCommissionCard({ lender, onUpdateClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="card lender-card" style={{ overflow: 'hidden', borderLeft: '4px solid var(--info)' }}>
      <div className="group-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg-surface)' }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)' }}>
            <Landmark size={16} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{lender.lender_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {lender.metrics.cases} {lender.metrics.cases === 1 ? 'case' : 'cases'} · Volume: {formatCurrency(lender.metrics.volume)} · Gross Comm: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(lender.metrics.gross_commission)}</span> · Pending: <span style={{ color: 'var(--error)', fontWeight: 600 }}>{formatCurrency(lender.metrics.pending_amount)}</span>
              {lender.hasPddPending && <span style={{ color: 'var(--warning)', fontWeight: 600, marginLeft: 8 }}>⚠ PDD Pending</span>}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Details
        </button>
      </div>
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <LenderCommissionCasesTable cases={lender.cases} onUpdateClick={onUpdateClick} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function LenderCommissionPage() {
  const [filters, setFilters] = useState({ month: '', lenderName: 'All Lenders', product: 'All Products', search: '' });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ summaryData: [], lendersData: [], availableMonths: [], availableLenders: [], hasAnyRecords: false });
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false);
  const [statusModalCase, setStatusModalCase] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const res = await getLenderCommissions(filters);
      if (res.success) {
        setData(res.data);
        if (!filters.month && res.data.availableMonths.length > 0) {
          setFilters(prev => ({ ...prev, month: res.data.availableMonths[0] }));
        }
      }
    } catch (error) {
      toast.error('Failed to load lender commissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCommissions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters.month, filters.lenderName, filters.product]);
  useEffect(() => {
    const timer = setTimeout(() => fetchCommissions(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await syncMissingLenderCommissions();
      toast.success(res.message || 'Synced successfully');
      fetchCommissions();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to sync missing commissions');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="lc-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .lc-page .card, .lc-page .btn, .lc-page .badge, .lc-page .form-control,
        .lc-page .modal-box, .lc-page .table-wrapper, .lc-page table { border-radius: 0 !important; }
        /* Match CustomersListPage's table density for cross-page consistency */
        .lc-page th { padding: 10px 8px !important; font-size: 10px !important; font-weight: 800 !important; }
        .lc-page td { padding: 12px 8px !important; font-size: 12px !important; }
        /* Only the data-list tables (wrapped in .table-wrapper) stack on mobile —
           the printable tax-invoice preview keeps its real table layout since it's
           a document facsimile, not a browsing list. */
        @media (max-width: 768px) {
          .lc-page > div { padding: 80px 24px 24px !important; }
          /* 2-per-row grid instead of each filter field stacking full-width —
             cuts the filter panel's height roughly in half on mobile. */
          .lc-page .filter-bar { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px 10px !important; padding: 10px 12px !important; align-items: end; }
          .lc-page .filter-bar > div { min-width: 0 !important; }
          .lc-page .filter-bar .search-field { grid-column: 1 / -1; }
          .lc-page .filter-bar .form-label { margin-bottom: 3px !important; }
          /* Each lender/summary group is ONE real card — header and its case
             rows together, with a visible border + strong shadow so it
             clearly lifts off the page and reads as a distinct section. Rows
             inside stay flat with a thin divider, like a normal table —
             giving every row its own separate elevation made the whole list
             busy without making section boundaries any clearer, and stacked
             extra margins around it just added dead space. One clean bordered
             box per group is simpler and reads better. Keeps the info-colored
             left accent on lender-card. */
          .lc-page .lender-card, .lc-page .summary-card { background: var(--bg-surface) !important; border: 1px solid var(--border) !important; border-left: 4px solid var(--info) !important; box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08) !important; }
          .lc-page .summary-card { border-left: 1px solid var(--border) !important; }
          .lc-page .list-wrap { background: transparent !important; border: none !important; box-shadow: none !important; }
          .lc-page .table-wrapper table, .lc-page .table-wrapper thead, .lc-page .table-wrapper tbody,
          .lc-page .table-wrapper tr, .lc-page .table-wrapper td { display: block; width: 100%; }
          .lc-page .table-wrapper thead { display: none; }
          .lc-page .table-wrapper table { background: transparent !important; }
          .lc-page .table-wrapper tbody { display: flex !important; flex-direction: column; gap: 0; }
          .lc-page .table-wrapper tbody tr { border: none !important; background: transparent !important; box-shadow: none !important; padding: 4px 14px; }
          .lc-page .table-wrapper tbody tr + tr { border-top: 1px solid var(--border) !important; }
          .lc-page .table-wrapper tbody td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0 !important; border-bottom: 1px solid var(--border); text-align: right; white-space: normal; }
          .lc-page .table-wrapper tbody td:last-child { border-bottom: none; }
          .lc-page .table-wrapper tbody td::before { content: attr(data-label); font-weight: 700; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; flex-shrink: 0; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <PageHeader title="Lender Commission" subtitle="Track and invoice expected commissions from lending partners" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 24 }}>
        <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>{syncing ? 'Syncing...' : '↻ Sync Past'}</button>
        <button className="btn btn-primary" onClick={() => setShowGenerateInvoice(true)}><FileText size={14} /> Generate Invoice</button>
      </div>

      {loading && data.lendersData.length === 0 ? (
        <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><LoadingSpinner size={32} /></div>
      ) : (
        <>
          <div className="card summary-card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            {/* Compact filter toolbar — merged into the same card as the summary table below */}
            <div className="filter-bar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Month</label>
                <select className="form-control" style={{ padding: '5px 10px', fontSize: 12 }} value={filters.month || 'all'} onChange={(e) => setFilters({ ...filters, month: e.target.value === 'all' ? 'all' : e.target.value })} disabled={data.availableMonths.length === 0}>
                  {data.availableMonths.length === 0 && <option value="">No data available</option>}
                  {data.availableMonths.length > 0 && <option value="all">All Months</option>}
                  {data.availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Lender</label>
                <select className="form-control" style={{ padding: '5px 10px', fontSize: 12 }} value={filters.lenderName || 'All Lenders'} onChange={(e) => setFilters({ ...filters, lenderName: e.target.value })}>
                  <option value="All Lenders">All Lenders</option>
                  {data.availableLenders.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Product</label>
                <select className="form-control" style={{ padding: '5px 10px', fontSize: 12 }} value={filters.product || 'All Products'} onChange={(e) => setFilters({ ...filters, product: e.target.value })}>
                  <option value="All Products">All Products</option>
                  <option value="LAP">LAP</option><option value="HL">Home Loan</option><option value="TL">Term Loan</option><option value="BL">Business Loan</option>
                </select>
              </div>
              <div className="search-field" style={{ flex: 2, minWidth: 170 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>Search</label>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input type="text" placeholder="Customer name, case ID..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="form-control" style={{ padding: '5px 10px 5px 28px', fontSize: 12 }} />
                </div>
              </div>
            </div>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th style={{ textAlign: 'center' }}>Cases Disbursed</th>
                    <th style={{ textAlign: 'right' }}>Disbursement Volume</th>
                    <th style={{ textAlign: 'right' }}>Payout Eligible</th>
                    <th style={{ textAlign: 'right' }}>Paid Dues</th>
                    <th style={{ textAlign: 'right', color: 'var(--error)' }}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summaryData.map((row, idx) => (
                    <tr key={idx}>
                      <td data-label="Period" style={{ fontWeight: 600 }}>{row.period}</td>
                      <td data-label="Cases Disbursed" style={{ textAlign: 'center' }}>{row.cases}</td>
                      <td data-label="Disbursement Volume" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(row.volume)}</td>
                      <td data-label="Payout Eligible" style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.eligible)}</td>
                      <td data-label="Paid Dues" style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.paid)}</td>
                      <td data-label="Pending" style={{ textAlign: 'right', color: 'var(--error)', fontWeight: 700 }}>{formatCurrency(row.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card list-wrap" style={{ overflow: 'hidden' }}>
            {data.lendersData.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="No commission records found"
                description={!data.hasAnyRecords ? 'Create a disbursement first to generate commission.' : 'Records exist but current filters exclude them.'}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
                {data.lendersData.map(lender => (
                  <LenderCommissionCard key={lender.lender_name} lender={lender} onUpdateClick={(caseRow) => setStatusModalCase(caseRow)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showGenerateInvoice && (
        <GenerateInvoiceModal
          onClose={() => setShowGenerateInvoice(false)}
          availableMonths={data.availableMonths}
          availableLenders={data.availableLenders}
          onSuccess={() => { setShowGenerateInvoice(false); fetchCommissions(); }}
        />
      )}

      {statusModalCase && (
        <UpdateInvoiceStatusModal
          caseData={statusModalCase}
          onClose={() => setStatusModalCase(null)}
          onSuccess={() => { setStatusModalCase(null); fetchCommissions(); }}
        />
      )}
      </div>
    </div>
  );
}
