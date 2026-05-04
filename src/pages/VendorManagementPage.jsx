import React, { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { Network, BarChart2, ShieldAlert, X } from 'lucide-react';
import { getVendors, updateVendor, updateVendorSlabs } from '../api/vendor.api';

const VendorManagementPage = () => {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60, position: 'relative' }}>
      <PageHeader
        title="Vendor Management"
        subtitle="API vendor contracts, billing slabs & monthly invoicing — Super Admin only"
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Vendor Management' }]}
        actions={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
             <div className="btn-group">
                <button className="btn btn-ghost btn-sm active">Today</button>
                <button className="btn btn-ghost btn-sm">MTD</button>
                <button className="btn btn-ghost btn-sm">YTD</button>
            </div>
          </div>
        }
      />

      <div style={{ 
        background: '#FFFBEB', 
        border: '1px solid #FDE68A', 
        borderRadius: '8px', 
        padding: '12px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        marginBottom: 24,
        color: '#92400E'
      }}>
        <ShieldAlert size={18} />
        <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
          <span style={{ fontWeight: 700 }}>Super Admin only.</span> Vendor cost changes are versioned and do not affect past invoices. Billing slabs are evaluated per monthly volume. Monthly invoices auto-calculated on the 1st of each month.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 24 }}>
        <div className="card card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#F1F5F9', padding: 8, borderRadius: 8 }}>
              <Network size={20} color="#334155" />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px 0', color: '#0F172A' }}>{vendors.length}</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Active Vendors<br/><span style={{fontSize:11, color:'#10B981'}}>4 primary · 2 backup</span></p>
          </div>
        </div>

        <div className="card card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#F1F5F9', padding: 8, borderRadius: 8 }}>
              <BarChart2 size={20} color="#334155" />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px 0', color: '#0F172A' }}>{totalCalls.toLocaleString()}</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>API Calls (MTD)<br/><span style={{fontSize:11, color:'#10B981'}}>28 failed / refunded</span></p>
          </div>
        </div>

        <div className="card card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#F1F5F9', padding: 8, borderRadius: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>₹</span>
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px 0', color: '#0F172A' }}>₹{totalCost.toLocaleString()}</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Vendor Cost (MTD)<br/><span style={{fontSize:11, color:'#EF4444'}}>Invoice due Apr 1</span></p>
          </div>
        </div>
      </div>

      {/* VENDOR REGISTRY */}
      <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#334155' }}>Vendor Registry<br/><span style={{fontWeight: 400, fontSize: 12, color:'#64748B'}}>All API vendors · contract status · MTD cost auto-calculated from billing slabs</span></h3>
        </div>

        <div className="table-wrapper" style={{ margin: 0 }}>
          <table style={{ margin: 0 }}>
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', width: 60 }}>#</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Vendor Name</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>API Type</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Role</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Contract Period</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Billing Model</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>MTD Calls</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>MTD Cost (₹)</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '32px' }}>Loading vendor data...</td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '32px' }}>No vendors configured.</td>
                </tr>
              ) : (
                vendors.map((v) => (
                <tr key={v.id} className="hover-row">
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#64748B' }}>{v.id}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{v.website}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>{v.apiType}</span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ background: v.role === 'Primary' ? '#ECFDF5' : '#FFF1F2', color: v.role === 'Primary' ? '#10B981' : '#F43F5E', padding: '4px 12px', borderRadius: '20px', fontSize: 11, fontWeight: 700 }}>
                      {v.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#64748B' }}>{v.period}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#64748B' }}>{v.billingModel}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#1E293B', fontWeight: 700, textAlign: 'right' }}>{v.mtdCalls.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#1E293B', fontWeight: 700, textAlign: 'right' }}>₹{v.mtdCost.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <span style={{ color: v.status === 'Active' ? '#10B981' : '#64748B', fontWeight: 700, fontSize: 12 }}>{v.status}</span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button className="btn btn-outline btn-xs" onClick={() => handleEditClick(v)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600 }}>Edit</button>
                      <button className="btn btn-outline btn-xs" onClick={() => handleEditClick(v)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600 }}>Slabs ▾</button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MONTHLY INVOICE SUMMARY */}
      <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#334155' }}>Monthly Invoice Summary — March 2026</h3>
            <div style={{display: 'flex', gap: 12}}>
              <span style={{background: '#FFEDD5', color: '#C2410C', padding: '4px 12px', borderRadius: '4px', fontSize: 12, fontWeight: 600}}>Invoice due Apr 1</span>
              <button className="btn btn-outline btn-sm">Export CSV</button>
            </div>
        </div>

        <div className="table-wrapper" style={{ margin: 0 }}>
          <table style={{ margin: 0 }}>
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Vendor</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>API Type</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Total Calls</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Base Rate</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Slab Discount</th>
                <th style={{ padding: '12px 24px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Payable (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.map((v) => (
                <tr key={v.id} className="hover-row">
                  <td style={{ padding: '16px 24px', fontWeight: 500, fontSize: 13, color: '#1E293B' }}>{v.vendorName}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#64748B' }}>{v.apiType}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#1E293B', textAlign: 'right' }}>{v.totalCalls.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#64748B', textAlign: 'right' }}>₹{v.baseRate}/call</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#10B981', fontWeight: 600, textAlign: 'right' }}>
                    {v.slabDiscount > 0 ? `-₹${v.slabDiscount.toLocaleString()}` : `-₹0`}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#1E293B', fontWeight: 700, textAlign: 'right' }}>₹{v.payable.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
               <tr>
                  <td colSpan="2" style={{ padding: '16px 24px', fontSize: 14, fontWeight: 800, color: '#1E293B' }}>TOTAL PAYABLE — March 2026</td>
                  <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 800, color: '#1E293B', textAlign: 'right' }}>{totalCalls.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px' }}></td>
                  <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 800, color: '#10B981', textAlign: 'right' }}>-₹{totalDiscount.toLocaleString()}</td>
                  <td style={{ padding: '16px 24px', fontSize: 16, fontWeight: 800, color: '#8B5CF6', textAlign: 'right' }}>₹{totalPayable.toLocaleString()}</td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ 
        background: '#EFF6FF', 
        border: '1px solid #BFDBFE', 
        borderRadius: '8px', 
        padding: '12px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        color: '#1E3A8A'
      }}>
        <div style={{background: '#3B82F6', width: 4, height: 16, borderRadius: 2}}></div>
        <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
          Slab discounts apply where monthly volume crosses slab thresholds. Failed / refunded API calls (28 this month) are excluded from billing. Invoice raised on 1st April 2026.
        </p>
      </div>

      {/* UNIFIED EDIT VENDOR MODAL */}
      {editModalOpen && selectedVendor && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 700, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
             <div style={{ background: '#1E40AF', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
              <div>
                 <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Edit Vendor</h3>
                 <p style={{ margin: 0, fontSize: 12, color: '#BFDBFE', fontWeight: 500 }}>Super Admin only — billing slab changes effective from next cycle</p>
              </div>
              <X size={20} cursor="pointer" onClick={() => setEditModalOpen(false)} style={{background: '#1E3A8A', padding: 4, borderRadius: 4, width: 28, height: 28}} />
            </div>
            
            <div style={{ padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
               
               {/* FORM TOP SECTION */}
               <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16}}>
                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Vendor Name</label>
                    <input type="text" className="form-control" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{background: '#fff', fontSize: 13, padding: '8px 12px'}} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>API Type</label>
                    <select className="form-control" value={editForm.apiType} onChange={e => setEditForm({...editForm, apiType: e.target.value})} style={{background: '#fff', fontSize: 13, padding: '8px 12px'}}>
                        <option value="ITR">ITR</option>
                        <option value="GST">GST</option>
                        <option value="Banking">Banking</option>
                        <option value="Bureau">Bureau</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Role</label>
                    <select className="form-control" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} style={{background: '#fff', fontSize: 13, padding: '8px 12px'}}>
                        <option value="Primary">Primary</option>
                        <option value="Backup">Backup</option>
                    </select>
                  </div>
               </div>

               <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24}}>
                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Contract Start</label>
                    <input type="text" className="form-control" value={editForm.contract_start} onChange={e => setEditForm({...editForm, contract_start: e.target.value})} style={{background: '#fff', fontSize: 13, padding: '8px 12px'}} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Contract End</label>
                    <input type="text" className="form-control" value={editForm.contract_end} onChange={e => setEditForm({...editForm, contract_end: e.target.value})} style={{background: '#fff', fontSize: 13, padding: '8px 12px'}} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Billing Cycle</label>
                    <select className="form-control" value={editForm.billingModel} onChange={e => setEditForm({...editForm, billingModel: e.target.value})} style={{background: '#fff', fontSize: 13, padding: '8px 12px'}}>
                        <option value="Volume Slabs">Monthly Volume-Based</option>
                        <option value="Per Call (Flat)">Per Call (Flat)</option>
                    </select>
                  </div>
               </div>

               {/* BILLING SLABS SECTION */}
               <div style={{background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                    <div>
                      <h4 style={{margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B'}}>Billing Slabs</h4>
                      <p style={{margin: 0, fontSize: 12, color: '#64748B'}}>Rate per API call based on monthly volume. Last slab covers all calls above its From value.</p>
                    </div>
                    <button className="btn btn-outline btn-xs" onClick={addSlabRow} style={{fontWeight: 600, color: '#0F172A', borderColor: '#CBD5E1', display: 'flex', alignItems: 'center', gap: 4}}>
                      <span style={{fontSize: 14}}>+</span> Add Slab
                    </button>
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 12, marginBottom: 8}}>
                    <div style={{fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase'}}>From (calls)</div>
                    <div style={{fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase'}}>To (calls)</div>
                    <div style={{fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase'}}>Rate (₹ per call)</div>
                    <div></div>
                  </div>

                  {editingSlabs.map((slab, i) => (
                    <div key={i} style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 12, marginBottom: 8}}>
                      <input type="number" className="form-control" value={slab.from} onChange={e => updateSlab(i, 'from', e.target.value)} style={{background: '#fff'}} />
                      <input type="text" className="form-control" placeholder="To (blank = unl)" value={slab.to === null ? '' : slab.to} onChange={e => updateSlab(i, 'to', e.target.value)} style={{background: '#fff'}} />
                      <input type="number" className="form-control" value={slab.rate} onChange={e => updateSlab(i, 'rate', e.target.value)} style={{background: '#fff'}} />
                      <button className="btn btn-outline btn-xs" style={{color: '#EF4444', borderColor: '#FECACA', background: '#FEF2F2', padding: 0, width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => removeSlab(i)}>✕</button>
                    </div>
                  ))}
               </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                <button className="btn btn-outline" onClick={() => setEditModalOpen(false)} style={{fontWeight: 600, color: '#0F172A', borderColor: '#CBD5E1'}}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveVendor} style={{fontWeight: 600, background: '#F97316', borderColor: '#EA580C', display: 'flex', alignItems: 'center', gap: 6}}>
                   <span style={{fontSize: 16}}>💾</span> Save Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagementPage;
