import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Plus, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { whitelabelService, apiError } from '../api/whitelabelService';
import { Pill, PageFrame } from './whitelabel/atoms';
import { STATUS_META, hostFor } from './whitelabel/whitelabelUi';

const FILTERS = [{ id: '', label: 'All' }, { id: 'ACTIVE', label: 'Live' }, { id: 'PROVISIONING', label: 'Setting up' }, { id: 'DRAFT', label: 'Draft' }, { id: 'FAILED', label: 'Needs attention' }, { id: 'SUSPENDED', label: 'Suspended' }];
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

// White-label partners: every organisation that has (or is getting) its own branded site.
const AdminWhitelabelListPage = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState(''); const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true);

  useEffect(() => { whitelabelService.config().then(setConfig).catch(() => {}); }, []);
  // fleet health (connections, provisioning, unreachable databases, unpaid fees): shown only when something needs attention
  useEffect(() => { whitelabelService.health().then(setHealth).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await whitelabelService.list({ status: status || undefined, q: query || undefined, page, pageSize: 20 })); }
    catch (err) { toast.error(apiError(err, 'Could not load partners')); }
    finally { setLoading(false); }
  }, [status, query, page]);
  useEffect(() => { load(); }, [load]);

  const base = config?.primary_base_domain;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const th = { padding: '10px 12px', fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em' };

  return (
    <PageFrame icon={Palette} title="White-label Partners" subtitle="Sourcing partners with their own branded site, address and database"
      actions={<button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/whitelabel/new')} style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} disabled={config && !config.enabled}><Plus size={14} /> New organisation</button>}>
      {config && !config.enabled && (
        <p role="status" style={{ margin: '0 0 14px', padding: '10px 12px', fontSize: 13, background: 'var(--warning-bg)', color: 'var(--warning-dark, var(--warning))' }}>
          White-labelling is not switched on for this server (no base domain is configured), so organisations cannot be created here yet.
        </p>
      )}
      {health && health.status !== 'ok' && (
        <div role="status" style={{ margin: '0 0 14px', padding: '10px 12px', fontSize: 13, background: health.status === 'alert' ? 'var(--error-bg)' : 'var(--warning-bg)', color: 'var(--text-primary)' }}>
          <strong>{health.status === 'alert' ? 'Needs attention now' : 'Worth a look'}</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {health.checks.filter((c) => c.level !== 'ok').map((c) => <li key={c.key}>{c.message}</li>)}
          </ul>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => { setStatus(f.id); setPage(1); }} aria-pressed={status === f.id}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--outline)', background: status === f.id ? 'var(--primary)' : 'var(--surface)', color: status === f.id ? '#fff' : 'var(--on-surface)' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', marginLeft: 'auto', width: 260, maxWidth: '100%' }}>
          <Search size={14} color="var(--on-muted)" style={{ position: 'absolute', left: 10, top: 11 }} />
          <input className="form-control" placeholder="Search name or subdomain" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search partners" style={{ paddingLeft: 32 }} />
        </div>
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={30} /></div>
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={Palette} title={status || query ? 'No partners match' : 'No white-label partners yet'}
          description={status || query ? 'Try a different filter or search.' : 'Create the first one: name, subdomain, branding, then set it up.'}
          action={!status && !query && config?.enabled ? <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/whitelabel/new')} style={{ borderRadius: 0 }}><Plus size={14} /> New organisation</button> : null} />
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--outline)', opacity: loading ? 0.6 : 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                {['Organisation', 'Address', 'Status', 'Administrator', 'Created', 'Live since'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data?.items.map((o) => (
                  <tr key={o.id} onClick={() => navigate(`/admin/whitelabel/${o.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/whitelabel/${o.id}`)}
                    style={{ borderTop: '1px solid var(--outline)', cursor: 'pointer' }}>
                    <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--on-surface)' }}>{o.display_name}</td>
                    <td style={{ padding: '11px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--on-muted)' }}>{hostFor(o.slug, base) || o.slug}</td>
                    <td style={{ padding: '11px 12px' }}><Pill tone={STATUS_META[o.status]?.tone} title={STATUS_META[o.status]?.hint}>{STATUS_META[o.status]?.label || o.status}</Pill></td>
                    <td style={{ padding: '11px 12px', color: 'var(--on-muted)' }}>{o.contact_email || '—'}</td>
                    <td style={{ padding: '11px 12px', color: 'var(--on-muted)' }}>{fmt(o.created_at)}</td>
                    <td style={{ padding: '11px 12px', color: 'var(--on-muted)' }}>{fmt(o.activated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12.5, color: 'var(--on-muted)' }}>
              <span>Page {data.page} of {pages} · {data.total} partners</span>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ borderRadius: 0 }}>Previous</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ borderRadius: 0 }}>Next</button>
            </div>
          )}
        </>
      )}
    </PageFrame>
  );
};

export default AdminWhitelabelListPage;
