import React, { useState } from 'react';
import { PauseCircle, PlayCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { whitelabelService, apiError } from '../../api/whitelabelService';

const btn = { borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 6 };

/**
 * Suspend / resume a live partner. Suspending takes its site offline at once for every user (nothing is deleted),
 * needs a written reason (kept in the activity log) and the admin's confirmation (step-up). Resume is the reverse.
 */
const SuspendControl = ({ org, stepUp, onChanged }) => {
  const [open, setOpen] = useState(null); // 'suspend' | 'resume'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (org.status !== 'ACTIVE' && org.status !== 'SUSPENDED') return null;

  const close = () => { if (!busy) { setOpen(null); setReason(''); } };
  const run = async (fn, okText) => {
    setBusy(true);
    try { const updated = await stepUp.run(fn); toast.success(okText); onChanged(updated); setOpen(null); setReason(''); }
    catch (err) { if (!err.cancelled) toast.error(apiError(err, 'Could not change the status')); }
    finally { setBusy(false); }
  };

  return (
    <>
      {org.status === 'ACTIVE'
        ? <button type="button" className="btn btn-secondary btn-sm" style={btn} onClick={() => setOpen('suspend')}><PauseCircle size={14} /> Suspend</button>
        : <button type="button" className="btn btn-primary btn-sm" style={btn} onClick={() => setOpen('resume')}><PlayCircle size={14} /> Resume</button>}

      {open === 'suspend' && (
        <div className="modal-overlay" onClick={close}>
          <form className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}
            onSubmit={(e) => { e.preventDefault(); if (reason.trim() && !busy) run((h) => whitelabelService.suspend(org.id, reason.trim(), h), `${org.display_name} is suspended`); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Suspend {org.display_name}?</h3>
              <button type="button" aria-label="Close" onClick={close} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
              Their site goes offline right away for every user and their background work stops. Nothing is deleted, and you can resume it at any time.
            </p>
            <label className="form-label" htmlFor="wl-suspend-reason">Reason (kept in the activity log)</label>
            <textarea id="wl-suspend-reason" className="form-control" rows={3} maxLength={300} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Platform fee unpaid since 1 November" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={close} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" style={{ borderRadius: 0 }} disabled={!reason.trim() || busy}>{busy ? <LoadingSpinner size={14} /> : 'Suspend'}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal isOpen={open === 'resume'} onClose={close} isLoading={busy} danger={false}
        title={`Resume ${org.display_name}?`} message="Their site comes back online right away for all of their users." confirmLabel="Resume"
        onConfirm={() => run((h) => whitelabelService.resume(org.id, h), `${org.display_name} is live again`)} />
    </>
  );
};

export default SuspendControl;
