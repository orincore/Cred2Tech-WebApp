import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { LayoutGrid, Plus, X, Save, Trash2, GripVertical } from 'lucide-react';
import api from '../api/axiosInstance';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../utils/helpers';
import { GATABLE_NAV_ITEMS } from '../constants/navItems';

const EMPTY_FORM = {
  name: '',
  description: '',
  monthly_price_credits: '',
  first_cycle_price_credits: '',
  is_active: true,
  sort_order: '0',
  feature_nav_item_ids: [], // [] = unrestricted (full access)
  included_features: [],
};

// Admin-managed Virtual Workspace subscription tiers — create new plans and
// edit pricing here. Editing a plan's price is a forward-only change: it
// never touches what an already-subscribed tenant is currently billed
// (that's a snapshot on TenantSubscription taken at subscribe/upgrade time,
// see virtualWorkspaceSubscription.service.js) — only a fresh subscribe or
// an explicit plan-switch by a tenant/admin picks up the new price.
const AdminSubscriptionPlansPage = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // null = closed, {} = create, {...} = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [restrictFeatures, setRestrictFeatures] = useState(false);
  const [newFeatureText, setNewFeatureText] = useState('');

  const fetchPlans = async () => {
    try {
      const res = await api.get('/admin/subscription-plans');
      setPlans(res.data.plans || []);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setRestrictFeatures(false);
    setNewFeatureText('');
    setEditing({});
  };
  const openEdit = (plan) => {
    const navIds = plan.feature_nav_item_ids || [];
    setForm({
      name: plan.name,
      description: plan.description || '',
      monthly_price_credits: String(plan.monthly_price_credits),
      first_cycle_price_credits: plan.first_cycle_price_credits != null ? String(plan.first_cycle_price_credits) : '',
      is_active: plan.is_active,
      sort_order: String(plan.sort_order),
      feature_nav_item_ids: navIds,
      included_features: plan.included_features || [],
    });
    setRestrictFeatures(navIds.length > 0);
    setNewFeatureText('');
    setEditing(plan);
  };

  const toggleFeatureNavItem = (id) => {
    setForm((f) => ({
      ...f,
      feature_nav_item_ids: f.feature_nav_item_ids.includes(id)
        ? f.feature_nav_item_ids.filter((x) => x !== id)
        : [...f.feature_nav_item_ids, id],
    }));
  };

  const addIncludedFeature = () => {
    const text = newFeatureText.trim();
    if (!text) return;
    setForm((f) => ({ ...f, included_features: [...f.included_features, text] }));
    setNewFeatureText('');
  };
  const removeIncludedFeature = (idx) => {
    setForm((f) => ({ ...f, included_features: f.included_features.filter((_, i) => i !== idx) }));
  };
  const updateIncludedFeature = (idx, value) => {
    setForm((f) => ({ ...f, included_features: f.included_features.map((v, i) => (i === idx ? value : v)) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.monthly_price_credits || Number(form.monthly_price_credits) <= 0) {
      return toast.error('Monthly price must be greater than 0');
    }
    if (form.first_cycle_price_credits && Number(form.first_cycle_price_credits) <= 0) {
      return toast.error('First-cycle price must be greater than 0');
    }
    if (restrictFeatures && form.feature_nav_item_ids.length === 0) {
      return toast.error('Select at least one allowed feature, or switch back to Full Access');
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      monthly_price_credits: parseInt(form.monthly_price_credits, 10),
      first_cycle_price_credits: form.first_cycle_price_credits ? parseInt(form.first_cycle_price_credits, 10) : null,
      is_active: form.is_active,
      sort_order: parseInt(form.sort_order, 10) || 0,
      // Full Access always saves as [] regardless of what was checked
      // before switching back — an unrestricted plan should never
      // silently retain a stale partial list.
      feature_nav_item_ids: restrictFeatures ? form.feature_nav_item_ids : [],
      included_features: form.included_features.map((s) => s.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (editing?.id) {
        await api.put(`/admin/subscription-plans/${editing.id}`, payload);
        toast.success('Plan updated');
      } else {
        await api.post('/admin/subscription-plans', payload);
        toast.success('Plan created');
      }
      setEditing(null);
      await fetchPlans();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan) => {
    try {
      await api.patch(`/admin/subscription-plans/${plan.id}/toggle`, { is_active: !plan.is_active });
      await fetchPlans();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to toggle plan');
    }
  };

  // Soft delete server-side — every tenant that ever subscribed to this
  // plan keeps their subscription history/invoices intact, this just
  // removes it from here and from new subscribes/upgrades.
  const handleDelete = async (plan) => {
    if (!confirm(`Delete plan "${plan.name}"? Tenants who already subscribed to it keep their billing history — this only removes it from the list and stops new subscribes.`)) return;
    try {
      await api.delete(`/admin/subscription-plans/${plan.id}`);
      await fetchPlans();
      toast.success('Plan deleted');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete plan');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--outline)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        background: 'var(--bg-elevated)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LayoutGrid size={18} color="var(--primary)" />
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>Subscription Plans</h1>
            <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>
              Virtual Workspace pricing tiers — DSA tenants pick one of these to subscribe or upgrade
            </p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate} style={{ borderRadius: 0 }}>
          <Plus size={14} /> New Plan
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ overflowX: 'auto', border: '1px solid var(--outline)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                {['Plan', 'Description', 'Price', 'Access', "What's Included", 'Subscribers', 'Order', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const isRestricted = (p.feature_nav_item_ids || []).length > 0;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--outline)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--on-muted)' }}>{p.description || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                      {p.first_cycle_price_credits != null && p.first_cycle_price_credits !== p.monthly_price_credits ? (
                        <>₹{p.first_cycle_price_credits} first month<span style={{ fontWeight: 400, color: 'var(--on-muted)' }}> then ₹{p.monthly_price_credits}/mo</span></>
                      ) : (
                        <>₹{p.monthly_price_credits}/mo</>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, padding: '3px 8px',
                        background: isRestricted ? (isDark ? '#422006' : '#fef9c3') : (isDark ? '#064e3b' : '#dcfce7'),
                        color: isRestricted ? (isDark ? '#fde047' : '#a16207') : (isDark ? '#6ee7b7' : '#15803d'),
                      }}>
                        {isRestricted ? `${p.feature_nav_item_ids.length} feature${p.feature_nav_item_ids.length === 1 ? '' : 's'}` : 'Full Access'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--on-muted)', maxWidth: 220 }}>
                      {p.included_features?.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {p.included_features.slice(0, 3).map((f, i) => (
                            <li key={i} style={{ fontSize: 11.5 }}>{f}</li>
                          ))}
                          {p.included_features.length > 3 && <li style={{ fontSize: 11.5 }}>+{p.included_features.length - 3} more</li>}
                        </ul>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{p._count?.subscriptions || 0}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--on-muted)' }}>{p.sort_order}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => handleToggleActive(p)}
                        style={{
                          background: p.is_active ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#334155' : '#f1f5f9'),
                          color: p.is_active ? (isDark ? '#6ee7b7' : '#15803d') : 'var(--on-muted)',
                          border: 'none', padding: '4px 10px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                        }}
                      >
                        {p.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} style={{ borderRadius: 0 }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)} style={{ borderRadius: 0 }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {plans.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--on-muted)' }}>No subscription plans yet — create one to let tenants subscribe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{editing?.id ? 'Edit Plan' : 'New Plan'}</h3>
              <button onClick={() => setEditing(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Plan Name</label>
                <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard, Pro, Enterprise" />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Description</label>
                <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shown to tenants when choosing a plan" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Renewal Price (₹/mo)</label>
                  <input type="number" min="1" className="form-control" value={form.monthly_price_credits} onChange={(e) => setForm({ ...form, monthly_price_credits: e.target.value })} placeholder="200" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Display Order</label>
                  <input type="number" className="form-control" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="0" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>First-Cycle (Intro) Price (₹) — optional</label>
                <input type="number" min="1" className="form-control" value={form.first_cycle_price_credits} onChange={(e) => setForm({ ...form, first_cycle_price_credits: e.target.value })} placeholder="Leave blank to charge the renewal price from day one" />
                <p style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6, marginBottom: 0 }}>
                  Discounted price for a first-time subscriber's very first month only. From the second month, they're automatically billed the renewal price above — no action needed from them or you. Never applied when switching an already-subscribed tenant onto this plan.
                </p>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Status</label>
                <select className="form-control" value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}>
                  <option value="1">Active — selectable by tenants</option>
                  <option value="0">Inactive — hidden from new subscribes/upgrades</option>
                </select>
              </div>

              {editing?.id && (
                <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: 0 }}>
                  Changing the price only affects new subscribes and upgrades — tenants already on this plan keep paying their existing rate until they upgrade.
                </p>
              )}

              {/* ─── Feature access — same mechanism as the Free plan's sidebar restriction ─── */}
              <div style={{ borderTop: '1px solid var(--outline)', paddingTop: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Feature Access
                </label>
                <div style={{ display: 'flex', gap: 20, marginBottom: restrictFeatures ? 10 : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <input type="radio" checked={!restrictFeatures} onChange={() => setRestrictFeatures(false)} />
                    Full Access — every feature their role allows
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <input type="radio" checked={restrictFeatures} onChange={() => setRestrictFeatures(true)} />
                    Limited — pick allowed sidebar features
                  </label>
                </div>
                {restrictFeatures && (
                  <>
                    <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 8px' }}>
                      Everything unchecked disappears from a subscriber's sidebar — same mechanism used to restrict the Free plan, just scoped to this plan instead of everyone.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                      {GATABLE_NAV_ITEMS.map((item) => {
                        const checked = form.feature_nav_item_ids.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                              background: 'var(--bg)', border: '1px solid var(--outline)', cursor: 'pointer',
                              fontSize: 12, fontWeight: 600, color: 'var(--on-surface)',
                            }}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleFeatureNavItem(item.id)} />
                            {item.label}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* ─── What's included — marketing bullets shown on the plan's card ─── */}
              <div style={{ borderTop: '1px solid var(--outline)', paddingTop: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  What's Included
                </label>
                <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '0 0 8px' }}>
                  Bullet points shown on this plan's card so a tenant can see what makes it different — purely descriptive, doesn't affect access on its own.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {form.included_features.map((feature, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GripVertical size={13} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                      <input
                        className="form-control"
                        value={feature}
                        onChange={(e) => updateIncludedFeature(idx, e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => removeIncludedFeature(idx)}
                        className="btn btn-ghost btn-icon"
                        style={{ color: 'var(--error)', flexShrink: 0 }}
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="form-control"
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIncludedFeature(); } }}
                    placeholder="e.g. Unlimited GST pulls"
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={addIncludedFeature} className="btn btn-secondary btn-sm" style={{ borderRadius: 0, whiteSpace: 'nowrap' }}>
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--outline)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)} style={{ borderRadius: 0 }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ borderRadius: 0 }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptionPlansPage;
