import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { whitelabelService } from '../../api/whitelabelService';
import { slugFormatError, hostFor } from './whitelabelUi';
import { Field } from './atoms';

// Subdomain input with the real address shown beside it and a live availability check. The check is debounced, ignores
// answers for text that has since changed, and reports the server's reason (taken, reserved, already in DNS, on hold...).
// The server is the authority; the instant local format check only saves a round trip.
const SubdomainField = ({ value, onChange, base, limits, disabled = false, onAvailability, error }) => {
  const [check, setCheck] = useState({ state: 'idle', message: '' });
  const seq = useRef(0);
  const slug = String(value || '').trim().toLowerCase();
  const formatError = slugFormatError(slug, limits);

  useEffect(() => {
    if (disabled) { setCheck({ state: 'idle', message: '' }); return undefined; }
    if (!slug || formatError) { setCheck({ state: 'idle', message: '' }); onAvailability?.(false); return undefined; }
    const my = ++seq.current;
    setCheck({ state: 'checking', message: '' });
    const t = setTimeout(async () => {
      try {
        const r = await whitelabelService.checkSubdomain(slug);
        if (my !== seq.current) return;                       // the text changed while we were asking
        setCheck(r.available ? { state: 'ok', message: `${hostFor(slug, base)} is available` } : { state: 'bad', message: r.message || 'This name is not available.' });
        onAvailability?.(!!r.available);
      } catch (e) {
        if (my !== seq.current) return;
        const limited = e?.response?.status === 429;
        setCheck({ state: 'error', message: limited ? 'Too many checks. Wait a minute and try again.' : 'Could not check right now. Try again.' });
        onAvailability?.(false);
      }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, disabled, formatError, base]);

  const note = formatError || (check.state === 'bad' || check.state === 'error' ? check.message : '');
  const icon = check.state === 'checking' ? <LoadingSpinner size={14} /> : check.state === 'ok' ? <CheckCircle2 size={15} color="var(--success)" /> : (check.state === 'bad' || formatError) ? <XCircle size={15} color="var(--error)" /> : null;

  return (
    <Field label="Subdomain" required htmlFor="wl-slug" error={error || note}
      hint={disabled ? 'The subdomain cannot be changed after setup has started.' : (base ? `This becomes the organisation's own address, ${hostFor(slug || 'name', base)}.` : 'No base domain is configured on this server.')}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <input id="wl-slug" className="form-control" value={value || ''} disabled={disabled} maxLength={30} autoComplete="off" spellCheck={false}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="acme-finance"
          style={{ borderRight: 'none', flex: 1, minWidth: 0 }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--outline)', borderLeft: 'none', fontSize: 13, color: 'var(--on-muted)', whiteSpace: 'nowrap' }}>
          {base ? `.${base}` : ''} {icon}
        </span>
      </div>
      {check.state === 'ok' && !note && <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--success)' }}>{check.message}</span>}
    </Field>
  );
};

export default SubdomainField;
