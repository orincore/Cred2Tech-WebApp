import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Trash2, ShieldAlert } from 'lucide-react';
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

  const handleSearch = (e) => {
    e.preventDefault();
    const id = parseInt(caseIdInput.trim(), 10);
    if (!Number.isFinite(id)) {
      toast.error('Enter a valid case ID');
      return;
    }
    loadStatus(id);
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Data Purge"
          subtitle="Look up a case's retention schedule and raise a manual early-deletion request (CT-004-DPP)."
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <SectionCard title="Look up a case">
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: 20 }}>
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
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={16} /> Look up
              </button>
            </form>
          </SectionCard>
        </div>

        {loading && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
            </SectionCard>
          </div>
        )}

        {!loading && !status && (
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

        {!loading && status && !status.case && (
          <div style={{ marginBottom: 16 }}>
            <SectionCard>
              <EmptyState icon={ShieldAlert} title="Case not found" description={`No case exists with ID ${status.caseId}.`} />
            </SectionCard>
          </div>
        )}

        {!loading && status && status.case && (
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
    </div>
  );
};

export default AdminDataPurgePage;
