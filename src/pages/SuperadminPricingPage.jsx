import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Settings, Save, Smartphone, DollarSign, PieChart, Building2, Plus, Trash2, Info, ChevronRight, ChevronDown, CheckCircle2, Search, Edit, ShieldAlert } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import api from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext';
import DataTable from '../components/DataTable';
import { NAV_ITEMS } from '../constants/navItems';

// The nav items Virtual Workspace can actually gate — DSA-role items only
// (SUPER_ADMIN/CRED2TECH_MEMBER nav is never affected by a tenant's VW flag,
// see Sidebar.jsx). Pulled from the single source of truth in navItems.js
// rather than duplicated here, so a newly added DSA nav item shows up in
// this editor automatically.
const DSA_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];
const GATABLE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.roles?.some((r) => DSA_ROLES.includes(r)));

// Responsive hook
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile, isTablet };
};

// Not using the shared `.card` class here — it's still rounded
// (`var(--radius-lg)`), and every stat/list surface on this page (and the
// pricing table/cards below) has already moved to sharp borders (`radius: 0`)
// this session. Inline styles keep this one consistent with that, and let the
// icon swatch's own corner follow the same rule.
const StatCard = ({ icon: Icon, value, label, color, isMobile }) => (
  <div style={{
    background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0,
    padding: isMobile ? '10px' : '8px 12px',
    display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
  }}>
    {/* Swatch background used to be `${color}10` — a Tailwind-style alpha
        suffix, invalid as a raw CSS color and silently ignored by the
        browser (same bug class as the pincode spinner border on
        CreateTenantPage). A neutral swatch + the real per-stat color on just
        the icon glyph keeps each card visually distinct without relying on
        that. */}
    <div style={{
      width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: 0, flexShrink: 0,
      background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color,
    }}>
      <Icon size={isMobile ? 14 : 16} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
      <p style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{label}</p>
    </div>
  </div>
);

// Same footprint as StatCard (no extra header row added) but doubles as the
// live editor for the Direct MSME eligibility fee — click the value to swap
// it for a rupee input in place, so admins can update the real payment-gate
// price without a separate section eating vertical space.
const MsmeStatCard = ({ msmePricing, isMobile, isEditing, draft, setDraft, onStartEdit, onCancel, onSave, saving }) => (
  <div
    onClick={!isEditing ? onStartEdit : undefined}
    style={{
      background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0,
      padding: isMobile ? '10px' : '8px 12px',
      display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
      cursor: isEditing ? 'default' : 'pointer',
    }}
  >
    <div style={{
      width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: 0, flexShrink: 0,
      background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#7C3AED',
    }}>
      <Building2 size={isMobile ? 14 : 16} />
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>₹</span>
          <input
            type="number"
            min="1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            style={{ width: 56, fontSize: 13, fontWeight: 800, border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--surface)', color: 'var(--on-surface)', padding: '2px 4px', outline: 'none' }}
          />
          <button onClick={onSave} disabled={saving} style={{ background: 'var(--primary)', border: 'none', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 6px', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? '…' : 'Save'}</button>
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid var(--outline)', color: 'var(--on-surface)', fontSize: 10, fontWeight: 700, padding: '3px 6px', cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {msmePricing ? `₹${(msmePricing.default_credit_cost / 100).toFixed(0)}` : '—'}
          </p>
          <p style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
            Direct MSME · tap to edit
          </p>
        </>
      )}
    </div>
  </div>
);

