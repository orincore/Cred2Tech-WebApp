import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MessageSquare, Paperclip, Settings, Check, Search } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import DataTable from '../components/DataTable';
import { formatDateTime, toTitleCase } from '../utils/helpers';
import { ticketService } from '../api/ticketService';
import AdminCaseFeedbackTab from './AdminCaseFeedbackTab';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const TYPE_OPTIONS = ['FEEDBACK', 'ISSUE'];
const ROLE_OPTIONS = ['MSME_CUSTOMER', 'DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];
const PAGE_SIZE = 20;

// Compact, sharp-cornered filter controls — sit inline in the toolbar strip
// merged onto the table card, rather than react-hot-toast/.form-control's
// underline style (too sparse for a dense horizontal filter row).
const compactField = {
  border: '1px solid var(--outline)',
  borderRadius: 0,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  outline: 'none',
};

const AdminTicketsListPage = () => {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'caseFeedback'
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ticketService.listForAdmin({ type, status, role, unreadOnly, search, sortBy, sortDir, page, pageSize: PAGE_SIZE });
      setRows(result.data);
      setTotal(result.total);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [type, status, role, unreadOnly, search, sortBy, sortDir, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { ticketService.unreadCount().then(setUnreadCount).catch(() => {}); }, [rows]);

  const handleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  const handleMarkAsRead = async (e, ticket) => {
    e.stopPropagation();
    try {
      await ticketService.markAsRead(ticket.id);
      setRows((prev) => prev.map((r) => (r.id === ticket.id ? { ...r, read_at: new Date().toISOString() } : r)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const activeFilterCount = [type, status, role].filter(Boolean).length + (unreadOnly ? 1 : 0);
  const clearFilters = () => { setType(''); setStatus(''); setRole(''); setUnreadOnly(false); setSearch(''); setPage(1); };

  const sortLabel = (key, label) => (
    // inline-flex (not flex) — a block-level flex container ignores the
    // parent <th>'s text-align, which is exactly why these header buttons
    // weren't lining up over their (inline, correctly-centered) cell values.
    <button
      onClick={() => handleSort(key)}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3 }}
    >
      {label}{sortBy === key && <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );

  const columns = [
    {
      key: 'subject', label: sortLabel('created_at', 'Ticket'),
      render: (t) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {!t.read_at && <div style={{ width: 7, height: 7, borderRadius: 0, background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} title="Unread" />}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{t.subject}</div>
            <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>
              {t.ticket_number} · {t.created_by?.name || 'Unknown'} ({toTitleCase(t.created_by_role)}) · {formatDateTime(t.created_at)}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'type', label: sortLabel('type', 'Type'), align: 'center', render: (t) => <Badge type="ticketType" value={t.type} /> },
    { key: 'status', label: sortLabel('status', 'Status'), align: 'center', render: (t) => <Badge type="ticketStatus" value={t.status} /> },
    {
      key: 'attachments', label: 'Attachments', align: 'center',
      render: (t) => t._count?.attachments > 0 ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--on-muted)' }}>
          <Paperclip size={12} /> {t._count.attachments}
        </span>
      ) : null,
    },
    {
      key: 'actions', label: 'Action', align: 'right',
      render: (t) => !t.read_at ? (
        // inline-flex, not flex — a block-level button ignores the <td>'s
        // text-align:right and just sits left, same issue as the sortable
        // header buttons above.
        <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={(e) => handleMarkAsRead(e, t)}>
          <Check size={12} /> Mark read
        </button>
      ) : null,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Feedback & Tickets"
          subtitle={activeTab === 'tickets'
            ? 'Everything submitted via the Feedback button, from both the MSME portal and the DSA app.'
            : 'Star ratings and comments DSAs leave on a case when it reaches full or partial disbursement.'}
          compact={isMobile}
          actions={activeTab === 'tickets' ? (
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/admin/ticket-recipients')}>
              <Settings size={13} /> Notification Recipients
            </button>
          ) : null}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ key: 'tickets', label: 'Tickets' }, { key: 'caseFeedback', label: 'Case Feedback' }].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 0,
                border: `1px solid ${activeTab === tab.key ? 'var(--primary)' : 'var(--outline)'}`,
                borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '1px solid var(--outline)',
                background: activeTab === tab.key ? 'var(--primary)0f' : 'var(--surface)',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {activeTab === 'caseFeedback' ? (
          <AdminCaseFeedbackTab />
        ) : (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
          <StatCard title="Total" value={total} icon={MessageSquare} />
          <StatCard title="Unread" value={unreadCount} color="var(--primary)" icon={MessageSquare} />
        </div>

        <div className="card" style={{ padding: 0, borderRadius: 0 }}>
          {/* Compact filter toolbar — merged into the same card as the table below */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--outline)' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140, maxWidth: 220 }}>
              <Search size={13} color="var(--text-tertiary)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }}
              />
            </div>
            <select style={{ ...compactField, maxWidth: 130 }} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === 'ISSUE' ? 'Issue' : 'Feedback'}</option>)}
            </select>
            <select style={{ ...compactField, maxWidth: 140 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{toTitleCase(s.replace('_', ' '))}</option>)}
            </select>
            <select style={{ ...compactField, maxWidth: 150 }} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              <option value="">All submitters</option>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{toTitleCase(r)}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
              Unread only
            </label>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} style={{ ...compactField, border: 'none', color: 'var(--primary)', marginLeft: 'auto', cursor: 'pointer' }}>
                Clear filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Table (or its loading/empty state), sharing the same card border.
              Mobile gets a card list instead of the table — a table forced
              into a small viewport either truncates every column or forces
              horizontal scroll, neither of which this needs to do. */}
          {loading ? (
            <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No feedback or tickets found" description="Submissions from the MSME portal and DSA app will show up here." />
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/admin/tickets/${t.id}`)}
                  style={{ padding: 12, borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--outline)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                      {!t.read_at && <div style={{ width: 7, height: 7, borderRadius: 0, background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} title="Unread" />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.subject}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>
                          {t.ticket_number} · {t.created_by?.name || 'Unknown'} ({toTitleCase(t.created_by_role)})
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 1 }}>{formatDateTime(t.created_at)}</div>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <Badge type="ticketStatus" value={t.status} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)', flexWrap: 'wrap' }}>
                    <Badge type="ticketType" value={t.type} />
                    {t._count?.attachments > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--on-muted)' }}>
                        <Paperclip size={12} /> {t._count.attachments}
                      </span>
                    )}
                    {!t.read_at && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                        onClick={(e) => handleMarkAsRead(e, t)}
                      >
                        <Check size={12} /> Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DataTable columns={columns} data={rows} onRowClick={(t) => navigate(`/admin/tickets/${t.id}`)} />
          )}
        </div>

        {!loading && total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default AdminTicketsListPage;
