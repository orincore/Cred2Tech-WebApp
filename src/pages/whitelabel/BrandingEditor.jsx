import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Save } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { whitelabelService, apiError, fieldErrors } from '../../api/whitelabelService';
import { Card, Field, Grid } from './atoms';
import LogoUploader from './LogoUploader';
import BrandingPreview from './BrandingPreview';
import { HEX } from './whitelabelUi';

const SURFACE_LABEL = {
  login_page: 'Sign-in page', header: 'Page header', sidebar: 'Side menu', emails: 'Emails',
  pdf_reports: 'Reports and PDFs', invoices: 'Invoices', consent_pages: 'Customer consent and authorisation pages', error_pages: 'Error pages',
};
const PRESETS = ['#0F766E', '#0369A1', '#4F46E5', '#7C3AED', '#BE185D', '#C2410C', '#15803D', '#1E293B'];
const TEXT_KEYS = ['tagline', 'footer_text', 'support_email', 'support_phone'];

const BrandingEditor = ({ org, config, stepUp, onChanged }) => {
  const b = org.branding || {};
  const saved = useMemo(() => ({
    primary_color: b.primary_color || '', tagline: b.tagline || '', footer_text: b.footer_text || '',
    support_email: b.support_email || '', support_phone: b.support_phone || '',
    logo_placements: b.logo_placements || {},
  }), [b.primary_color, b.tagline, b.footer_text, b.support_email, b.support_phone, JSON.stringify(b.logo_placements || {})]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [previews, setPreviews] = useState({});
  const [poweredBy, setPoweredBy] = useState(!!org.powered_by_visible);
  const [poweredBusy, setPoweredBusy] = useState(false);
  useEffect(() => setForm(saved), [saved]);
  useEffect(() => setPoweredBy(!!org.powered_by_visible), [org.powered_by_visible]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const colourOk = !form.primary_color || HEX.test(form.primary_color);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const assetOf = (kind) => (org.assets || []).find((a) => a.kind === kind);
  const ruleOf = (kind) => (config?.asset_kinds || []).find((k) => k.kind === kind);
  const surfaces = config?.logo_surfaces || Object.keys(SURFACE_LABEL);

  const save = async () => {
    setSaving(true); setErrors({});
    try {
      const payload = { primary_color: form.primary_color || null, logo_placements: form.logo_placements };
      for (const k of TEXT_KEYS) payload[k] = form[k] === '' ? null : form[k];
      await whitelabelService.updateBranding(org.id, payload);
      toast.success('Branding saved'); await onChanged?.();
    } catch (err) {
      setErrors(fieldErrors(err)); toast.error(apiError(err, 'Could not save branding'));
    } finally { setSaving(false); }
  };

  const togglePowered = async () => {
    const next = !poweredBy; setPoweredBusy(true);
    try {
      await stepUp.run((headers) => whitelabelService.update(org.id, { powered_by_visible: next }, headers));
      setPoweredBy(next); toast.success(next ? 'Attribution switched on' : 'Attribution switched off'); await onChanged?.();
    } catch (err) { if (!err.cancelled) toast.error(apiError(err, 'Could not change this setting')); }
    finally { setPoweredBusy(false); }
  };

  const placementOn = (s) => form.logo_placements[s] !== false;
  const togglePlacement = (s) => setForm((f) => ({ ...f, logo_placements: { ...f.logo_placements, [s]: !placementOn(s) } }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 18, alignItems: 'start' }} className="wl-two-col">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        <Card title="Colour" subtitle="One brand colour themes buttons, links and highlights across their site and emails.">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="color" aria-label="Pick brand colour" value={HEX.test(form.primary_color) ? form.primary_color : '#4F46E5'} onChange={(e) => set('primary_color')(e.target.value.toUpperCase())}
              style={{ width: 48, height: 40, padding: 0, border: '1px solid var(--outline)', background: 'transparent', cursor: 'pointer' }} />
            <input id="wl-primary" className="form-control" value={form.primary_color} placeholder="#0F766E" maxLength={7} onChange={(e) => set('primary_color')(e.target.value.toUpperCase())}
              style={{ width: 130, fontFamily: 'monospace' }} aria-label="Brand colour hex code" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map((c) => (
                <button key={c} type="button" title={c} aria-label={`Use ${c}`} onClick={() => set('primary_color')(c)}
                  style={{ width: 26, height: 26, background: c, border: form.primary_color?.toUpperCase() === c ? '2px solid var(--on-surface)' : '1px solid var(--outline)', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
          {(!colourOk || errors.primary_color) && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--error)' }}>{errors.primary_color || 'Use a 6-digit hex colour like #0F766E.'}</p>}
        </Card>

        <Card title="Texts and contact" subtitle="Shown in the sign-in screen, emails and notices.">
          <Grid>
            <Field label="Tagline" htmlFor="wl-tagline" error={errors.tagline} hint="One short line under the welcome message.">
              <input id="wl-tagline" className="form-control" value={form.tagline} maxLength={120} onChange={(e) => set('tagline')(e.target.value)} placeholder="Loans made simple" />
            </Field>
            <Field label="Email footer text" htmlFor="wl-footer" error={errors.footer_text}>
              <input id="wl-footer" className="form-control" value={form.footer_text} maxLength={200} onChange={(e) => set('footer_text')(e.target.value)} placeholder="Licensed and regulated" />
            </Field>
            <Field label="Support email" htmlFor="wl-semail" error={errors.support_email} hint="Replies to its emails go here. If empty, emails say do not reply.">
              <input id="wl-semail" className="form-control" type="email" value={form.support_email} maxLength={120} onChange={(e) => set('support_email')(e.target.value)} placeholder="help@acme.in" />
            </Field>
            <Field label="Support phone" htmlFor="wl-sphone" error={errors.support_phone}>
              <input id="wl-sphone" className="form-control" value={form.support_phone} maxLength={20} onChange={(e) => set('support_phone')(e.target.value)} placeholder="+91 80 1234 5678" />
            </Field>
          </Grid>
        </Card>

        <Card title="Logos" subtitle="Pick the versions that read well on light and on dark backgrounds. Without a logo, the name is shown as text.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            <LogoUploader orgId={org.id} kind="LOGO_LIGHT" title="Logo for light backgrounds" help="Used on white and light screens." rule={ruleOf('LOGO_LIGHT')} stored={assetOf('LOGO_LIGHT')} onChanged={onChanged} onPreviewUrl={(k, u) => setPreviews((p) => ({ ...p, [k]: u }))} />
            <LogoUploader orgId={org.id} kind="LOGO_DARK" title="Logo for dark backgrounds" help="Used on the coloured sign-in panel, dark mode and email headers." rule={ruleOf('LOGO_DARK')} stored={assetOf('LOGO_DARK')} onChanged={onChanged} onPreviewUrl={(k, u) => setPreviews((p) => ({ ...p, [k]: u }))} checker />
            <LogoUploader orgId={org.id} kind="FAVICON" title="Browser tab icon" help="A small square image. Without one the tab shows no icon." rule={ruleOf('FAVICON')} stored={assetOf('FAVICON')} onChanged={onChanged} onPreviewUrl={(k, u) => setPreviews((p) => ({ ...p, [k]: u }))} />
          </div>
        </Card>

        <Card title="Where the logo shows" subtitle="Switch a place off to hide the logo there (the name is not shown instead).">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px 18px' }}>
            {surfaces.map((s) => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--on-surface)', cursor: 'pointer' }}>
                <input type="checkbox" checked={placementOn(s)} onChange={() => togglePlacement(s)} />
                {SURFACE_LABEL[s] || s}
              </label>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
          {dirty && <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>Unsaved changes</span>}
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving || !colourOk} style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {saving ? <LoadingSpinner size={14} /> : <Save size={15} />} Save branding
          </button>
        </div>

        <Card title="Attribution" subtitle="The small “Powered by Cred2Tech” line on their sign-in page, customer pages, side menu and emails.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, color: 'var(--on-surface)', cursor: poweredBusy ? 'wait' : 'pointer' }}>
            <input type="checkbox" checked={poweredBy} disabled={poweredBusy} onChange={togglePowered} />
            Show “Powered by Cred2Tech”
          </label>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--on-muted)' }}>Changing this asks you to confirm it's you, because it affects what the partner's customers see.</p>
        </Card>
      </div>

      <div style={{ position: 'sticky', top: 12 }}>
        <Card title="Preview" subtitle="Updates as you type. Save to apply.">
          <BrandingPreview name={org.display_name} primary={colourOk ? form.primary_color : ''} logoLightUrl={previews.LOGO_LIGHT} logoDarkUrl={previews.LOGO_DARK}
            tagline={form.tagline} poweredBy={poweredBy} showLoginLogo={placementOn('login_page')} />
        </Card>
      </div>
    </div>
  );
};

export default BrandingEditor;
