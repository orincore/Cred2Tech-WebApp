import React from 'react';

// Renders a pull-button's label with its price: "Label (~X Cr)" normally, or
// "Label (~~~Y Cr~~~ ~X Cr)" — the admin-set "before discount" price struck
// through, the real charged price next to it — once an admin sets a higher
// actual_credit_cost than default_credit_cost on the Superadmin Pricing page
// (ApiPricing.actual_credit_cost; see pricing.service.js#getTenantCostsMatrix,
// which is the actual/discounted pair every caller of this component reads
// from). `discounted` missing (null/undefined — no cost row resolved at all)
// renders the bare label with no price; `discounted: 0` is a real free price
// and must still render (and still show the strikethrough if actual > 0), so
// this checks `== null` rather than falsiness.
export default function PriceTag({ label, actual, discounted, suffix = 'Cr' }) {
  if (discounted == null) return label;
  const hasDiscount = actual != null && actual > discounted;
  if (!hasDiscount) return `${label} (~${discounted} ${suffix})`;
  return (
    <>
      {label} (~
      <span style={{ textDecoration: 'line-through', opacity: 0.65, marginRight: 4 }}>
        {actual} {suffix}
      </span>
      {discounted} {suffix})
    </>
  );
}
