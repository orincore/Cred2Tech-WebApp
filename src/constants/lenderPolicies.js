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

export const getLenderDisplayName = (lender = {}) => {
  const code = String(lender.code || lender.lender_code || '').toUpperCase();
  const name = String(lender.name || lender.lender_name || '').trim();
  const upperName = name.toUpperCase();
  if (code === BAJAJ_AFNP.code || BAJAJ_NAMES.some(alias => upperName === alias || upperName.startsWith(`${alias} -`))) {
    return BAJAJ_AFNP.displayName;
  }
  return name || 'Unnamed lender';
};
