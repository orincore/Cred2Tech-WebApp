import React from 'react';

// Renders a pull-button's label with its price: "Label (~X)" with the credit
// number in red, or "Label (~~~Y~~~ ~X~)" — the admin-set "before discount"
// price struck through, the real charged price next to it, both red — once
// an admin sets a higher actual_credit_cost than default_credit_cost on the
// Superadmin Pricing page (ApiPricing.actual_credit_cost; see
// pricing.service.js#getTenantCostsMatrix, which is the actual/discounted
// pair every caller of this component reads from). `discounted` missing
// (null/undefined — no cost row resolved at all) renders the bare label with
// no price; `discounted: 0` with a real `actual` is a genuine fully-discounted
// offer and must still render the strikethrough — but `actual` and
// `discounted` both 0 means no real price was ever set at all (not a free
// offer), so that case renders the bare label too.
export default function PriceTag({ label, actual, discounted }) {
  if (discounted == null) return label;
  if (actual === 0 && discounted === 0) return label;
  const hasDiscount = actual != null && actual > discounted;
  if (!hasDiscount) {
    return (
      <>
        {label} (~<span style={{ color: 'var(--error)', fontWeight: 700 }}>{discounted}</span>)
      </>
    );
  }
  return (
    <>
      {label} (~
      <span style={{ textDecoration: 'line-through', opacity: 0.65, marginRight: 4, color: 'var(--error)' }}>
        {actual}
      </span>
      <span style={{ color: 'var(--error)', fontWeight: 700 }}>{discounted}</span>)
    </>
  );
}
