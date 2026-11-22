import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { changePassword, manageStatus } from '../../api/mfaService';
import { apiError } from '../../api/esrApiService';
import { ROLES } from '../../constants/roles';
import { getInitials } from '../../utils/helpers';
import { Card, Field, PageFrame, Pill } from '../whitelabel/atoms';
import { Notice, Sharp, dt, useAsync } from './common';

// The profile page for ESR API client users (API_CLIENT_ADMIN / API_CLIENT_MEMBER). The existing profile page belongs to the sourcing-partner app and is not for these roles,
// so the sidebar's profile button lands here instead: who you are, your sign-in security, change password, and Log out.
export default function EsrApiProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const mfa = useAsync(() => manageStatus(), []);
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const roleInfo = ROLES[user?.role];
  const org = user?.tenant?.name || user?.tenant_name || null;
  const mismatch = f.again.length > 0 && f.next !== f.again;
  const canSubmit = f.current && f.next.length >= 8 && f.next === f.again && !busy;

  const signOut = () => { logout(); navigate('/login'); };
  const submit = async (e) => {
    e.preventDefault(); if (!canSubmit) return; setBusy(true);
    try {
      await changePassword({ currentPassword: f.current, newPassword: f.next });
      toast.success('Password changed');
      setF({ current: '', next: '', again: '' });
    } catch (err) { toast.error(apiError(err, 'Could not change the password')); } finally { setBusy(false); }
  };

  return (
    <PageFrame icon={UserCircle} title="My profile" subtitle="Your account on the Cred2Tech ESR API"
      actions={<Sharp><button type="button" className="btn btn-secondary btn-sm" onClick={signOut} data-testid="profile-logout"><LogOut size={14} /> Log out</button></Sharp>}>
      <Sharp>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
          <Card title="Account">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, background: 'var(--on-surface)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{getInitials(user?.name || 'U')}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, overflowWrap: 'anywhere' }}>{user?.name}</div>
                <Pill tone={user?.role === 'API_CLIENT_ADMIN' ? 'info' : 'neutral'}>{roleInfo ? roleInfo.name : user?.role}</Pill>
              </div>
            </div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
              <dt style={{ color: 'var(--text-tertiary)' }}>E-mail</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{user?.email || '—'}</dd>
              {user?.mobile ? <><dt style={{ color: 'var(--text-tertiary)' }}>Mobile</dt><dd style={{ margin: 0 }}>{user.mobile}</dd></> : null}
              <dt style={{ color: 'var(--text-tertiary)' }}>Organisation</dt><dd style={{ margin: 0 }}>{org || '—'}</dd>
              {user?.last_login_at ? <><dt style={{ color: 'var(--text-tertiary)' }}>Last sign-in</dt><dd style={{ margin: 0 }}>{dt(user.last_login_at)}</dd></> : null}
            </dl>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {user?.role === 'API_CLIENT_ADMIN' ? 'You can manage keys, IP addresses, billing and your team.' : 'You can view your account; an administrator makes changes.'}
            </p>
          </Card>

          <Card title="Sign-in security">
            {mfa.loading ? <p style={{ margin: 0, fontSize: 13 }}>Checking…</p> : mfa.error ? <Notice tone="warning">Could not read your two-step verification status.</Notice> : (
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
                <dt style={{ color: 'var(--text-tertiary)' }}>Authenticator app</dt><dd style={{ margin: 0 }}><Pill tone={mfa.data.mfaTotpEnabled ? 'success' : 'neutral'}>{mfa.data.mfaTotpEnabled ? 'On' : 'Off'}</Pill></dd>
                <dt style={{ color: 'var(--text-tertiary)' }}>E-mail code</dt>
                <dd style={{ margin: 0, minWidth: 0 }}>
                  <Pill tone={mfa.data.mfaEmailEnabled ? 'success' : 'neutral'}>{mfa.data.mfaEmailEnabled ? 'On' : 'Off'}</Pill>
                  {mfa.data.mfaEmailEnabled && mfa.data.email ? <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)', overflowWrap: 'anywhere' }}>Codes go to {mfa.data.email}</div> : null}
                </dd>
              </dl>
            )}
          </Card>

          <Card title="Change password" subtitle="Use at least 8 characters. You stay signed in on this device.">
            <form onSubmit={submit} autoComplete="off">
              <Field label="Current password" htmlFor="pw-current"><input id="pw-current" type="password" className="form-control" value={f.current} onChange={set('current')} autoComplete="current-password" /></Field>
              <Field label="New password" htmlFor="pw-new"><input id="pw-new" type="password" className="form-control" value={f.next} onChange={set('next')} autoComplete="new-password" /></Field>
              <Field label="New password again" htmlFor="pw-again" error={mismatch ? 'The two passwords do not match.' : undefined}><input id="pw-again" type="password" className="form-control" value={f.again} onChange={set('again')} autoComplete="new-password" /></Field>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!canSubmit}>{busy ? 'Saving…' : 'Change password'}</button>
            </form>
          </Card>

          <Card title="Sign out">
            <p style={{ margin: '0 0 12px', fontSize: 13 }}>Sign out of the ESR API dashboard on this device.</p>
            <button type="button" className="btn btn-danger btn-sm" onClick={signOut} data-testid="profile-logout-card"><LogOut size={14} /> Log out</button>
          </Card>
        </div>
      </Sharp>
    </PageFrame>
  );
}
