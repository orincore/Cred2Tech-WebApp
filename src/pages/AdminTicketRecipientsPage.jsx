import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Trash2, Plus, Mail } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { ticketService } from '../api/ticketService';

const TYPES = ['TO', 'CC'];

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const RecipientRow = ({ recipient, onUpdated, onDeleted }) => {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(recipient.email);
  const [label, setLabel] = useState(recipient.label || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await ticketService.updateRecipient(recipient.id, { email, label });
      onUpdated(updated);
      setEditing(false);
      toast.success('Recipient updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update recipient');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${recipient.email} from the ${recipient.type} list?`)) return;
    setDeleting(true);
    try {
      await ticketService.removeRecipient(recipient.id);
      onDeleted(recipient.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove recipient');
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--outline)' }}>
      {editing ? (
        <>
          <input className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: '2 1 160px', minWidth: 0 }} />
          <input className="form-control" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" style={{ flex: '1 1 100px', minWidth: 0 }} />
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
            <button className="btn btn-primary btn-sm" style={{ borderRadius: 0 }} onClick={save} disabled={saving}>{saving ? <LoadingSpinner size={13} color="currentColor" /> : 'Save'}</button>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipient.email}</div>
            {recipient.label && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{recipient.label}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => setEditing(true)}>Edit</button>
            <button className="btn btn-ghost btn-icon" style={{ borderRadius: 0, color: 'var(--error)' }} onClick={remove} disabled={deleting} title="Remove">
              {deleting ? <LoadingSpinner size={14} color="var(--error)" /> : <Trash2 size={15} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const AddRecipientForm = ({ type, onAdded }) => {
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const created = await ticketService.addRecipient({ email: email.trim(), type, label: label.trim() || undefined });
      onAdded(created);
      setEmail('');
      setLabel('');
      toast.success('Recipient added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add recipient');
    } finally {
      setAdding(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <input type="email" className="form-control" placeholder="email@cred2tech.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ flex: '2 1 160px', minWidth: 0 }} />
      <input type="text" className="form-control" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: '1 1 100px', minWidth: 0 }} />
      <button type="submit" className="btn btn-primary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} disabled={adding}>
        {adding ? <LoadingSpinner size={13} color="currentColor" /> : <><Plus size={13} /> Add</>}
      </button>
    </form>
  );
};

const AdminTicketRecipientsPage = () => {
  const { isMobile } = useResponsive();
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketService.listRecipients()
      .then(setRecipients)
      .catch(() => toast.error('Failed to load notification recipients'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdated = (updated) => setRecipients((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  const handleDeleted = (id) => setRecipients((prev) => prev.filter((r) => r.id !== id));
  const handleAdded = (created) => setRecipients((prev) => [...prev, created]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Ticket Notification Recipients"
          subtitle="Who gets emailed when a new feedback/ticket is submitted."
          breadcrumbs={[{ label: 'Feedback & Tickets', path: '/admin/tickets' }, { label: 'Notification Recipients' }]}
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {loading ? (
          <div className="card" style={{ padding: 0, borderRadius: 0 }}>
            <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {TYPES.map((type) => {
              const list = recipients.filter((r) => r.type === type);
              return (
                <div key={type} className="card card-padded" style={{ borderRadius: 0 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    {type === 'TO' ? 'To' : 'Cc'}
                  </h3>
                  {list.length === 0 ? (
                    <EmptyState icon={Mail} title={`No ${type} recipients`} description="Add at least one address below." />
                  ) : (
                    list.map((r) => <RecipientRow key={r.id} recipient={r} onUpdated={handleUpdated} onDeleted={handleDeleted} />)
                  )}
                  <AddRecipientForm type={type} onAdded={handleAdded} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTicketRecipientsPage;
