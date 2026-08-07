import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Star, MessageSquare, Search } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import DataTable from '../components/DataTable';
import { formatDateTime } from '../utils/helpers';
import { caseFeedbackService } from '../api/caseFeedbackService';

const TYPE_OPTIONS = ['FULL', 'PARTIAL'];
const RATING_OPTIONS = [5, 4, 3, 2, 1];
const PAGE_SIZE = 20;

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

const caseLabel = (c) => c?.customer?.business_name || c?.customer?.proprietor_name || c?.customer?.legal_business_name || `Case #${c?.id}`;

const StarRating = ({ value, size = 13 }) => (
  <div style={{ display: 'inline-flex', gap: 1 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} color={n <= value ? '#f59e0b' : 'var(--outline)'} fill={n <= value ? '#f59e0b' : 'none'} strokeWidth={1.5} />
    ))}
  </div>
);

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const AdminCaseFeedbackTab = () => {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [averageRating, setAverageRating] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState('');
  const [rating, setRating] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const result = await caseFeedbackService.listForAdmin({ type, rating, search, sortBy, sortDir, page, pageSize: PAGE_SIZE });
      setRows(result.data);
      setTotal(result.total);
      setAverageRating(result.averageRating);
    } catch (err) {
      toast.error('Failed to load case feedback');
    } finally {
      setLoading(false);
    }
  }, [type, rating, search, sortBy, sortDir, page]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const handleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  const activeFilterCount = [type, rating].filter(Boolean).length;
  const clearFilters = () => { setType(''); setRating(''); setSearch(''); setPage(1); };

  const sortLabel = (key, label) => (
    <button
      onClick={() => handleSort(key)}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3 }}
    >
      {label}{sortBy === key && <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );

  const columns = [
    {
      key: 'case', label: 'Case',
      render: (f) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{caseLabel(f.case)}</div>
          <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>
            CASE-{f.case?.id} · {f.submitted_by?.name || 'Unknown'} · {formatDateTime(f.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: 'type', label: sortLabel('type', 'Type'), align: 'center',
      render: (f) => (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', border: `1px solid ${f.type === 'FULL' ? 'var(--success)' : 'var(--warning)'}`,
          color: f.type === 'FULL' ? 'var(--success)' : 'var(--warning)', background: f.type === 'FULL' ? 'var(--success-bg)' : 'var(--warning-bg)',
        }}>
          {f.type === 'FULL' ? 'Fully Disbursed' : 'Partially Disbursed'}
        </span>
      ),
    },
    { key: 'rating', label: sortLabel('rating', 'Rating'), align: 'center', render: (f) => <StarRating value={f.rating} /> },
    {
      key: 'comment', label: 'Comment', whiteSpace: 'normal', overflow: 'visible', width: '32%',
      render: (f) => (
        <span style={{ fontSize: 12, color: 'var(--on-muted)', lineHeight: 1.5 }}>
          {f.comment || '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
        <StatCard title="Total Responses" value={total} icon={MessageSquare} />
        <StatCard title="Average Rating" value={averageRating != null ? averageRating.toFixed(1) : '—'} color="#f59e0b" icon={Star} />
      </div>

      <div className="card" style={{ padding: 0, borderRadius: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--outline)' }}>
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140, maxWidth: 220 }}>
            <Search size={13} color="var(--text-tertiary)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search by business name…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ ...compactField, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }}
            />
          </div>
          <select style={{ ...compactField, maxWidth: 160 }} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All milestones</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === 'FULL' ? 'Fully Disbursed' : 'Partially Disbursed'}</option>)}
          </select>
          <select style={{ ...compactField, maxWidth: 130 }} value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }}>
            <option value="">All ratings</option>
            {RATING_OPTIONS.map((r) => <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>)}
          </select>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ ...compactField, border: 'none', color: 'var(--primary)', marginLeft: 'auto', cursor: 'pointer' }}>
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Star} title="No case feedback yet" description="Ratings collected from DSAs when a case reaches full/partial disbursement will show up here." />
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((f, idx) => (
              <div
                key={f.id}
                onClick={() => navigate(`/cases/${f.case?.id}`)}
                style={{ padding: 12, borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--outline)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {caseLabel(f.case)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>
                      CASE-{f.case?.id} · {f.submitted_by?.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 1 }}>{formatDateTime(f.created_at)}</div>
                  </div>
                  <StarRating value={f.rating} />
                </div>
                {f.comment && <p style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--outline)' }}>{f.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <DataTable columns={columns} data={rows} onRowClick={(f) => navigate(`/cases/${f.case?.id}`)} />
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
  );
};

export default AdminCaseFeedbackTab;
