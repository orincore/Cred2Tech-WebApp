import React from 'react';
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
}) => {
  if (!isOpen) return null;

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

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
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
