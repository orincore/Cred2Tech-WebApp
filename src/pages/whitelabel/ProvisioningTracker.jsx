import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, Circle, CircleDashed, ExternalLink, MinusCircle, Play, RotateCcw, Undo2, XCircle, Ban, ChevronDown, ChevronRight, Radio } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { whitelabelService, apiError } from '../../api/whitelabelService';
import { useProvisioningStream } from './useProvisioningStream';
import { applyEvent, allowedActions, jobStage, formatDuration, JOB_META, STEP_STATUS_META, ACTIVE_JOB_STATUSES, canProvision, readiness } from './whitelabelUi';
import { Card, Pill, TONES } from './atoms';

// Live view of an organisation's setup (docs/Whitelabel.md section 7): twelve steps with their state, a progress bar, the
// reason when one fails, and the controls to start, retry, roll back or cancel. State comes from the server's database;
// the live stream makes it feel instant and a slow refresh heals anything a dropped connection missed.
const ICON = { DONE: CheckCircle2, SKIPPED: MinusCircle, FAILED: XCircle, COMPENSATED: Undo2, PENDING: Circle };

const StepIcon = ({ status }) => {
  if (status === 'RUNNING') return <span style={{ display: 'inline-flex', width: 22, justifyContent: 'center' }}><LoadingSpinner size={18} /></span>;
  const I = ICON[status] || CircleDashed;
  const tone = TONES[STEP_STATUS_META[status]?.tone || 'neutral'];
  return <I size={22} color={tone.fg} />;
};

const orgUrl = (config, slug) => (config?.sample_url ? config.sample_url.replace('//example.', `//${slug}.`) : null);

