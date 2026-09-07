export const BAJAJ_AFNP = {
  code: 'BAJAJ_AFNP',
  displayName: 'Bajaj Housing Finance Ltd - Near Prime & Affordable (AFNP)',
  schemes: [
    'Salaried',
    'Vanilla Income Program',
    'Banking Surrogate',
    'Gross Receipt Program',
    'AIP',
    'Low LTV',
    'Gross Profit Program',
    'Income Plus',
    'Rental Income Program',
    'GST Surplus',
  ],
};

const BAJAJ_NAMES = [
  'BAJAJ HOUSING FINANCE',
  'BAJAJ HOUSING FINANCE LTD',
  'BAJAJ HOUSING FINANCE NEAR PRIME & AFFORDABLE',
];

// Keep lender-specific method availability consistent with the ESR engine.
// This is a defensive UI filter for reports generated before the backend was
// updated; current reports are filtered by the backend before evaluation.
export const isSchemeDisabledForLender = (lenderPolicyKey, schemeName) => {
  const lenderKey = String(lenderPolicyKey || '').trim().toUpperCase();
  const method = String(schemeName || '').trim().toUpperCase();

  if (lenderKey === 'IIFL') {
    return /\bGRP\b|GROSS\s+RECEIPT|\bGST\b|GROSS\s+MARGIN|NET\s+WORTH|\bNWM\b|ASSESSED\s+INCOME|\bAIP\b/.test(method);
  }

  if (lenderKey === 'ICICI') {
    return /\bLIP\b|\bLOW\s+LTV\b/.test(method);
  }

  return false;
};

export const getLenderDisplayName = (lender = {}) => {
  const code = String(lender.code || lender.lender_code || '').toUpperCase();
  const name = String(lender.name || lender.lender_name || '').trim();
  const upperName = name.toUpperCase();
  if (code === BAJAJ_AFNP.code || BAJAJ_NAMES.some(alias => upperName === alias || upperName.startsWith(`${alias} -`))) {
    return BAJAJ_AFNP.displayName;
  }
  return name || 'Unnamed lender';
};
