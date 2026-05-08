import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Settings, Save, Smartphone, DollarSign, PieChart, Building2, Plus, Trash2, Info, ChevronRight, CheckCircle2, Search, Edit, ShieldAlert } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import api from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext';
import DataTable from '../components/DataTable';

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

const StatCard = ({ icon: Icon, value, label, sublabel, color }) => (
  <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
    <div style={{ 
      width: '48px', height: '48px', borderRadius: '12px', 
      background: `${color}10`, display: 'flex', alignItems: 'center', 
      justifyContent: 'center', color: color 
    }}>
      <Icon size={24} />
    </div>
    <div>
      <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</p>
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
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get(`/admin/wallet/api-pricing`);
      setPricing(res.data.pricing || []);
      setDiscounts(res.data.discounts || []);
    } catch (err) {
      toast.error('Failed to load pricing configurations');
    } finally {
      setLoading(false);
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

  const stats = useMemo(() => {
    const live = pricing.filter(p => p.is_active).length;
    const avgRate = pricing.reduce((acc, curr) => acc + curr.default_credit_cost, 0) / (pricing.length || 1);
    const avgMargin = pricing.reduce((acc, curr) => {
        const margin = curr.default_credit_cost - curr.vendor_cost;
        return acc + (margin / (curr.default_credit_cost || 1));
    }, 0) / (pricing.length || 1) * 100;
    
    return { live, avgRate, avgMargin };
  }, [pricing]);

  const filtered = useMemo(() => {
    return pricing.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.api_name?.toLowerCase().includes(q) ||
        p.api_code?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [pricing, search]);

  /* ---- label style shared across filters ---- */
  const labelSm = { fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
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
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Admin › API Pricing
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            API Pricing & Credit Rules
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
            DSA charges & discount tiers
          </p>
        </div>
      </div>

      {/* ─── Info bar ─── */}
      <div style={{ borderBottom: '1px solid var(--outline)', padding: '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ShieldAlert size={16} color="#4f46e5" />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--on-surface)' }}>Super Admin only.</strong> Changes to pricing affect all DSA wallets immediately. Volume discounts apply at top-up time.
        </p>
      </div>

      {/* ─── Stats cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', padding: isMobile ? '16px' : '20px 20px', background: 'var(--bg)', flexShrink: 0 }}>
        <StatCard icon={Smartphone} value={stats.live} label="API Types Live" color="#4F46E5" />
        <StatCard icon={DollarSign} value={`₹${stats.avgRate.toFixed(1)}`} label="Avg. Rate / Call" color="#059669" />
        <StatCard icon={PieChart} value={`${stats.avgMargin.toFixed(1)}%`} label="Avg. Gross Margin" color="#D97706" />
        <StatCard icon={Building2} value="₹1,150" label="Direct MSME Price" color="#7C3AED" />
      </div>

      {/* ─── Filter row ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '16px' : '20px 20px', display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
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

      {/* ─── Pricing table section ─── */}
      <>
        {/* Sub-header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>API Rate Card — DSA Pricing</span>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{filtered.length} APIs</span>
        </div>

        {/* Table */}
        <DataTable
          columns={[
            { key: 'api_name', label: 'API Service', render: (p, idx) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface)' }}>{p.api_name || p.api_code}</span>
                <span style={{ fontSize: 10, color: 'var(--on-muted)', fontFamily: 'monospace' }}>{p.api_code}</span>
              </div>
            )},
            { key: 'description', label: 'Description', render: (p) => {
              const isEditing = editingId === p.id;
              return isEditing ? (
                <input 
                  className="form-control form-control-sm" 
                  value={editForm.description} 
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  style={{ background: isDark ? '#1e293b' : '#fff', border: '1px solid var(--outline)', color: 'var(--on-surface)', fontSize: 12 }}
                />
              ) : (
                p.description || '—'
              );
            }},
            { key: 'vendor_cost', label: 'Vendor Cost (₹)', render: (p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              return isEditing ? (
                <input 
                  type="number" 
                  className="form-control form-control-sm" 
                  value={editForm.vendor_cost} 
                  onChange={e => setEditForm({...editForm, vendor_cost: parseFloat(e.target.value)})}
                  style={{ width: 80, background: isDark ? '#1e293b' : '#fff', border: '1px solid var(--outline)', color: 'var(--on-surface)', fontSize: 12 }}
                />
              ) : (
                `₹${p.vendor_cost.toFixed(2)}`
              );
            }},
            { key: 'default_credit_cost', label: 'C2T Rate (₹)', render: (p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              return isEditing ? (
                <input 
                  type="number" 
                  className="form-control" 
                  value={editForm.default_credit_cost} 
                  onChange={e => setEditForm({...editForm, default_credit_cost: parseInt(e.target.value) || 0})}
                  style={{ width: 100, fontWeight: 700, borderColor: '#4f46e5', background: isDark ? '#1e293b' : '#fff', color: 'var(--on-surface)' }} 
                />
              ) : (
                <div style={{ background: isDark ? '#1e293b' : '#F3F4F6', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, display: 'inline-block' }}>
                  {p.default_credit_cost.toFixed(2)}
                </div>
              );
            }},
            { key: 'margin', label: 'Margin (₹)', render: (p) => {
              const isEditing = editingId === p.id;
              const current = isEditing ? editForm : p;
              const margin = current.default_credit_cost - current.vendor_cost;
              return (
                <span style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>
                  ₹{margin.toFixed(2)}
                </span>
              );
            }},
            { key: 'margin_pct', label: 'Margin %', render: (p) => {
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
            { key: 'is_active', label: 'Status', render: (p) => (
              <span style={{ 
                display: 'flex', alignItems: 'center', gap: 4, 
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
      </>

      {/* ─── Volume Package Discounts ─── */}
      <div style={{ padding: isMobile ? '16px' : '20px 20px', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? '#0f172a' : '#F8FAFC', borderRadius: 8, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Volume Package Discounts</h3>
            <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '4px 0 0 0' }}>Bonus wallet credits when DSA top-up crosses threshold</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ border: '1px solid var(--outline)', fontSize: 11, color: 'var(--on-surface)' }} 
              onClick={handleAddSlab}
            >
              <Plus size={14} /> Add Slab
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleSaveDiscounts} 
              disabled={saving}
              style={{ fontSize: 11 }}
            >
              <Save size={14} /> Save
            </button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gap: 12 }}>
            {discounts.map(d => (
                <div key={d.id} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr auto', 
                  gap: 12, 
                  padding: '12px 16px', 
                  background: isDark ? '#1e293b' : '#fff', 
                  border: '1px solid var(--outline)', 
                  borderRadius: 8,
                  alignItems: 'center'
                }}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--on-muted)', fontSize: 12 }}>₹</span>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={d.min_topup_amount} 
                          onChange={e => handleSlabChange(d.id, 'min_topup_amount', parseFloat(e.target.value) || 0)} 
                          style={{ width: 120, background: 'transparent', border: '1px solid var(--outline)', fontWeight: 600, color: 'var(--on-surface)', fontSize: 13 }} 
                        />
                        <span style={{ fontSize: 11, color: 'var(--on-muted)' }}>and above</span>
                    </td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={d.bonus_percentage} 
                              onChange={e => handleSlabChange(d.id, 'bonus_percentage', parseFloat(e.target.value) || 0)} 
                              style={{ width: 60, textAlign: 'center', fontWeight: 700, background: 'transparent', border: '1px solid var(--outline)', color: 'var(--on-surface)', fontSize: 13 }} 
                            />
                            <span style={{ fontWeight: 600, color: 'var(--on-surface)', fontSize: 13 }}>%</span>
                        </div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--on-muted)' }}>
                        Top up ₹{Number(d.min_topup_amount).toLocaleString()} → get ₹{Number(d.min_topup_amount * d.bonus_percentage / 100).toLocaleString()} bonus
                    </td>
                    <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-icon" style={{ color: '#ef4444' }} onClick={() => handleRemoveSlab(d.id)}>
                            <Trash2 size={14} />
                        </button>
                    </td>
                </div>
            ))}
        </div>
        <div style={{ padding: '12px 16px', background: isDark ? '#0f172a' : '#F8FAFC', borderRadius: 8, marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color="#3B82F6" />
            <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: 0 }}>Discount applied as bonus credits at time of top-up. Discount slabs apply to wallet recharges — not individual API calls.</p>
        </div>
      </div>
    </div>
  );
};

export default SuperadminPricingPage;
