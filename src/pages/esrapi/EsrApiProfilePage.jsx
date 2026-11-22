import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Building2, Clock, KeyRound, LogOut, Mail, Phone, ShieldCheck, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { changePassword, manageStatus } from '../../api/mfaService';
import { apiError } from '../../api/esrApiService';
import { ROLES } from '../../constants/roles';
import { getInitials } from '../../utils/helpers';
import { Card, Field, PageFrame, Pill } from '../whitelabel/atoms';
import NotificationBell from '../../components/notifications/NotificationBell';
import { Notice, Sharp, dt, useAsync } from './common';

// The profile page for ESR API client users (API_CLIENT_ADMIN / API_CLIENT_MEMBER). The existing profile page belongs to the sourcing-partner app and is not for these roles,
// so the sidebar's profile button lands here instead: who you are (with Log out), your sign-in security, and change password.

const Detail = ({ icon: Icon, label, children }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
      <Icon size={12} /> {label}
    </div>
    <div style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{children || '—'}</div>
  </div>
);

const SecurityRow = ({ label, hint, on }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, overflowWrap: 'anywhere' }}>{hint}</div>}
    </div>
    <Pill tone={on ? 'success' : 'neutral'}>{on ? 'On' : 'Off'}</Pill>
  </div>
);

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
  const tooShort = f.next.length > 0 && f.next.length < 8;
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
    <PageFrame icon={UserCircle} title="My profile" subtitle="Your account on the Cred2Tech ESR API" actions={<NotificationBell />}>
      <Sharp>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16, alignItems: 'stretch', maxWidth: 1100 }}>

          {/* Who you are, with Log out right here so it is always in view */}
          <section style={{ gridColumn: '1 / -1', background: 'var(--surface)', border: '1px solid var(--outline)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 64, height: 64, background: 'var(--on-surface)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
                {getInitials(user?.name || 'U')}
              </div>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }}>{user?.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  <Pill tone={user?.role === 'API_CLIENT_ADMIN' ? 'info' : 'neutral'}>{roleInfo ? roleInfo.name : user?.role}</Pill>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {user?.role === 'API_CLIENT_ADMIN' ? 'Manages keys, IP addresses, billing and the team' : 'Can view the account; an administrator makes changes'}
                  </span>
                </div>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={signOut} data-testid="profile-logout-card"><LogOut size={14} /> Log out</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 18, marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <Detail icon={Mail} label="E-mail">{user?.email}</Detail>
              <Detail icon={Building2} label="Organisation">{org}</Detail>
              {user?.mobile ? <Detail icon={Phone} label="Mobile">{user.mobile}</Detail> : null}
              {user?.last_login_at ? <Detail icon={Clock} label="Last sign-in">{dt(user.last_login_at)}</Detail> : null}
            </div>
          </section>

          <Card title="Sign-in security" subtitle="Extra checks when you sign in." style={{ display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1 }}>
            {mfa.loading ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Checking…</p> : mfa.error ? <Notice tone="warning">Could not read your two-step verification status.</Notice> : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12.5, color: 'var(--text-tertiary)' }}><ShieldCheck size={14} /> Two-step verification is required for every account.</div>
                <SecurityRow label="Authenticator app" hint="A code from an app such as Google Authenticator" on={!!mfa.data.mfaTotpEnabled} />
                <SecurityRow label="E-mail code" hint={mfa.data.mfaEmailEnabled && mfa.data.email ? `Codes go to ${mfa.data.email}` : 'A code sent to your e-mail'} on={!!mfa.data.mfaEmailEnabled} />
              </>
            )}
          </Card>

          <Card title="Change password" subtitle="Use at least 8 characters. You stay signed in on this device." style={{ display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1 }}>
            <form onSubmit={submit} autoComplete="off">
              <Field label="Current password" htmlFor="pw-current"><input id="pw-current" type="password" className="form-control" style={{ width: '100%' }} value={f.current} onChange={set('current')} autoComplete="current-password" /></Field>
              <Field label="New password" htmlFor="pw-new" error={tooShort ? 'Use at least 8 characters.' : undefined}><input id="pw-new" type="password" className="form-control" style={{ width: '100%' }} value={f.next} onChange={set('next')} autoComplete="new-password" /></Field>
              <Field label="New password again" htmlFor="pw-again" error={mismatch ? 'The two passwords do not match.' : undefined}><input id="pw-again" type="password" className="form-control" style={{ width: '100%' }} value={f.again} onChange={set('again')} autoComplete="new-password" /></Field>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!canSubmit}><KeyRound size={14} /> {busy ? 'Saving…' : 'Change password'}</button>
            </form>
          </Card>
        </div>
      </Sharp>
    </PageFrame>
  );
}
