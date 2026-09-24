// Tiny module-level signal: "is any first-time walkthrough (PageTour) pending
// or on screen right now?" PageTour registers itself from the moment it
// decides it will run until it finishes, is skipped, gives up, or unmounts.
// Other overlays that would otherwise stack on top of the walkthrough —
// currently the browser-notification prompt in NotificationContext — subscribe
// to this and hold off until it's clear, so a new user sees one popup at a
// time instead of several blurred layers at once.
const active = new Set();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function registerTour(key) {
  if (!active.has(key)) { active.add(key); emit(); }
}
export function unregisterTour(key) {
  if (active.delete(key)) emit();
}
export function subscribeTours(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function toursInProgress() {
  return active.size > 0;
}
