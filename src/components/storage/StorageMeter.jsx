import React from 'react';
import { AlertTriangle, HardDrive } from 'lucide-react';

// 1 GB = 1024^3 bytes — the unit S3 meters in, and the unit the server uses.
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  // The thresholds sit just below each unit so a value that would ROUND up to the
  // next unit ("1024.0 MB") is shown in that unit ("1.00 GB") instead.
  if (n >= GB * 0.99995) return `${(n / GB).toFixed(2)} GB`;
  if (n >= MB * 0.99995) return `${(n / MB).toFixed(1)} MB`;
  if (n >= KB * 0.9995) return `${(n / KB).toFixed(0)} KB`;
  return `${n} B`;
};

const LEVEL = {
  ok: { color: 'var(--primary)', label: null },
  warning: { color: 'var(--warning)', label: 'Storage is filling up' },
  critical: { color: 'var(--error)', label: 'Storage is almost full' },
  full: { color: 'var(--error)', label: 'Storage is full' },
};

const SOURCES = [
  { key: 'uploaded', label: 'Uploaded documents', hint: 'Files you or your team uploaded', color: '#6366f1' },
  { key: 'api_pulled', label: 'Pulled via Cred2Tech', hint: 'GST, ITR, bank and bureau reports', color: '#14b8a6' },
  { key: 'system_generated', label: 'System-generated', hint: 'Reports built from pulled data', color: '#a78bfa' },
];

/**
 * The filling bar + numbers + breakdown. Presentational only — `storage` is the
 * payload of GET /storage/status (also embedded in the admin tenant summary).
 */
const StorageMeter = ({ storage, compact = false }) => {
  if (!storage) return null;

  if (!storage.applies) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--outline)', fontSize: 13, color: 'var(--on-muted)' }}>
        <HardDrive size={16} />
        <span>No storage limit applies to this account. {formatBytes(storage.used_bytes)} stored.</span>
      </div>
    );
  }

  const level = LEVEL[storage.level] || LEVEL.ok;
  const fill = Math.min(100, Math.max(0, storage.percent));
  const total = storage.used_bytes || 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: compact ? 20 : 26, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>{formatBytes(storage.used_bytes)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-muted)', marginLeft: 8 }}>of {storage.limit_gb} GB used</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: level.color }}>{storage.percent}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-label="Storage used"
        style={{ position: 'relative', height: compact ? 12 : 16, background: 'var(--bg-elevated)', border: '1px solid var(--outline)', overflow: 'hidden' }}
      >
        <div style={{ width: `${fill}%`, height: '100%', background: level.color, transition: 'width 0.5s ease, background 0.3s ease' }} />
        {/* faint markers where the bar turns amber (85%) and red (95%) */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '85%', width: 1, background: 'var(--outline)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '95%', width: 1, background: 'var(--outline)' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--on-muted)' }}>
        <span>
          {storage.over_by_bytes > 0
            ? <b style={{ color: 'var(--error)' }}>{formatBytes(storage.over_by_bytes)} over the limit</b>
            : <>{formatBytes(storage.remaining_bytes)} free</>}
        </span>
        <span>{storage.object_count} file{storage.object_count === 1 ? '' : 's'}</span>
      </div>

      {level.label && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: '10px 12px', background: storage.level === 'warning' ? 'var(--warning-bg)' : 'var(--error-bg)', color: level.color, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {level.label}.{' '}
            {storage.is_full
              ? 'New GST, ITR, bank and bureau pulls and new uploads are paused. Free up space or upgrade to continue. Nothing you already have is deleted.'
              : 'Once it is full, new pulls and uploads stop until you free up space or upgrade.'}
          </span>
        </div>
      )}

      {!compact && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>What is using your storage</div>
          {SOURCES.map((s) => {
            const bytes = storage.breakdown?.[s.key] || 0;
            const share = total > 0 ? (bytes / total) * 100 : 0;
            return (
              <div key={s.key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                  <span style={{ color: 'var(--on-surface)', fontWeight: 600 }}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, background: s.color, marginRight: 8 }} />{s.label}
                    <span style={{ color: 'var(--on-muted)', fontWeight: 400, marginLeft: 8 }}>{s.hint}</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--on-surface)' }}>{formatBytes(bytes)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-elevated)', marginTop: 4 }}>
                  <div style={{ width: `${share}%`, height: '100%', background: s.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StorageMeter;
