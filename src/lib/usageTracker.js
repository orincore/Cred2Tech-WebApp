// Measures how long the app is really in use, for the Super Admin "Device analytics" page.
//
// "Screen time" = seconds the app was in the FOREGROUND and the person INTERACTED within the last 60 seconds. A tab left
// open in the background, or a screen left on while nobody touches it, adds nothing. The counter is cumulative for one
// "visit" (a tab, or an installed-app launch) and is sent to the server every 30 seconds and when the tab is hidden; the
// server also refuses to let it grow faster than real time (backend usage.service.js), so a repeat or retry can never
// double-count.
//
// A new visit starts after 30 minutes without interaction and at Indian midnight, so no time is credited to the wrong day.
// Nothing about WHAT the person looked at is collected: no page, no URL, no content. Only device facts and seconds.
//
// The class takes its clock, visibility and sender as parameters so every rule can be tested without a browser.

export const TICK_MS = 5000;               // how often time is added up
export const SEND_EVERY_MS = 30000;        // how often the total is reported
export const ACTIVE_WINDOW_MS = 60000;     // interaction within this long counts as "in use"
export const NEW_VISIT_AFTER_MS = 30 * 60 * 1000;
const MAX_TICK_GAP_MS = 10000;             // a tick later than this means the device slept: do not count the gap

export const istDay = (ms) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const newId = () => {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, ''); } catch { /* fall through */ }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 40);
};

export function createUsageTracker({ now = Date.now, isVisible = () => true, send, getHints = () => ({}) }) {
  let sid = null;
  let day = null;
  let activeMs = 0;
  let lastTick = now();
  let lastInputAt = 0;
  let lastSendAt = 0;
  let lastSentSeconds = -1;
  let hintsSent = false;

  const seconds = () => Math.floor(activeMs / 1000);

  function report(final) {
    if (!sid) return;
    const s = seconds();
    if (s <= 0 || s === lastSentSeconds) return;       // nothing new to say
    const body = { sid, active_s: s };
    if (!hintsSent) body.hints = getHints();
    lastSentSeconds = s;
    lastSendAt = now();
    hintsSent = true;
    try { send(body, { final: !!final }); } catch { /* reporting is best-effort and must never disturb the app */ }
  }

  function endVisit() {
    report(true);
    sid = null; day = null; activeMs = 0; lastSentSeconds = -1; hintsSent = false;
  }

  /** The person touched the app (pointer, key, scroll, touch). */
  function input() { lastInputAt = now(); }

  /** Call every TICK_MS. */
  function tick() {
    const t = now();
    const gap = t - lastTick;
    lastTick = t;

    // A visit ends after a long quiet spell, or when the Indian day changes.
    if (sid && (t - lastInputAt > NEW_VISIT_AFTER_MS || istDay(t) !== day)) endVisit();

    const inUse = isVisible() && lastInputAt > 0 && t - lastInputAt <= ACTIVE_WINDOW_MS;
    if (inUse) {
      if (!sid) { sid = newId(); day = istDay(t); activeMs = 0; lastSentSeconds = -1; hintsSent = false; lastSendAt = 0; }
      activeMs += gap > 0 && gap <= MAX_TICK_GAP_MS ? gap : TICK_MS;
    }
    if (sid && t - lastSendAt >= SEND_EVERY_MS) report(false);
  }

  /** The tab was hidden or is closing: send what we have now, because there may be no later chance. */
  function flush() { report(true); }

  return { input, tick, flush, endVisit, _state: () => ({ sid, day, activeMs, lastSentSeconds }) };
}

/** Wire a tracker to the real browser. Returns a stop function. */
export function startUsageTracking({ send, getHints }) {
  const tracker = createUsageTracker({ isVisible: () => document.visibilityState === 'visible', send, getHints });
  const onInput = () => tracker.input();
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove', 'click'];
  events.forEach((e) => window.addEventListener(e, onInput, { passive: true, capture: true }));
  window.addEventListener('scroll', onInput, { passive: true, capture: true }); // inner scroll containers do not bubble
  const onVisibility = () => { if (document.visibilityState === 'hidden') tracker.flush(); else tracker.input(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', tracker.flush);
  tracker.input(); // opening the app is itself an interaction
  const timer = setInterval(tracker.tick, TICK_MS);
  return () => {
    clearInterval(timer);
    events.forEach((e) => window.removeEventListener(e, onInput, true));
    window.removeEventListener('scroll', onInput, true);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', tracker.flush);
    tracker.flush();
  };
}

/** The facts only the browser knows, used by the server to tell an iPad from a Mac and a phone from a desktop. */
export function collectHints() {
  const standalone = (typeof navigator !== 'undefined' && navigator.standalone === true)
    || (typeof window !== 'undefined' && window.matchMedia && ['standalone', 'fullscreen', 'minimal-ui'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches));
  return {
    touch_points: navigator.maxTouchPoints || 0,
    screen_w: window.screen ? window.screen.width : null,
    screen_h: window.screen ? window.screen.height : null,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    installed: !!standalone,
  };
}