const SuperadminPricingPage = () => {
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [pricing, setPricing] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  // Info bar is collapsed by default on mobile — same reasoning as the
  // Role/Status/Level filter collapse on /users: nice-to-have context
  // shouldn't cost permanent screen space on a small viewport. Desktop
  // always shows it expanded, unaffected by this state.
  const [showInfo, setShowInfo] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [msmeEditing, setMsmeEditing] = useState(false);
  const [msmeDraft, setMsmeDraft] = useState('');
  const [freeNavItemIds, setFreeNavItemIds] = useState([]);
  const [freeUntil, setFreeUntil] = useState(''); // yyyy-mm-dd, for the date input
  const [tab, setTab] = useState('pricing'); // 'pricing' | 'discounts' | 'workspace'
  const [savingFreeTabs, setSavingFreeTabs] = useState(false);
  const [savingFreeUntil, setSavingFreeUntil] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pricingRes, vwRes] = await Promise.all([
        api.get(`/admin/wallet/api-pricing`),
        api.get(`/admin/wallet/virtual-workspace-config`),
      ]);
      setPricing(pricingRes.data.pricing || []);
      setDiscounts(pricingRes.data.discounts || []);
      setFreeNavItemIds(vwRes.data.free_nav_item_ids || []);
      setFreeUntil(vwRes.data.free_until ? vwRes.data.free_until.slice(0, 10) : '');
    } catch (err) {
      toast.error('Failed to load pricing configurations');
    } finally {
      setLoading(false);
    }
  };

  const toggleFreeNavItem = (itemId) => {
    setFreeNavItemIds((prev) => (
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    ));
  };

  const handleSaveFreeTabs = async () => {
    setSavingFreeTabs(true);
    try {
      await api.put(`/admin/wallet/virtual-workspace-config`, { free_nav_item_ids: freeNavItemIds });
      toast.success('Virtual Workspace free tabs updated');
    } catch (err) {
      toast.error('Failed to save Virtual Workspace config');
    } finally {
      setSavingFreeTabs(false);
    }
  };

  // Saving a later free_until retroactively extends every subscription
  // already in flight (server-side batch job — see admin.wallet.controller
  // .js#updateVirtualWorkspaceConfig), not just future subscribers.
  const handleSaveFreeUntil = async () => {
    setSavingFreeUntil(true);
    try {
      await api.put(`/admin/wallet/virtual-workspace-config`, { free_until: freeUntil || null });
      toast.success(freeUntil ? `Virtual Workspace is now free until ${freeUntil} — existing subscriptions are being extended to match` : 'Free period cleared — Virtual Workspace billing applies immediately for new/renewing subscriptions');
    } catch (err) {
      toast.error('Failed to save the free-until date');
    } finally {
      setSavingFreeUntil(false);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({ ...p });
  };

  const handleSavePricing = async (id) => {
    setSaving(true);
    try {
      await api.patch(`/admin/wallet/api-pricing/${id}`, {
        api_name: editForm.api_name,
        description: editForm.description,
        vendor_cost: editForm.vendor_cost,
        credit_cost: editForm.default_credit_cost,
        is_active: editForm.is_active
      });
      toast.success('Pricing updated successfully');
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // The MSME self-service portal's payment gate (GET /msme/payment/config,
  // called by MsmePaymentGate.jsx before an eligibility check) reads this
  // exact row live on every request — no caching, no redeploy — so editing
  // it here through the same PATCH the API rate card already uses is
  // sufficient to change the real charged amount immediately. Its
  // default_credit_cost is stored in paise (Razorpay order amount), unlike
  // every other row here which stores rupees directly — pulling it into its
  // own card with a rupee-denominated input avoids an admin seeing "99900"
  // in a raw number field and misreading it as ₹99,900.
  const startMsmeEdit = () => {
    setMsmeDraft(msmePricing ? String(Math.round(msmePricing.default_credit_cost / 100)) : '');
    setMsmeEditing(true);
  };

  const handleSaveMsmePrice = async () => {
    if (!msmePricing) return;
    const inr = parseFloat(msmeDraft);
    if (!Number.isFinite(inr) || inr <= 0) {
      toast.error('Enter a valid amount greater than 0');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/admin/wallet/api-pricing/${msmePricing.id}`, {
        api_name: msmePricing.api_name,
        description: msmePricing.description,
        vendor_cost: msmePricing.vendor_cost,
        credit_cost: Math.round(inr * 100),
        is_active: msmePricing.is_active,
      });
      toast.success('Direct MSME eligibility price updated');
      setMsmeEditing(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlab = () => {
    const maxSlab = discounts.length > 0 ? Math.max(...discounts.map(d => d.min_topup_amount)) : 0;
    const newSlab = { id: Date.now(), min_topup_amount: maxSlab + 5000, bonus_percentage: 5, is_new: true };
    setDiscounts([...discounts, newSlab]);
  };

  const handleRemoveSlab = (id) => {
    setDiscounts(discounts.filter(d => d.id !== id));
  };

  const handleSlabChange = (id, field, value) => {
    setDiscounts(discounts.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleSaveDiscounts = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/wallet/volume-discounts`, { slabs: discounts });
      toast.success('Volume discounts updated');
      fetchData();
    } catch (err) {
      toast.error('Failed to save discounts');
    } finally {
      setSaving(false);
    }
  };

  // Split out the one-time Direct MSME eligibility fee — it's stored in
  // paise (a Razorpay order amount) while every other row here is a small
  // per-API-call rate stored directly in rupees. Averaging it in with the
  // rest (as the "Avg. Rate / Call" stat used to) let one 99900 value
  // dwarf a set of ~2-20 rupee values into a meaningless number, and it
  // isn't a per-call rate to begin with. It gets its own dedicated,
  // clearly-labeled card below instead of living inside the generic table.
  const msmePricing = useMemo(() => pricing.find(p => p.api_code === 'DIRECT_MSME_ELIGIBILITY'), [pricing]);
  const apiPricingRows = useMemo(() => pricing.filter(p => p.api_code !== 'DIRECT_MSME_ELIGIBILITY'), [pricing]);

  const stats = useMemo(() => {
    const live = apiPricingRows.filter(p => p.is_active).length;
    const avgRate = apiPricingRows.reduce((acc, curr) => acc + curr.default_credit_cost, 0) / (apiPricingRows.length || 1);
    const avgMargin = apiPricingRows.reduce((acc, curr) => {
        const margin = curr.default_credit_cost - curr.vendor_cost;
        return acc + (margin / (curr.default_credit_cost || 1));
    }, 0) / (apiPricingRows.length || 1) * 100;

    return { live, avgRate, avgMargin };
  }, [apiPricingRows]);

  const filtered = useMemo(() => {
    return apiPricingRows.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.api_name?.toLowerCase().includes(q) ||
        p.api_code?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [apiPricingRows, search]);

  /* ---- label style shared across filters ---- */
  const labelSm = { fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
  const underlineInput = (active) => ({
    background: 'transparent', border: 'none',
    borderBottom: `2px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
    outline: 'none', width: '100%', padding: '6px 0',
    fontSize: 13, fontWeight: 600, color: 'var(--on-surface)',
    transition: 'border-color 0.2s',
  });

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      {/* ─── Top header ─── */}
      {/* Mobile: same minimal-header treatment as /users — 68px top
          clearance (verified against AppLayout's actual 60px fixed topbar,
          not the old blanket 80px every page used), smaller title/subtitle,
          tighter padding. Desktop untouched. */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '68px 16px 8px' : '14px 20px 10px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 17 : 19, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            API Pricing & Credit Rules
          </h1>
          <p style={{ margin: isMobile ? '2px 0 0' : '2px 0 0', fontSize: isMobile ? 11 : 12, color: 'var(--on-muted)' }}>
            DSA charges & discount tiers
          </p>
        </div>
      </div>

      {/* ─── Info bar + Stats cards ───
          One collapsible section on mobile, not two: the toggle now reveals
          both the full explanation AND the stat cards together, collapsed by
          default. Desktop shows both always-expanded, unchanged — no toggle
          rendered there at all. */}
      {isMobile ? (
        <div style={{ borderBottom: '2px solid var(--outline)', background: 'var(--surface)', flexShrink: 0 }}>
          <button
            onClick={() => setShowInfo(v => !v)}
            style={{
              width: '100%', padding: '6px 16px', background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <ShieldAlert size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 11, color: 'var(--on-surface)', fontWeight: 700 }}>Super Admin only</span>
            <ChevronDown
              size={14}
              color="var(--on-muted)"
              style={{ flexShrink: 0, transition: 'transform 0.15s', transform: showInfo ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {showInfo && (
            <div style={{ padding: '0 16px 10px' }}>
              <p style={{ margin: '0 0 10px 26px', fontSize: 11, color: 'var(--on-muted)', fontWeight: 500 }}>
                <strong style={{ color: 'var(--on-surface)' }}>Super Admin only.</strong> Changes to pricing affect all DSA wallets immediately. Volume discounts apply at top-up time.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <StatCard icon={Smartphone} value={stats.live} label="API Types Live" color="#4F46E5" isMobile />
                <StatCard icon={DollarSign} value={`₹${stats.avgRate.toFixed(1)}`} label="Avg. Rate / Call" color="#059669" isMobile />
                <StatCard icon={PieChart} value={`${stats.avgMargin.toFixed(1)}%`} label="Avg. Gross Margin" color="#D97706" isMobile />
                <MsmeStatCard
                  msmePricing={msmePricing} isMobile
                  isEditing={msmeEditing} draft={msmeDraft} setDraft={setMsmeDraft}
                  onStartEdit={startMsmeEdit} onCancel={() => setMsmeEditing(false)} onSave={handleSaveMsmePrice} saving={saving}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--outline)', padding: '5px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <ShieldAlert size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 11, color: 'var(--on-muted)', fontWeight: 500 }}>
              <strong style={{ color: 'var(--on-surface)' }}>Super Admin only.</strong> Changes to pricing affect all DSA wallets immediately. Volume discounts apply at top-up time.
            </p>
          </div>

          {/* ─── Stats cards ─── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 8, padding: '8px 20px', background: 'var(--bg)', flexShrink: 0,
          }}>
            <StatCard icon={Smartphone} value={stats.live} label="API Types Live" color="#4F46E5" />
            <StatCard icon={DollarSign} value={`₹${stats.avgRate.toFixed(1)}`} label="Avg. Rate / Call" color="#059669" />
            <StatCard icon={PieChart} value={`${stats.avgMargin.toFixed(1)}%`} label="Avg. Gross Margin" color="#D97706" />
            <MsmeStatCard
              msmePricing={msmePricing}
              isEditing={msmeEditing} draft={msmeDraft} setDraft={setMsmeDraft}
              onStartEdit={startMsmeEdit} onCancel={() => setMsmeEditing(false)} onSave={handleSaveMsmePrice} saving={saving}
            />
          </div>
        </>
      )}

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '8px 16px' : '10px 20px', display: 'flex', gap: isMobile ? 12 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ flex: 2, minWidth: 200, maxWidth: 360 }}>
          <span style={labelSm}>Search</span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 0, bottom: 9, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="API name, code or description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
              onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
              onBlur={e => e.target.style.borderBottomColor = '#e2e8f0'}
            />
          </div>
        </div>
      </div>

      {/* ─── Section tabs — keeps the page short: only one of API Pricing /
          Volume Discounts / Virtual Workspace renders at a time instead of
          one long stacked scroll. ─── */}
      <div style={{ padding: '0 20px', borderBottom: '1px solid var(--outline)', background: 'var(--bg)', display: 'flex', gap: 4, flexShrink: 0, overflowX: 'auto' }}>
        {[
          { id: 'pricing', label: 'API Pricing' },
          { id: 'discounts', label: 'Volume Discounts' },
          { id: 'workspace', label: 'Virtual Workspace' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              whiteSpace: 'nowrap', padding: '10px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--on-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Pricing table + Volume Discounts — ONE scrolling region ───
          The outer page shell is overflow:hidden with exactly one flex:1
          child expected to hold everything below the filter row. Volume
          Package Discounts renders after the table and has real content of
          its own (unlike the other admin list pages, which end at their
          table/card list) — if only the table got flex:1/overflow:auto while
          Discounts stayed a plain block, the two competed for space under a
          fixed-height shell: the table got squeezed toward zero height and
          Discounts had nowhere to scroll, so it was clipped outright. Wrapping
          both in one scrollable region fixes both at once. */}
      {/* Deliberately plain block flow (no display:flex here) — DataTable's own
          root div hardcodes `flex: 1`, which is only meaningful when its
          parent is itself a flex container. Making this wrapper a flex column
          would turn that into a real flex item competing for space against
          the Volume Discounts block below it, reintroducing the exact
          collapse this wrapper exists to fix. Block flow just stacks
          Sub-header → table/cards → Discounts at their natural heights, and
          overflowY:auto scrolls the stack as a whole once it doesn't fit. */}
      <div style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
        {tab === 'pricing' && (
        <>
        {/* Sub-header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>API Rate Card — DSA Pricing</span>
          <span style={{ fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>{filtered.length} APIs</span>
        </div>

        {/* Mobile: card list instead of a table — same reasoning as the other
            admin list pages. Each card supports the same inline edit the
            desktop table's row already does: tap Edit, the read-only fields
            swap for inputs, Save/Cancel replace the Edit button. */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
            {filtered.map((p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              const margin = current.default_credit_cost - current.vendor_cost;
              const marginPct = (margin / (current.default_credit_cost || 1)) * 100;
              return (
                <div
                  key={p.id}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0, padding: 14 }}
                >
                  {/* Identity row: API service name + code on the left, status pill anchored right */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.api_name || p.api_code}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--on-muted)', fontFamily: 'monospace' }}>{p.api_code}</div>
                    </div>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      fontSize: 11, fontWeight: 700, color: p.is_active ? 'var(--success)' : 'var(--error)',
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.is_active ? 'var(--success)' : 'var(--error)' }} />
                      {p.is_active ? 'Live' : 'Disabled'}
                    </span>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--outline)' }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Description</div>
                        <input
                          className="form-control form-control-sm"
                          value={editForm.description || ''}
                          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                          style={{ fontSize: 13, width: '100%' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Vendor Cost (₹)</div>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={editForm.vendor_cost}
                            onChange={e => setEditForm({ ...editForm, vendor_cost: parseFloat(e.target.value) })}
                            style={{ fontSize: 13, width: '100%' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>C2T Rate (₹)</div>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={editForm.default_credit_cost}
                            onChange={e => setEditForm({ ...editForm, default_credit_cost: parseInt(e.target.value) || 0 })}
                            style={{ fontSize: 13, width: '100%', fontWeight: 700, borderBottomColor: 'var(--primary)' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ flex: 1, padding: '8px 0', background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0, fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSavePricing(p.id)}
                          disabled={saving}
                          style={{ flex: 1, padding: '8px 0', background: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 0, fontSize: 12, fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {p.description && (
                        <div style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 8 }}>{p.description}</div>
                      )}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                        marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--outline)',
                      }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Vendor Cost</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>₹{(p.vendor_cost ?? 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>C2T Rate</div>
                          <div style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 0, fontWeight: 700, fontSize: 13, display: 'inline-block', color: 'var(--on-surface)' }}>
                            ₹{(p.default_credit_cost ?? 0).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Margin</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>₹{margin.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Margin %</div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: 0, display: 'inline-block' }}>
                            {marginPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => startEdit(p)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          width: '100%', marginTop: 12, padding: '8px 0',
                          background: 'transparent', border: '1px solid var(--outline)', borderRadius: 0,
                          fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', cursor: 'pointer',
                        }}
                      >
                        <Edit size={12} /> Edit
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
        <DataTable
          columns={[
            { key: 'api_name', label: 'API Service', align: 'center', render: (p, idx) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface)' }}>{p.api_name || p.api_code}</span>
                <span style={{ fontSize: 10, color: 'var(--on-muted)', fontFamily: 'monospace' }}>{p.api_code}</span>
              </div>
            )},
            { key: 'description', label: 'Description', align: 'center', render: (p) => {
              const isEditing = editingId === p.id;
              return isEditing ? (
                <input
                  className="form-control form-control-sm"
                  value={editForm.description}
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  style={{ fontSize: 12 }}
                />
              ) : (
                p.description || '—'
              );
            }},
            { key: 'vendor_cost', label: 'Vendor Cost (₹)', align: 'center', render: (p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              return isEditing ? (
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={editForm.vendor_cost}
                  onChange={e => setEditForm({...editForm, vendor_cost: parseFloat(e.target.value)})}
                  style={{ width: 80, fontSize: 12 }}
                />
              ) : (
                `₹${(p.vendor_cost ?? 0).toFixed(2)}`
              );
            }},
            { key: 'default_credit_cost', label: 'C2T Rate (₹)', align: 'center', render: (p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              return isEditing ? (
                <input
                  type="number"
                  className="form-control"
                  value={editForm.default_credit_cost}
                  onChange={e => setEditForm({...editForm, default_credit_cost: parseInt(e.target.value) || 0})}
                  style={{ width: 100, fontWeight: 700, borderBottomColor: 'var(--primary)' }}
                />
              ) : (
                <div style={{ background: isDark ? '#1e293b' : '#F3F4F6', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, display: 'inline-block' }}>
                  {(p.default_credit_cost ?? 0).toFixed(2)}
                </div>
              );
            }},
            { key: 'margin', label: 'Margin (₹)', align: 'center', render: (p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              const margin = current.default_credit_cost - current.vendor_cost;
              return (
                <span style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>
                  ₹{margin.toFixed(2)}
                </span>
              );
            }},
            { key: 'margin_pct', label: 'Margin %', align: 'center', render: (p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              const margin = current.default_credit_cost - current.vendor_cost;
              const marginPct = (margin / (current.default_credit_cost || 1)) * 100;
              return (
                <span style={{ 
                  fontSize: 11, fontWeight: 700, color: '#059669',
                  background: isDark ? '#064e3b' : '#ECFDF5', padding: '2px 8px', borderRadius: '4px'
                }}>
                  {marginPct.toFixed(1)}%
                </span>
              );
            }},
            { key: 'is_active', label: 'Status', align: 'center', render: (p) => (
              <span style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, 
                fontSize: 11, fontWeight: 700, color: p.is_active ? '#10b981' : '#f43f5e' 
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.is_active ? '#10b981' : '#f43f5e' }} />
                {p.is_active ? 'Live' : 'Disabled'}
              </span>
            )},
            { key: 'action', label: 'Action', align: 'center', render: (p) => {
              const isEditing = editingId === p.id;
              return isEditing ? (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button 
                    className="btn btn-primary btn-xs" 
                    onClick={() => handleSavePricing(p.id)} 
                    disabled={saving}
                    style={{ fontSize: 11 }}
                  >
                    Save
                  </button>
                  <button 
                    className="btn btn-ghost btn-xs" 
                    onClick={() => setEditingId(null)}
                    style={{ fontSize: 11 }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  className="btn btn-outline btn-xs" 
                  onClick={() => startEdit(p)}
                  style={{ fontSize: 11 }}
                >
                  Edit
                </button>
              );
            }},
          ]}
          data={filtered}
          isMobile={isMobile}
          hoverRows={true}
        />
        )}
        </>
        )}

        {tab === 'discounts' && (
      /* ─── Volume Package Discounts ───
          Brought in line with the rest of the page: sharp borders instead of
          rounded (`radius: 8` -> 0), theme tokens instead of hardcoded
          isDark-ternary hex, and a stacked mobile layout for each slab
          instead of forcing a 4-column grid into a phone width — the same
          reasoning behind every other card conversion on this page. Each
          slab row previously used `<td>` elements as generic containers
          outside any `<table>`, which is invalid markup that happened to
          render via the browser's default table-cell styling colliding with
          the parent's `display: grid`; replaced with plain `<div>`s. */
      <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{
          padding: isMobile ? '10px 12px' : '16px 20px', borderBottom: '1px solid var(--outline)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          background: 'var(--bg-elevated)', borderRadius: 0, marginBottom: isMobile ? 10 : 16,
        }}>
          <div>
            <h3 style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Volume Package Discounts</h3>
            <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--on-muted)', margin: '4px 0 0 0' }}>Bonus wallet credits when DSA top-up crosses threshold</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ border: '1px solid var(--outline)', borderRadius: 0, fontSize: 11, color: 'var(--on-surface)' }}
              onClick={handleAddSlab}
            >
              <Plus size={14} /> Add Slab
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveDiscounts}
              disabled={saving}
              style={{ borderRadius: 0, fontSize: 11 }}
            >
              <Save size={14} /> Save
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: isMobile ? 8 : 12 }}>
            {discounts.map(d => (
                isMobile ? (
                  <div key={d.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--on-muted)', fontSize: 11 }}>₹</span>
                      <input
                        type="number"
                        className="form-control"
                        value={d.min_topup_amount}
                        onChange={e => handleSlabChange(d.id, 'min_topup_amount', parseFloat(e.target.value) || 0)}
                        style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--on-muted)', whiteSpace: 'nowrap' }}>and above</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        className="form-control"
                        value={d.bonus_percentage}
                        onChange={e => handleSlabChange(d.id, 'bonus_percentage', parseFloat(e.target.value) || 0)}
                        style={{ width: 60, textAlign: 'center', fontWeight: 700, fontSize: 13 }}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--on-surface)', fontSize: 13 }}>% bonus</span>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ marginLeft: 'auto', color: 'var(--error)' }}
                        onClick={() => handleRemoveSlab(d.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--on-muted)', paddingTop: 6, borderTop: '1px solid var(--outline)' }}>
                      Top up ₹{Number(d.min_topup_amount).toLocaleString()} → get ₹{Number(d.min_topup_amount * d.bonus_percentage / 100).toLocaleString()} bonus
                    </div>
                  </div>
                ) : (
                <div key={d.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--outline)',
                  borderRadius: 0,
                  alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--on-muted)', fontSize: 12 }}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={d.min_topup_amount}
                          onChange={e => handleSlabChange(d.id, 'min_topup_amount', parseFloat(e.target.value) || 0)}
                          style={{ width: 120, fontWeight: 600, fontSize: 13 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--on-muted)' }}>and above</span>
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="number"
                              className="form-control"
                              value={d.bonus_percentage}
                              onChange={e => handleSlabChange(d.id, 'bonus_percentage', parseFloat(e.target.value) || 0)}
                              style={{ width: 60, textAlign: 'center', fontWeight: 700, fontSize: 13 }}
                            />
                            <span style={{ fontWeight: 600, color: 'var(--on-surface)', fontSize: 13 }}>%</span>
                        </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>
                        Top up ₹{Number(d.min_topup_amount).toLocaleString()} → get ₹{Number(d.min_topup_amount * d.bonus_percentage / 100).toLocaleString()} bonus
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleRemoveSlab(d.id)}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                )
            ))}
        </div>
        <div style={{ padding: isMobile ? '10px 12px' : '12px 16px', background: 'var(--bg-elevated)', borderRadius: 0, marginTop: isMobile ? 10 : 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color="var(--info)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--on-muted)', margin: 0 }}>Discount applied as bonus credits at time of top-up. Discount slabs apply to wallet recharges — not individual API calls.</p>
        </div>
      </div>
        )}

        {tab === 'workspace' && (
      <>
      {/* ─── Virtual Workspace — Free Until ───
          Platform-wide "free for now" window. While set to a future date,
          subscribing never creates a real charge (see
          virtualWorkspaceSubscription.service.js#subscribe) and every
          in-flight subscription gets pulled forward to match whenever this
          is changed — see updateVirtualWorkspaceConfig's batch extend. */}
      <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{
          padding: isMobile ? '10px 12px' : '16px 20px', borderBottom: '1px solid var(--outline)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          background: 'var(--bg-elevated)', borderRadius: 0, marginBottom: isMobile ? 10 : 16,
        }}>
          <div>
            <h3 style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Virtual Workspace — Free Until</h3>
            <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--on-muted)', margin: '4px 0 0 0' }}>
              No tenant is charged before this date — clear it to make billing apply immediately for new/renewing subscriptions
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="form-control" value={freeUntil} onChange={(e) => setFreeUntil(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn btn-primary btn-sm" onClick={handleSaveFreeUntil} disabled={savingFreeUntil} style={{ borderRadius: 0 }}>
            <Save size={14} /> {savingFreeUntil ? 'Saving…' : 'Save'}
          </button>
          {freeUntil && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFreeUntil('')} style={{ borderRadius: 0 }}>Clear</button>
          )}
        </div>
      </div>

      {/* ─── Virtual Workspace — Free Tabs ───
          Which nav items a DSA-role user still sees when their tenant's
          Virtual Workspace isn't active (per-tenant toggle lives on
          TenantsListPage.jsx) — everything unchecked here disappears from
          their sidebar. Same header/save pattern as Volume Package
          Discounts above. */}
      <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{
          padding: isMobile ? '10px 12px' : '16px 20px', borderBottom: '1px solid var(--outline)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          background: 'var(--bg-elevated)', borderRadius: 0, marginBottom: isMobile ? 10 : 16,
        }}>
          <div>
            <h3 style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Virtual Workspace — Free Tabs</h3>
            <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--on-muted)', margin: '4px 0 0 0' }}>Sidebar tabs a DSA still sees before subscribing — everything else here is unchecked = locked</p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveFreeTabs}
            disabled={savingFreeTabs}
            style={{ borderRadius: 0, fontSize: 11 }}
          >
            <Save size={14} /> Save
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {GATABLE_NAV_ITEMS.map((item) => {
            const checked = freeNavItemIds.includes(item.id);
            return (
              <label
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--outline)',
                  borderRadius: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--on-surface)',
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleFreeNavItem(item.id)} />
                {item.label}
              </label>
            );
          })}
        </div>
      </div>
      </>
        )}
      </div>
    </div>
  );
};

export default SuperadminPricingPage;
