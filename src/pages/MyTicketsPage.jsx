import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MessageSquare, Paperclip } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { ticketService } from '../api/ticketService';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const MyTicketsPage = () => {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketService.listMine()
      .then((data) => setTickets(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Failed to load your feedback/tickets'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: 'subject', label: 'Subject',
      render: (t) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{t.subject}</div>
          <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{t.ticket_number} · {formatDateTime(t.created_at)}</div>
        </div>
      ),
    },
    { key: 'type', label: 'Type', align: 'center', render: (t) => <Badge type="ticketType" value={t.type} /> },
    { key: 'status', label: 'Status', align: 'center', render: (t) => <Badge type="ticketStatus" value={t.status} /> },
    {
      key: 'attachments', label: 'Attachments', align: 'center',
      render: (t) => t._count?.attachments > 0 ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--on-muted)' }}>
          <Paperclip size={12} /> {t._count.attachments}
        </span>
      ) : null,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader title="My Feedback &amp; Tickets" subtitle="Everything you've submitted, and its current status." compact={isMobile} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {loading ? (
          <div className="card" style={{ padding: 0, borderRadius: 0 }}>
            <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="card" style={{ padding: 0, borderRadius: 0 }}>
            <EmptyState icon={MessageSquare} title="Nothing submitted yet" description="Use the Feedback button to share feedback or report an issue." />
          </div>
        ) : isMobile ? (
          // Card list instead of a table — a table forced into a small
          // viewport either truncates every column or forces horizontal
          // scroll, so mobile gets one field-per-line card per ticket
          // instead (same pattern as AdminMsmeCasesPage/TenantsListPage).
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/tickets/${t.id}`)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 12, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{t.ticket_number} · {formatDateTime(t.created_at)}</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <Badge type="ticketStatus" value={t.status} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)' }}>
                  <Badge type="ticketType" value={t.type} />
                  {t._count?.attachments > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--on-muted)' }}>
                      <Paperclip size={12} /> {t._count.attachments}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, borderRadius: 0 }}>
            <DataTable columns={columns} data={tickets} onRowClick={(t) => navigate(`/tickets/${t.id}`)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTicketsPage;
