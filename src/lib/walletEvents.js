// A tiny signal for "this wallet's balance just changed" (a recharge, a free-credit code, credits given to or taken back from a team
// member). Anything that shows the balance and cannot wait for its next poll (the low-balance banner) listens here and re-reads it
// at once. Plain DOM events: no state to keep in sync, and it works across components that do not share a parent.
const EVENT = 'c2t:wallet-changed';

export const notifyWalletChanged = () => {
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch (e) { /* a missing signal only means the next poll picks it up */ }
};

/** Returns an unsubscribe function. */
export const onWalletChanged = (handler) => {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
