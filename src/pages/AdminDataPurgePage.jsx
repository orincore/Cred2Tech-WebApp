import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Trash2, ShieldAlert, ExternalLink } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmModal from '../components/ui/ConfirmModal';
import DataTable from '../components/DataTable';
import { formatDateTime, formatCompactINR, CASE_STAGE_LABELS, formatStatusLabel } from '../utils/helpers';
import { adminPurgeService } from '../api/adminPurgeService';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const SCHEDULE_STATUS_STYLE = {
  PENDING: { color: 'var(--info)', bg: 'var(--info-bg)' },
  QUEUED: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  PURGED: { color: 'var(--success)', bg: 'var(--success-bg)' },
  FAILED: { color: 'var(--error)', bg: 'var(--error-bg)' },
};

const AUDIT_STATUS_STYLE = {
  SUCCESS: { color: 'var(--success)', bg: 'var(--success-bg)' },
  FAILED: { color: 'var(--error)', bg: 'var(--error-bg)' },
};

const TRIGGER_STYLE = {
  SCHEDULED: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
  MANUAL: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
};

const SOURCE_TABLE_LABEL = {
  bureau_verifications: 'Bureau Verification',
  gstr_analytics_requests: 'GST Analytics',
  itr_analytics_requests: 'ITR Analytics',
  bank_statement_analysis_requests: 'Bank Statement Analytics',
};

const Pill = ({ label, style }) => (
  <span style={{
    display: 'inline-block', background: style?.bg || 'var(--bg-elevated)', color: style?.color || 'var(--text-tertiary)',
    padding: '3px 10px', borderRadius: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.03em',
  }}>
    {label}
  </span>
);

const STAGE_STYLE = {
  DRAFT: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
  LEAD_CREATED: { color: 'var(--info)', bg: 'var(--info-bg)' },
  DATA_COLLECTION: { color: 'var(--info)', bg: 'var(--info-bg)' },
  INCOME_REVIEWED: { color: 'var(--info)', bg: 'var(--info-bg)' },
  ESR_GENERATED: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  LEAD_SENT_TO_LENDER: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  IN_REVIEW: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  APPROVED: { color: 'var(--success)', bg: 'var(--success-bg)' },
  DISBURSED: { color: 'var(--success)', bg: 'var(--success-bg)' },
  PARTLY_DISBURSED: { color: 'var(--success)', bg: 'var(--success-bg)' },
  CLOSED: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
  REJECTED: { color: 'var(--error)', bg: 'var(--error-bg)' },
};

const PURGE_STATUS_STYLE = {
  PURGED: { color: 'var(--success)', bg: 'var(--success-bg)' },
  ACTIVE: { color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
};

const InfoField = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
      {value}
    </div>
  </div>
);

