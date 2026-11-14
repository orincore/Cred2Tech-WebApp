import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { whitelabelService, apiError, fieldErrors } from '../../api/whitelabelService';
import { Card, Field, Grid, Pill } from './atoms';
import { formatBytes } from './whitelabelUi';

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const LEVEL = { ok: { tone: 'success', label: 'Fine' }, warning: { tone: 'warning', label: 'Close to the limit' }, exceeded: { tone: 'error', label: 'Over the limit' } };
const BAR = { ok: 'var(--success)', warning: 'var(--warning)', exceeded: 'var(--error)' };
const monthLabel = (m) => { const [y, mm] = m.split('-'); return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); };

const Stat = ({ label, value, sub }) => (
  <div style={{ padding: '12px 14px', border: '1px solid var(--outline)', background: 'var(--surface)' }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--on-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

/** What this partner organisation uses this month, a six-month trend, and where it stands against its soft limits. */
const UsageTab = ({ org, onOrgChanged }) => {
  const [u, setU] = useState(null);
  const [error, setError] = useState(null);
  const [limits, setLimits] = useState({ limit_storage_gb: org.limit_storage_gb ?? '', limit_api_calls_month: org.limit_api_calls_month ?? '' });
  const [errs, setErrs] = useState({}); const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setU(await whitelabelService.usage(org.id)); setError(null); }
    catch (e) { setError(apiError(e, 'Could not load usage')); }
  }, [org.id]);
  useEffect(() => { load(); }, [load, org.limit_storage_gb, org.limit_api_calls_month]);

  const saveLimits = async (e) => {
    e.preventDefault(); setSaving(true); setErrs({});
    try {
      const body = { limit_storage_gb: limits.limit_storage_gb === '' ? null : Number(limits.limit_storage_gb), limit_api_calls_month: limits.limit_api_calls_month === '' ? null : Number(limits.limit_api_calls_month) };
      const out = await whitelabelService.setLimits(org.id, body);
      toast.success('Limits saved'); onOrgChanged?.({ ...org, ...out }); await load();
    } catch (err) { setErrs(fieldErrors(err)); toast.error(apiError(err, 'Could not save the limits')); }
    finally { setSaving(false); }
  };

  if (error) return <p role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>;
  if (!u) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={26} /></div>;
  const maxCalls = Math.max(1, ...u.months.map((m) => m.api_calls));
  const flagged = u.limits.filter((l) => l.level !== 'ok');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
      {flagged.length > 0 && (
        <p role="status" style={{ margin: 0, padding: '10px 12px', fontSize: 13, background: 'var(--warning-bg)', color: 'var(--text-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={15} /> {flagged.map((l) => `${l.label}: ${num(l.used)} of ${num(l.limit)} ${l.unit} (${l.percent}%)`).join(' · ')}
        </p>
      )}

      <Card title="This month" subtitle={`${monthLabel(u.month)} · India time. Read live from this organisation's own database.`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Stat label="Active users" value={num(u.people.active_users)} sub={`${num(u.people.partners)} partner${u.people.partners === 1 ? '' : 's'}`} />
          <Stat label="Cases" value={num(u.cases.total)} sub={`${num(u.cases.this_month)} created this month`} />
          <Stat label="API calls" value={num(u.api.calls_this_month)} sub={`${num(u.api.credits_this_month)} credits used`} />
          <Stat label="Wallet balance" value={`${num(u.wallet.balance_credits)} credits`} sub={`${num(u.wallet.recharges_this_month)} recharge${u.wallet.recharges_this_month === 1 ? '' : 's'} this month (₹${num(Math.round(u.wallet.recharged_inr_this_month))})`} />
          <Stat label="Storage" value={formatBytes(u.storage.used_bytes)} sub={`${num(u.storage.objects)} files`} />
          <Stat label="Platform fee paid" value={`${num(u.platform_fee_credits_this_month)} credits`} sub="taken from its wallet this month" />
        </div>
      </Card>

      <Card title="Last six months" subtitle="API calls per month.">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {u.months.map((m) => (
            <li key={m.month} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 150px', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ color: 'var(--on-muted)' }}>{monthLabel(m.month)}</span>
              <span style={{ background: 'var(--bg)', height: 10 }} aria-hidden="true"><span style={{ display: 'block', height: '100%', width: `${(m.api_calls / maxCalls) * 100}%`, background: 'var(--primary)' }} /></span>
              <span style={{ color: 'var(--on-surface)', textAlign: 'right' }}>{num(m.api_calls)} calls · {num(m.api_credits)} cr</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Limits" subtitle="Soft limits only raise a warning here. Nothing is blocked. Leave empty for no limit.">
        {u.limits.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {u.limits.map((l) => (
              <li key={l.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{l.label}: {num(l.used)} of {num(l.limit)} {l.unit}</span>
                  <Pill tone={LEVEL[l.level].tone}>{l.percent}% · {LEVEL[l.level].label}</Pill>
                </div>
                <div style={{ background: 'var(--bg)', height: 8 }} role="progressbar" aria-valuenow={Math.min(100, l.percent)} aria-valuemin={0} aria-valuemax={100} aria-label={l.label}>
                  <div style={{ height: '100%', width: `${Math.min(100, l.percent)}%`, background: BAR[l.level] }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={saveLimits}>
          <Grid>
            <Field label="Storage limit (GB)" htmlFor="wl-lim-storage" error={errs.limit_storage_gb}>
              <input id="wl-lim-storage" className="form-control" inputMode="numeric" value={limits.limit_storage_gb} onChange={(e) => setLimits({ ...limits, limit_storage_gb: e.target.value.replace(/\D/g, '') })} placeholder="No limit" />
            </Field>
            <Field label="API calls per month" htmlFor="wl-lim-calls" error={errs.limit_api_calls_month}>
              <input id="wl-lim-calls" className="form-control" inputMode="numeric" value={limits.limit_api_calls_month} onChange={(e) => setLimits({ ...limits, limit_api_calls_month: e.target.value.replace(/\D/g, '') })} placeholder="No limit" />
            </Field>
          </Grid>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving} style={{ borderRadius: 0 }}>{saving ? <LoadingSpinner size={14} /> : 'Save limits'}</button>
        </form>
      </Card>
    </div>
  );
};

export default UsageTab;
