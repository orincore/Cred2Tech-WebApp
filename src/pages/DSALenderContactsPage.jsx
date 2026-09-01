import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Plus, Edit2, Trash2, ChevronDown, ChevronUp, AlertCircle, Briefcase, Lock, Check, X
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  getTenantLenders, createTenantLender, updateTenantLender, deleteTenantLender,
  createTenantLenderContact, updateTenantLenderContact, deleteTenantLenderContact,
} from '../api/tenantLenderService';
import {
  getCommissionRules, createCommissionRule, updateCommissionRule, 
  deleteCommissionRule
} from '../api/commissionService';
import { useAuth } from '../context/AuthContext';
import { LENDERS_LIST } from '../constants/lenders';

const PRODUCT_TYPES = ['LAP', 'HL', 'WC', 'TL', 'BL', 'ML'];

// Reuse the app's existing dark-mode-aware role tokens (index.css) instead of
// flat hex, so these chips adapt automatically instead of staying light-only.
const PT_COLORS = {
  LAP: { bg: 'var(--role-dsa-bg)', text: 'var(--role-dsa)', border: 'var(--role-dsa)' },
  HL:  { bg: 'var(--role-employee-bg)', text: 'var(--role-employee)', border: 'var(--role-employee)' },
  WC:  { bg: 'var(--role-admin-bg)', text: 'var(--role-admin)', border: 'var(--role-admin)' },
  TL:  { bg: 'var(--role-partner-bg)', text: 'var(--role-partner)', border: 'var(--role-partner)' },
  BL:  { bg: 'var(--role-super-admin-bg)', text: 'var(--role-super-admin)', border: 'var(--role-super-admin)' },
  ML:  { bg: 'var(--role-cred2tech-bg)', text: 'var(--role-cred2tech)', border: 'var(--role-cred2tech)' },
};

function ProductBadge({ type }) {
  const c = PT_COLORS[type] || PT_COLORS.ML;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 0,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{type}</span>
  );
}

