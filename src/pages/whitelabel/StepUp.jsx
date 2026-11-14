import React, { useCallback, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Sensitive white-label actions (create, edit details, provision, retry, roll back, cancel) need a fresh confirmation each
// time, so a stolen login alone cannot change infrastructure. The server asks; this asks the person. The action runs first
// WITHOUT a code: if the server demands one, a small prompt appears (authenticator code, or password for an account with
// no authenticator), then the SAME action is retried with it. A wrong code keeps the prompt open with the server's message.
const isStepUp = (err) => err?.response?.data?.code === 'STEP_UP_REQUIRED';

export function useStepUp() {
  const [prompt, setPrompt] = useState(null);       // { kind: 'totp' | 'password', error, busy, locked }
  const pending = useRef(null);

  const run = useCallback(async (action) => {
    try {
      return await action({});
    } catch (err) {
      if (!isStepUp(err)) throw err;
      return new Promise((resolve, reject) => {
        pending.current = { action, resolve, reject };
        setPrompt({ kind: err.response.data.step_up || 'password', error: '', busy: false, locked: err.response.status === 429 });
      });
    }
  }, []);

  const submit = useCallback(async (secret) => {
    const p = pending.current; if (!p) return;
    setPrompt((s) => ({ ...s, busy: true, error: '' }));
    try {
      const kind = prompt?.kind;
      const result = await p.action(kind === 'totp' ? { 'X-Step-Up-Code': secret.trim() } : { 'X-Step-Up-Password': secret });
      pending.current = null; setPrompt(null); p.resolve(result);
    } catch (err) {
      if (isStepUp(err)) {
        setPrompt({ kind: err.response.data.step_up || prompt?.kind || 'password', error: err.response.data.error || 'That did not work.', busy: false, locked: err.response.status === 429 });
      } else {
        pending.current = null; setPrompt(null); p.reject(err);
      }
    }
  }, [prompt]);

  const cancel = useCallback(() => {
    const p = pending.current; pending.current = null; setPrompt(null);
    if (p) p.reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
  }, []);

  const modal = prompt ? <StepUpModal prompt={prompt} onSubmit={submit} onCancel={cancel} /> : null;
  return { run, modal };
}

const StepUpModal = ({ prompt, onSubmit, onCancel }) => {
  const [value, setValue] = useState('');
  const totp = prompt.kind === 'totp';
  const ready = totp ? /^\d{6}$/.test(value.trim()) : value.length > 0;
  const go = (e) => { e.preventDefault(); if (ready && !prompt.busy && !prompt.locked) onSubmit(value); };
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal-box" onClick={(e) => e.stopPropagation()} onSubmit={go} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Confirm it's you</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>This action changes a partner's live setup.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>
        <label className="form-label" htmlFor="wl-stepup">{totp ? 'Enter the 6-digit code from your authenticator app' : 'Re-enter your password'}</label>
        <input
          id="wl-stepup" className="form-control" autoFocus autoComplete="one-time-code" disabled={prompt.busy || prompt.locked}
          type={totp ? 'text' : 'password'} inputMode={totp ? 'numeric' : undefined} maxLength={totp ? 6 : 200}
          value={value} onChange={(e) => setValue(totp ? e.target.value.replace(/\D/g, '') : e.target.value)}
          placeholder={totp ? '123456' : 'Your password'} style={totp ? { letterSpacing: '0.4em', fontSize: 18, textAlign: 'center' } : undefined}
        />
        {prompt.error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--error)' }}>{prompt.error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} style={{ borderRadius: 0 }}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!ready || prompt.busy || prompt.locked} style={{ borderRadius: 0 }}>
            {prompt.busy ? <LoadingSpinner size={14} /> : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
};

export { StepUpModal };
