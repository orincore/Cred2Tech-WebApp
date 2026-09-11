import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { ShieldCheck, ChevronUp, ChevronDown, Save, RotateCcw, Info } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import api from '../api/axiosInstance';
import { formatDateTime } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

// Row order in `draft` IS the priority order — position 0 saves as priority
// 1, and so on. Keeping order and priority the same thing means "drag/move
// up-down" is the only mental model an admin needs; there's no separate
// numeric field that could disagree with what's on screen.
const roleLabel = (draft, index) => {
  const row = draft[index];
  if (!row.enabled) return { text: 'Disabled', color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' };
  const enabledBefore = draft.slice(0, index).filter((r) => r.enabled).length;
  if (enabledBefore === 0) return { text: 'Primary', color: 'var(--success)', bg: 'var(--success-bg)' };
  return { text: `Fallback ${enabledBefore}`, color: 'var(--warning)', bg: 'var(--warning-bg)' };
};

const PROVIDER_DESCRIPTIONS = {
  SIGNZY: 'Returns the bureau’s own CIBIL PDF report.',
  BEFISC: 'Returns a single-use web link to the report, not a PDF.',
};

const AdminBureauProviderSettingsPage = () => {
  const { isMobile } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [providers, setProviders] = useState([]); // last-saved (server) state
  const [draft, setDraft] = useState([]); // editable working copy
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/bureau-providers');
      const sorted = [...(res.data.providers || [])].sort((a, b) => a.priority - b.priority);
      setProviders(sorted);
      setDraft(sorted.map((p) => ({ provider: p.provider, label: p.label, enabled: p.enabled })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load bureau provider settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isDirty = JSON.stringify(draft.map((d) => ({ provider: d.provider, enabled: d.enabled }))) !==
    JSON.stringify(providers.map((p) => ({ provider: p.provider, enabled: p.enabled })));

  const toggleEnabled = (index) => {
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, enabled: !row.enabled } : row)));
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleReset = () => {
    setDraft(providers.map((p) => ({ provider: p.provider, label: p.label, enabled: p.enabled })));
  };

  const handleSave = async () => {
    if (!draft.some((d) => d.enabled)) {
      toast.error('At least one bureau provider must stay enabled.');
      return;
    }
    setSaving(true);
    try {
      const payload = { providers: draft.map((d, i) => ({ provider: d.provider, enabled: d.enabled, priority: i + 1 })) };
      const res = await api.put('/admin/bureau-providers', payload);
      const sorted = [...(res.data.providers || [])].sort((a, b) => a.priority - b.priority);
      setProviders(sorted);
      setDraft(sorted.map((p) => ({ provider: p.provider, label: p.label, enabled: p.enabled })));
      toast.success('Saved — live from the next bureau pull, no restart needed.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bureau provider settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title="Bureau API Settings"
          subtitle="Turn each bureau vendor on or off and set the primary / fallback order for CIBIL pulls (Bureau & Obligations)."
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        <SectionCard
          title="Bureau Providers"
          subtitle="Reorder to set which vendor is tried first — later rows only run if every one above them fails or is disabled."
          actions={(
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={!isDirty || saving} style={{ borderRadius: 0 }}>
                <RotateCcw size={14} /> Discard
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!isDirty || saving} style={{ borderRadius: 0 }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}
        >
          {loading ? (
            <div style={{ padding: 40 }}><LoadingSpinner /></div>
          ) : (
            <div style={{ padding: isMobile ? 12 : 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {draft.map((row, index) => {
                const serverRow = providers.find((p) => p.provider === row.provider);
                const role = roleLabel(draft, index);
                return (
                  <div
                    key={row.provider}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: isMobile ? '12px' : '14px 16px',
                      background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0,
                      opacity: row.enabled ? 1 : 0.65,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                        style={{ padding: 2, minHeight: 'auto' }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => move(index, 1)}
                        disabled={index === draft.length - 1}
                        title="Move down"
                        style={{ padding: 2, minHeight: 'auto' }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    <div style={{
                      width: 32, height: 32, borderRadius: 0, flexShrink: 0,
                      background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: row.enabled ? 'var(--primary)' : 'var(--text-tertiary)',
                    }}>
                      <ShieldCheck size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: 'var(--on-surface)' }}>{row.label || row.provider}</span>
                        <span style={{
                          display: 'inline-block', background: role.bg, color: role.color,
                          padding: '2px 8px', borderRadius: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.03em',
                        }}>
                          {role.text}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>
                        {PROVIDER_DESCRIPTIONS[row.provider] || ''}
                        {serverRow?.updated_at && (
                          <span> &middot; last changed {formatDateTime(serverRow.updated_at)}{serverRow.updated_by_name ? ` by ${serverRow.updated_by_name}` : ''}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleEnabled(index)}
                      title={row.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                        background: row.enabled ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#334155' : '#f1f5f9'),
                        color: row.enabled ? (isDark ? '#6ee7b7' : '#15803d') : 'var(--on-muted)',
                        border: 'none', padding: '6px 14px', borderRadius: 4,
                        fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
                      }}
                    >
                      {row.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            padding: isMobile ? '10px 12px' : '12px 16px', background: 'var(--bg-elevated)', borderRadius: 0,
            margin: isMobile ? '0 12px 12px' : '0 16px 16px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Info size={14} color="var(--info)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--on-muted)', margin: 0 }}>
              A bureau pull tries providers top-to-bottom, skipping disabled ones, and falls through to the next only if the one above it fails. Saved changes apply to the very next bureau pull — no deploy or restart needed.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default AdminBureauProviderSettingsPage;
