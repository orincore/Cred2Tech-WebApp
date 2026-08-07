import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Check, Lock, Send } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AttachmentGallery from '../components/ticket/AttachmentGallery';
import { formatDateTime, toTitleCase } from '../utils/helpers';
import { ticketService } from '../api/ticketService';

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const TIMELINE_LABEL = {
  CREATED: 'Submitted',
  STATUS_CHANGED: 'Status changed',
  INTERNAL_NOTE: 'Internal note',
  REPLIED_TO_SUBMITTER: 'Replied to submitter',
  SUBMITTER_REPLIED: 'Reply from submitter',
  MARKED_READ: 'Marked as read',
};

const sharpCard = { borderRadius: 0 };

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const AdminTicketDetailPage = () => {
  const { isMobile } = useResponsive();
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusDraft, setStatusDraft] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const load = useCallback(() => {
    return ticketService.getById(id)
      .then((t) => { setTicket(t); setStatusDraft(t.status); })
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load ticket');
        navigate('/admin/tickets');
      });
  }, [id, navigate]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  const handleStatusChange = async () => {
    if (statusDraft === ticket.status && !statusNote.trim()) return;
    setSavingStatus(true);
    try {
      await ticketService.changeStatus(ticket.id, statusDraft, statusNote.trim() || undefined);
      setStatusNote('');
      toast.success('Status updated — submitter has been notified.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      await ticketService.addNote(ticket.id, noteText.trim());
      setNoteText('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add note');
    } finally {
      setSendingNote(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await ticketService.reply(ticket.id, replyText.trim());
      setReplyText('');
      toast.success('Reply sent to the submitter.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleMarkAsRead = async () => {
    setMarkingRead(true);
    try {
      await ticketService.markAsRead(ticket.id);
      await load();
    } catch {
      toast.error('Failed to mark as read');
    } finally {
      setMarkingRead(false);
    }
  };

  if (loading) return <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>;
  if (!ticket) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title={ticket.subject}
          subtitle={`${ticket.ticket_number} · ${ticket.created_by?.name || 'Unknown'} (${toTitleCase(ticket.created_by_role)}) · ${formatDateTime(ticket.created_at)}`}
          breadcrumbs={[{ label: 'Feedback & Tickets', path: '/admin/tickets' }, { label: ticket.ticket_number }]}
          compact={isMobile}
          actions={!ticket.read_at ? (
            <button className="btn btn-secondary" style={sharpCard} onClick={handleMarkAsRead} disabled={markingRead}>
              {markingRead ? <LoadingSpinner size={14} color="currentColor" /> : <Check size={14} />} Mark as read
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Read {formatDateTime(ticket.read_at)}{ticket.read_by ? ` by ${ticket.read_by.name}` : ''}</span>
          )}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div className="card card-padded" style={sharpCard}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Description</h3>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.description}</p>
            </div>

            <div className="card card-padded" style={sharpCard}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>History &amp; Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {ticket.timeline.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 0, marginTop: 6, flexShrink: 0,
                      background: entry.action === 'INTERNAL_NOTE' ? 'var(--warning)' : entry.action === 'SUBMITTER_REPLIED' ? 'var(--info)' : 'var(--primary)',
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {TIMELINE_LABEL[entry.action] || entry.action}
                        {entry.from_status && entry.to_status && ` (${entry.from_status.replace('_', ' ')} → ${entry.to_status.replace('_', ' ')})`}
                        {entry.action === 'INTERNAL_NOTE' && <Lock size={11} color="var(--text-tertiary)" title="Internal only — never shown to the submitter" />}
                      </div>
                      {entry.note && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'pre-wrap' }}>{entry.note}</p>}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                        {formatDateTime(entry.created_at)}{entry.performed_by ? ` · ${entry.performed_by.name}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, paddingTop: 16, borderTop: '1px solid var(--outline)' }}>
                <div>
                  <label className="form-label">Internal note <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(admin-only, never emailed)</span></label>
                  <textarea className="form-control" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                  <button className="btn btn-secondary btn-sm" style={{ ...sharpCard, marginTop: 8 }} onClick={handleAddNote} disabled={sendingNote || !noteText.trim()}>
                    {sendingNote ? <LoadingSpinner size={13} color="currentColor" /> : 'Add note'}
                  </button>
                </div>
                <div>
                  <label className="form-label">Reply to submitter <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(emailed &amp; visible to them)</span></label>
                  <textarea className="form-control" rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                  <button className="btn btn-primary btn-sm" style={{ ...sharpCard, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleReply} disabled={sendingReply || !replyText.trim()}>
                    {sendingReply ? <LoadingSpinner size={13} color="currentColor" /> : <><Send size={12} /> Send reply</>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-padded" style={sharpCard}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Type</span>
                  <Badge type="ticketType" value={ticket.type} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Reference No.</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{ticket.ticket_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Submitted by</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
                    {ticket.created_by?.name || 'Unknown'}<br />
                    <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>{toTitleCase(ticket.created_by_role)}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Contact</span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right', wordBreak: 'break-word' }}>
                    {ticket.created_by?.email || ticket.created_by?.mobile || '—'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--outline)' }}>
                <label className="form-label">Status</label>
                <select className="form-control" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{toTitleCase(s.replace('_', ' '))}</option>)}
                </select>
                {statusDraft !== ticket.status && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Optional note for the submitter…"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
                <button
                  className="btn btn-primary btn-sm"
                  style={{ ...sharpCard, marginTop: 10, width: '100%', justifyContent: 'center' }}
                  onClick={handleStatusChange}
                  disabled={savingStatus || statusDraft === ticket.status}
                >
                  {savingStatus ? <LoadingSpinner size={14} color="currentColor" /> : 'Update status'}
                </button>
              </div>
            </div>

            {ticket.attachments?.length > 0 && (
              <div className="card card-padded" style={sharpCard}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Attachments</h3>
                <AttachmentGallery ticketId={ticket.id} attachments={ticket.attachments} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTicketDetailPage;
