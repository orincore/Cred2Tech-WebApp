import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Tag, Plus, X, Save, History, Trash2 } from 'lucide-react';
import api from '../api/axiosInstance';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useTheme } from '../context/ThemeContext';

const PRODUCT_LABELS = {
  DIRECT_MSME_ELIGIBILITY: 'Direct MSME Eligibility Fee',
  VIRTUAL_WORKSPACE_SUBSCRIPTION: 'Virtual Workspace Subscription',
  WALLET_TOPUP: 'Wallet Recharge (Buy Credits)',
};

// CASHBACK/FREEBIE only make sense against a wallet-credit purchase (there's
// no "credits granted" concept for a one-time fee or a subscription) — the
// backend enforces this too (admin.promoCode.controller.js), this just
// keeps the form from ever offering an invalid combination in the first
// place.
const WALLET_ONLY_BENEFIT_TYPES = ['CASHBACK', 'FREEBIE'];
const BENEFIT_TYPE_LABELS = {
  DISCOUNT: 'Discount — reduces the price paid',
  CASHBACK: 'Cashback — bonus credits on top of a real recharge',
  FREEBIE: 'Freebie — fixed free credits, no payment needed',
};

const EMPTY_FORM = {
  code: '',
  description: '',
  benefit_type: 'DISCOUNT',
  discount_type: 'PERCENTAGE',
  discount_value: '',
  max_discount_amount: '',
  applicable_products: [],
  duration_type: 'ONCE',
  duration_cycles: '',
  min_order_amount: '',
  max_redemptions: '',
  max_redemptions_per_user: '1',
  valid_from: '',
  valid_until: '',
  is_active: true,
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN') : '—';

const BENEFIT_BADGE_COLOR = {
  DISCOUNT: { bg: '#e0e7ff', fg: '#4338ca', bgDark: '#312e81', fgDark: '#c7d2fe' },
  CASHBACK: { bg: '#dcfce7', fg: '#15803d', bgDark: '#064e3b', fgDark: '#6ee7b7' },
  FREEBIE: { bg: '#fef3c7', fg: '#b45309', bgDark: '#451a03', fgDark: '#fcd34d' },
};

// "20% off" / "10% cashback (cap 500 credits)" / "₹100 free credits" — the
// same discount_type/discount_value/max_discount_amount fields mean a
// different thing depending on benefit_type (see promoCode.service.js).
const formatBenefit = (c) => {
  const value = c.discount_type === 'PERCENTAGE' ? `${c.discount_value}%` : `₹${c.discount_value}`;
  if (c.benefit_type === 'FREEBIE') return `₹${c.discount_value} free credits`;
  if (c.benefit_type === 'CASHBACK') return `${value} cashback${c.max_discount_amount ? ` (cap ${c.max_discount_amount} credits)` : ''}`;
  return `${value}${c.discount_type === 'PERCENTAGE' && c.max_discount_amount ? ` (cap ₹${c.max_discount_amount})` : ''} off`;
};

const STATUS_COLOR = { CONFIRMED: { bg: '#dcfce7', fg: '#15803d', bgDark: '#064e3b', fgDark: '#6ee7b7' }, PENDING: { bg: '#fef9c3', fg: '#a16207', bgDark: '#422006', fgDark: '#fde047' }, CANCELLED: { bg: '#f1f5f9', fg: '#64748b', bgDark: '#334155', fgDark: '#94a3b8' } };

const AdminPromoCodesPage = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState('codes'); // 'codes' | 'usage'
  const [codes, setCodes] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // null = closed, {} = create, {...} = edit
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { fetchCodes(); }, []);
  useEffect(() => { if (tab === 'usage' && redemptions.length === 0) fetchRedemptions(); }, [tab]);

  const fetchRedemptions = async () => {
    setLoadingUsage(true);
    try {
      const res = await api.get('/admin/promo-codes/redemptions');
      setRedemptions(res.data.redemptions || []);
    } catch (err) {
      toast.error('Failed to load promo code usage');
    } finally {
      setLoadingUsage(false);
    }
  };

  const fetchCodes = async () => {
    try {
      const res = await api.get('/admin/promo-codes');
      setCodes(res.data.promo_codes || []);
    } catch (err) {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditing({}); };
  const openEdit = (code) => {
    setForm({
      code: code.code,
      description: code.description || '',
      benefit_type: code.benefit_type || 'DISCOUNT',
      discount_type: code.discount_type,
      discount_value: String(code.discount_value),
      max_discount_amount: code.max_discount_amount != null ? String(code.max_discount_amount) : '',
      applicable_products: code.applicable_products,
      duration_type: code.duration_type,
      duration_cycles: code.duration_cycles != null ? String(code.duration_cycles) : '',
      min_order_amount: code.min_order_amount != null ? String(code.min_order_amount) : '',
      max_redemptions: code.max_redemptions != null ? String(code.max_redemptions) : '',
      max_redemptions_per_user: code.max_redemptions_per_user != null ? String(code.max_redemptions_per_user) : '',
      valid_from: code.valid_from ? code.valid_from.slice(0, 10) : '',
      valid_until: code.valid_until ? code.valid_until.slice(0, 10) : '',
      is_active: code.is_active,
    });
    setEditing(code);
  };

  const toggleProduct = (p) => {
    setForm((f) => ({
      ...f,
      applicable_products: f.applicable_products.includes(p)
        ? f.applicable_products.filter((x) => x !== p)
        : [...f.applicable_products, p],
    }));
  };

  // Switching TO a wallet-only benefit type locks applicable_products down
  // to just Wallet Recharge (a CASHBACK/FREEBIE code combined with the MSME
  // fee or a subscription is rejected server-side anyway — this just keeps
  // the form from ever showing that invalid combination). Switching to
  // FREEBIE also forces discount_type to FLAT — there's no "percentage of
  // the purchase" for a code with no purchase.
  const handleBenefitTypeChange = (benefit_type) => {
    setForm((f) => ({
      ...f,
      benefit_type,
      applicable_products: WALLET_ONLY_BENEFIT_TYPES.includes(benefit_type) ? ['WALLET_TOPUP'] : f.applicable_products,
      discount_type: benefit_type === 'FREEBIE' ? 'FLAT' : f.discount_type,
    }));
  };

  const handleSave = async () => {
    if (!form.code.trim()) return toast.error('Code is required');
    if (!form.discount_value) return toast.error(form.benefit_type === 'FREEBIE' ? 'Free credits amount is required' : 'Discount value is required');
    if (form.applicable_products.length === 0) return toast.error('Select at least one applicable product');
    if (WALLET_ONLY_BENEFIT_TYPES.includes(form.benefit_type)
      && (form.applicable_products.length !== 1 || form.applicable_products[0] !== 'WALLET_TOPUP')) {
      return toast.error(`A ${form.benefit_type} code can only apply to Wallet Recharge`);
    }

    const payload = {
      ...form,
      discount_value: parseFloat(form.discount_value),
      max_discount_amount: form.max_discount_amount ? parseInt(form.max_discount_amount, 10) : null,
      duration_cycles: form.duration_cycles ? parseInt(form.duration_cycles, 10) : null,
      min_order_amount: form.min_order_amount ? parseInt(form.min_order_amount, 10) : null,
      max_redemptions: form.max_redemptions ? parseInt(form.max_redemptions, 10) : null,
      max_redemptions_per_user: form.max_redemptions_per_user ? parseInt(form.max_redemptions_per_user, 10) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    };

    setSaving(true);
    try {
      if (editing?.id) {
        await api.put(`/admin/promo-codes/${editing.id}`, payload);
        toast.success('Promo code updated');
      } else {
        await api.post('/admin/promo-codes', payload);
        toast.success('Promo code created');
      }
      setEditing(null);
      await fetchCodes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save promo code');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (code) => {
    try {
      await api.patch(`/admin/promo-codes/${code.id}/toggle`, { is_active: !code.is_active });
      await fetchCodes();
    } catch (err) {
      toast.error('Failed to toggle promo code');
    }
  };

  const handleDelete = async (code) => {
    if (!confirm(`Are you sure you want to delete promo code "${code.code}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/promo-codes/${code.id}`);
      await fetchCodes();
      toast.success('Promo code deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete promo code');
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
          <Tag size={18} color="var(--primary)" />
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>Promo Codes</h1>
            <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>Discount codes for Direct MSME and Virtual Workspace</p>
          </div>
        </div>
        {tab === 'codes' && (
          <button className="btn btn-primary btn-sm" onClick={openCreate} style={{ borderRadius: 0 }}>
            <Plus size={14} /> New Promo Code
          </button>
        )}
      </div>

      <div style={{ padding: '10px 20px 0', borderBottom: '1px solid var(--outline)', background: 'var(--bg)', display: 'flex', gap: 4 }}>
        {[{ id: 'codes', label: 'Codes', icon: Tag }, { id: 'usage', label: 'Usage', icon: History }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--on-muted)',
            }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {tab === 'usage' ? (
          loadingUsage ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--outline)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                    {['Code', 'Used By', 'Purpose', 'Discount', 'Status', 'When'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r) => {
                    const sc = STATUS_COLOR[r.status] || STATUS_COLOR.PENDING;
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--outline)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.promo_code?.code}</td>
                        <td style={{ padding: '10px 12px' }}>{r.tenant_name || r.user_name || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>{PRODUCT_LABELS[r.product] || r.product}</td>
                        <td style={{ padding: '10px 12px' }}>₹{r.discount_amount}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 9px', fontSize: 10.5, fontWeight: 800,
                            background: isDark ? sc.bgDark : sc.bg, color: isDark ? sc.fgDark : sc.fg,
                          }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--on-muted)' }}>{fmtDateTime(r.confirmed_at || r.created_at)}</td>
                      </tr>
                    );
                  })}
                  {redemptions.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--on-muted)' }}>No promo code usage yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--outline)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                {['Code', 'Type', 'Benefit', 'Products', 'Redemptions', 'Valid', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const benefitType = c.benefit_type || 'DISCOUNT';
                const bc = BENEFIT_BADGE_COLOR[benefitType];
                return (
                <tr key={c.id} style={{ borderTop: '1px solid var(--outline)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{c.code}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '3px 9px', fontSize: 10.5, fontWeight: 800, background: isDark ? bc.bgDark : bc.bg, color: isDark ? bc.fgDark : bc.fg }}>
                      {benefitType}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{formatBenefit(c)}</td>
                  <td style={{ padding: '10px 12px' }}>{c.applicable_products.map((p) => PRODUCT_LABELS[p] || p).join(', ')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {c._count?.redemptions || 0}{c.max_redemptions != null ? ` / ${c.max_redemptions}` : ''}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--on-muted)' }}>{fmtDate(c.valid_from)} — {c.valid_until ? fmtDate(c.valid_until) : 'no end'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => handleToggleActive(c)}
                      style={{
                        background: c.is_active ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#334155' : '#f1f5f9'),
                        color: c.is_active ? (isDark ? '#6ee7b7' : '#15803d') : 'var(--on-muted)',
                        border: 'none', padding: '4px 10px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                      }}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} style={{ borderRadius: 0 }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)} style={{ borderRadius: 0 }}>Delete</button>
                  </td>
                </tr>
                );
              })}
              {codes.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--on-muted)' }}>No promo codes yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {editing !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{editing?.id ? 'Edit Promo Code' : 'New Promo Code'}</h3>
              <button onClick={() => setEditing(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Code</label>
                  <input className="form-control" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={!!editing?.id} placeholder="SAVE20" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Active</label>
                  <select className="form-control" value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Description</label>
                <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Internal note — not shown to customers" />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Benefit Type</label>
                <select className="form-control" value={form.benefit_type} onChange={(e) => handleBenefitTypeChange(e.target.value)}>
                  {Object.entries(BENEFIT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Applicable Products</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  {Object.entries(PRODUCT_LABELS).map(([key, label]) => {
                    const walletOnly = WALLET_ONLY_BENEFIT_TYPES.includes(form.benefit_type);
                    const disabled = walletOnly && key !== 'WALLET_TOPUP';
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, opacity: disabled ? 0.4 : 1 }}>
                        <input type="checkbox" checked={form.applicable_products.includes(key)} onChange={() => toggleProduct(key)} disabled={disabled} />
                        {label}
                      </label>
                    );
                  })}
                </div>
                {WALLET_ONLY_BENEFIT_TYPES.includes(form.benefit_type) && (
                  <p style={{ fontSize: 10.5, color: 'var(--on-muted)', marginTop: 6 }}>{form.benefit_type} codes only ever apply to Wallet Recharge — there's no "credits granted" concept for a one-time fee or a subscription.</p>
                )}
              </div>

              {form.benefit_type === 'FREEBIE' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Free Credits Amount (₹)</label>
                    <input type="number" className="form-control" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder="e.g. 100" />
                    <p style={{ fontSize: 10.5, color: 'var(--on-muted)', marginTop: 4 }}>A fixed number of credits, granted directly to the wallet — never a percentage, never influenced by anything the DSA enters.</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>{form.benefit_type === 'CASHBACK' ? 'Bonus Type' : 'Discount Type'}</label>
                    <select className="form-control" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FLAT">Flat (₹ / credits)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>{form.benefit_type === 'CASHBACK' ? 'Bonus Value' : 'Value'}</label>
                    <input type="number" className="form-control" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'PERCENTAGE' ? '20' : '100'} />
                  </div>
                  {form.discount_type === 'PERCENTAGE' && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>{form.benefit_type === 'CASHBACK' ? 'Max Bonus Credits' : 'Max Discount (₹)'}</label>
                      <input type="number" className="form-control" value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} placeholder="Optional cap" />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Duration (subscriptions only)</label>
                  <select className="form-control" value={form.duration_type} onChange={(e) => setForm({ ...form, duration_type: e.target.value })}>
                    <option value="ONCE">First charge only</option>
                    <option value="RECURRING_N">N cycles, then full price</option>
                    <option value="RECURRING_FOREVER">Every cycle, forever</option>
                  </select>
                </div>
                {form.duration_type === 'RECURRING_N' && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Cycles</label>
                    <input type="number" className="form-control" value={form.duration_cycles} onChange={(e) => setForm({ ...form, duration_cycles: e.target.value })} placeholder="3" />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: form.benefit_type === 'FREEBIE' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
                {form.benefit_type !== 'FREEBIE' && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Min Order (₹)</label>
                    <input type="number" className="form-control" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} placeholder="Optional" />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Max Total Uses</label>
                  <input type="number" className="form-control" value={form.max_redemptions} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} placeholder="Unlimited" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Max Per User</label>
                  <input type="number" className="form-control" value={form.max_redemptions_per_user} onChange={(e) => setForm({ ...form, max_redemptions_per_user: e.target.value })} placeholder="1" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Valid From</label>
                  <input type="date" className="form-control" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase' }}>Valid Until</label>
                  <input type="date" className="form-control" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
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

export default AdminPromoCodesPage;
