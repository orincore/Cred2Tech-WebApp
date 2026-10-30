import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown on a paid-pull screen (GST, ITR, bank statements, bureau) while the
 * account's storage is full, in place of letting the user hit an API that would
 * be refused. `gate` is the object from useStorageGate(); renders nothing unless
 * storage is full. Pair it with `disabled={gate.blocked}` on the pull button.
 */
const StorageFullNotice = ({ gate, service, style }) => {
  const navigate = useNavigate();
  if (!gate?.blocked) return null;
  const s = gate.status;
  return (
    <div
      role="alert"
      style={{
        padding: 12, background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)',
        fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        marginBottom: 16, ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <span>
          You don&apos;t have sufficient space ({s.used_gb} of {s.limit_gb} GB used). Please clear some storage to pull {service}.
          {!gate.isAdmin && ' Ask your account admin to manage storage.'}
        </span>
      </div>
      {gate.isAdmin && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate('/storage/manage')}>
            Manage Storage
          </button>
          <button type="button" className="btn btn-primary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate('/profile?tab=storage#plans')}>
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  );
};

export default StorageFullNotice;
