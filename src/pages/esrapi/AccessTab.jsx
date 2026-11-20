import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { KeyRound, Plus, RefreshCw, Ban, Trash2 } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { esrApiPortal, apiError } from '../../api/esrApiService';
import { Card, Field, Pill } from '../whitelabel/atoms';
import { Modal, Notice, SecretModal, Table, dt, td, useAsync, ENV_TONE, STATUS_TONE } from './common';

// API keys and the IP allow-list. What each user can do (view / manage / UAT / production) comes from the server's feature flags.
export default function AccessTab({ flag }) {
  const keys = useAsync(() => esrApiPortal.keys(), []);
  const ips = useAsync(() => esrApiPortal.ips(), []);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState(null);       // { title, key, warnings }: shown once, never stored
  const [revoking, setRevoking] = useState(null);
  const [rotating, setRotating] = useState(null);
  const [addingIp, setAddingIp] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (fn, ok) => {
    setBusy(true);
    try { const r = await fn(); if (ok) toast.success(ok); return r; }
    catch (err) { toast.error(apiError(err)); return null; }
    finally { setBusy(false); }
  };

  return (
    <>
      <Card title="API keys" subtitle="Send a key in the X-API-Key header. Test keys use free test credits; production keys are billed."
        actions={flag('keys.manage') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={14} /> New key</button>}>
        {keys.loading ? <LoadingSpinner /> : keys.error ? <Notice tone="error">{apiError(keys.error)}</Notice> : !keys.data.keys.length ? (
          <EmptyState icon={KeyRound} title="No keys yet" description={flag('keys.manage') ? 'Create a test key to start.' : 'An administrator of your account can create keys.'} />
        ) : (
          <Table head={['Name', 'Key', 'Environment', 'Status', 'Last used', '']}>
            {keys.data.keys.map((k) => (
              <tr key={k.id}>
                <td style={td}>{k.name}</td>
                <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{k.prefix}…</td>
                <td style={td}><Pill tone={ENV_TONE[k.environment]}>{k.environment}</Pill></td>
                <td style={td}><Pill tone={STATUS_TONE[k.status] || 'neutral'}>{k.status}</Pill>{k.grace_until && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>old key works until {dt(k.grace_until)}</div>}</td>
                <td style={td}>{k.last_used_at ? `${dt(k.last_used_at)}${k.last_used_ip ? ` from ${k.last_used_ip}` : ''}` : 'Never'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {flag('keys.manage') && k.status === 'ACTIVE' && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRotating(k)} title="Replace with a new key"><RefreshCw size={13} /> Rotate</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevoking(k)} title="Stop this key working now"><Ban size={13} /> Revoke</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div style={{ height: 16 }} />
      <Card title="Allowed IP addresses" subtitle="Calls are accepted only from these addresses. This is mandatory for every key."
        actions={flag('ip.manage') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddingIp(true)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={14} /> Add address</button>}>
        {ips.loading ? <LoadingSpinner /> : ips.error ? <Notice tone="error">{apiError(ips.error)}</Notice> : (
          <>
            {flag('production.enabled') && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>A new production address starts working after {ips.data.production_activation_delay_minutes} minutes. Test addresses work at once. Up to {ips.data.max_per_environment} per environment.</p>}
            {!ips.data.ips.length ? <EmptyState icon={KeyRound} title="No addresses yet" description="Add the public IP address (or range) your servers call from." /> : (
              <Table head={['Address', 'Environment', 'Label', 'Active', '']}>
                {ips.data.ips.map((i) => (
                  <tr key={i.id}>
                    <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{i.cidr}</td>
                    <td style={td}><Pill tone={ENV_TONE[i.environment]}>{i.environment}</Pill></td>
                    <td style={td}>{i.label || '—'}</td>
                    <td style={td}>{i.active_now ? <Pill tone="success">Active</Pill> : <Pill tone="warning" title={dt(i.active_from)}>From {dt(i.active_from)}</Pill>}</td>
                    <td style={td}>{flag('ip.manage') && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { if (await act(() => esrApiPortal.removeIp(i.id), 'Address removed')) ips.reload(); }}><Trash2 size={13} /> Remove</button>}</td>
                  </tr>
                ))}
              </Table>
            )}
          </>
        )}
      </Card>

      {creating && <NewKeyModal flag={flag} onClose={() => setCreating(false)} onCreated={(r) => { setCreating(false); setSecret({ title: 'Your new API key', key: r.key, warnings: r.warnings || [] }); keys.reload(); }} />}
      {addingIp && <AddIpModal flag={flag} onClose={() => setAddingIp(false)} onAdded={() => { setAddingIp(false); ips.reload(); keys.reload(); }} />}
      {secret && <SecretModal title={secret.title} secret={secret.key} warnings={secret.warnings} onClose={() => setSecret(null)} />}
      <ConfirmModal isOpen={!!rotating} onClose={() => setRotating(null)} isLoading={busy} danger={false} title="Rotate this key?" confirmLabel="Rotate"
        message="A new key is created. The old key keeps working for 24 hours so you can switch over, then stops."
        onConfirm={async () => { const k = rotating; const r = await act(() => esrApiPortal.rotateKey(k.id)); setRotating(null); if (r) { setSecret({ title: 'Your replacement key', key: r.key, warnings: r.warnings || [] }); keys.reload(); } }} />
      <RevokeModal target={revoking} busy={busy} onClose={() => setRevoking(null)}
        onConfirm={async (reason) => { const k = revoking; if (await act(() => esrApiPortal.revokeKey(k.id, reason), 'Key revoked')) { setRevoking(null); keys.reload(); } }} />
    </>
  );
}

function NewKeyModal({ flag, onClose, onCreated }) {
  const [environment, setEnvironment] = useState(flag('uat.enabled') ? 'UAT' : 'PRODUCTION');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { onCreated(await esrApiPortal.createKey({ environment, name })); } catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title="New API key" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name" required hint="So you can tell your keys apart, e.g. “Billing server”." htmlFor="key-name">
          <input id="key-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
        </Field>
        <Field label="Environment" htmlFor="key-env">
          <select id="key-env" className="form-control" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            {flag('uat.enabled') && <option value="UAT">Test (UAT): free test credits</option>}
            {flag('production.enabled') && <option value="PRODUCTION">Production: billed</option>}
          </select>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>Create key</button>
        </div>
      </form>
    </Modal>
  );
}

function AddIpModal({ flag, onClose, onAdded }) {
  const [environment, setEnvironment] = useState(flag('uat.enabled') ? 'UAT' : 'PRODUCTION');
  const [cidr, setCidr] = useState(''); const [label, setLabel] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await esrApiPortal.addIp({ environment, cidr, label: label || undefined }); toast.success('Address added'); onAdded(); } catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title="Add an allowed address" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="IP address or range" required hint="e.g. 203.0.113.7 or 203.0.113.0/24. Very wide ranges are refused." htmlFor="ip-cidr">
          <input id="ip-cidr" className="form-control" value={cidr} onChange={(e) => setCidr(e.target.value)} required autoFocus />
        </Field>
        <Field label="Label" htmlFor="ip-label"><input id="ip-label" className="form-control" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} /></Field>
        <Field label="Environment" htmlFor="ip-env">
          <select id="ip-env" className="form-control" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            {flag('uat.enabled') && <option value="UAT">Test (UAT)</option>}
            {flag('production.enabled') && <option value="PRODUCTION">Production (active after a short delay)</option>}
          </select>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !cidr.trim()}>Add address</button>
        </div>
      </form>
    </Modal>
  );
}

function RevokeModal({ target, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  if (!target) return null;
  return (
    <Modal title={`Revoke “${target.name}”?`} onClose={onClose}>
      <p style={{ marginTop: 0, fontSize: 13 }}>This key stops working immediately and cannot be restored. Anything still using it will start getting errors.</p>
      <Field label="Reason" required hint="At least 5 characters. Kept in the audit log." htmlFor="revoke-reason">
        <input id="revoke-reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-danger btn-sm" disabled={busy || reason.trim().length < 5} onClick={() => onConfirm(reason.trim())}>Revoke key</button>
      </div>
    </Modal>
  );
}
