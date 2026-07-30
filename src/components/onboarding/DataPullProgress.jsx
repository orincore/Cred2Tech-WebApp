import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock, AlertTriangle, FileDown } from 'lucide-react';

const getScoreColor = (score) => {
  if (!score) return 'var(--text-tertiary)';
  if (score >= 750) return 'var(--success)';
  if (score >= 700) return 'var(--warning)';
  return 'var(--error)';
};

const DataPullProgress = ({
  label,
  status,
  onRetry,
  onStart,
  loading = false,
  error = null,
  cost = 0,
  description = null,
  score = null,
  onDownload = null,
  downloading = false
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
      borderRadius: 0,
      marginBottom: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 0,
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
              borderRadius: 0,
              background: config.bg,
              color: config.color,
              textTransform: 'uppercase'
            }}>
              {config.text}
            </span>
          </div>
          {description && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</p>}
          {error && <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 2, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> {error}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {status === 'COMPLETE' ? (
          <>
            {onDownload && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onDownload}
                disabled={downloading}
                title="Download the full bureau report for this applicant"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <FileDown size={13} /> {downloading ? 'Downloading…' : 'Download Report'}
              </button>
            )}
            {score != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: getScoreColor(score) }}>{score}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Bureau Score</div>
              </div>
            )}
            <CheckCircle2 size={20} color="var(--success)" />
          </>
        ) : (
          <button
            type="button"
            className={`btn btn-sm ${status === 'FAILED' ? 'btn-secondary' : 'btn-primary'}`}
            disabled={loading || status === 'PROCESSING'}
            onClick={status === 'FAILED' ? onRetry : onStart}
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
