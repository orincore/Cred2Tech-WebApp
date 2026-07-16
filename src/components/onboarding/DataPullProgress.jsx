import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock } from 'lucide-react';

const DataPullProgress = ({
  label,
  status,
  onRetry,
  onStart,
  loading = false,
  error = null,
  cost = 0,
  description = null
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'COMPLETE':
        return { icon: <CheckCircle2 size={18} color="var(--success)" />, color: 'var(--success)', bg: 'var(--success-bg)', text: 'Complete' };
      case 'PROCESSING':
        return { icon: <Loader2 size={18} className="animate-spin" color="var(--info)" />, color: 'var(--info)', bg: 'var(--info-bg)', text: 'Processing...' };
      case 'FAILED':
        return { icon: <AlertCircle size={18} color="var(--error)" />, color: 'var(--error)', bg: 'var(--error-bg)', text: 'Failed' };
      case 'PENDING':
        return { icon: <Clock size={18} color="var(--warning)" />, color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'Pending' };
      default:
        return { icon: <RefreshCw size={18} color="var(--text-tertiary)" />, color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)', text: 'Not Started' };
    }
  };

  const config = getStatusConfig();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      marginBottom: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: config.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {config.icon}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 20,
              background: config.bg,
              color: config.color,
              textTransform: 'uppercase'
            }}>
              {config.text}
            </span>
          </div>
          {description && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</p>}
          {error && <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 2, fontWeight: 500 }}>⚠️ {error}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {status === 'COMPLETE' ? (
          <CheckCircle2 size={20} color="var(--success)" />
        ) : (
          <button
            type="button"
            className={`btn btn-sm ${status === 'FAILED' ? 'btn-secondary' : ''}`}
            disabled={loading || status === 'PROCESSING'}
            onClick={status === 'FAILED' ? onRetry : onStart}
            style={status !== 'FAILED' ? { background: 'var(--success)', color: 'white', border: 'none' } : {}}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : status === 'FAILED' ? (
              'Retry'
            ) : (
              `Pull ${cost > 0 ? `(${cost} Cr)` : ''}`
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default DataPullProgress;
