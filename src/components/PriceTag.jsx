import React from 'react';

// Renders a pull-button's label with its price: "Label (~X Cr)" normally, or
// "Label (~~~Y Cr~~~ ~X Cr)" — the admin-set "before discount" price struck
// through, the real charged price next to it — once an admin sets a higher
// actual_credit_cost than default_credit_cost on the Superadmin Pricing page
// (ApiPricing.actual_credit_cost; see pricing.service.js#getTenantCostsMatrix,
// which is the actual/discounted pair every caller of this component reads
// from). `discounted` falsy renders the bare label with no price at all —
// matches every call site's own prior "cost ? `Label (~X Cr)` : 'Label'"
// fallback (a 0-credit/missing price means nothing to advertise).
export default function PriceTag({ label, actual, discounted, suffix = 'Cr' }) {
  if (!discounted) return label;
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
