import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Mail, UserPlus } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { esrApiPortal, apiError } from '../../api/esrApiService';
import { Card, Field, Pill } from '../whitelabel/atoms';
import { Modal, Notice, Table, dt, td, useAsync } from './common';

const ROLE_LABEL = { API_CLIENT_ADMIN: 'Administrator', API_CLIENT_MEMBER: 'Member (read-only)' };

export default function TeamTab({ flag }) {
  const team = useAsync(() => esrApiPortal.team(), []);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(null);

  const act = async (id, fn, ok) => {
    setBusy(id);
    try { await fn(); toast.success(ok); team.reload(); } catch (err) { toast.error(apiError(err)); } finally { setBusy(null); }
  };

  if (team.loading) return <LoadingSpinner />;
  if (team.error) return <Notice tone="error">{apiError(team.error, 'Could not load your team')}</Notice>;
  const { members, max_members: max } = team.data;

  return (
    <Card title="Your team" subtitle={`${members.length} of ${max} people. Administrators manage keys, IP addresses, billing and the team; members can look but not change.`}
      actions={flag('team.manage') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviting(true)} disabled={members.length >= max} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><UserPlus size={14} /> Invite person</button>}>
      <Table head={['Name', 'E-mail', 'Role', 'Status', 'Last sign-in', '']}>
        {members.map((m) => (
          <tr key={m.id}>
            <td style={td}>{m.name}{m.is_you && <span style={{ color: 'var(--text-tertiary)' }}> (you)</span>}</td>
            <td style={td}>{m.email}</td>
            <td style={td}>
              {flag('team.manage') && !m.is_you && m.status !== 'SUSPENDED' ? (
                <select className="form-control" style={{ width: 'auto' }} value={m.role} disabled={busy === m.id} aria-label={`Role of ${m.name}`}
                  onChange={(e) => act(m.id, () => esrApiPortal.updateMember(m.id, { role: e.target.value }), 'Role updated')}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : ROLE_LABEL[m.role] || m.role}
            </td>
            <td style={td}><Pill tone={m.status === 'ACTIVE' ? (m.invitation_pending ? 'info' : 'success') : 'neutral'}>{m.status === 'ACTIVE' ? (m.invitation_pending ? 'Invited' : 'Active') : m.status === 'INACTIVE' ? 'Deactivated' : m.status}</Pill></td>
            <td style={td}>{dt(m.last_login_at)}</td>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
              {flag('team.manage') && !m.is_you && m.status === 'ACTIVE' && m.invitation_pending && <button type="button" className="btn btn-ghost btn-sm" disabled={busy === m.id} onClick={() => act(m.id, () => esrApiPortal.resendInvite(m.id), 'Invitation sent again')}><Mail size={13} /> Resend invite</button>}
              {flag('team.manage') && !m.is_you && m.status === 'ACTIVE' && <button type="button" className="btn btn-ghost btn-sm" disabled={busy === m.id} onClick={() => act(m.id, () => esrApiPortal.updateMember(m.id, { status: 'INACTIVE' }), 'Person deactivated and signed out')}>Deactivate</button>}
              {flag('team.manage') && !m.is_you && m.status === 'INACTIVE' && <button type="button" className="btn btn-ghost btn-sm" disabled={busy === m.id} onClick={() => act(m.id, () => esrApiPortal.updateMember(m.id, { status: 'ACTIVE' }), 'Person reactivated')}>Reactivate</button>}
            </td>
          </tr>
        ))}
      </Table>
      {inviting && <InviteModal onClose={() => setInviting(false)} onDone={() => { setInviting(false); team.reload(); }} />}
    </Card>
  );
}

function InviteModal({ onClose, onDone }) {
  const [f, setF] = useState({ name: '', email: '', mobile: '', role: 'API_CLIENT_MEMBER' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await esrApiPortal.invite({ ...f, mobile: f.mobile || undefined });
      toast.success(r.invite_sent ? `Invitation sent to ${f.email}` : 'Person added, but the invitation e-mail could not be sent. Use “Resend invite”.');
      onDone();
    } catch (err) { toast.error(apiError(err)); setBusy(false); }
  };
  return (
    <Modal title="Invite a person" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name" required htmlFor="inv-name"><input id="inv-name" className="form-control" value={f.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="E-mail" required hint="They get a link to set their password." htmlFor="inv-email"><input id="inv-email" type="email" className="form-control" value={f.email} onChange={set('email')} required /></Field>
        <Field label="Mobile (optional)" htmlFor="inv-mobile"><input id="inv-mobile" className="form-control" inputMode="tel" value={f.mobile} onChange={set('mobile')} /></Field>
        <Field label="Role" htmlFor="inv-role">
          <select id="inv-role" className="form-control" value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Send invitation</button>
        </div>
      </form>
    </Modal>
  );
}