const ProvisioningTracker = ({ org, config, stepUp, onOrgChanged }) => {
  const [snap, setSnap] = useState(undefined);        // undefined = loading, null = never provisioned
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);       // 'start' | 'rollback' | 'cancel'
  const [open, setOpen] = useState({});
  const [, tick] = useState(0);
  const lastStatus = useRef(null);

  const refresh = useCallback(async () => {
    try { setSnap(await whitelabelService.provisioningStatus(org.id)); } catch (e) { if (snap === undefined) setSnap(null); }
  }, [org.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh]);

  const active = snap && ACTIVE_JOB_STATUSES.includes(snap.job.status);
  const stream = useProvisioningStream(org.id, {
    enabled: true,
    onSnapshot: (s) => setSnap(s),
    onEvent: (e) => {
      setSnap((s) => applyEvent(s, e));
      if (e.type === 'job') refresh();                  // a job-level change: confirm with the authoritative state
    },
  });

  // slow healing refresh while something is running, and a 1 s tick so the elapsed time moves
  useEffect(() => {
    if (!active) return undefined;
    const r = setInterval(refresh, 8000); const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(r); clearInterval(t); };
  }, [active, refresh]);

  // tell the admin when a run they are watching finishes, and refresh the organisation's own status
  useEffect(() => {
    const s = snap?.job?.status;
    if (lastStatus.current && lastStatus.current !== s) {
      if (s === 'SUCCEEDED') toast.success(`${org.display_name} is live`);
      else if (s === 'FAILED') toast.error('Setup stopped with an error');
      if (['SUCCEEDED', 'FAILED', 'ROLLED_BACK', 'CANCELLED'].includes(s)) onOrgChanged?.();
    }
    lastStatus.current = s || null;
  }, [snap?.job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (name, fn) => {
    setBusy(name);
    try { await stepUp.run(fn); await refresh(); onOrgChanged?.(); }
    catch (err) { if (!err.cancelled) toast.error(apiError(err, `Could not ${name}`)); }
    finally { setBusy(''); setConfirm(null); }
  };
  const start = () => act('start setup', (h) => whitelabelService.provision(org.id, h));
  const retry = () => act('retry', (h) => whitelabelService.retry(org.id, h));
  const rollback = () => act('roll back', (h) => whitelabelService.rollback(org.id, h));
  const cancel = () => act('cancel', (h) => whitelabelService.cancel(org.id, h));

  if (snap === undefined) return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><LoadingSpinner size={28} /></div>;

  const can = allowedActions(snap, { provisioningConfigured: config?.provisioning_configured !== false });
  const stage = jobStage(snap);
  const ready = canProvision(org);
  const missing = readiness(org).filter((r) => r.required && !r.done);
  const url = org.status === 'ACTIVE' ? orgUrl(config, org.slug) : null;
  const btn = { borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 7 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card
        title="Setup status"
        subtitle={snap ? undefined : 'Nothing has been set up yet. Starting creates their address, their own database and the administrator account.'}
        actions={(
          <>
            {(can.start || !snap) && <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !ready || config?.provisioning_configured === false || (org.status === 'ACTIVE' || org.status === 'SUSPENDED')} onClick={() => setConfirm('start')} style={btn}><Play size={14} />{snap ? 'Start again' : 'Start setup'}</button>}
            {can.retry && <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={retry} style={btn}>{busy === 'retry' ? <LoadingSpinner size={14} /> : <RotateCcw size={14} />} Retry from the failed step</button>}
            {can.rollback && <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => setConfirm('rollback')} style={btn}><Undo2 size={14} /> Roll back</button>}
            {can.cancel && <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => setConfirm('cancel')} style={btn}><Ban size={14} /> Cancel</button>}
            {url && <a className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}><ExternalLink size={14} /> Open their site</a>}
          </>
        )}
      >
        {!snap && (
          <div>
            {missing.length > 0 && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--warning-dark, var(--warning))' }}>Before starting: {missing.map((m) => m.label.toLowerCase()).join(', ')}.</p>}
            {config?.provisioning_configured === false && <p style={{ margin: 0, fontSize: 13, color: 'var(--warning-dark, var(--warning))' }}>Provisioning is not configured on this server (no database provisioner), so setup cannot be started here.</p>}
            {ready && config?.provisioning_configured !== false && <p style={{ margin: 0, fontSize: 13, color: 'var(--on-muted)' }}>Ready to start. This takes a few minutes and you can watch it here.</p>}
          </div>
        )}
        {snap && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <Pill tone={JOB_META[snap.job.status]?.tone}>{JOB_META[snap.job.status]?.label || snap.job.status}</Pill>
              <span style={{ fontSize: 12.5, color: 'var(--on-muted)' }}>{snap.progress.done} of {snap.progress.total} steps</span>
              {snap.job.started_at && <span style={{ fontSize: 12.5, color: 'var(--on-muted)' }}>· {formatDuration(snap.job.started_at, snap.job.finished_at)}</span>}
              {active && (
                <span title="Updates arrive instantly while this page is open" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: stream === 'live' ? 'var(--success)' : 'var(--warning-dark, var(--warning))' }}>
                  <Radio size={13} /> {stream === 'live' ? 'Live' : 'Reconnecting…'}
                </span>
              )}
            </div>
            <div role="progressbar" aria-valuenow={snap.progress.percent} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              <div style={{ width: `${snap.progress.percent}%`, height: '100%', background: stage === 'failed' ? 'var(--error)' : stage === 'done' ? 'var(--success)' : 'var(--primary)', transition: 'width 0.4s ease' }} />
            </div>
            {snap.job.error && stage === 'failed' && <p role="alert" style={{ margin: '12px 0 0', padding: '10px 12px', fontSize: 13, background: 'var(--error-bg)', color: 'var(--error)' }}>{snap.job.error}</p>}
            {snap.job.cancel_requested && active && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>Stopping after the current step, then undoing what was created…</p>}
            {stage === 'done' && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--success)' }}>Everything is in place. The administrator has been emailed an invite to set a password.</p>}
          </div>
        )}
      </Card>

      {snap && (
        <Card title="Steps" bodyStyle={{ padding: 0 }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {snap.steps.map((s, i) => {
              const meta = STEP_STATUS_META[s.status] || STEP_STATUS_META.PENDING;
              const expandable = (s.log && s.log.length) || s.error;
              const isOpen = open[s.key] ?? (s.status === 'FAILED');
              return (
                <li key={s.key} data-step={s.key} data-status={s.status} style={{ borderTop: i ? '1px solid var(--outline)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: s.status === 'RUNNING' ? 'var(--primary-subtle)' : 'transparent' }}>
                    <StepIcon status={s.status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: s.status === 'PENDING' ? 'var(--on-muted)' : 'var(--on-surface)' }}>{i + 1}. {s.title}</div>
                      {s.status === 'FAILED' && s.error && <div style={{ fontSize: 12.5, color: 'var(--error)', marginTop: 2 }}>{s.error}</div>}
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{s.attempts > 1 ? `attempt ${s.attempts} · ` : ''}{formatDuration(s.started_at, s.finished_at)}</span>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                    {expandable ? (
                      <button type="button" aria-label={isOpen ? 'Hide details' : 'Show details'} onClick={() => setOpen((o) => ({ ...o, [s.key]: !isOpen }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--on-muted)' }}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ) : <span style={{ width: 16 }} />}
                  </div>
                  {expandable && isOpen && (
                    <div style={{ padding: '0 18px 12px 52px' }}>
                      {(s.log || []).map((l, j) => (
                        <div key={j} style={{ fontFamily: 'monospace', fontSize: 11.5, color: l.level === 'warn' ? 'var(--warning-dark, var(--warning))' : 'var(--on-muted)', lineHeight: 1.7 }}>
                          <span style={{ opacity: 0.6 }}>{new Date(l.t).toLocaleTimeString('en-IN')}</span>  {l.msg}
                        </div>
                      ))}
                      {s.error && s.status !== 'FAILED' && <div style={{ fontSize: 12, color: 'var(--error)' }}>{s.error}</div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <ConfirmModal isOpen={confirm === 'start'} onClose={() => setConfirm(null)} onConfirm={start} isLoading={busy === 'start setup'} danger={false}
        title="Start setting up this organisation?" confirmLabel="Start setup"
        message={`This creates ${org.slug}'s address, its own database and administrator account, and emails the administrator an invite. You can watch it here.`} />
      <ConfirmModal isOpen={confirm === 'rollback'} onClose={() => setConfirm(null)} onConfirm={rollback} isLoading={busy === 'roll back'}
        title="Roll back this setup?" confirmLabel="Roll back"
        message="Everything created so far (address, database, credentials) is removed so you can start clean. This is refused if the database already holds real data." />
      <ConfirmModal isOpen={confirm === 'cancel'} onClose={() => setConfirm(null)} onConfirm={cancel} isLoading={busy === 'cancel'}
        title="Cancel this setup?" confirmLabel="Cancel setup"
        message="It stops after the current step and everything created so far is removed." />
    </div>
  );
};

export default ProvisioningTracker;
