// Shared KYC/document category structure — the single source of truth for
// how a case's documents are grouped, used by both the Prepare Proposal
// page (where a DSA uploads into these categories) and the Case Detail
// page's read-only Documents tab (which must show the same structure so a
// document always lands in the category a user expects, wherever they look
// for it). Keeping this in one place means a category added here shows up
// consistently on both pages instead of drifting apart.
//
// Each category's `options` list is also what decides which document_type
// values belong to it (see docBelongsToCategory below) — a document only
// renders under a category if its type is one of that category's options,
// so a real document_type must be listed here or it falls through to the
// freeform "Other Documents" bucket. `perApplicant` categories (ID Proof,
// Residence Address Proof) render once per applicant; everything else is
// entity-level, shared by the case.
export const KYC_CATEGORIES = [
  {
    id: 'id_proof', label: 'ID Proof', perApplicant: true, required: true,
    options: [
      { type: 'PAN_CARD', label: 'PAN Card' },
      { type: 'DRIVING_LICENSE', label: 'Driving Licence' },
      { type: 'VOTER_ID', label: 'Voter ID Card' },
      { type: 'PASSPORT', label: 'Passport' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  {
    id: 'residence_address_proof', label: 'Residence Address Proof', perApplicant: true, required: true,
    options: [
      { type: 'UTILITY_BILL', label: 'Utility Bill' },
      { type: 'RENT_AGREEMENT', label: 'Rent Agreement' },
      { type: 'VOTER_ID', label: 'Voter ID Card' },
      { type: 'PASSPORT', label: 'Passport' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  // Business/self-employed only — never applicable to a salaried case.
  {
    id: 'incorporation', label: 'Incorporation Document', perApplicant: false, msmeOnly: true, required: false,
    options: [
      { type: 'CERTIFICATE_OF_INCORPORATION', label: 'Certificate of Incorporation' },
      { type: 'MOA', label: 'MOA (Memorandum of Association)' },
      { type: 'AOA', label: 'AOA (Articles of Association)' },
      { type: 'PARTNERSHIP_DEED', label: 'Partnership Deed' },
    ],
  },
  {
    id: 'office_address_proof', label: 'Office Address Proof', perApplicant: false, msmeOnly: true, required: false,
    options: [
      { type: 'UTILITY_BILL', label: 'Utility Bill' },
      { type: 'RENT_AGREEMENT', label: 'Rent Agreement / Lease Deed' },
      { type: 'TRADE_LICENSE', label: 'Trade License' },
      { type: 'GST_PDF', label: 'GST Registration Certificate' },
    ],
  },
  {
    id: 'income_documents', label: 'Income Documents', perApplicant: false, required: true,
    options: [
      { type: 'ITR', label: 'ITR' },
      { type: 'BANK_STATEMENT', label: 'Bank Statement' },
      { type: 'GST_RETURNS', label: 'GST Returns' },
      { type: 'SALARY_SLIP', label: 'Salary Slip' },
      { type: 'FORM_16', label: 'Form 16' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  // Kept separate from Income Documents (manual uploads) — these are the
  // exact document_type values the automated pull pipeline saves
  // (pullSync.service.js / document.service.js).
  {
    id: 'api_fetched_documents', label: 'Fetched from API', perApplicant: false, required: false,
    options: [
      { type: 'ITR_EXCEL', label: 'ITR (Excel)' },
      { type: 'BANK_EXCEL', label: 'Bank Statement (Excel)' },
      { type: 'GST_REPORT_PDF', label: 'GST Report (PDF)' },
      { type: 'GST_REPORT_EXCEL', label: 'GST Report (Excel)' },
    ],
  },
  {
    id: 'property_documents', label: 'Property Documents', perApplicant: false, required: false,
    options: [
      { type: 'SALE_DEED', label: 'Sale Deed' },
      { type: 'ENCUMBRANCE_CERTIFICATE', label: 'Encumbrance Certificate (EC)' },
      { type: 'KHATA', label: 'Khata / Property Tax Receipt' },
      { type: 'OTHER', label: 'Others', customLabel: true },
    ],
  },
  // Freeform catch-all — no fixed sub-type list, just a name + upload.
  { id: 'others', label: 'Other Documents', perApplicant: false, required: false, freeform: true },
];

// Master dropdown offered on any user-created custom category — every
// sub-type across the fixed categories, deduped, plus an Others entry.
export const ALL_DOCUMENT_OPTIONS = (() => {
  const seen = new Map();
  for (const cat of KYC_CATEGORIES) {
    for (const opt of cat.options || []) {
      if (opt.type !== 'OTHER' && !seen.has(opt.type)) seen.set(opt.type, opt.label);
    }
  }
  return [
    ...[...seen.entries()].map(([type, label]) => ({ type, label })),
    { type: 'OTHER', label: 'Others', customLabel: true },
  ];
})();

// A doc belongs to a category if its type is one of the category's fixed
// options — except type OTHER, which is shared by several categories'
// "Others" sub-option, the freeform bucket, and every custom category (custom
// categories always upload as OTHER regardless of which dropdown sub-type was
// picked, so they never collide with a fixed category that happens to share
// the same sub-type label), so those are disambiguated by metadata.category
// (stamped at upload time). Legacy/foreign OTHER docs with no such tag fall
// back to the freeform "Other Documents" bucket.
export function docBelongsToCategory(doc, category) {
  if (doc.document_type === 'OTHER' || category.custom) {
    return (doc.metadata?.category || 'others') === category.id;
  }
  return (category.options || []).some(o => o.type === doc.document_type);
}

// Groups a flat document list into the same category structure the Prepare
// Proposal page uses, for any read-only display (e.g. the Case Detail
// page's Documents tab). Returns an ordered array of
// { id, label, perApplicant, docs: Document[] } — custom (user-created)
// categories discovered from doc metadata are appended after the fixed
// ones, same recovery logic ProposalPage.jsx uses so they still show up
// correctly labeled after a reload.
export function groupDocumentsByCategory(documents, { isSalaried = false } = {}) {
  const fixedCategories = KYC_CATEGORIES.filter(cat => !(cat.msmeOnly && isSalaried));
  const fixedIds = new Set(fixedCategories.map(c => c.id));

  const discoveredCustom = [];
  const seenCustomIds = new Set();
  for (const d of documents) {
    const catId = d.metadata?.category;
    if (!catId || fixedIds.has(catId) || seenCustomIds.has(catId)) continue;
    seenCustomIds.add(catId);
    discoveredCustom.push({
      id: catId, label: d.metadata?.category_label || catId, perApplicant: false, custom: true,
    });
  }

  const allCategories = [...fixedCategories, ...discoveredCustom];
  return allCategories
    .map(cat => ({ ...cat, docs: documents.filter(d => docBelongsToCategory(d, cat)) }))
    .filter(cat => cat.docs.length > 0);
}
