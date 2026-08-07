import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Send } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AttachmentGallery from '../components/ticket/AttachmentGallery';
import { formatDateTime } from '../utils/helpers';
import { ticketService } from '../api/ticketService';

const TIMELINE_LABEL = {
  CREATED: 'Submitted',
  STATUS_CHANGED: 'Status updated',
  REPLIED_TO_SUBMITTER: 'Reply from Cred2Tech',
  SUBMITTER_REPLIED: 'Your reply',
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

const MyTicketDetailPage = () => {
  const { isMobile } = useResponsive();
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    return ticketService.getById(id)
      .then(setTicket)
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load ticket');
        navigate('/tickets');
      });
  }, [id, navigate]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await ticketService.addMessage(ticket.id, replyText.trim());
      setReplyText('');
      toast.success('Reply sent.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>;
  if (!ticket) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title={ticket.subject}
          subtitle={`${ticket.ticket_number} · Submitted ${formatDateTime(ticket.created_at)}`}
          breadcrumbs={[{ label: 'My Feedback & Tickets', path: '/tickets' }, { label: ticket.ticket_number }]}
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 300px', gap: 16, alignItems: 'start' }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div className="card card-padded" style={sharpCard}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Description</h3>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.description}</p>
            </div>

            <div className="card card-padded" style={sharpCard}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ticket.timeline.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 0, background: entry.action === 'SUBMITTER_REPLIED' ? 'var(--info)' : 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {TIMELINE_LABEL[entry.action] || entry.action}
                        {entry.to_status && ` → ${entry.to_status.replace('_', ' ')}`}
                      </div>
                      {entry.note && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'pre-wrap' }}>{entry.note}</p>}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{formatDateTime(entry.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--outline)' }}>
                <label className="form-label">
                  {ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'Still not sorted? Reply to reopen this.' : 'Add a reply'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your message…"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={sharpCard}
                  onClick={handleReply}
                  disabled={sending || !replyText.trim()}
                >
                  {sending ? <LoadingSpinner size={13} color="currentColor" /> : <><Send size={12} /> Send</>}
                </button>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Status</span>
                  <Badge type="ticketStatus" value={ticket.status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Reference No.</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{ticket.ticket_number}</span>
                </div>
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

export default MyTicketDetailPage;
