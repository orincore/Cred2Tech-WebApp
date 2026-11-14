import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Palette } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { whitelabelService, apiError, fieldErrors } from '../api/whitelabelService';
import { Card, PageFrame } from './whitelabel/atoms';
import SubdomainField from './whitelabel/SubdomainField';
import OrgDetailsForm, { DETAIL_KEYS } from './whitelabel/OrgDetailsForm';
import { useStepUp } from './whitelabel/StepUp';
import { suggestSlug, validateDetails, detailsPayload, slugFormatError } from './whitelabel/whitelabelUi';

// Step 1 of onboarding: who they are and which address they get. Creating it makes a DRAFT (nothing is built yet);
// branding and logos are set on the next screen, and setup is started from there once everything is ready.
const AdminWhitelabelCreatePage = () => {
  const navigate = useNavigate();
  const stepUp = useStepUp();
  const [config, setConfig] = useState(null);
  const [values, setValues] = useState({});
  const [slug, setSlug] = useState(''); const slugTouched = useRef(false);
  const [available, setAvailable] = useState(false);
  const [errors, setErrors] = useState({}); const [slugError, setSlugError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { whitelabelService.config().then(setConfig).catch(() => toast.error('Could not load settings')); }, []);

  // until the admin edits the subdomain themselves, keep suggesting one from the name
  const onValues = (v) => {
    setValues(v);
    if (!slugTouched.current) setSlug(suggestSlug(v.display_name, config?.slug));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateDetails(values);
    const slugErr = !slug ? 'Choose a subdomain.' : slugFormatError(slug, config?.slug);
    setErrors(errs); setSlugError(slugErr || '');
    if (Object.keys(errs).length || slugErr) { toast.error('Please fix the highlighted fields'); return; }
    if (!available) { setSlugError('Wait for the subdomain check, or choose another name.'); return; }
    setSaving(true);
    try {
      const body = { slug, ...detailsPayload(values, DETAIL_KEYS) };
      const org = await stepUp.run((headers) => whitelabelService.create(body, headers));
      toast.success('Organisation created. Now set up its branding.');
      navigate(`/admin/whitelabel/${org.id}?tab=branding`);
    } catch (err) {
      if (err.cancelled) return;
      const f = fieldErrors(err); setErrors(f); if (f.slug) setSlugError(f.slug);
      toast.error(apiError(err, 'Could not create the organisation'));
    } finally { setSaving(false); }
  };

  if (!config) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={30} /></div>;

  return (
    <PageFrame icon={Palette} title="New white-label partner" subtitle="Step 1 of 3 · Details and address"
      back={<Link to="/admin/whitelabel" aria-label="Back to partners" style={{ display: 'flex', color: 'var(--on-muted)' }}><ArrowLeft size={18} /></Link>}>
      <form onSubmit={submit} style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Card title="Address" subtitle="Where their site lives. This cannot be changed once setup has started.">
          <SubdomainField value={slug} onChange={(v) => { slugTouched.current = true; setSlug(v); setSlugError(''); }} base={config.primary_base_domain} limits={config.slug} onAvailability={setAvailable} error={slugError} />
        </Card>
        <Card title="Organisation and administrator">
          <OrgDetailsForm values={values} onChange={onValues} errors={errors} />
        </Card>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Link to="/admin/whitelabel" className="btn btn-secondary" style={{ borderRadius: 0, textDecoration: 'none' }}>Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={saving || !config.enabled} style={{ borderRadius: 0 }}>
            {saving ? <LoadingSpinner size={14} /> : 'Create and continue'}
          </button>
        </div>
      </form>
      {stepUp.modal}
    </PageFrame>
  );
};

export default AdminWhitelabelCreatePage;
