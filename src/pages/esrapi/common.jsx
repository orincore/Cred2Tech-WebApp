import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';

import './esrApi.css';

// Small shared pieces for the ESR API screens (client dashboard and admin console), built on the app's own tokens and the white-label atoms.

/** Wraps a page's content so the sharp-cornered look in esrApi.css applies to it (and to the modals it opens). */
export const Sharp = ({ children }) => <div className="esr-sharp">{children}</div>;

export const inr = (v, digits = 2) => (v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`);
export const dt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN'));

export const th = { padding: '10px 12px', fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em', textAlign: 'left', whiteSpace: 'nowrap' };
export const td = { padding: '10px 12px', fontSize: 12.5, color: 'var(--text-primary)', borderTop: '1px solid var(--border)', verticalAlign: 'top' };

export const Notice = ({ tone = 'info', title, children }) => {
  const bg = { info: 'var(--info-bg)', warning: 'var(--warning-bg)', error: 'var(--error-bg)', success: 'var(--success-bg)' }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} style={{ margin: '0 0 14px', padding: '10px 12px', fontSize: 13, background: bg, color: 'var(--text-primary)' }}>
      {title && <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong>}
      {children}
    </div>
  );
};

export const Stat = ({ label, value, sub, tone }) => (
  <div style={{ padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', minWidth: 0 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: tone === 'error' ? 'var(--error)' : tone === 'warning' ? 'var(--warning-dark, var(--warning))' : 'var(--text-primary)', overflowWrap: 'anywhere' }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
  </div>
);

export const StatRow = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>{children}</div>
);

export const Modal = ({ title, onClose, children, width = 520, footer }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  );
};

/** A secret that is shown exactly once. It is held only in this component's state and gone when the dialog closes. */
export const SecretModal = ({ title, secret, warnings = [], onClose }) => (
  <Modal title={title} onClose={onClose} width={620} footer={<button type="button" className="btn btn-primary btn-sm" onClick={onClose}>I have saved it</button>}>
    <p style={{ margin: '0 0 10px', fontSize: 13 }}>
      <AlertTriangle size={14} style={{ verticalAlign: '-2px', color: 'var(--warning-dark, var(--warning))' }} /> Copy this key now. For security it is shown <strong>only once</strong> and cannot be shown again.
    </p>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, wordBreak: 'break-all' }}>
      <span data-testid="api-key-secret" style={{ flex: 1 }}>{secret}</span>
      <CopyButton text={secret} label="Key copied" size={14} />
    </div>
    {warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
  </Modal>
);

export const Pager = ({ total, limit, offset, onOffset }) => {
  if (!total || total <= limit) return null;
  const page = Math.floor(offset / limit) + 1; const pages = Math.ceil(total / limit);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '10px 0', fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-tertiary)' }}>Page {page} of {pages} ({num(total)} total)</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - limit))}>Previous</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={offset + limit >= total} onClick={() => onOffset(offset + limit)}>Next</button>
    </div>
  );
};

/** A table that scrolls sideways on a phone instead of breaking the page. */
export const Table = ({ head, children, empty }) => (
  <div className="table-wrapper" style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
      <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
    {empty}
  </div>
);

export const useAsync = (fn, deps) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(fn).then(
      (data) => { if (live) setState({ data, loading: false, error: null }); },
      (error) => { if (live) setState({ data: null, loading: false, error }); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
};

export const ENV_TONE = { UAT: 'info', PRODUCTION: 'success' };
export const STATUS_TONE = { ACTIVE: 'success', ROTATING: 'warning', REVOKED: 'neutral', EXPIRED: 'neutral', PENDING: 'info', SUSPENDED: 'warning', CLOSED: 'neutral', PAID: 'success', ISSUED: 'info', OVERDUE: 'error', CREDITED: 'success', INITIATED: 'neutral', FAILED: 'error', SUCCESS: 'success', REFUNDED: 'warning' };
