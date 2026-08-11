import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  danger = true,
  notice, // optional notice text
  // Optional extra friction for high-stakes irreversible actions: when set,
  // the admin must type this exact value before Confirm becomes clickable.
  // Every existing caller omits this and is unaffected.
  confirmText,
}) => {
  const [typedValue, setTypedValue] = useState('');

  // Reset the typed value each time the modal opens/closes so a stale match
  // from a previous open can't silently pre-arm the confirm button.
  useEffect(() => {
    if (!isOpen) setTypedValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmDisabled = isLoading || (confirmText != null && typedValue !== confirmText);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42,
              borderRadius: '50%',
              background: danger ? 'var(--error-bg)' : 'var(--warning-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AlertTriangle size={20} color={danger ? 'var(--error)' : 'var(--warning)'} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          {message}
        </p>

        {notice && (
          <div className="notice notice-warning" style={{ marginBottom: 20 }}>
            <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{notice}</span>
          </div>
        )}

        {confirmText != null && (
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" htmlFor="confirm-modal-typed-value">
              Type <strong>{confirmText}</strong> to confirm
            </label>
            <input
              id="confirm-modal-typed-value"
              className="form-control"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              autoComplete="off"
              autoFocus
              disabled={isLoading}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{ minWidth: 100, justifyContent: 'center' }}
          >
            {isLoading ? <LoadingSpinner size={16} color="currentColor" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
