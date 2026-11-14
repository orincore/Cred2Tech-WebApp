import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ImagePlus, Trash2 } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { whitelabelService, apiError } from '../../api/whitelabelService';
import { formatBytes } from './whitelabelUi';

// One image slot (logo for light backgrounds, for dark backgrounds, or the tab icon). Chooses a file, checks type and size
// before sending (the server checks again, from the file's real bytes), uploads it, and shows what is stored. SVG is not
// accepted: it can carry scripts.
const TYPE_LABEL = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', ico: 'ICO' };
const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon' };

const LogoUploader = ({ orgId, kind, title, help, rule, stored, onChanged, onPreviewUrl, disabled, checker = false }) => {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const version = stored?.sha256 || '';

  useEffect(() => {
    let revoked = null; let cancelled = false;
    if (!stored) { setUrl(null); onPreviewUrl?.(kind, null); return undefined; }
    whitelabelService.assetBlobUrl(orgId, kind).then((u) => { if (cancelled) { URL.revokeObjectURL(u); return; } revoked = u; setUrl(u); onPreviewUrl?.(kind, u); }).catch(() => {});
    return () => { cancelled = true; if (revoked) URL.revokeObjectURL(revoked); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, kind, version, !!stored]);

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    setError('');
    if (rule && file.size > rule.max_bytes) { setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(rule.max_bytes)}.`); return; }
    if (rule && !rule.types.some((t) => file.type === MIME[t] || (t === 'ico' && /\.ico$/i.test(file.name)))) { setError(`Use ${rule.types.map((t) => TYPE_LABEL[t]).join(', ')}. SVG is not allowed.`); return; }
    setBusy(true);
    try { await whitelabelService.uploadAsset(orgId, kind, file); toast.success('Image saved'); await onChanged?.(); }
    catch (err) { setError(apiError(err, 'Could not save the image.')); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setError('');
    try { await whitelabelService.deleteAsset(orgId, kind); toast.success('Image removed'); await onChanged?.(); }
    catch (err) { setError(apiError(err, 'Could not remove the image.')); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ border: '1px solid var(--outline)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--on-muted)', marginTop: 2 }}>{help}</div>
      </div>
      <div style={{ height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--outline)', overflow: 'hidden',
        background: checker ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 14px 14px' : 'var(--bg-elevated)' }}>
        {busy ? <LoadingSpinner size={20} /> : url ? <img src={url} alt={title} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nothing uploaded</span>}
      </div>
      {stored && !busy && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{stored.content_type?.replace('image/', '').toUpperCase()} · {formatBytes(stored.size_bytes)}</div>}
      {error && <div role="alert" style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <input ref={input} type="file" accept={rule ? rule.types.map((t) => MIME[t]).join(',') + (rule.types.includes('ico') ? ',.ico' : '') : 'image/*'} onChange={pick} style={{ display: 'none' }} data-testid={`upload-${kind}`} />
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy || disabled} onClick={() => input.current?.click()} style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ImagePlus size={14} /> {stored ? 'Replace' : 'Upload'}
        </button>
        {stored && <button type="button" className="btn btn-secondary btn-sm" disabled={busy || disabled} onClick={remove} style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /> Remove</button>}
      </div>
      {rule && <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{rule.types.map((t) => TYPE_LABEL[t]).join(' / ')} · up to {formatBytes(rule.max_bytes)}</div>}
    </div>
  );
};

export default LogoUploader;