const AdminDataPurgePage = () => {
  const { isMobile } = useResponsive();

  const [caseIdInput, setCaseIdInput] = useState('');
  const [caseId, setCaseId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const [hardDeleteReason, setHardDeleteReason] = useState('');
  const [hardDeleteConfirmOpen, setHardDeleteConfirmOpen] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);

  // PAN search — the alternative to Case ID: finds every case, across every
  // tenant (the same PAN can exist as separate Customer rows per tenant),
  // for a right-to-erasure / bulk-cleanup request that doesn't come in with
  // a specific case ID already in hand.
  const [searchMode, setSearchMode] = useState('case'); // 'case' | 'pan'
  const [panInput, setPanInput] = useState('');
  const [panLoading, setPanLoading] = useState(false);
  const [panResult, setPanResult] = useState(null); // { pan, customers: [{ ...customer, display_name, cases: [...] }] }

  const [panBulkReason, setPanBulkReason] = useState('');
  const [panPurgeAllConfirmOpen, setPanPurgeAllConfirmOpen] = useState(false);
  const [panPurgingAll, setPanPurgingAll] = useState(false);

  const [panHardDeleteReason, setPanHardDeleteReason] = useState('');
  const [panDeleteAllConfirmOpen, setPanDeleteAllConfirmOpen] = useState(false);
  const [panDeletingAll, setPanDeletingAll] = useState(false);

  const loadStatus = async (id) => {
    setLoading(true);
    try {
      const result = await adminPurgeService.getCaseStatus(id);
      setStatus(result);
      setCaseId(id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load case purge status');
      setStatus(null);
      setCaseId(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPan = async (pan) => {
    setPanLoading(true);
    try {
      const result = await adminPurgeService.getCasesByPan(pan);
      setPanResult(result);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to look up cases for this PAN');
      setPanResult(null);
    } finally {
      setPanLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchMode === 'pan') {
      const pan = panInput.trim().toUpperCase();
      if (!pan) {
        toast.error('Enter a PAN');
        return;
      }
      // Switching search modes clears whatever the OTHER mode had loaded —
      // otherwise a stale single-case Danger Zone from a previous Case ID
      // lookup could keep showing underneath a fresh PAN result.
      setStatus(null);
      setCaseId(null);
      loadPan(pan);
      return;
    }
    const id = parseInt(caseIdInput.trim(), 10);
    if (!Number.isFinite(id)) {
      toast.error('Enter a valid case ID');
      return;
    }
    setPanResult(null);
    loadStatus(id);
  };

  // Clicking "Manage" on a row in the PAN results reuses the exact same
  // single-case Case Details / Retention Schedule / Purge / Danger Zone
  // sections already built for Case ID search — no duplicate UI needed for
  // "purge this one case" / "delete this one case" from the PAN view.
  const handleManageCase = (id) => {
    setSearchMode('case');
    setCaseIdInput(String(id));
    loadStatus(id);
  };

  const panCases = panResult?.customers?.flatMap((c) => c.cases.map((cs) => ({ ...cs, customer: c }))) || [];
  const panNotPurgedCount = panCases.filter((c) => !c.data_purged_at).length;

  const handleConfirmPurgeAllForPan = async () => {
    setPanPurgingAll(true);
    try {
      const result = await adminPurgeService.purgeAllForPan(panResult.pan, panBulkReason.trim());
      toast.success(
        `Purged records across ${result.purgedCount} case(s); ${result.alreadyPurgedCount} already purged${result.failedCount > 0 ? `, ${result.failedCount} failed — check logs` : ''}.`,
        { duration: 8000 }
      );
      setPanPurgeAllConfirmOpen(false);
      setPanBulkReason('');
      await loadPan(panResult.pan);
      if (caseId) await loadStatus(caseId); // keep an open single-case view in sync too
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to purge cases for this PAN');
    } finally {
      setPanPurgingAll(false);
    }
  };

  const handleConfirmDeleteAllForPan = async () => {
    setPanDeletingAll(true);
    try {
      const result = await adminPurgeService.hardDeleteAllForPan(panResult.pan, panHardDeleteReason.trim());
      toast.success(
        `Permanently deleted ${result.deletedCount} case(s)${result.alreadyDeletedCount > 0 ? `, ${result.alreadyDeletedCount} were already gone` : ''}${result.failedCount > 0 ? `, ${result.failedCount} failed — check logs` : ''}.`,
        { duration: 8000 }
      );
      setPanDeleteAllConfirmOpen(false);
      setPanHardDeleteReason('');
      // Everything for this PAN is gone — nothing left to show.
      setPanResult(null);
      setPanInput('');
      setStatus(null);
      setCaseId(null);
      setCaseIdInput('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to permanently delete cases for this PAN');
    } finally {
      setPanDeletingAll(false);
    }
  };

  const pendingCount = status?.schedules?.filter((s) => s.status !== 'PURGED').length ?? 0;

  const handleConfirmPurge = async () => {
    setPurging(true);
    try {
      const result = await adminPurgeService.manualPurge(caseId, reason.trim());
      toast.success(`Purged ${result.purgedCount} record(s); ${result.alreadyPurgedCount} were already purged.`);
      setConfirmOpen(false);
      setReason('');
      await loadStatus(caseId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to purge case data');
    } finally {
      setPurging(false);
    }
  };

  const handleConfirmHardDelete = async () => {
    setHardDeleting(true);
    try {
      const result = await adminPurgeService.hardDeleteCase(caseId, hardDeleteReason.trim());
      toast.success(
        `Case #${result.deletedCaseId}${result.childCaseIds.length > 0 ? ` and ${result.childCaseIds.length} child case(s)` : ''} permanently deleted — ${result.documentsDeleted} document(s), ${result.filesDeleted} file(s) removed from storage${result.filesFailed > 0 ? ` (${result.filesFailed} file(s) failed to delete)` : ''}.`,
        { duration: 8000 }
      );
      setHardDeleteConfirmOpen(false);
      setHardDeleteReason('');
      // The case is gone — nothing left to look up.
      setStatus(null);
      setCaseId(null);
      setCaseIdInput('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to permanently delete case');
    } finally {
      setHardDeleting(false);
    }
  };

  const scheduleColumns = [
    { key: 'source_table', label: 'Record Type', render: (s) => SOURCE_TABLE_LABEL[s.source_table] || s.source_table },
    { key: 'record_id', label: 'Record ID', width: 90 },
    { key: 'status', label: 'Status', width: 100, render: (s) => <Pill label={s.status} style={SCHEDULE_STATUS_STYLE[s.status]} /> },
    { key: 'recorded_at', label: 'Recorded At', render: (s) => formatDateTime(s.recorded_at) },
    { key: 'expiry_date', label: 'Expires', render: (s) => formatDateTime(s.expiry_date) },
    { key: 'purged_at', label: 'Purged At', render: (s) => (s.purged_at ? formatDateTime(s.purged_at) : '—') },
  ];

  const auditColumns = [
    { key: 'purged_at', label: 'Time', render: (l) => formatDateTime(l.purged_at) },
    { key: 'table_name', label: 'Record Type', render: (l) => SOURCE_TABLE_LABEL[l.table_name] || l.table_name },
    { key: 'trigger_type', label: 'Trigger', width: 100, render: (l) => <Pill label={l.trigger_type} style={TRIGGER_STYLE[l.trigger_type]} /> },
    {
      key: 'purged_fields', label: 'Fields Purged', whiteSpace: 'normal',
      render: (l) => (Array.isArray(l.purged_fields) && l.purged_fields.length > 0 ? l.purged_fields.join(', ') : '—'),
    },
    { key: 'files_deleted', label: 'Files Deleted', width: 100, render: (l) => (l.files_deleted ? 'Yes' : 'No') },
    { key: 'status', label: 'Status', width: 100, render: (l) => <Pill label={l.status} style={AUDIT_STATUS_STYLE[l.status]} /> },
    { key: 'reason', label: 'Reason', whiteSpace: 'normal', render: (l) => l.reason || '—' },
  ];

  const panCaseColumns = [
    { key: 'id', label: 'Case ID', width: 80 },
    { key: 'tenant', label: 'Tenant', render: (c) => (c.customer?.tenant ? `${c.customer.tenant.name} (${c.customer.tenant.type})` : '—') },
    { key: 'customer', label: 'Customer', render: (c) => c.customer?.display_name || c.customer_name || '—' },
    { key: 'stage', label: 'Stage', width: 130, render: (c) => <Pill label={CASE_STAGE_LABELS[c.stage] || formatStatusLabel(c.stage)} style={STAGE_STYLE[c.stage]} /> },
    { key: 'category', label: 'Category', width: 100, render: (c) => formatStatusLabel(c.category) },
    { key: 'lead_date', label: 'Lead Date', render: (c) => (c.lead_date ? formatDateTime(c.lead_date) : '—') },
    {
      key: 'purge_status', label: 'Purge Status', width: 100,
      render: (c) => <Pill label={c.data_purged_at ? 'PURGED' : 'ACTIVE'} style={PURGE_STATUS_STYLE[c.data_purged_at ? 'PURGED' : 'ACTIVE']} />,
    },
    {
      key: 'actions', label: '', width: 110,
      render: (c) => (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => handleManageCase(c.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
        >
          <ExternalLink size={13} /> Manage
        </button>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Data Purge"
          subtitle="Look up a case by ID, or a PAN to see every case it touches across every tenant — raise a manual early-deletion request (CT-004-DPP)."
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <SectionCard title="Look up">
            <form onSubmit={handleSearch} style={{ padding: 20 }}>
              {/* The PAN-mode hint used to live inside the input's own
                  form-group (flex-direction: column), so it silently made
                  that one flex item taller than its siblings — which then
                  threw off the whole row's alignItems: 'flex-end' and made
                  the Look up button (and Search By toggle) sit at the wrong
                  height relative to the input. Hint now renders on its own
                  line below the row instead, so it can never affect row
                  alignment. */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Search By</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${searchMode === 'case' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSearchMode('case')}
                      style={{ borderRadius: 0 }}
                    >
                      Case ID
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${searchMode === 'pan' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSearchMode('pan')}
                      style={{ borderRadius: 0 }}
                    >
                      PAN
                    </button>
                  </div>
                </div>
                {searchMode === 'case' ? (
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                    <label className="form-label" htmlFor="caseId">Case ID</label>
                    <input
                      id="caseId"
                      className="form-control"
                      type="number"
                      value={caseIdInput}
                      onChange={(e) => setCaseIdInput(e.target.value)}
                      placeholder="e.g. 1042"
                    />
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                    <label className="form-label" htmlFor="pan">PAN</label>
                    <input
                      id="pan"
                      className="form-control"
                      type="text"
                      value={panInput}
                      onChange={(e) => setPanInput(e.target.value.toUpperCase())}
                      placeholder="e.g. AABCE1234F"
                      style={{ textTransform: 'uppercase' }}
                      maxLength={10}
                    />
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={searchMode === 'case' ? loading : panLoading}
                  style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Search size={16} /> Look up
                </button>
              </div>
              {searchMode === 'pan' && (
                <p className="form-hint" style={{ margin: '10px 0 0' }}>
                  Searches across every tenant — the same PAN can have separate customer records per tenant.
                </p>
              )}
            </form>
          </SectionCard>
        </div>

        {searchMode === 'case' && loading && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
            </SectionCard>
          </div>
        )}

        {searchMode === 'case' && !loading && !status && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <EmptyState
                icon={ShieldAlert}
                title="No case loaded"
                description="Enter a case ID above to view its data-retention schedule and purge history."
              />
            </SectionCard>
          </div>
        )}

        {searchMode === 'case' && !loading && status && !status.case && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <EmptyState icon={ShieldAlert} title="Case not found" description={`No case exists with ID ${status.caseId}.`} />
            </SectionCard>
          </div>
        )}

        {searchMode === 'pan' && panLoading && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
            </SectionCard>
          </div>
        )}

        {searchMode === 'pan' && !panLoading && !panResult && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <EmptyState
                icon={ShieldAlert}
                title="No PAN searched"
                description="Enter a PAN above to see every case it touches, across every tenant."
              />
            </SectionCard>
          </div>
        )}

        {searchMode === 'pan' && !panLoading && panResult && panCases.length === 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <EmptyState icon={ShieldAlert} title="No cases found" description={`No customer or case exists for PAN ${panResult.pan}.`} />
            </SectionCard>
          </div>
        )}

        {searchMode === 'pan' && !panLoading && panResult && panCases.length > 0 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <SectionCard title={`Cases for PAN ${panResult.pan} (${panCases.length})`}>
                <DataTable columns={panCaseColumns} data={panCases} rowKey="id" isMobile={isMobile} stickyHeader={false} />
              </SectionCard>
            </div>

            <div style={{ marginBottom: 16 }}>
              <SectionCard title="Bulk Purge — Every Case for this PAN">
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>
                    {panNotPurgedCount > 0
                      ? `${panNotPurgedCount} of ${panCases.length} case(s) for this PAN have not yet been purged. This purges every one of them, across every tenant, ahead of the normal 179-day retention window.`
                      : `All ${panCases.length} case(s) for this PAN have already been purged — submitting here will have no effect.`}
                  </p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="panBulkReason">
                      Reason<span className="required">*</span>
                    </label>
                    <textarea
                      id="panBulkReason"
                      className="form-control"
                      rows={3}
                      value={panBulkReason}
                      onChange={(e) => setPanBulkReason(e.target.value)}
                      placeholder="e.g. Customer submitted a right-to-erasure request covering every application"
                    />
                    <span className="form-hint">Required — recorded permanently in the purge audit trail for each case.</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={!panBulkReason.trim()}
                    onClick={() => setPanPurgeAllConfirmOpen(true)}
                    style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Trash2 size={16} /> Purge All ({panCases.length} case{panCases.length === 1 ? '' : 's'})
                  </button>
                </div>
              </SectionCard>
            </div>

            <div style={{ marginBottom: 16, border: '2px solid var(--error)' }}>
              <SectionCard title="Danger Zone — Delete Every Case for this PAN">
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>
                    Permanently and irreversibly deletes all <strong>{panCases.length}</strong> case(s) for PAN{' '}
                    <strong>{panResult.pan}</strong>, across every tenant — every applicant, document, income entry,
                    obligation, bureau/GST/ITR/bank-statement record, proposal, sanction, disbursement, PDD task, and
                    every other row tied to each one, plus the actual files in storage.
                  </p>
                  <div className="notice notice-error" style={{ marginBottom: 14 }}>
                    <ShieldAlert size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span>Cases that will be deleted: {panCases.map((c) => `#${c.id}`).join(', ')}.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="panHardDeleteReason">
                      Reason<span className="required">*</span>
                    </label>
                    <textarea
                      id="panHardDeleteReason"
                      className="form-control"
                      rows={3}
                      value={panHardDeleteReason}
                      onChange={(e) => setPanHardDeleteReason(e.target.value)}
                      placeholder="e.g. Customer requested full account and data deletion"
                    />
                    <span className="form-hint">Required — recorded permanently in a standalone audit log that survives each case.</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={!panHardDeleteReason.trim()}
                    onClick={() => setPanDeleteAllConfirmOpen(true)}
                    style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Trash2 size={16} /> Permanently Delete All ({panCases.length} case{panCases.length === 1 ? '' : 's'})
                  </button>
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {searchMode === 'case' && !loading && status && status.case && (
          <>
            <div style={{ marginBottom: 16 }}>
              <SectionCard title="Case Details">
                <div style={{ padding: 20, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
                  <InfoField label="Stage" value={<Pill label={CASE_STAGE_LABELS[status.case.stage] || formatStatusLabel(status.case.stage)} style={STAGE_STYLE[status.case.stage]} />} />
                  <InfoField label="Category" value={formatStatusLabel(status.case.category)} />
                  <InfoField label="Product Type" value={status.case.product_type || '—'} />
                  <InfoField label="Loan Amount" value={status.case.loan_amount != null ? formatCompactINR(status.case.loan_amount) : '—'} />
                  <InfoField label="Sanctioned Amount" value={status.case.sanctioned_amount != null ? formatCompactINR(status.case.sanctioned_amount) : '—'} />
                  <InfoField label="Disbursed Amount" value={status.case.total_disbursed_amount != null ? formatCompactINR(status.case.total_disbursed_amount) : '—'} />
                  <InfoField label="Lead Source" value={status.case.lead_source || '—'} />
                  <InfoField label="Customer" value={status.case.customer?.business_name || status.case.customer?.legal_business_name || status.case.customer_name || '—'} />
                  <InfoField label="Entity Type" value={status.case.entity_type || '—'} />
                  <InfoField label="Tenant (DSA)" value={status.case.tenant ? `${status.case.tenant.name} (${status.case.tenant.type})` : '—'} />
                  <InfoField label="DSA (Created By)" value={status.case.created_by?.name || '—'} />
                  <InfoField label="DSA (Assigned)" value={status.case.assigned_dsa_user?.name || '—'} />
                  <InfoField label="Lead Date" value={status.case.lead_date ? formatDateTime(status.case.lead_date) : '—'} />
                  <InfoField label="Case Created" value={formatDateTime(status.case.created_at)} />
                  <InfoField label="Last Updated" value={formatDateTime(status.case.updated_at)} />
                </div>
              </SectionCard>
            </div>

            <div style={{ marginBottom: 16 }}>
              <SectionCard title={`Retention Schedule — Case #${status.caseId}`}>
                {status.schedules.length === 0 ? (
                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                      No credit-info records are tracked for this case yet (nothing has gone through nightly reconciliation).
                    </p>
                  </div>
                ) : (
                  <DataTable columns={scheduleColumns} data={status.schedules} rowKey="id" isMobile={isMobile} stickyHeader={false} />
                )}
              </SectionCard>
            </div>

            <div style={{ marginBottom: 16 }}>
              <SectionCard title="Raise Manual Purge Request">
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>
                    {pendingCount > 0
                      ? `${pendingCount} record(s) for this case have not yet been purged and can be deleted immediately, ahead of the normal 179-day retention window.`
                      : 'Every tracked record for this case has already been purged — submitting a request here will have no effect.'}
                  </p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reason">
                      Reason<span className="required">*</span>
                    </label>
                    <textarea
                      id="reason"
                      className="form-control"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Customer submitted a right-to-erasure request on 2026-08-11"
                    />
                    <span className="form-hint">Required — recorded permanently in the purge audit trail.</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={!reason.trim()}
                    onClick={() => setConfirmOpen(true)}
                    style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Trash2 size={16} /> Purge Now
                  </button>
                </div>
              </SectionCard>
            </div>

            <div style={{ marginBottom: 16 }}>
              <SectionCard title="Purge Audit History">
                {status.auditLogs.length === 0 ? (
                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No purge has been recorded for this case yet.</p>
                  </div>
                ) : (
                  <DataTable columns={auditColumns} data={status.auditLogs} rowKey="id" isMobile={isMobile} stickyHeader={false} />
                )}
              </SectionCard>
            </div>

            <div style={{ marginBottom: 16, border: '2px solid var(--error)' }}>
              <SectionCard title="Danger Zone">
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>
                    Permanently and irreversibly deletes case <strong>#{status.caseId}</strong> — every applicant, document,
                    income entry, obligation, bureau/GST/ITR/bank-statement record, proposal, sanction, disbursement, PDD
                    task, and every other row tied to it, plus the actual files in storage. This is not the same as the
                    retention purge above (which only nulls sensitive fields) — the case itself, and everything about it,
                    ceases to exist.
                  </p>
                  {status.case.child_cases?.length > 0 && (
                    <div className="notice notice-error" style={{ marginBottom: 14 }}>
                      <ShieldAlert size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span>
                        This case has <strong>{status.case.child_cases.length} child case(s)</strong> (cloned for other
                        lenders) — they will be permanently deleted too: {status.case.child_cases.map((c) => `#${c.id}`).join(', ')}.
                      </span>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" htmlFor="hardDeleteReason">
                      Reason<span className="required">*</span>
                    </label>
                    <textarea
                      id="hardDeleteReason"
                      className="form-control"
                      rows={3}
                      value={hardDeleteReason}
                      onChange={(e) => setHardDeleteReason(e.target.value)}
                      placeholder="e.g. Duplicate test case created in error, never a real applicant"
                    />
                    <span className="form-hint">Required — recorded permanently in a standalone audit log that survives the case itself.</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={!hardDeleteReason.trim()}
                    onClick={() => setHardDeleteConfirmOpen(true)}
                    style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Trash2 size={16} /> Permanently Delete Case
                  </button>
                </div>
              </SectionCard>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => !purging && setConfirmOpen(false)}
        onConfirm={handleConfirmPurge}
        title="Purge case data now?"
        message={`This immediately and irreversibly purges all sensitive credit-information fields for the ${pendingCount} not-yet-purged record(s) on case #${caseId}, ahead of the normal retention schedule. This cannot be undone.`}
        notice={`Reason on record: "${reason.trim()}"`}
        confirmLabel="Purge Now"
        isLoading={purging}
        confirmText={caseId != null ? String(caseId) : undefined}
        danger
      />

      <ConfirmModal
        isOpen={hardDeleteConfirmOpen}
        onClose={() => !hardDeleting && setHardDeleteConfirmOpen(false)}
        onConfirm={handleConfirmHardDelete}
        title="Permanently delete this case?"
        message={`This permanently deletes case #${caseId}${status?.case?.child_cases?.length > 0 ? ` and its ${status.case.child_cases.length} child case(s)` : ''} — every related record and every file in storage. There is no undo, no soft-delete, and no way to recover this data afterward.`}
        notice={`Reason on record: "${hardDeleteReason.trim()}"`}
        confirmLabel="Delete Permanently"
        isLoading={hardDeleting}
        confirmText={caseId != null ? `DELETE ${caseId}` : undefined}
        danger
      />

      <ConfirmModal
        isOpen={panPurgeAllConfirmOpen}
        onClose={() => !panPurgingAll && setPanPurgeAllConfirmOpen(false)}
        onConfirm={handleConfirmPurgeAllForPan}
        title="Purge all cases for this PAN now?"
        message={`This immediately and irreversibly purges all sensitive credit-information fields for ${panNotPurgedCount} not-yet-purged case(s) out of ${panCases.length} total for PAN ${panResult?.pan}, across every tenant. This cannot be undone.`}
        notice={`Reason on record: "${panBulkReason.trim()}"`}
        confirmLabel="Purge All"
        isLoading={panPurgingAll}
        confirmText={panResult?.pan}
        danger
      />

      <ConfirmModal
        isOpen={panDeleteAllConfirmOpen}
        onClose={() => !panDeletingAll && setPanDeleteAllConfirmOpen(false)}
        onConfirm={handleConfirmDeleteAllForPan}
        title="Permanently delete all cases for this PAN?"
        message={`This permanently deletes all ${panCases.length} case(s) for PAN ${panResult?.pan}, across every tenant — every related record and every file in storage for each one. There is no undo, no soft-delete, and no way to recover this data afterward.`}
        notice={`Reason on record: "${panHardDeleteReason.trim()}"`}
        confirmLabel="Delete All Permanently"
        isLoading={panDeletingAll}
        confirmText={panResult?.pan ? `DELETE ${panResult.pan}` : undefined}
        danger
      />
    </div>
  );
};

export default AdminDataPurgePage;
