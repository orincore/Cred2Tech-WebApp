import React, { useState, useEffect, useMemo } from 'react';
import {
   getLenders, createLender, getLenderProducts, createLenderProduct,
   getProductMatrix, createScheme, getParameterMaster,
   updateSchemeParameter, updateScheme, deleteScheme
} from '../api/lenderService';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Settings, Plus, Files, Trash, X, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
         <div style={{ background: '#fff', width: '600px', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Configure Structured Slabs / Logic</h3>
               <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Editing engine rule for: <strong>{parameterLabel}</strong></p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 20 }}>
               <table className="w-full text-sm">
                  <thead>
                     <tr style={{ background: '#f9fafb' }}>
                        <th className="p-2 text-left">Min Threshold</th>
                        <th className="p-2 text-left">Max Threshold</th>
                        <th className="p-2 text-left">Rule / Multiplier</th>
                        <th className="p-2 w-10"></th>
                     </tr>
                  </thead>
                  <tbody>
                     {slabs.map((slab, idx) => (
                        <tr key={idx} className="border-b">
                           <td className="p-2"><input type="number" className="form-control form-control-sm w-full" value={slab.min} onChange={e => updateSlab(idx, 'min', e.target.value)} /></td>
                           <td className="p-2"><input type="number" className="form-control form-control-sm w-full" value={slab.max} onChange={e => updateSlab(idx, 'max', e.target.value)} /></td>
                           <td className="p-2"><input type="text" className="form-control form-control-sm w-full" value={slab.value} onChange={e => updateSlab(idx, 'value', e.target.value)} /></td>
                           <td className="p-2"><button className="btn btn-ghost btn-icon" onClick={() => removeRow(idx)}><Trash size={14} color="var(--danger)" /></button></td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            <button className="btn btn-outline btn-sm mb-4" onClick={addRow}>+ Add Slab Tier</button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #eee', paddingTop: 20 }}>
               <button className="btn btn-outline" onClick={onClose}>Cancel</button>
               <button className="btn btn-primary" onClick={() => onSave(slabs)}>Apply Structure</button>
            </div>
         </div>
      </div>
   );
};

const LenderConfigPage = () => {
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
      <div className="space-y-6">
         <PageHeader
            title="Lender Configuration Engine"
            subtitle="Manage exact engine structural matrices per Lender Product"
            actions={
               <button className="btn btn-outline btn-sm">
                  <Settings size={15} /> Global Rule Overrides
               </button>
            }
         />

         <div className="card card-padded flex items-center gap-4 bg-white">
            <div className="flex-1">
               <label className="block text-sm font-medium text-gray-700 mb-1">Target Lender</label>
               <div className="flex gap-2">
                  <select className="form-control flex-1" value={selectedLenderId} onChange={handleLenderChange}>
                     <option value="">-- Select Lender --</option>
                     {lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button className="btn btn-outline" onClick={addLender} title="Add Lender"><Plus size={16} /></button>
               </div>
            </div>
            <div className="flex-1">
               <label className="block text-sm font-medium text-gray-700 mb-1">Target Product Line</label>
               <div className="flex gap-2">
                  <select className="form-control flex-1" value={selectedProductId} onChange={handleProductChange} disabled={!selectedLenderId}>
                     <option value="">-- Select Product --</option>
                     {products.map(p => <option key={p.id} value={p.id}>{p.product_type} - {p.status}</option>)}
                  </select>
                  <button className="btn btn-outline" onClick={addProduct} disabled={!selectedLenderId} title="Add Product"><Plus size={16} /></button>
               </div>
            </div>
         </div>

         {loading && <div className="p-10 text-center"><LoadingSpinner /></div>}

         {!loading && selectedProductId && (
            <div className="card shadow rounded-lg overflow-hidden bg-white" style={{ maxWidth: '100vw', overflowX: 'auto', border: '1px solid #e2e8f0' }}>

               <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '12px 16px', margin: '16px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium">
                     <span role="img" aria-label="edit">✏️</span> <strong>Edit Mode Active</strong> — Tap any cell to modify it. Changed cells are auto-saved.
                  </div>
                  <div className="text-yellow-700 text-xs flex items-center gap-1">
                     <span role="img" aria-label="lightning">⚡</span> Saves affect all future eligibility calculations
                  </div>
               </div>

               <div className="px-4 pb-4 flex justify-end items-center">
                  <button className="btn btn-primary btn-sm flex items-center gap-2 shadow-sm" onClick={addScheme} style={{ background: '#0d6efd' }}><Plus size={16} /> Add Scheme Column</button>
               </div>

               <div style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', position: 'relative', padding: '0 16px 16px' }}>
                  <table className="min-w-full divide-y divide-gray-200" style={{ borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #dee2e6' }}>
                     <thead className="sticky top-0 z-10" style={{ zIndex: 10 }}>
                        <tr>
                           <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-b min-w-[250px] sticky left-0 z-20" style={{ backgroundColor: '#0d6efd', color: '#fff' }}>
                              PARAMETER
                           </th>
                           {schemes.map(sch => (
                              <th key={sch.id} className="px-4 py-2 border-r border-b text-center min-w-[150px]" style={{ backgroundColor: '#0d6efd', color: '#fff' }}>
                                 <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#fff' }}>{sch.scheme_name}</div>
                                 <div className="mt-1 flex justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                                    <button onClick={() => duplicateScheme(sch.id)} title="Clone Structure"><Files size={12} /></button>
                                    <button onClick={() => deactivateScheme(sch.id)} title="Deactivate"><Trash size={12} /></button>
                                 </div>
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(categorizedParams).map(([category, params]) => (
                           <React.Fragment key={category}>
                              <tr className="border-b" style={{ backgroundColor: '#f8f9fa' }}>
                                 <td colSpan={schemes.length + 1} className="px-4 py-2 text-xs font-bold uppercase tracking-wider sticky left-0" style={{ color: '#0d6efd', borderRight: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                    <span role="img" aria-label="cat" className="mr-2">📐</span> {category}
                                 </td>
                              </tr>
                              {params.map(p => (
                                 <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 border-r bg-white text-sm font-medium text-gray-800 sticky left-0 z-10 whitespace-nowrap shadow-[1px_0_0_0_#e5e7eb]">
                                       {p.parameter_label}
                                       <div className="text-[10px] text-gray-400 font-mono mt-0.5">{p.parameter_key}</div>
                                    </td>

                                    {schemes.map(sch => {
                                       const val = matrixData[`${sch.id}_${p.id}`] || '';
                                       return (
                                          <td key={sch.id} className="p-1 border-r text-center align-middle relative group">
                                             {p.data_type === 'json_slab' ? (
                                                <button
                                                   className="w-full text-xs py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 font-medium transition-colors"
                                                   onClick={() => openSlabEditor(sch.id, p.id, p.parameter_label)}
                                                >
                                                   {Array.isArray(val) && val.length > 0 ? `Slab Set (${val.length} rules)` : 'Configure Slabs'}
                                                </button>
                                             ) : (
                                                <input
                                                   type="text"
                                                   className="w-full h-full p-2 text-sm text-center bg-transparent border-0 ring-1 ring-transparent focus:ring-blue-500 focus:bg-white rounded transition-all focus:outline-none placeholder-gray-300"
                                                   defaultValue={typeof val === 'object' ? JSON.stringify(val) : val}
                                                   onBlur={(e) => handleCellBlur(sch.id, p.id, p.data_type === 'integer' ? parseInt(e.target.value) || 0 : p.data_type === 'boolean' ? e.target.value === 'true' : e.target.value)}
                                                   placeholder="---"
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
         />
      </div>
   );
};

export default LenderConfigPage;