// ── Modal: Add Lender ──────────────────────────────────────────────────
function LenderModal({ isOpen, onClose, onSave, existingLenders = [] }) {
  const [lenderName, setLenderName] = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (isOpen) setLenderName('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedName = lenderName.trim();
    if (!trimmedName) { toast.error('Lender name is required'); return; }
    
    const isDuplicate = existingLenders.some(l => l.lender_name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      toast.error('This lender has already been added');
      return;
    }

    setSaving(true);
    try {
      await onSave({ lender_name: trimmedName, is_active: true });
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save lender');
    } finally { setSaving(false); }
  };

  return (
    <div style={overlay}>
      <div style={modalBox}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add New Lender</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>LENDER NAME *</label>
            <input value={lenderName} onChange={e => setLenderName(e.target.value)}
              placeholder="e.g. HDFC Bank, Axis Bank, ICICI Bank"
              list="lenders-list"
              style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleSave()} />
            <datalist id="lenders-list">
              {LENDERS_LIST.map((name, i) => <option key={i} value={name} />)}
            </datalist>
          </div>
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={btnOutline}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Add Lender'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DSALenderContactsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('DSA_ADMIN');

  const [lenders, setLenders]   = useState([]);
  const [commissionRules, setCommissionRules] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState({});

  const [lenderModal, setLenderModal] = useState({ open: false });

  // For inline editing states
  const [contactEdits, setContactEdits] = useState({}); // { contactId: { ...fields being edited } } — a lender can have multiple contacts (one per product type), so edits are keyed per-contact, not per-lender
  const [newContactDrafts, setNewContactDrafts] = useState({}); // { lenderId: { product_type, contact_name, contact_mobile, contact_email, is_primary } } — presence of a key means the "add contact" form is open for that lender
  const [ruleEdits, setRuleEdits] = useState({}); // { `${lenderId}_${product}`: ruleConfig }
  const [activeProductTabs, setActiveProductTabs] = useState({}); // { lenderId: 'LAP' }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [lendersData, rulesData] = await Promise.all([
        getTenantLenders(),
        getCommissionRules()
      ]);
      setLenders(lendersData);
      setCommissionRules(rulesData);
      
      // Initialize states
      const initialActiveTabs = {};
      lendersData.forEach(l => {
        if (!activeProductTabs[l.id]) {
          const firstProductRule = rulesData.find(r => r.tenant_lender_id === l.id);
          initialActiveTabs[l.id] = firstProductRule ? firstProductRule.product_type : PRODUCT_TYPES[0];
        } else {
          initialActiveTabs[l.id] = activeProductTabs[l.id];
        }
      });
      setActiveProductTabs(initialActiveTabs);
    } catch (e) {
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [activeProductTabs]);

  useEffect(() => { load(); }, []);

  const toggleExpand = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // ── Lender actions ──
  const handleAddLender = async (payload) => {
    await createTenantLender(payload);
    toast.success('Lender added');
    await load();
  };

  // ── Contact actions ──
  // A lender can have multiple contacts — one per product type (LAP/HL/WC/...)
  // or a single 'ALL' contact covering every product — so editing/adding/
  // deleting all operate per-contact rather than assuming one contact/lender.
  const startEditContact = (contact) => {
    setContactEdits(prev => ({ ...prev, [contact.id]: {
      product_type: contact.product_type,
      contact_name: contact.contact_name || '',
      contact_mobile: contact.contact_mobile || '',
      contact_email: contact.contact_email || '',
      is_primary: !!contact.is_primary,
    }}));
  };

  const cancelEditContact = (contactId) => {
    setContactEdits(prev => { const n = { ...prev }; delete n[contactId]; return n; });
  };

  const updateEditField = (contactId, field, value) => {
    setContactEdits(prev => ({ ...prev, [contactId]: { ...prev[contactId], [field]: value } }));
  };

  const saveEditContact = async (contactId) => {
    const edit = contactEdits[contactId];
    if (!edit?.contact_name) { toast.error('Contact Name is required'); return; }
    if (!edit?.contact_email) { toast.error('Contact Email is required'); return; }
    try {
      await updateTenantLenderContact(contactId, edit);
      toast.success('Contact updated');
      cancelEditContact(contactId);
      await load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update contact'); }
  };

  const handleDeleteContact = async (contact) => {
    if (!window.confirm(`Remove ${contact.contact_name} (${contact.product_type}) as a contact for this lender?`)) return;
    try {
      await deleteTenantLenderContact(contact.id);
      toast.success('Contact removed');
      await load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to remove contact'); }
  };

  const startAddContact = (lenderId) => {
    setNewContactDrafts(prev => ({ ...prev, [lenderId]: {
      product_type: 'LAP', contact_name: '', contact_mobile: '', contact_email: '', is_primary: true,
    }}));
  };

  const cancelAddContact = (lenderId) => {
    setNewContactDrafts(prev => { const n = { ...prev }; delete n[lenderId]; return n; });
  };

  const updateNewContactField = (lenderId, field, value) => {
    setNewContactDrafts(prev => ({ ...prev, [lenderId]: { ...prev[lenderId], [field]: value } }));
  };

  const handleCreateContact = async (lenderId) => {
    const draft = newContactDrafts[lenderId];
    if (!draft?.contact_name) { toast.error('Contact Name is required'); return; }
    if (!draft?.contact_email) { toast.error('Contact Email is required'); return; }
    try {
      await createTenantLenderContact({ tenant_lender_id: lenderId, ...draft });
      toast.success('Contact added');
      cancelAddContact(lenderId);
      await load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add contact'); }
  };

  // ── Rule actions ──
  const getRuleForLenderProduct = (lenderId, productType) => {
    return commissionRules.find(r => r.tenant_lender_id === lenderId && r.product_type === productType);
  };

  const getActiveRuleState = (lenderId, productType) => {
    const editKey = `${lenderId}_${productType}`;
    if (ruleEdits[editKey]) return ruleEdits[editKey];
    
    const existing = getRuleForLenderProduct(lenderId, productType);
    if (existing) return existing;
    
    return {
      payout_basis: 'NET_DISBURSED',
      commission_type: 'HYBRID',
      effective_from: '',
      max_cap_amount: '',
      volume_slabs: [],
      case_count_slabs: [],
      special_schemes: []
    };
  };

  const updateRuleEdit = (lenderId, productType, updates) => {
    const editKey = `${lenderId}_${productType}`;
    const currentState = getActiveRuleState(lenderId, productType);
    setRuleEdits(prev => ({ ...prev, [editKey]: { ...currentState, ...updates } }));
  };

  const handleSaveRule = async (lenderId, productType) => {
    const editKey = `${lenderId}_${productType}`;
    const stateToSave = ruleEdits[editKey];
    if (!stateToSave) return;

    try {
      const existing = getRuleForLenderProduct(lenderId, productType);
      const payload = {
        tenant_lender_id: lenderId,
        product_type: productType,
        payout_basis: stateToSave.payout_basis,
        commission_type: stateToSave.commission_type || 'HYBRID',
        is_active: true,
        effective_from: stateToSave.effective_from || '',
        max_cap_amount: stateToSave.max_cap_amount || null,
        volume_slabs: stateToSave.volume_slabs || [],
        case_count_slabs: stateToSave.case_count_slabs || [],
        special_schemes: stateToSave.special_schemes || []
      };

      if (existing) {
        await updateCommissionRule(existing.id, payload);
        toast.success(`${productType} rules updated`);
      } else {
        await createCommissionRule(payload);
        toast.success(`${productType} rules saved`);
      }
      
      setRuleEdits(prev => { const n = {...prev}; delete n[editKey]; return n; });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save rules');
    }
  };

  return (
    <div className="dlc-page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`
        .dlc-page .card, .dlc-page .btn, .dlc-page .badge, .dlc-page .form-control,
        .dlc-page .modal-box, .dlc-page .table-wrapper, .dlc-page table { border-radius: 0 !important; }
        @media (max-width: 768px) {
          .dlc-page > div { padding: 80px 24px 24px !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <PageHeader
        title="Lender Contacts"
        subtitle="Manage lender contacts & payout slabs"
      />
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => setLenderModal({ open: true })} style={btnPrimary}>
            <Plus size={16} /> Add Lender
          </button>
        </div>
      )}

      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        Contact details & commission rules per lender — configured per product
      </div>

      <div style={{
        background: 'var(--info-bg)', border: '1px solid var(--info)', borderRadius: 0,
        padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10,
        fontSize: 13, color: 'var(--info)', lineHeight: 1.5
      }}>
        <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>DSA Admin only.</strong> Commission rules <strong>must be explicitly configured per lender-product combination.</strong> Lender name cannot be edited once added. Subvention is recorded at the time of disbursement entry.
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={36} />
        </div>
      ) : lenders.length === 0 ? (
        <div style={emptyCard}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No lenders configured yet</h3>
          {isAdmin && (
            <button onClick={() => setLenderModal({ open: true })} style={btnPrimary}>
              <Plus size={16} /> Add First Lender
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lenders.map(lender => {
            const isExpanded = expanded[lender.id];
            const lenderContacts = lender.contacts || [];
            const isAddingContact = !!newContactDrafts[lender.id];

            const activeProduct = activeProductTabs[lender.id] || PRODUCT_TYPES[0];
            const ruleState = getActiveRuleState(lender.id, activeProduct);
            const isEditingRule = !!ruleEdits[`${lender.id}_${activeProduct}`];
            
            const configuredProductsCount = PRODUCT_TYPES.filter(pt => getRuleForLenderProduct(lender.id, pt)).length;

            return (
              <div key={lender.id} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 0,
                boxShadow: isExpanded ? 'var(--shadow)' : 'var(--shadow-sm)',
                overflow: 'hidden', transition: 'all 0.2s'
              }}>
                {/* Header */}
                <div style={{
                  padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: 12,
                  cursor: 'pointer', background: isExpanded ? 'var(--bg-elevated)' : 'var(--bg-surface)'
                }} onClick={() => toggleExpand(lender.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 0, background: 'var(--primary-dark)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0
                    }}>
                      {lender.lender_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{lender.lender_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        LAP · HL · Working Capital · Term Loan
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>Active</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{configuredProductsCount} products configured</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{lenderContacts.length} contact{lenderContacts.length === 1 ? '' : 's'}</span>
                    {isExpanded ? <ChevronUp size={20} color="var(--text-tertiary)" /> : <ChevronDown size={20} color="var(--text-tertiary)" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {/* Contact Details Section — a lender can have multiple
                        contacts, one per product type (or a single 'ALL'
                        contact), so each is its own editable/deletable row
                        rather than a single fixed set of fields. */}
                    <div style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        <div style={sectionTitle}>CONTACT DETAILS</div>
                        {!isAddingContact && (
                          <button onClick={() => startAddContact(lender.id)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none',
                            border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 0,
                            padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                          }}>
                            <Plus size={13} /> Add Contact
                          </button>
                        )}
                      </div>

                      {lenderContacts.length === 0 && !isAddingContact && (
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0 4px' }}>
                          No contacts configured yet.
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {lenderContacts.map(contact => {
                          const isEditingThis = !!contactEdits[contact.id];
                          const editState = contactEdits[contact.id];
                          return (
                            <div key={contact.id} style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', padding: '14px 16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {PRODUCT_TYPES.includes(contact.product_type)
                                    ? <ProductBadge type={contact.product_type} />
                                    : <span style={{ padding: '2px 10px', borderRadius: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>{contact.product_type}</span>}
                                  {contact.is_primary && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', letterSpacing: '0.5px' }}>PRIMARY</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {isEditingThis ? (
                                    <>
                                      <button onClick={() => saveEditContact(contact.id)} title="Save" style={iconBtn}><Check size={15} color="var(--success)" /></button>
                                      <button onClick={() => cancelEditContact(contact.id)} title="Cancel" style={iconBtn}><X size={15} /></button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditContact(contact)} title="Edit contact" style={iconBtn}><Edit2 size={14} /></button>
                                      <button onClick={() => handleDeleteContact(contact)} title="Delete contact" style={iconBtn}><Trash2 size={14} color="var(--error)" /></button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {isEditingThis ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginTop: 12 }}>
                                  <div>
                                    <label style={inputLabel}>PRODUCT</label>
                                    <select value={editState.product_type} onChange={e => updateEditField(contact.id, 'product_type', e.target.value)} style={inputStyle}>
                                      <option value="ALL">ALL</option>
                                      {PRODUCT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={inputLabel}>CONTACT PERSON</label>
                                    <input value={editState.contact_name} onChange={e => updateEditField(contact.id, 'contact_name', e.target.value)} style={inputStyle} placeholder="Suresh Nair" />
                                  </div>
                                  <div>
                                    <label style={inputLabel}>MOBILE</label>
                                    <input value={editState.contact_mobile} onChange={e => updateEditField(contact.id, 'contact_mobile', e.target.value)} style={inputStyle} placeholder="9820001122" />
                                  </div>
                                  <div>
                                    <label style={inputLabel}>EMAIL</label>
                                    <input value={editState.contact_email} onChange={e => updateEditField(contact.id, 'contact_email', e.target.value)} style={inputStyle} placeholder="suresh.nair@hdfc.com" />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={!!editState.is_primary} onChange={e => updateEditField(contact.id, 'is_primary', e.target.checked)} />
                                      Primary for this product
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginTop: 10, fontSize: 13 }}>
                                  <div><span style={{ color: 'var(--text-tertiary)' }}>Contact: </span><strong>{contact.contact_name}</strong></div>
                                  <div><span style={{ color: 'var(--text-tertiary)' }}>Mobile: </span>{contact.contact_mobile || '—'}</div>
                                  <div><span style={{ color: 'var(--text-tertiary)' }}>Email: </span>{contact.contact_email}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {isAddingContact && (
                          <div style={{ border: '1px dashed var(--primary)', background: 'var(--primary-subtle)', padding: '14px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                              <div>
                                <label style={inputLabel}>PRODUCT *</label>
                                <select value={newContactDrafts[lender.id].product_type} onChange={e => updateNewContactField(lender.id, 'product_type', e.target.value)} style={inputStyle}>
                                  <option value="ALL">ALL</option>
                                  {PRODUCT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={inputLabel}>CONTACT PERSON *</label>
                                <input value={newContactDrafts[lender.id].contact_name} onChange={e => updateNewContactField(lender.id, 'contact_name', e.target.value)} style={inputStyle} placeholder="Suresh Nair" />
                              </div>
                              <div>
                                <label style={inputLabel}>MOBILE</label>
                                <input value={newContactDrafts[lender.id].contact_mobile} onChange={e => updateNewContactField(lender.id, 'contact_mobile', e.target.value)} style={inputStyle} placeholder="9820001122" />
                              </div>
                              <div>
                                <label style={inputLabel}>EMAIL *</label>
                                <input value={newContactDrafts[lender.id].contact_email} onChange={e => updateNewContactField(lender.id, 'contact_email', e.target.value)} style={inputStyle} placeholder="suresh.nair@hdfc.com" />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                  <input type="checkbox" checked={!!newContactDrafts[lender.id].is_primary} onChange={e => updateNewContactField(lender.id, 'is_primary', e.target.checked)} />
                                  Primary for this product
                                </label>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                              <button onClick={() => cancelAddContact(lender.id)} style={btnOutline}>Cancel</button>
                              <button onClick={() => handleCreateContact(lender.id)} style={btnPrimary}>Add Contact</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ height: 1, background: 'var(--border)' }} />

                    {/* Commission Rules Section */}
                    <div style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Briefcase size={16} color="var(--text-secondary)" />
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>Commission Rules</span>
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Configured per product · Slabs are monthly (reset each month)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Payout on:</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="radio" checked={ruleState.payout_basis === 'NET_DISBURSED'}
                              onChange={() => updateRuleEdit(lender.id, activeProduct, { payout_basis: 'NET_DISBURSED' })}/>
                            Net Disbursed
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="radio" checked={ruleState.payout_basis === 'GROSS_SANCTIONED'}
                              onChange={() => updateRuleEdit(lender.id, activeProduct, { payout_basis: 'GROSS_SANCTIONED' })}/>
                            Gross Sanctioned
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Effective From:</span>
                          <input type="date" value={ruleState.effective_from ? ruleState.effective_from.split('T')[0] : ''} onChange={e => updateRuleEdit(lender.id, activeProduct, { effective_from: e.target.value })} style={{ ...inputStyle, width: 140, padding: '4px 0', borderBottom: '1px solid var(--border)' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Max Payout Cap (₹):</span>
                          <input type="number" placeholder="No limit" value={ruleState.max_cap_amount || ''} onChange={e => updateRuleEdit(lender.id, activeProduct, { max_cap_amount: e.target.value ? Number(e.target.value) : '' })} style={{ ...inputStyle, width: 140, padding: '4px 0', borderBottom: '1px solid var(--border)' }} />
                        </div>
                      </div>

                      {/* Product Tabs */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                        {PRODUCT_TYPES.map(pt => {
                          const isConfigured = !!getRuleForLenderProduct(lender.id, pt);
                          const isActive = activeProduct === pt;
                          return (
                            <button key={pt} onClick={() => setActiveProductTabs({...activeProductTabs, [lender.id]: pt})} style={{
                              padding: '8px 16px', borderRadius: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                              border: isActive ? 'none' : '1px solid var(--border)',
                              background: isActive ? 'var(--primary)' : 'var(--bg-surface)',
                              color: isActive ? '#fff' : 'var(--text-secondary)',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}>
                              {pt}
                              {isConfigured ? <Check size={12} color={isActive ? '#A7F3D0' : 'var(--success)'} /> : <span style={{ fontSize: 10, color: isActive ? '#C7D2FE' : 'var(--text-tertiary)' }}>Not set</span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Slabs Grids */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40 }}>
                        {/* Volume Slabs */}
                        <div>
                          <div style={slabHeader}>VOLUME-BASED SLABS (MONTHLY DISBURSEMENT)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 12, marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                            <div>FROM (₹ CR)</div>
                            <div>TO (₹ CR)</div>
                            <div>RATE (%)</div>
                            <div></div>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {ruleState.volume_slabs.map((slab, idx) => (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 12, alignItems: 'center' }}>
                                <input type="number" value={slab.from_amount} 
                                  onChange={e => {
                                    const newSlabs = [...ruleState.volume_slabs];
                                    newSlabs[idx].from_amount = e.target.value;
                                    updateRuleEdit(lender.id, activeProduct, { volume_slabs: newSlabs });
                                  }} style={slabInput} />
                                <input type="number" value={slab.to_amount || ''} placeholder="∞"
                                  onChange={e => {
                                    const newSlabs = [...ruleState.volume_slabs];
                                    newSlabs[idx].to_amount = e.target.value;
                                    updateRuleEdit(lender.id, activeProduct, { volume_slabs: newSlabs });
                                  }} style={slabInput} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="number" step="0.01" value={slab.percent_rate} 
                                    onChange={e => {
                                      const newSlabs = [...ruleState.volume_slabs];
                                      newSlabs[idx].percent_rate = e.target.value;
                                      updateRuleEdit(lender.id, activeProduct, { volume_slabs: newSlabs });
                                    }} style={slabInput} />
                                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>%</span>
                                </div>
                                <button onClick={() => {
                                  const newSlabs = ruleState.volume_slabs.filter((_, i) => i !== idx);
                                  updateRuleEdit(lender.id, activeProduct, { volume_slabs: newSlabs });
                                }} style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--error)' }}>
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button onClick={() => {
                              const newSlabs = [...ruleState.volume_slabs, { from_amount: 0, to_amount: '', percent_rate: 0 }];
                              updateRuleEdit(lender.id, activeProduct, { volume_slabs: newSlabs });
                            }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content', marginTop: 4 }}>
                              <Plus size={14} /> Add Slab
                            </button>
                          </div>
                        </div>

                        {/* Cases Slabs */}
                        <div>
                          <div style={slabHeader}>CASES-BASED SLABS (MONTHLY CASE COUNT)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 12, marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                            <div>FROM (CASES)</div>
                            <div>TO (CASES)</div>
                            <div>PAYOUT PER CASE (₹)</div>
                            <div></div>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {ruleState.case_count_slabs.map((slab, idx) => (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 12, alignItems: 'center' }}>
                                <input type="number" value={slab.from_cases} 
                                  onChange={e => {
                                    const newSlabs = [...ruleState.case_count_slabs];
                                    newSlabs[idx].from_cases = e.target.value;
                                    updateRuleEdit(lender.id, activeProduct, { case_count_slabs: newSlabs });
                                  }} style={slabInput} />
                                <input type="number" value={slab.to_cases || ''} placeholder="∞"
                                  onChange={e => {
                                    const newSlabs = [...ruleState.case_count_slabs];
                                    newSlabs[idx].to_cases = e.target.value;
                                    updateRuleEdit(lender.id, activeProduct, { case_count_slabs: newSlabs });
                                  }} style={slabInput} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>₹</span>
                                  <input type="number" value={slab.payout_per_case} 
                                    onChange={e => {
                                      const newSlabs = [...ruleState.case_count_slabs];
                                      newSlabs[idx].payout_per_case = e.target.value;
                                      updateRuleEdit(lender.id, activeProduct, { case_count_slabs: newSlabs });
                                    }} style={slabInput} />
                                </div>
                                <button onClick={() => {
                                  const newSlabs = ruleState.case_count_slabs.filter((_, i) => i !== idx);
                                  updateRuleEdit(lender.id, activeProduct, { case_count_slabs: newSlabs });
                                }} style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--error)' }}>
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button onClick={() => {
                              const newSlabs = [...ruleState.case_count_slabs, { from_cases: 0, to_cases: '', payout_per_case: 0 }];
                              updateRuleEdit(lender.id, activeProduct, { case_count_slabs: newSlabs });
                            }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content', marginTop: 4 }}>
                              <Plus size={14} /> Add Slab
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Special Schemes */}
                      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <div>
                            <div style={slabHeader}>SPECIAL PAYOUT SCHEMES</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Time-bound bonuses — stack with regular slabs</div>
                          </div>
                          <button onClick={() => {
                            const newSchemes = [...(ruleState.special_schemes || []), { scheme_name: '', basis: 'CASE_COUNT', valid_from: '', valid_to: '', bonus_per_case: '', bonus_percent: '', is_active: true }];
                            updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                          }} style={{ ...btnOutline, padding: '6px 12px', fontSize: 12 }}>
                            <Plus size={13} /> Add Scheme
                          </button>
                        </div>
                        
                        {!ruleState.special_schemes || ruleState.special_schemes.length === 0 ? (
                          <div style={{ padding: 14, background: 'var(--bg-elevated)', border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            No special schemes configured.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {ruleState.special_schemes.map((sc, idx) => (
                              <div key={idx} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '12px 16px', position: 'relative' }}>
                                <button onClick={() => {
                                  const newSchemes = ruleState.special_schemes.filter((_, i) => i !== idx);
                                  updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                }} style={{ position: 'absolute', top: 12, right: 16, background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--error)' }}>
                                  <X size={12} />
                                </button>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, paddingRight: 32 }}>
                                  <div>
                                    <label style={inputLabel}>SCHEME NAME</label>
                                    <input value={sc.scheme_name || ''} placeholder="e.g. Q1FY26 Bonus" onChange={e => {
                                      const newSchemes = [...ruleState.special_schemes];
                                      newSchemes[idx].scheme_name = e.target.value;
                                      updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                    }} style={inputStyle} />
                                  </div>
                                  <div>
                                    <label style={inputLabel}>BASIS</label>
                                    <select value={sc.basis || 'CASE_COUNT'} onChange={e => {
                                      const newSchemes = [...ruleState.special_schemes];
                                      newSchemes[idx].basis = e.target.value;
                                      updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                    }} style={inputStyle}>
                                      <option value="CASE_COUNT">Case Count</option>
                                      <option value="VOLUME">Volume</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={inputLabel}>VALID FROM</label>
                                    <input type="date" value={sc.valid_from ? sc.valid_from.split('T')[0] : ''} onChange={e => {
                                      const newSchemes = [...ruleState.special_schemes];
                                      newSchemes[idx].valid_from = e.target.value;
                                      updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                    }} style={inputStyle} />
                                  </div>
                                  <div>
                                    <label style={inputLabel}>VALID TO</label>
                                    <input type="date" value={sc.valid_to ? sc.valid_to.split('T')[0] : ''} onChange={e => {
                                      const newSchemes = [...ruleState.special_schemes];
                                      newSchemes[idx].valid_to = e.target.value;
                                      updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                    }} style={inputStyle} />
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginTop: 12, paddingRight: 32 }}>
                                  <div>
                                    <label style={inputLabel}>BONUS RATE (%)</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <input type="number" step="0.01" placeholder="e.g. 0.5" value={sc.bonus_percent || ''} onChange={e => {
                                        const newSchemes = [...ruleState.special_schemes];
                                        newSchemes[idx].bonus_percent = e.target.value;
                                        updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                      }} style={inputStyle} />
                                      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>%</span>
                                    </div>
                                  </div>
                                  <div>
                                    <label style={inputLabel}>BONUS PER CASE (₹)</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>₹</span>
                                      <input type="number" placeholder="e.g. 500" value={sc.bonus_per_case || ''} onChange={e => {
                                        const newSchemes = [...ruleState.special_schemes];
                                        newSchemes[idx].bonus_per_case = e.target.value;
                                        updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                      }} style={inputStyle} />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={sc.is_active !== false} onChange={e => {
                                        const newSchemes = [...ruleState.special_schemes];
                                        newSchemes[idx].is_active = e.target.checked;
                                        updateRuleEdit(lender.id, activeProduct, { special_schemes: newSchemes });
                                      }} />
                                      Active Scheme
                                    </label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Info Note */}
                      <div style={{
                        background: 'var(--info-bg)', border: '1px solid var(--info)', borderRadius: 0,
                        padding: '12px 16px', marginTop: 24, display: 'flex', gap: 10,
                        fontSize: 13, color: 'var(--info)', lineHeight: 1.5
                      }}>
                        <span style={{ fontSize: 16 }}>📌</span>
                        <div>
                          <strong>Both slabs are calculated independently each month and the totals are added together.</strong> Volume-based is on net disbursed amount (as set above). Cases-based is per number of cases disbursed in the calendar month.
                        </div>
                      </div>

                      {/* Save Button Container */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                        <button 
                          onClick={() => handleSaveRule(lender.id, activeProduct)}
                          disabled={!isEditingRule}
                          style={{
                            ...btnPrimary, opacity: isEditingRule ? 1 : 0.5,
                            borderRadius: 0, padding: '8px 24px'
                          }}
                        >
                          Save {activeProduct} Rules
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <LenderModal
        isOpen={lenderModal.open}
        onClose={() => setLenderModal({ open: false })}
        onSave={handleAddLender}
        existingLenders={lenders}
      />
      </div>
    </div>
  );
}

// ── Shared Styles (CSS variable tokens — same theme as the dashboard) ────────
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
  backdropFilter: 'blur(4px)', zIndex: 9999,
  display: 'flex', justifyContent: 'center', alignItems: 'center',
};
const modalBox = {
  background: 'var(--bg-surface)', width: '94%', maxWidth: 480, borderRadius: 0,
  boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
};
const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 24px', borderBottom: '1px solid var(--border)',
};
const modalFooter = {
  display: 'flex', justifyContent: 'flex-end', gap: 12,
  padding: '16px 24px', borderTop: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
};
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
};
const inputStyle = {
  width: '100%', padding: '8px 0', borderRadius: 0, fontSize: 14, fontWeight: 600,
  border: 'none', borderBottom: '2px solid var(--border)', background: 'transparent',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '8px 16px', borderRadius: 0, fontSize: 14, fontWeight: 600,
  background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
};
const btnOutline = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '8px 16px', borderRadius: 0, fontSize: 14, fontWeight: 600,
  background: 'var(--bg-surface)', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', cursor: 'pointer',
};
const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center',
  padding: 6, borderRadius: 0, transition: 'background 0.2s',
};

const emptyCard = {
  textAlign: 'center', padding: '80px 40px', background: 'var(--bg-surface)',
  borderRadius: 0, border: '2px dashed var(--border-strong)',
};
const sectionTitle = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em'
};
const inputLabel = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6
};
const slabHeader = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16
};
const slabInput = {
  width: '100%', padding: '8px 0', borderRadius: 0, border: 'none', borderBottom: '2px solid var(--border)',
  background: 'transparent', color: 'var(--text-primary)', outline: 'none',
  fontSize: 13, fontWeight: 600, textAlign: 'center'
};
