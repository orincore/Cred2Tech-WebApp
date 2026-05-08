import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Network, BarChart2, ShieldAlert, X, Edit, Plus } from 'lucide-react';
import { getVendors, updateVendor, updateVendorSlabs } from '../api/vendor.api';
import { useTheme } from '../context/ThemeContext';
import DataTable from '../components/DataTable';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import TravelingBorderButton from '../components/TravelingBorderButton';

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

const VendorManagementPage = () => {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  
  // Form states
  const [editForm, setEditForm] = useState({ 
    name: '', apiType: '', role: 'Primary', 
    contract_start: '', contract_end: '', billingModel: 'Volume Slabs'
  });
  const [editingSlabs, setEditingSlabs] = useState([]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const data = await getVendors();
      if (data.success && data.vendors) {
        setVendors(data.vendors);
      }
    } catch (error) {
      console.error('Failed to load vendors', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (vendor) => {
    setSelectedVendor(vendor);
    
    // Parse dates if available, otherwise fallback
    const parts = vendor.period ? vendor.period.split(' – ') : [];
    const startStr = parts.length > 0 ? parts[0] : '';
    const endStr = parts.length > 1 ? parts[1] : '';

    setEditForm({
      name: vendor.name,
      apiType: vendor.apiType,
      role: vendor.role,
      contract_start: startStr,
      contract_end: endStr,
      billingModel: vendor.billingModel || 'Volume Slabs'
    });
    setEditingSlabs(vendor.slabs ? JSON.parse(JSON.stringify(vendor.slabs)) : []);
    setEditModalOpen(true);
  };

  const handleSaveVendor = async () => {
    try {
      // Assuming backend handles full updates. 
      // Currently backend service updateVendor only updates status, and updateVendorSlabs updates slabs.
      // We will call both if necessary, or just update the slabs for now.
      await updateVendor(selectedVendor.id, { ...editForm });
      await updateVendorSlabs(selectedVendor.id, editingSlabs);
      setEditModalOpen(false);
      fetchVendors();
    } catch (err) {
      console.error(err);
    }
  };

  const addSlabRow = () => {
    setEditingSlabs([...editingSlabs, { from: 0, to: null, rate: 0 }]);
  };

  const updateSlab = (index, field, value) => {
    const updated = [...editingSlabs];
    updated[index][field] = value === '' && field === 'to' ? null : Number(value);
    setEditingSlabs(updated);
  };

  const removeSlab = (index) => {
    setEditingSlabs(editingSlabs.filter((_, i) => i !== index));
  };

  const totalCalls = vendors.reduce((acc, curr) => acc + curr.mtdCalls, 0);
  const totalCost = vendors.reduce((acc, curr) => acc + curr.mtdCost, 0);

  // Compute Invoice Summary
  const invoiceData = vendors.map(v => {
    const baseRate = v.slabs && v.slabs.length > 0 ? v.slabs[0].rate : 0;
    const baseCost = v.mtdCalls * baseRate;
    const actualCost = v.mtdCost;
    const discount = baseCost - actualCost;

    return {
      id: v.id,
      vendorName: v.name,
      apiType: v.apiType,
      totalCalls: v.mtdCalls,
      baseRate,
      slabDiscount: discount > 0 ? discount : 0,
      payable: actualCost
    };
  });

  const totalPayable = invoiceData.reduce((acc, curr) => acc + curr.payable, 0);
  const totalDiscount = invoiceData.reduce((acc, curr) => acc + curr.slabDiscount, 0);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        v.name?.toLowerCase().includes(q) ||
        v.apiType?.toLowerCase().includes(q) ||
        v.website?.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [vendors, search]);

  /* ---- label style shared across filters ---- */
  const labelSm = { fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
  const underlineInput = (active) => ({
    background: 'transparent', border: 'none',
    borderBottom: `2px solid ${active ? '#4f46e5' : 'var(--outline)'}`,
    outline: 'none', width: '100%', padding: '6px 0',
    fontSize: 13, fontWeight: 600, color: 'var(--on-surface)',
    transition: 'border-color 0.2s',
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      {/* ─── Top header ─── */}
      <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Admin › Vendor Management
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Vendor Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
            API vendor contracts, billing slabs & monthly invoicing
          </p>
        </div>
      </div>

      {/* ─── Info bar ─── */}
      <div style={{ borderBottom: '1px solid var(--outline)', padding: '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ShieldAlert size={16} color="#4f46e5" />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--on-surface)' }}>Super Admin only.</strong> Vendor cost changes are versioned and do not affect past invoices. Billing slabs are evaluated per monthly volume.
        </p>
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
              placeholder="Vendor name, API type or website…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...underlineInput(false), paddingLeft: 20 }}
              onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
              onBlur={e => e.target.style.borderBottomColor = '#e2e8f0'}
            />
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
          <LoadingSpinner fullPage />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <Network size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No vendors found</h3>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>Try adjusting your search.</p>
        </div>
      ) : (
        <>
          {/* Sub-header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Vendor Registry</span>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{filtered.length} vendors</span>
          </div>

          {/* Table */}
          <DataTable
            columns={[
              { key: 'name', label: 'Vendor Name', render: (v) => (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface)' }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{v.website}</div>
                </div>
              )},
              { key: 'apiType', label: 'API Type', render: (v) => (
                <span style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600 }}>{v.apiType}</span>
              )},
              { key: 'role', label: 'Role', render: (v) => (
                <span style={{
                  background: v.role === 'Primary' ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#7f1d1d' : '#fee2e2'),
                  color: v.role === 'Primary' ? (isDark ? '#6ee7b7' : '#15803d') : (isDark ? '#fca5a5' : '#dc2626'),
                  padding: '3px 8px', borderRadius: 4,
                  fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                }}>
                  {v.role}
                </span>
              )},
              { key: 'period', label: 'Contract Period', render: (v) => v.period || '—' },
              { key: 'billingModel', label: 'Billing Model', render: (v) => v.billingModel || '—' },
              { key: 'mtdCalls', label: 'MTD Calls', render: (v) => v.mtdCalls.toLocaleString() },
              { key: 'mtdCost', label: 'MTD Cost (₹)', render: (v) => `₹${v.mtdCost.toLocaleString()}` },
              { key: 'status', label: 'Status', render: (v) => {
                const isActive = v.status === 'Active';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#10b981' : '#f43f5e', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#10b981' : '#f43f5e', whiteSpace: 'nowrap' }}>
                      {v.status}
                    </span>
                  </div>
                );
              }},
              { key: 'action', label: 'Action', align: 'center', render: (v) => (
                <button
                  onClick={(e) => { e.stopPropagation(); handleEditClick(v); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'transparent', border: 'none',
                    padding: '5px 10px', fontSize: 11, fontWeight: 700,
                    color: 'var(--on-surface)', cursor: 'pointer', transition: 'all 0.15s',
                    borderRadius: 4, whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.background = 'var(--surface-low)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Edit size={11} />
                  Edit
                </button>
              )},
            ]}
            data={filtered}
            isMobile={isMobile}
            hoverRows={true}
          />
        </>
      )}

      {/* UNIFIED EDIT VENDOR MODAL */}
      {editModalOpen && selectedVendor && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? 16 : 24
        }}>
          <div style={{ background: isDark ? '#1e293b' : '#fff', borderRadius: 12, width: isMobile ? '100%' : 700, maxWidth: isMobile ? '100%' : 700, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
             <div style={{ background: '#4f46e5', padding: isMobile ? '12px 16px' : '16px 20px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
              <div>
                 <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 700 }}>Edit Vendor</h3>
                 <p style={{ margin: 0, fontSize: isMobile ? 11 : 12, color: '#c7d2fe', fontWeight: 500 }}>Super Admin only — billing slab changes effective from next cycle</p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 6,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: isMobile ? 16 : 24, maxHeight: '80vh', overflowY: 'auto' }}>

               {/* FORM TOP SECTION */}
               <div style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24, marginBottom: 16}}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94a3b8' : '#4a5d73', display: 'block', marginBottom: 6 }}>Vendor Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94a3b8' : '#4a5d73', display: 'block', marginBottom: 6 }}>API Type</label>
                    <select
                      value={editForm.apiType}
                      onChange={e => setEditForm({...editForm, apiType: e.target.value})}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s', cursor: 'pointer', appearance: 'none' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                    >
                        <option value="ITR">ITR</option>
                        <option value="GST">GST</option>
                        <option value="Banking">Banking</option>
                        <option value="Bureau">Bureau</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94a3b8' : '#4a5d73', display: 'block', marginBottom: 6 }}>Role</label>
                    <select
                      value={editForm.role}
                      onChange={e => setEditForm({...editForm, role: e.target.value})}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s', cursor: 'pointer', appearance: 'none' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                    >
                        <option value="Primary">Primary</option>
                        <option value="Backup">Backup</option>
                    </select>
                  </div>
               </div>

               <div style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 16 : 24, marginBottom: 24}}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94a3b8' : '#4a5d73', display: 'block', marginBottom: 6 }}>Contract Start</label>
                    <input
                      type="text"
                      value={editForm.contract_start}
                      onChange={e => setEditForm({...editForm, contract_start: e.target.value})}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94a3b8' : '#4a5d73', display: 'block', marginBottom: 6 }}>Contract End</label>
                    <input
                      type="text"
                      value={editForm.contract_end}
                      onChange={e => setEditForm({...editForm, contract_end: e.target.value})}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94a3b8' : '#4a5d73', display: 'block', marginBottom: 6 }}>Billing Cycle</label>
                    <select
                      value={editForm.billingModel}
                      onChange={e => setEditForm({...editForm, billingModel: e.target.value})}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', borderBottom: '2px solid var(--outline)', color: isDark ? '#e6edf7' : '#0a1628', fontSize: 15, fontWeight: 600, padding: '6px 0', transition: 'border-color 0.2s', cursor: 'pointer', appearance: 'none' }}
                      onFocus={e => e.target.style.borderBottomColor = '#4f46e5'}
                      onBlur={e => e.target.style.borderBottomColor = 'var(--outline)'}
                    >
                        <option value="Volume Slabs">Monthly Volume-Based</option>
                        <option value="Per Call (Flat)">Per Call (Flat)</option>
                    </select>
                  </div>
               </div>

               {/* BILLING SLABS SECTION */}
               <div style={{background: isDark ? '#0f172a' : '#F8FAFC', border: '1px solid var(--outline)', borderRadius: 8, padding: isMobile ? 12 : 16}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0}}>
                    <div>
                      <h4 style={{margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--on-surface)'}}>Billing Slabs</h4>
                      <p style={{margin: 0, fontSize: 12, color: 'var(--on-muted)'}}>Rate per API call based on monthly volume. Last slab covers all calls above its From value.</p>
                    </div>
                    <button
                      onClick={addSlabRow}
                      style={{
                        padding: '8px 16px', background: 'transparent', border: '2px solid var(--outline)',
                        borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--on-surface)',
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
                      }}
                      onMouseEnter={e => e.target.style.borderColor = '#4f46e5'}
                      onMouseLeave={e => e.target.style.borderColor = 'var(--outline)'}
                    >
                      <span style={{fontSize: 14}}>+</span> Add Slab
                    </button>
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr 40px' : '1fr 1fr 1fr 40px', gap: isMobile ? 8 : 12, marginBottom: 8}}>
                    <div style={{fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase'}}>From (calls)</div>
                    <div style={{fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase'}}>To (calls)</div>
                    <div style={{fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase'}}>Rate (₹ per call)</div>
                    <div></div>
                  </div>

                  {editingSlabs.map((slab, i) => (
                    <div key={i} style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr 40px' : '1fr 1fr 1fr 40px', gap: isMobile ? 8 : 12, marginBottom: 8}}>
                      <input
                        type="number"
                        value={slab.from}
                        onChange={e => updateSlab(i, 'from', e.target.value)}
                        style={{ width: '100%', background: isDark ? '#1e293b' : '#fff', border: '1px solid var(--outline)', color: 'var(--on-surface)', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <input
                        type="text"
                        placeholder="To (blank = unl)"
                        value={slab.to === null ? '' : slab.to}
                        onChange={e => updateSlab(i, 'to', e.target.value)}
                        style={{ width: '100%', background: isDark ? '#1e293b' : '#fff', border: '1px solid var(--outline)', color: 'var(--on-surface)', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <input
                        type="number"
                        value={slab.rate}
                        onChange={e => updateSlab(i, 'rate', e.target.value)}
                        style={{ width: '100%', background: isDark ? '#1e293b' : '#fff', border: '1px solid var(--outline)', color: 'var(--on-surface)', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <button
                        onClick={() => removeSlab(i)}
                        style={{
                          color: '#EF4444', borderColor: '#FECACA', background: '#FEF2F2',
                          padding: 0, width: 32, height: 36, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', border: '1px solid', borderRadius: 6, cursor: 'pointer',
                          fontSize: 16, fontWeight: 700
                        }}
                      >✕</button>
                    </div>
                  ))}
               </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--outline)', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <button
                  onClick={() => setEditModalOpen(false)}
                  style={{
                    padding: '8px 20px', background: 'transparent', border: '2px solid var(--outline)',
                    borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--on-surface)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </button>
                <TravelingBorderButton
                  onClick={handleSaveVendor}
                  className="px-6 py-2.5 text-[13px] rounded-[10px]"
                >
                  Save Vendor
                </TravelingBorderButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagementPage;
