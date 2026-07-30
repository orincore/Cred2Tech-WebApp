import React, { useState, useEffect, useMemo } from 'react';
import {
   getLenders, createLender, getLenderProducts, createLenderProduct,
   getProductMatrix, createScheme, getParameterMaster,
   updateSchemeParameter, updateScheme, deleteScheme
} from '../api/lenderService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Settings, Plus, Files, Trash, X, Lock, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

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

// Embedded Modal for JSON Slab editing
const SlabEditorModal = ({ isOpen, onClose, initialData, onSave, parameterLabel, isDark }) => {
   const [slabs, setSlabs] = useState([]);

   useEffect(() => {
      if (isOpen) {
         if (initialData && Array.isArray(initialData)) {
            setSlabs(JSON.parse(JSON.stringify(initialData)));
         } else {
            setSlabs([{ min: '', max: '', value: '' }]); // generic format
         }
      }
   }, [isOpen, initialData]);

   if (!isOpen) return null;

   const updateSlab = (idx, field, val) => {
      const updated = [...slabs];
      updated[idx][field] = val;
      setSlabs(updated);
   };

   const addRow = () => setSlabs([...slabs, { min: '', max: '', value: '' }]);
   const removeRow = (idx) => setSlabs(slabs.filter((s, i) => i !== idx));

   return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
         <div style={{ background: isDark ? '#1e293b' : '#fff', width: '600px', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: isDark ? '#fff' : '#1e293b' }}>Configure Structured Slabs / Logic</h3>
               <button 
                  className="btn btn-ghost btn-icon" 
                  onClick={onClose}
                  style={{ color: isDark ? '#fff' : '#64748b' }}
               >
                  <X size={18} />
               </button>
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--on-muted)', marginBottom: 20 }}>Editing engine rule for: <strong style={{ color: isDark ? '#fff' : '#1e293b' }}>{parameterLabel}</strong></p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 20 }}>
               <table style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                     <tr style={{ background: isDark ? '#0f172a' : '#f9fafb' }}>
                        <th style={{ padding: 8, textAlign: 'left', color: 'var(--on-muted)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Min Threshold</th>
                        <th style={{ padding: 8, textAlign: 'left', color: 'var(--on-muted)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Max Threshold</th>
                        <th style={{ padding: 8, textAlign: 'left', color: 'var(--on-muted)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Rule / Multiplier</th>
                        <th style={{ padding: 8, width: 40 }}></th>
                     </tr>
                  </thead>
                  <tbody>
                     {slabs.map((slab, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--outline)' }}>
                           <td style={{ padding: 8 }}>
                              <input
                                 type="number"
                                 className="form-control form-control-sm"
                                 style={{ width: '100%', fontSize: 12 }}
                                 value={slab.min}
                                 onChange={e => updateSlab(idx, 'min', e.target.value)}
                              />
                           </td>
                           <td style={{ padding: 8 }}>
                              <input
                                 type="number"
                                 className="form-control form-control-sm"
                                 style={{ width: '100%', fontSize: 12 }}
                                 value={slab.max}
                                 onChange={e => updateSlab(idx, 'max', e.target.value)}
                              />
                           </td>
                           <td style={{ padding: 8 }}>
                              <input
                                 type="text"
                                 className="form-control form-control-sm"
                                 style={{ width: '100%', fontSize: 12 }}
                                 value={slab.value}
                                 onChange={e => updateSlab(idx, 'value', e.target.value)}
                              />
                           </td>
                           <td style={{ padding: 8 }}>
                              <button 
                                 className="btn btn-ghost btn-icon" 
                                 onClick={() => removeRow(idx)}
                                 style={{ color: '#ef4444' }}
                              >
                                 <Trash size={12} />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            <button 
               className="btn btn-outline btn-sm mb-4" 
               onClick={addRow}
               style={{ fontSize: 11, color: isDark ? '#fff' : '#1e293b', borderColor: isDark ? '#475569' : '#cbd5e1' }}
            >
               + Add Slab Tier
            </button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--outline)', paddingTop: 20 }}>
               <button 
                  className="btn btn-outline" 
                  onClick={onClose}
                  style={{ fontSize: 12, color: isDark ? '#fff' : '#1e293b', borderColor: isDark ? '#475569' : '#cbd5e1' }}
               >
                  Cancel
               </button>
               <button 
                  className="btn btn-primary" 
                  onClick={() => onSave(slabs)}
                  style={{ fontSize: 12 }}
               >
                  Apply Structure
               </button>
            </div>
         </div>
      </div>
   );
};

const LenderConfigPage = () => {
   const { isMobile, isTablet } = useResponsive();
   const { theme } = useTheme();
   const isDark = theme === 'dark';
   const [lenders, setLenders] = useState([]);
   const [selectedLenderId, setSelectedLenderId] = useState('');
   const [products, setProducts] = useState([]);
   const [selectedProductId, setSelectedProductId] = useState('');
   const [schemes, setSchemes] = useState([]);
   const [parameters, setParameters] = useState([]);
   const [matrixData, setMatrixData] = useState({}); // { [schemeId_parameterId]: value }
   const [loading, setLoading] = useState(false);

   const [slabModalInfo, setSlabModalInfo] = useState(null); // { schemeId, parameterId, label, initialData }

   useEffect(() => {
      loadLenders();
      loadParameters();
   }, []);

   const loadLenders = async () => {
      try {
         const data = await getLenders();
         setLenders(data);
      } catch (e) { console.error(e); }
   };

   const loadParameters = async () => {
      try {
         const data = await getParameterMaster();
         setParameters(data);
      } catch (e) { console.error(e); }
   };

   const handleLenderChange = async (e) => {
      const id = e.target.value;
      setSelectedLenderId(id);
      setSelectedProductId('');
      setSchemes([]);
      if (!id) { setProducts([]); return; }

      setLoading(true);
      try {
         const data = await getLenderProducts(id);
         setProducts(data);
      } catch (e) { console.error(e); } finally { setLoading(false); }
   };

   const handleProductChange = async (e) => {
      const id = e.target.value;
      setSelectedProductId(id);
      if (!id) { setSchemes([]); return; }
      loadMatrix(id);
   };

   const loadMatrix = async (productId) => {
      setLoading(true);
      try {
         const data = await getProductMatrix(productId);
         setSchemes(data.schemes || []);

         const newMatrix = {};
         if (data.values) {
            data.values.forEach(v => {
               newMatrix[`${v.scheme_id}_${v.parameter_id}`] = v.value;
            });
         }
         setMatrixData(newMatrix);
      } catch (e) {
         console.error(e);
         toast.error("Failed to load matrix data.");
      } finally {
         setLoading(false);
      }
   };

   const handleCellBlur = async (schemeId, parameterId, newValue) => {
      const key = `${schemeId}_${parameterId}`;
      if (matrixData[key] === newValue) return; // No change

      // Optimistic UI mapping
      setMatrixData(prev => ({ ...prev, [key]: newValue }));

      try {
         await updateSchemeParameter(schemeId, parameterId, newValue);
         toast.success("Saved");
      } catch (e) {
         toast.error("Failed to update cell.");
      }
   };

   const openSlabEditor = (schemeId, paramId, label) => {
      const key = `${schemeId}_${paramId}`;
      setSlabModalInfo({
         schemeId,
         parameterId: paramId,
         label: label,
         initialData: matrixData[key] || []
      });
   };

   const handleSlabSave = async (structuredData) => {
      const { schemeId, parameterId } = slabModalInfo;
      setSlabModalInfo(null);
      await handleCellBlur(schemeId, parameterId, structuredData);
   };

   const addScheme = async () => {
      const name = prompt("Enter new scheme name:");
      if (!name) return;
      try {
         await createScheme(selectedProductId, { scheme_name: name });
         toast.success("Scheme created");
         loadMatrix(selectedProductId);
      } catch (e) { toast.error("Creation failed"); }
   };

   const duplicateScheme = async (schemeId) => {
      const name = prompt("Enter name for duplicated scheme:");
      if (!name) return;
      try {
         await createScheme(selectedProductId, { scheme_name: name, dup_scheme_id: schemeId });
         toast.success("Scheme duplicated");
         loadMatrix(selectedProductId);
      } catch (e) { toast.error("Duplication failed"); }
   };

   const addLender = async () => {
      const name = prompt("Enter new Lender Name (e.g. HDFC Bank):");
      if (!name) return;
      const code = prompt("Enter Lender Code (e.g. HDFC):");
      if (!code) return;

      try {
         const newLender = await createLender({ name, code });
         toast.success("Lender created!");
         await loadLenders();
         setSelectedLenderId(newLender.id);
         setSelectedProductId('');
         setProducts([]);
         setSchemes([]);
      } catch (e) {
         toast.error("Failed to create Lender");
         console.error("Lender error:", e);
      }
   };

   const addProduct = async () => {
      if (!selectedLenderId) return alert("Select a lender first!");
      const type = prompt("Enter Product Type (HL or LAP):");
      if (!type || (type !== 'HL' && type !== 'LAP')) return alert("Must be HL or LAP");

      try {
         const newProd = await createLenderProduct(selectedLenderId, { product_type: type });
         toast.success("Product created!");
         // re-fetch products
         const pkgs = await getLenderProducts(selectedLenderId);
         setProducts(pkgs);

         // Auto-load matrix for the newly created product natively!
         setSelectedProductId(newProd.id);
         loadMatrix(newProd.id);
      } catch (e) { toast.error("Failed to create Product"); }
   };

   const deactivateScheme = async (schemeId) => {
      if (!window.confirm("Soft delete (Deactivate) this scheme?")) return;
      try {
         await deleteScheme(schemeId);
         toast.success("Deactivated");
         loadMatrix(selectedProductId);
      } catch (e) { toast.error("Deactivation failed"); }
   };

   // Group params safely
   const categorizedParams = useMemo(() => {
      return parameters.reduce((acc, p) => {
         if (!acc[p.category]) acc[p.category] = [];
         acc[p.category].push(p);
         return acc;
      }, {});
   }, [parameters]);

   return (
      <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
         {/* ─── Top header ─── */}
         <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '80px 16px 16px' : '24px 20px 24px 60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'var(--bg)', flexShrink: 0 }}>
            <div>
               <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Admin › Lender Configuration
               </p>
               <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
                  Lender Configuration Engine
               </h1>
               <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-muted)' }}>
                  Manage exact engine structural matrices per Lender Product
               </p>
            </div>
            <button className="btn btn-outline btn-sm" style={{ fontSize: 11, color: 'var(--on-surface)', borderColor: 'var(--outline)' }}>
               <Settings size={14} /> Global Rule Overrides
            </button>
         </div>

         {/* ─── Info bar ─── */}
         <div style={{ borderBottom: '1px solid var(--outline)', padding: '12px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <ShieldAlert size={16} color="#4f46e5" />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--on-muted)', fontWeight: 500 }}>
               <strong style={{ color: 'var(--on-surface)' }}>Super Admin only.</strong> Changes to lender configuration affect eligibility calculations immediately.
            </p>
         </div>

         {/* ─── Filter row (Lender/Product selectors) ─── */}
         <div style={{ borderBottom: '2px solid var(--outline)', padding: isMobile ? '16px' : '20px 20px', display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)', flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
               <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Target Lender</span>
               <div style={{ display: 'flex', gap: 8 }}>
                  <select
                     className="form-control"
                     style={{ flex: 1, fontSize: 13 }}
                     value={selectedLenderId}
                     onChange={handleLenderChange}
                  >
                     <option value="">-- Select Lender --</option>
                     {lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button 
                     className="btn btn-outline" 
                     onClick={addLender} 
                     title="Add Lender"
                     style={{ padding: '8px 12px', fontSize: 11, color: 'var(--on-surface)', borderColor: 'var(--outline)' }}
                  >
                     <Plus size={14} />
                  </button>
               </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
               <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Target Product Line</span>
               <div style={{ display: 'flex', gap: 8 }}>
                  <select
                     className="form-control"
                     style={{ flex: 1, fontSize: 13 }}
                     value={selectedProductId}
                     onChange={handleProductChange}
                     disabled={!selectedLenderId}
                  >
                     <option value="">-- Select Product --</option>
                     {products.map(p => <option key={p.id} value={p.id}>{p.product_type} - {p.status}</option>)}
                  </select>
                  <button 
                     className="btn btn-outline" 
                     onClick={addProduct} 
                     disabled={!selectedLenderId} 
                     title="Add Product"
                     style={{ padding: '8px 12px', fontSize: 11, color: 'var(--on-surface)', borderColor: 'var(--outline)' }}
                  >
                     <Plus size={14} />
                  </button>
               </div>
            </div>
         </div>

         {/* ─── Content ─── */}
         {loading ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
               <LoadingSpinner fullPage />
            </div>
         ) : !selectedProductId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
               <Settings size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
               <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>Select a Lender and Product</h3>
               <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>Choose a lender and product line to view configuration matrix</p>
            </div>
         ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '20px', background: 'var(--bg)' }}>
               {/* Edit Mode Banner */}
               <div style={{ 
                  backgroundColor: isDark ? '#7c2d12' : '#fffbe6', 
                  border: `1px solid ${isDark ? '#9a3412' : '#ffe58f'}`, 
                  padding: '12px 16px', 
                  borderRadius: 8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 16
               }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: isDark ? '#fed7aa' : '#b45309' }}>
                     <span>✏️</span> <strong>Edit Mode Active</strong> — Tap any cell to modify it. Changed cells are auto-saved.
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#fdba74' : '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                     <span>⚡</span> Saves affect all future eligibility calculations
                  </div>
               </div>

               {/* Add Scheme Button */}
               <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <button 
                     className="btn btn-primary btn-sm" 
                     onClick={addScheme} 
                     style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                     <Plus size={14} /> Add Scheme Column
                  </button>
               </div>

               {/* Matrix Table */}
               <div style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', position: 'relative', border: '1px solid var(--outline)', borderRadius: 8 }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
                     <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                           <th style={{ 
                              padding: '12px 16px', 
                              textAlign: 'left', 
                              fontSize: 11, 
                              fontWeight: 700, 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.05em', 
                              borderRight: '1px solid var(--outline)', 
                              borderBottom: '1px solid var(--outline)', 
                              minWidth: '250px', 
                              position: 'sticky', 
                              left: 0, 
                              zIndex: 20,
                              background: '#4f46e5',
                              color: '#fff'
                           }}>
                              PARAMETER
                           </th>
                           {schemes.map(sch => (
                              <th key={sch.id} style={{ 
                                 padding: '10px 16px', 
                                 borderRight: '1px solid var(--outline)', 
                                 borderBottom: '1px solid var(--outline)', 
                                 textAlign: 'center', 
                                 minWidth: '150px',
                                 background: '#4f46e5',
                                 color: '#fff'
                              }}>
                                 <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>{sch.scheme_name}</div>
                                 <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 8, opacity: 0.8 }}>
                                    <button onClick={() => duplicateScheme(sch.id)} title="Clone Structure" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2 }}><Files size={12} /></button>
                                    <button onClick={() => deactivateScheme(sch.id)} title="Deactivate" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2 }}><Trash size={12} /></button>
                                 </div>
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {Object.entries(categorizedParams).map(([category, params]) => (
                           <React.Fragment key={category}>
                              <tr style={{ borderBottom: '1px solid var(--outline)' }}>
                                 <td colSpan={schemes.length + 1} style={{ 
                                    padding: '10px 16px', 
                                    fontSize: 11, 
                                    fontWeight: 700, 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.05em',
                                    position: 'sticky', 
                                    left: 0,
                                    borderRight: '1px solid var(--outline)',
                                    background: isDark ? '#0f172a' : '#f8f9fa',
                                    color: '#4f46e5'
                                 }}>
                                    <span style={{ marginRight: 6 }}>📐</span> {category}
                                 </td>
                              </tr>
                              {params.map(p => (
                                 <tr key={p.id} style={{ borderBottom: '1px solid var(--outline)' }}>
                                    <td style={{ 
                                       padding: '12px 16px', 
                                       borderRight: '1px solid var(--outline)', 
                                       fontSize: 13, 
                                       fontWeight: 600, 
                                       color: 'var(--on-surface)', 
                                       position: 'sticky', 
                                       left: 0, 
                                       zIndex: 5, 
                                       whiteSpace: 'nowrap',
                                       background: isDark ? '#1e293b' : '#fff',
                                       boxShadow: '1px 0 0 0 var(--outline)'
                                    }}>
                                       {p.parameter_label}
                                       <div style={{ fontSize: 10, color: 'var(--on-muted)', fontFamily: 'monospace', marginTop: 2 }}>{p.parameter_key}</div>
                                    </td>

                                    {schemes.map(sch => {
                                       const val = matrixData[`${sch.id}_${p.id}`] || '';
                                       return (
                                          <td key={sch.id} style={{ padding: 4, borderRight: '1px solid var(--outline)', textAlign: 'center', verticalAlign: 'middle', position: 'relative' }}>
                                             {p.data_type === 'json_slab' ? (
                                                <button
                                                   style={{
                                                      width: '100%',
                                                      fontSize: 11,
                                                      padding: '6px 8px',
                                                      background: isDark ? '#1e3a8a' : '#eff6ff',
                                                      color: isDark ? '#93c5fd' : '#1d4ed8',
                                                      border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`,
                                                      borderRadius: 4,
                                                      fontWeight: 600,
                                                      cursor: 'pointer',
                                                      transition: 'all 0.15s'
                                                   }}
                                                   onClick={() => openSlabEditor(sch.id, p.id, p.parameter_label)}
                                                >
                                                   {Array.isArray(val) && val.length > 0 ? `Slab Set (${val.length} rules)` : 'Configure Slabs'}
                                                </button>
                                             ) : (
                                                <input
                                                   type="text"
                                                   style={{
                                                      width: '100%',
                                                      height: '100%',
                                                      padding: '8px',
                                                      fontSize: 12,
                                                      textAlign: 'center',
                                                      background: 'transparent',
                                                      border: 'none',
                                                      color: 'var(--on-surface)',
                                                      transition: 'all 0.15s'
                                                   }}
                                                   defaultValue={typeof val === 'object' ? JSON.stringify(val) : val}
                                                   onBlur={(e) => handleCellBlur(sch.id, p.id, p.data_type === 'integer' ? parseInt(e.target.value) || 0 : p.data_type === 'boolean' ? e.target.value === 'true' : e.target.value)}
                                                   placeholder="---"
                                                   onFocus={e => e.target.style.background = isDark ? '#0f172a' : '#f9fafb'}
                                                   onBlurCapture={e => e.target.style.background = 'transparent'}
                                                />
                                             )}
                                          </td>
                                       )
                                    })}
                                 </tr>
                              ))}
                           </React.Fragment>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* Structured Complex Slab Engine Editor */}
         <SlabEditorModal
            isOpen={!!slabModalInfo}
            onClose={() => setSlabModalInfo(null)}
            initialData={slabModalInfo?.initialData}
            onSave={handleSlabSave}
            parameterLabel={slabModalInfo?.label}
            isDark={isDark}
         />
      </div>
   );
};

export default LenderConfigPage;
