import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Settings, Save, Smartphone, DollarSign, PieChart, Building2, Plus, Trash2, Info, ChevronRight, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import api from '../api/axiosInstance';

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
  const [pricing, setPricing] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      <PageHeader
        title="API Pricing & Credit Rules"
        subtitle="DSA charges & discount tiers — Super Admin only"
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'API Pricing' }]}
        actions={
            <div style={{ display: 'flex', gap: 8 }}>
                <div className="btn-group">
                    <button className="btn btn-ghost btn-sm active">Today</button>
                    <button className="btn btn-ghost btn-sm">MTD</button>
                    <button className="btn btn-ghost btn-sm">YTD</button>
                </div>
            </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <StatCard icon={Smartphone} value={stats.live} label="API Types Live" color="#4F46E5" />
        <StatCard icon={DollarSign} value={`₹${stats.avgRate.toFixed(1)}`} label="Avg. Rate / Call" color="#059669" />
        <StatCard icon={PieChart} value={`${stats.avgMargin.toFixed(1)}%`} label="Avg. Gross Margin" color="#D97706" />
        <StatCard icon={Building2} value="₹1,150" label="Direct MSME Price" color="#7C3AED" />
      </div>

      <div className="card" style={{ marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>API Rate Card — DSA Pricing</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>Per-call rates deducted from DSA wallet - edit C2T Rate and press Save</p>
          </div>
          <button className="btn btn-primary btn-sm" style={{ boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }} disabled={!editingId || saving}>
            <Save size={14} /> Save Rates
          </button>
        </div>
        
        <div className="table-wrapper">
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>API SERVICE</th>
                <th>DESCRIPTION</th>
                <th>VENDOR COST (₹)</th>
                <th>C2T RATE / CALL (₹)</th>
                <th style={{ textAlign: 'right' }}>MARGIN (₹)</th>
                <th style={{ textAlign: 'right' }}>MARGIN %</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((p, idx) => {
                const isEditing = editingId === p.id;
                const current = isEditing ? editForm : p;
                const margin = current.default_credit_cost - current.vendor_cost;
                const marginPct = (margin / (current.default_credit_cost || 1)) * 100;
                
                return (
                  <tr key={p.id} className="hover-row">
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{p.api_name || p.api_code}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.api_code}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>
                        {isEditing ? (
                            <input className="form-control form-control-sm" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                        ) : (
                            p.description || '—'
                        )}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {isEditing ? (
                            <input type="number" className="form-control form-control-sm" value={editForm.vendor_cost} onChange={e => setEditForm({...editForm, vendor_cost: parseFloat(e.target.value)})} style={{ width: 80 }} />
                        ) : (
                            `₹${p.vendor_cost.toFixed(2)}`
                        )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input 
                          type="number" 
                          className="form-control" 
                          value={editForm.default_credit_cost} 
                          onChange={e => setEditForm({...editForm, default_credit_cost: parseInt(e.target.value) || 0})}
                          style={{ width: 100, fontWeight: 700, borderColor: 'var(--primary)' }} 
                        />
                      ) : (
                        <div style={{ background: '#F3F4F6', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, display: 'inline-block' }}>
                          {p.default_credit_cost.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: 13 }}>
                      ₹{margin.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: 11, fontWeight: 700, color: '#059669',
                        background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px'
                      }}>
                        {marginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        display: 'flex', alignItems: 'center', gap: 4, 
                        fontSize: 11, fontWeight: 700, color: p.is_active ? '#059669' : 'var(--text-tertiary)' 
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.is_active ? '#059669' : 'var(--text-tertiary)' }} />
                        {p.is_active ? 'Live' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-primary btn-xs" onClick={() => handleSavePricing(p.id)} disabled={saving}>Save</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn btn-outline btn-xs" onClick={() => startEdit(p)}>Edit</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Volume Package Discounts</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>Bonus wallet credits when DSA top-up crosses threshold - highest applicable slab wins, not stackable</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }} onClick={handleAddSlab}>
              <Plus size={14} /> Add Slab
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveDiscounts} disabled={saving}>
                <Save size={14} /> Save
            </button>
          </div>
        </div>
        
        <div className="table-wrapper">
            <table style={{ margin: 0 }}>
                <thead>
                    <tr>
                        <th>WALLET TOP-UP AMOUNT (₹)</th>
                        <th>BONUS CREDIT %</th>
                        <th>EFFECTIVE BENEFIT</th>
                        <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                </thead>
                <tbody>
                    {discounts.map(d => (
                        <tr key={d.id}>
                            <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>₹</span>
                                <input 
                                  type="number" 
                                  className="form-control" 
                                  value={d.min_topup_amount} 
                                  onChange={e => handleSlabChange(d.id, 'min_topup_amount', parseFloat(e.target.value) || 0)} 
                                  style={{ width: 120, background: 'transparent', border: '1px solid var(--border)', fontWeight: 600 }} 
                                />
                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>and above</span>
                            </td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input 
                                      type="number" 
                                      className="form-control" 
                                      value={d.bonus_percentage} 
                                      onChange={e => handleSlabChange(d.id, 'bonus_percentage', parseFloat(e.target.value) || 0)} 
                                      style={{ width: 60, textAlign: 'center', fontWeight: 700 }} 
                                    />
                                    <span style={{ fontWeight: 600 }}>%</span>
                                </div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Top up ₹{Number(d.min_topup_amount).toLocaleString()} → get ₹{Number(d.min_topup_amount * d.bonus_percentage / 100).toLocaleString()} bonus credits
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleRemoveSlab(d.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div style={{ padding: '12px 24px', background: '#F8FAFC', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color="#3B82F6" />
            <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Discount applied as bonus credits at time of top-up. Discount slabs apply to wallet recharges — not individual API calls.</p>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Individual MSME — Direct Access Price</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>MSMEs who self-onboard without a DSA - flat fee covers full credit assessment bundle</p>
          </div>
          <button className="btn btn-primary btn-sm">
            <Save size={14} /> Save Price
          </button>
        </div>
        
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div className="card" style={{ padding: '20px', border: '1px solid var(--primary-subtle)', background: 'rgba(79, 70, 229, 0.02)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>Flat Fee per MSME</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>₹ 1150</span>
                <div style={{ width: 100, height: 2, background: 'var(--primary-subtle)' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>Current effective price</p>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>Bundle Includes</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['GST Verification', 'ITR Analysis', 'Banking Analysis', 'Bureau / Credit'].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
                        <CheckCircle2 size={14} color="#059669" />
                        {item}
                    </li>
                ))}
            </ul>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>Margin Analysis</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Bundle Revenue</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>₹1,150</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Vendor Cost</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--error)' }}>₹54.50</span>
                </div>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Net Margin</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>₹1095.50</span>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperadminPricingPage;
