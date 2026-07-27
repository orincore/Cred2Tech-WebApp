import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Users, X } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import FormField from '../components/ui/FormField';
import DataTable from '../components/DataTable';
import { formatDate, toTitleCase } from '../utils/helpers';
import {
  getDirectMsmeCases,
  getAllocationTargets,
  allocateDirectMsmeCase,
} from '../api/adminMsmeService';

// ─── Allocate to DSA modal ──────────────────────────────────────────────────
function AllocateModal({ isOpen, onClose, caseRecord, targets, onAllocated }) {
  const [tenantId, setTenantId] = useState('');
  const [userId, setUserId] = useState('');
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTenantId('');
      setUserId('');
    }
  }, [isOpen]);

  if (!isOpen || !caseRecord) return null;

  const availableUsers = targets.find(t => String(t.id) === String(tenantId))?.users || [];

  const handleAllocate = async () => {
    if (!tenantId || !userId) {
      toast.error('Please select a DSA and a user');
      return;
    }
    setAllocating(true);
    try {
      await allocateDirectMsmeCase(caseRecord.id, { dsa_tenant_id: tenantId, dsa_user_id: userId });
      toast.success('Case successfully allocated to DSA');
      onAllocated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to allocate case');
    } finally {
      setAllocating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Allocate Case to DSA</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
          {toTitleCase(caseRecord.customer?.proprietor_name || caseRecord.customer?.business_name) || 'This MSME lead'} will move into the selected DSA's pipeline. The DSA will then prepare and send the loan proposal.
        </p>

        <FormField label="Select DSA Partner" name="dsa_tenant" required>
          <select
            id="dsa_tenant"
            className="form-control"
            value={tenantId}
            onChange={e => { setTenantId(e.target.value); setUserId(''); }}
          >
            <option value="">-- Select DSA --</option>
            {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>

        {tenantId && (
          <FormField label="Select DSA Agent" name="dsa_user" required>
            <select
              id="dsa_user"
              className="form-control"
              value={userId}
              onChange={e => setUserId(e.target.value)}
            >
              <option value="">-- Select User --</option>
              {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.name})</option>)}
            </select>
          </FormField>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={allocating}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleAllocate}
            disabled={allocating || !tenantId || !userId}
            style={{ minWidth: 100, justifyContent: 'center' }}
          >
            {allocating ? <LoadingSpinner size={16} color="currentColor" /> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

const AdminMsmeCasesPage = () => {
  const [cases, setCases] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  const fetchCases = async () => {
    try {
      const data = await getDirectMsmeCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load MSME cases');
    } finally {
      setLoading(false);
    }
  };

  const fetchTargets = async () => {
    try {
      const data = await getAllocationTargets();
      setTargets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch allocation targets', err);
    }
  };

  useEffect(() => { fetchCases(); fetchTargets(); }, []);

  const stats = useMemo(() => ({
    total: cases.length,
    unallocated: cases.filter(c => !c.assigned_dsa_tenant_id).length,
    allocated: cases.filter(c => c.assigned_dsa_tenant_id).length,
  }), [cases]);

  const openAllocateModal = (caseRecord) => {
    setSelectedCase(caseRecord);
    setShowModal(true);
  };

  const columns = [
    {
      key: 'business', label: 'Business',
      render: (c) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{toTitleCase(c.customer?.proprietor_name || c.customer?.business_name) || 'N/A'}</div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>PAN: {c.customer?.business_pan || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{formatDate(c.created_at)}</div>
        </div>
      )
    },
    {
      key: 'loan', label: 'Requested Loan',
      render: (c) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>
            {c.loan_amount ? `₹${Number(c.loan_amount).toLocaleString('en-IN')}` : 'Not Specified'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>{c.product_type || '—'}</div>
        </div>
      )
    },
    {
      key: 'stage', label: 'Status',
      render: (c) => <Badge type="level" value={c.stage} />
    },
    {
      key: 'payment', label: 'Payment',
      render: (c) => c.case_payment?.status === 'PAID' ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '3px 8px', border: '1px solid var(--success)' }}>
          Paid
        </span>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Pending</span>
      )
    },
    {
      key: 'allocation', label: 'Allocation',
      render: (c) => c.assigned_dsa_tenant_id ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{toTitleCase(c.assigned_dsa_user?.name)}</div>
          <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>Allocated {c.allocated_at ? formatDate(c.allocated_at) : ''}</div>
        </div>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '3px 8px', border: '1px solid var(--warning)' }}>
          Unallocated
        </span>
      )
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        c.stage === 'LEAD_CREATED' && !c.assigned_dsa_tenant_id ? (
          <button className="btn btn-secondary btn-sm" onClick={() => openAllocateModal(c)}>Allocate</button>
        ) : null
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Direct MSME Leads"
        subtitle="Manage and allocate self-onboarded MSME customers to DSA partners."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard title="Total Leads" value={stats.total} icon={Users} loading={loading} />
        <StatCard title="Unallocated" value={stats.unallocated} color="var(--warning)" icon={Users} loading={loading} />
        <StatCard title="Allocated" value={stats.allocated} color="var(--success)" icon={Users} loading={loading} />
      </div>

      <div className="card" style={{ padding: 0, borderRadius: 0 }}>
        {loading ? (
          <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
        ) : (
          <DataTable
            columns={columns}
            data={cases}
            emptyState={
              <EmptyState
                icon={Users}
                title="No Direct MSME cases"
                description="Self-onboarded MSME leads awaiting allocation will show up here."
              />
            }
          />
        )}
      </div>

      <AllocateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        caseRecord={selectedCase}
        targets={targets}
        onAllocated={fetchCases}
      />
    </div>
  );
};

export default AdminMsmeCasesPage;
