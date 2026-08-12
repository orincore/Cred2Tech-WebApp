import React, { useState, useEffect, useMemo } from 'react';
import {
   getLenders, createLender, getLenderProducts, createLenderProduct,
   getProductMatrix, createScheme, getParameterMaster,
   updateSchemeParameter, updateScheme, deleteScheme
} from '../api/lenderService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Settings, Plus, Files, Trash, X, Lock, ShieldAlert, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Mirrors the backend's key-based type inference (Cred2Tech/backend's
// src/utils/esrParsers.js normalizeParameter()) so the editor shown for a
// cell always matches what the backend will actually accept for that
// parameter — e.g. LTV/ROI/PF are validated server-side to *require* a
// trailing "%" or the save is rejected outright, so those get a dedicated
// number+% editor rather than a bare text box the admin has to remember the
// format for. Order matters and matches the backend's own if/else chain.
const classifyParamType = (parameterKey) => {
   const k = (parameterKey || '').toLowerCase();
   if (k.includes('foir')) return 'foir'; // percent/slab/conditional — too variable to force into a fixed widget
   if (k.includes('ltv') || k.includes('roi') || k.includes('pf')) return 'percent';
   if (k.includes('age') || k.includes('cutoff') || k.includes('tenure')) return 'integer';
   if (k.includes('loan') || k.includes('income')) return 'money';
   if (k.includes('elig_')) return 'boolean';
   return 'string';
};

// Pulls the leading number out of values like "300 Months" or "7.60%" so a
// <input type="number"> can hold it — the backend accepts a bare number back
// for these (tenure/age default to months/no-unit when no suffix is given).
const leadingNumber = (v) => {
   if (v === null || v === undefined) return '';
   const m = String(v).match(/-?\d+(\.\d+)?/);
   return m ? m[0] : '';
};

// Stored boolean values arrive as loosely-cased free text ("Yes", "NO",
// "true"...) — normalize to the exact option value the <select> uses.
const boolDisplayValue = (v) => {
   const s = String(v ?? '').trim().toLowerCase();
   if (['yes', 'true', 'y', '1'].includes(s)) return 'Yes';
   if (['no', 'false', 'n', '0'].includes(s)) return 'No';
   return '';
};

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
const SlabEditorModal = ({ isOpen, onClose, initialData, onSave, parameterLabel }) => {
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
      <div className="modal-overlay" onClick={onClose}>
         <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>Configure Structured Slabs / Logic</h3>
               <button
                  className="btn btn-ghost btn-icon"
                  onClick={onClose}
                  style={{ color: 'var(--on-muted)' }}
               >
                  <X size={18} />
               </button>
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--on-muted)', marginBottom: 20 }}>Editing engine rule for: <strong style={{ color: 'var(--on-surface)' }}>{parameterLabel}</strong></p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 20 }}>
               <table style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                     <tr style={{ background: 'var(--bg-elevated)' }}>
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
                                 style={{ color: 'var(--error)' }}
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
               style={{ fontSize: 11, color: 'var(--on-surface)', borderColor: 'var(--outline)' }}
            >
               + Add Slab Tier
            </button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--outline)', paddingTop: 20 }}>
               <button
                  className="btn btn-outline"
                  onClick={onClose}
                  style={{ fontSize: 12, color: 'var(--on-surface)', borderColor: 'var(--outline)' }}
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
   const [lenders, setLenders] = useState([]);
   const [selectedLenderId, setSelectedLenderId] = useState('');
   const [products, setProducts] = useState([]);
   const [selectedProductId, setSelectedProductId] = useState('');
   const [schemes, setSchemes] = useState([]);
   const [parameters, setParameters] = useState([]);
   const [matrixData, setMatrixData] = useState({}); // { [schemeId_parameterId]: value } — last-saved values
   const [loading, setLoading] = useState(false);

   // Edits the admin has made but not yet persisted — { [schemeId_parameterId]: { schemeId, parameterId, value } }.
   // Cells write here on blur/apply instead of calling the API directly; only
   // the Save button flushes this to the backend.
   const [pendingChanges, setPendingChanges] = useState({});
   const [savingAll, setSavingAll] = useState(false);
   const pendingCount = Object.keys(pendingChanges).length;
   const hasUnsavedChanges = pendingCount > 0;

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

   const confirmDiscardIfDirty = (message) => {
      if (!hasUnsavedChanges) return true;
      return window.confirm(message);
   };

   const handleLenderChange = async (e) => {
      if (!confirmDiscardIfDirty('You have unsaved matrix changes. Discard them and switch lender?')) return;

      const id = e.target.value;
      setSelectedLenderId(id);
      setSelectedProductId('');
      setSchemes([]);
      setPendingChanges({});
      if (!id) { setProducts([]); return; }

      setLoading(true);
      try {
         const data = await getLenderProducts(id);
         setProducts(data);
      } catch (e) { console.error(e); } finally { setLoading(false); }
   };

   const handleProductChange = async (e) => {
      if (!confirmDiscardIfDirty('You have unsaved matrix changes. Discard them and switch product?')) return;

      const id = e.target.value;
      setSelectedProductId(id);
      setPendingChanges({});
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
         setPendingChanges({});
      } catch (e) {
         console.error(e);
         toast.error("Failed to load matrix data.");
      } finally {
         setLoading(false);
      }
   };

   // Same "unwrap the normalized {raw, type, normalized} payload" logic the
   // input's defaultValue uses — needed here too so a re-typed value that
   // matches what's already saved doesn't get flagged as a pending change.
   const displayValueOf = (rawStored) => {
      if (!rawStored || typeof rawStored !== 'object' || Array.isArray(rawStored)) return rawStored;
      if ('raw' in rawStored) return rawStored.raw;
      if ('value' in rawStored) return rawStored.value;
      // A never-set cell on a freshly-created scheme comes back as `{}`,
      // not null/undefined — show it blank rather than literal "{}" text.
      if (Object.keys(rawStored).length === 0) return '';
      return JSON.stringify(rawStored); // unrecognized non-empty shape — surface it rather than hide it
   };

   // Stages an edit locally instead of saving it — the Save button is what
   // actually calls the API now. Snapping back to the last-saved value drops
   // the cell out of the pending set again, so the Save button and dirty
   // highlight stay accurate to "is there really something to save".
   const stageCellChange = (schemeId, parameterId, newValue) => {
      const key = `${schemeId}_${parameterId}`;
      const savedValue = displayValueOf(matrixData[key]) ?? '';
      setPendingChanges(prev => {
         const next = { ...prev };
         if (newValue === savedValue) {
            delete next[key];
         } else {
            next[key] = { schemeId, parameterId, value: newValue };
         }
         return next;
      });
   };

   const getCellValue = (schemeId, parameterId) => {
      const key = `${schemeId}_${parameterId}`;
      return key in pendingChanges ? pendingChanges[key].value : matrixData[key];
   };

   const handleSaveAll = async () => {
      const changes = Object.values(pendingChanges);
      if (changes.length === 0) return;

      setSavingAll(true);
      const results = await Promise.allSettled(
         changes.map(c => updateSchemeParameter(c.schemeId, c.parameterId, c.value))
      );

      const succeeded = changes.filter((_, i) => results[i].status === 'fulfilled');
      const failed = changes.filter((_, i) => results[i].status === 'rejected');

      if (succeeded.length > 0) {
         setMatrixData(prev => {
            const next = { ...prev };
            succeeded.forEach(c => { next[`${c.schemeId}_${c.parameterId}`] = c.value; });
            return next;
         });
      }

      setPendingChanges(() => {
         const next = {};
         failed.forEach(c => { next[`${c.schemeId}_${c.parameterId}`] = c; });
         return next;
      });

      setSavingAll(false);

      if (failed.length === 0) {
         toast.success(`Saved ${succeeded.length} change${succeeded.length > 1 ? 's' : ''}`);
      } else if (succeeded.length === 0) {
         toast.error(`Failed to save ${failed.length} change${failed.length > 1 ? 's' : ''}. Please retry.`);
      } else {
         toast.error(`Saved ${succeeded.length}, but ${failed.length} failed. Please retry the rest.`);
      }
   };

   const openSlabEditor = (schemeId, paramId, label) => {
      setSlabModalInfo({
         schemeId,
         parameterId: paramId,
         label: label,
         initialData: getCellValue(schemeId, paramId) || []
      });
   };

   const handleSlabSave = (structuredData) => {
      const { schemeId, parameterId } = slabModalInfo;
      setSlabModalInfo(null);
      stageCellChange(schemeId, parameterId, structuredData);
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

            {/* Manual Save — sits to the right of the Target Lender / Target Product
                Line selectors. Blurred/unclickable until a matrix cell is edited. */}
            <button
               className="btn btn-primary btn-sm"
               onClick={handleSaveAll}
               disabled={!hasUnsavedChanges || savingAll}
               title={hasUnsavedChanges ? 'Save changes to the matrix' : 'No changes to save'}
               style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
               <Save size={14} />
               {savingAll ? 'Saving…' : hasUnsavedChanges ? `Save Changes (${pendingCount})` : 'Save Changes'}
            </button>
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
                  backgroundColor: 'var(--warning-bg)',
                  border: '1px solid var(--warning)',
                  padding: '12px 16px',
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16
               }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>
                     <span>✏️</span> <strong>Edit Mode Active</strong> — {hasUnsavedChanges
                        ? `${pendingCount} unsaved change${pendingCount > 1 ? 's' : ''} — click Save Changes to apply.`
                        : 'Tap any cell to modify it, then click Save Changes to apply.'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
               <div style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', position: 'relative', border: '1px solid var(--outline)', borderRadius: 0 }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
                     <thead className="sticky-top" style={{ zIndex: 10 }}>
                        <tr>
                           <th className="sticky-col" style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderRight: '1px solid var(--outline)',
                              borderBottom: '1px solid var(--outline)',
                              minWidth: '250px',
                              zIndex: 20,
                              background: 'var(--primary)',
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
                                 background: 'var(--primary)',
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
                                 <td colSpan={schemes.length + 1} className="sticky-col" style={{
                                    padding: '10px 16px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    borderRight: '1px solid var(--outline)',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--primary)'
                                 }}>
                                    <span style={{ marginRight: 6 }}>📐</span> {category}
                                 </td>
                              </tr>
                              {params.map(p => (
                                 <tr key={p.id} style={{ borderBottom: '1px solid var(--outline)' }}>
                                    <td className="sticky-col" style={{
                                       padding: '12px 16px',
                                       borderRight: '1px solid var(--outline)',
                                       fontSize: 13,
                                       fontWeight: 600,
                                       color: 'var(--on-surface)',
                                       zIndex: 5,
                                       whiteSpace: 'nowrap',
                                       background: 'var(--surface)',
                                       boxShadow: '1px 0 0 0 var(--outline)'
                                    }}>
                                       {p.parameter_label}
                                       <div style={{ fontSize: 10, color: 'var(--on-muted)', fontFamily: 'monospace', marginTop: 2 }}>{p.parameter_key}</div>
                                    </td>

                                    {schemes.map(sch => {
                                       const cellKey = `${sch.id}_${p.id}`;
                                       const isDirty = cellKey in pendingChanges;
                                       // Unsaved edits are stored already-unwrapped (plain string/int/bool/array);
                                       // untouched cells still hold the backend's normalized {raw,type,normalized}
                                       // wrapper (see admin.lender.controller.js's normalizeParameter()) and need
                                       // unwrapping to their human-readable `raw` field before display.
                                       const val = isDirty ? pendingChanges[cellKey].value : (displayValueOf(matrixData[cellKey]) ?? '');
                                       const dirtyBg = isDirty ? 'var(--warning-bg)' : 'transparent';
                                       const paramType = classifyParamType(p.parameter_key);
                                       // Free-text notes (e.g. "50%, can be considered 100% if ownership proof
                                       // provided.") don't fit — or read — in a single-line box this narrow.
                                       const isLongText = typeof val === 'string' && val.length > 18;

                                       // Stages the edit and repaints the cell's dirty highlight in one go —
                                       // shared across every editor variant below so they all behave identically.
                                       const commitEdit = (el, transformedValue) => {
                                          stageCellChange(sch.id, p.id, transformedValue);
                                          const savedValue = displayValueOf(matrixData[cellKey]) ?? '';
                                          el.style.background = (transformedValue !== savedValue) ? 'var(--warning-bg)' : 'transparent';
                                       };

                                       const baseInputStyle = {
                                          width: '100%', height: '100%', padding: '8px', fontSize: 12,
                                          background: dirtyBg, border: 'none', color: 'var(--on-surface)',
                                          transition: 'all 0.15s'
                                       };

                                       return (
                                          <td key={sch.id} style={{ padding: 4, borderRight: '1px solid var(--outline)', textAlign: 'center', verticalAlign: 'middle', position: 'relative' }}>
                                             {p.data_type === 'json_slab' ? (
                                                <button
                                                   style={{
                                                      width: '100%',
                                                      fontSize: 11,
                                                      padding: '6px 8px',
                                                      background: isDirty ? 'var(--warning-bg)' : 'var(--info-bg)',
                                                      color: isDirty ? 'var(--warning)' : 'var(--info)',
                                                      border: `1px solid ${isDirty ? 'var(--warning)' : 'var(--info)'}`,
                                                      borderRadius: 0,
                                                      fontWeight: 600,
                                                      cursor: 'pointer',
                                                      transition: 'all 0.15s'
                                                   }}
                                                   onClick={() => openSlabEditor(sch.id, p.id, p.parameter_label)}
                                                >
                                                   {Array.isArray(val) && val.length > 0 ? `Slab Set (${val.length} rules)${isDirty ? ' •' : ''}` : 'Configure Slabs'}
                                                </button>
                                             ) : paramType === 'boolean' ? (
                                                <select
                                                   style={{ ...baseInputStyle, textAlign: 'center', cursor: 'pointer' }}
                                                   defaultValue={boolDisplayValue(val)}
                                                   onChange={(e) => commitEdit(e.target, e.target.value)}
                                                >
                                                   <option value="">---</option>
                                                   <option value="Yes">Yes</option>
                                                   <option value="No">No</option>
                                                </select>
                                             ) : paramType === 'percent' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: dirtyBg }}>
                                                   <input
                                                      type="number"
                                                      step="0.01"
                                                      style={{ ...baseInputStyle, textAlign: 'right', background: 'transparent', width: '70%' }}
                                                      defaultValue={leadingNumber(val)}
                                                      placeholder="0"
                                                      title="Stored as a percentage — enter the number only, e.g. 75 for 75%."
                                                      onFocus={e => e.target.parentElement.style.background = 'var(--bg-elevated)'}
                                                      onBlur={(e) => {
                                                         const raw = e.target.value.trim();
                                                         commitEdit(e.target.parentElement, raw === '' ? '' : `${raw}%`);
                                                      }}
                                                   />
                                                   <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-muted)', paddingRight: 8 }}>%</span>
                                                </div>
                                             ) : paramType === 'integer' ? (
                                                <input
                                                   type="number"
                                                   step="1"
                                                   style={{ ...baseInputStyle, textAlign: 'center' }}
                                                   defaultValue={leadingNumber(val)}
                                                   placeholder="0"
                                                   onFocus={e => e.target.style.background = 'var(--bg-elevated)'}
                                                   onBlur={(e) => commitEdit(e.target, e.target.value.trim())}
                                                />
                                             ) : (
                                                // money / foir / free-text fallback — formats are genuinely too varied
                                                // (₹ amounts with L/Cr/K suffixes, "No Capping", FOIR slab shorthand,
                                                // plain notes) to force into a fixed widget, so these stay text —
                                                // just left-aligned and roomier so multi-word values are readable,
                                                // with a format hint instead of a guessing game. Longer existing
                                                // values (full-sentence notes) get a small resizable textarea
                                                // instead of a single-line box they'd only ever see part of.
                                                (() => {
                                                   const placeholder = paramType === 'money' ? 'e.g. 500000, 50L, 2Cr, No Capping'
                                                      : paramType === 'foir' ? 'e.g. 75%, <75k -60%,>75k -70%, No DBR'
                                                      : '---';
                                                   const hint = paramType === 'money' ? 'Accepts a plain amount, or with L/Cr/K suffix, or "No Capping".'
                                                      : paramType === 'foir' ? 'Accepts a plain %, a slab like "<75k -60%, >75k -70%", or "No DBR".'
                                                      : undefined;
                                                   return isLongText ? (
                                                      <textarea
                                                         rows={2}
                                                         style={{ ...baseInputStyle, textAlign: 'left', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.35 }}
                                                         defaultValue={val}
                                                         placeholder={placeholder}
                                                         title={hint}
                                                         onFocus={e => e.target.style.background = 'var(--bg-elevated)'}
                                                         onBlur={(e) => commitEdit(e.target, e.target.value)}
                                                      />
                                                   ) : (
                                                      <input
                                                         type="text"
                                                         style={{ ...baseInputStyle, textAlign: 'left' }}
                                                         defaultValue={val}
                                                         placeholder={placeholder}
                                                         title={hint}
                                                         onFocus={e => e.target.style.background = 'var(--bg-elevated)'}
                                                         onBlur={(e) => commitEdit(e.target, e.target.value)}
                                                      />
                                                   );
                                                })()
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
         />
      </div>
   );
};

export default LenderConfigPage;
