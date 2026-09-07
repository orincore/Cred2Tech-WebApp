import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DSA_TOUR_ROLES } from '../../constants/roles';

// Same custom-decelerate curve ProfilePage's modal chrome already uses
// everywhere — reused here so this overlay's motion reads as part of the
// same design system rather than a bolted-on animation library default.
const EASE = [0.32, 0.72, 0, 1];

const MOBILE_BREAKPOINT = 768;
const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 340;

// ─── Single-active-tour lock ────────────────────────────────────────────────
// More than one <PageTour> is mounted at once in practice — the app-shell
// "global-nav" tour lives in AppLayout (always mounted) alongside whichever
// page-specific tour the current route renders — and both auto-start on
// their own independent timer. Without coordination, a first-time visit to
// a page that also has its own tour showed BOTH overlays racing at once:
// two spotlights lit at the same time, two tooltip cards stacked on top of
// each other (reading as "one set of instructions with no Next/Skip" since
// only the top card was visible, while the *other* tour's ring was still
// highlighting a second, unrelated element in the background).
// This is a plain module-level singleton, not React state — it doesn't need
// to trigger a render anywhere, it only needs every PageTour instance to
// agree on who currently owns the floor.
let activeTourOwner = null;
function claimTour(pageKey) {
  if (activeTourOwner && activeTourOwner !== pageKey) return false;
  activeTourOwner = pageKey;
  return true;
}
function releaseTour(pageKey) {
  if (activeTourOwner === pageKey) activeTourOwner = null;
}

// Stable references (not re-created per render) so framer-motion always sees
// the exact same `animate`/`transition` objects for the ring's glow loop —
// otherwise every re-render this component does while tracking the target
// (see the settle-poll below) hands motion a brand-new object each time,
// which reads as "restart the animation from scratch" and made the pulsing
// glow look like it never actually animated at all.
const RING_GLOW_ANIMATE = {
  boxShadow: [
    '0 0 0 4px rgba(79,70,229,0.18), 0 0 24px 4px rgba(79,70,229,0.35)',
    '0 0 0 7px rgba(79,70,229,0.10), 0 0 34px 10px rgba(79,70,229,0.22)',
    '0 0 0 4px rgba(79,70,229,0.18), 0 0 24px 4px rgba(79,70,229,0.35)',
  ],
};
const RING_GLOW_TRANSITION = { duration: 2.1, repeat: Infinity, ease: 'easeInOut' };

const rectsEqual = (a, b) => !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * A first-time-visit, spotlighted walkthrough for one screen.
 *
 * Mount one per page (or per major panel of a page) with a stable `pageKey`
 * and a `steps` array of `{ target, title, description, placement? }`,
 * where `target` is a CSS selector matching a `data-tour="..."` attribute
 * already present in that page's JSX. Auto-starts, once, a short beat after
 * mount — but ONLY for DSA_ADMIN/DSA_MEMBER/SUB_DSA users who haven't
 * already finished or skipped this exact `pageKey` before. That "seen" flag
 * lives on the account itself (`user.tour_flags[pageKey]`, part of the
 * already-fetched /auth/me response) rather than in localStorage, so it
 * carries across browsers and devices for the same account, not just this
 * one browser (see AuthContext.jsx's markTourSeen) — AND only
 * if no other PageTour is currently showing (see the lock above); if one is,
 * this one keeps quietly retrying every 400ms until the floor is free, so
 * multiple tours queued on the same page always run one at a time, in turn,
 * never on top of each other.
 *
 * A step whose target isn't in the DOM (a control that doesn't render for
 * this user's role, a tab that isn't the active one, a mobile-only filter
 * still collapsed, ...) is dropped rather than shown floating/unanchored —
 * callers don't need to hand-filter steps per role or viewport themselves.
 */
const PageTour = ({ pageKey, steps, delay = 900 }) => {
  const { user, hasRole, markTourSeen: persistTourSeen } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const eligible = !!user && hasRole(DSA_TOUR_ROLES);
  const alreadySeen = !!user?.tour_flags?.[pageKey];

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [active, setActive] = useState(false);
  const [resolvedSteps, setResolvedSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);

  // Activation: waits for `delay`, then repeatedly tries to claim the
  // single-tour lock (in case another PageTour got there first) until it
  // succeeds or this component unmounts (e.g. the user navigated away).
  // Deliberately keyed only on [eligible, pageKey] — `steps` is very often a
  // fresh inline array/object on every render, and re-running this effect
  // every time would restart an in-progress tour.
  useEffect(() => {
    if (!eligible || !steps?.length || alreadySeen) return undefined;
    let cancelled = false;
    let pollId;

    const tryClaim = () => {
      if (cancelled) return;
      if (!claimTour(pageKey)) return; // another tour currently owns the floor — keep polling
      if (pollId) clearInterval(pollId);
      const found = steps.filter((s) => document.querySelector(s.target));
      if (found.length) {
        setResolvedSteps(found);
        setStepIndex(0);
        setActive(true);
      } else {
        releaseTour(pageKey); // nothing resolvable right now — don't hold the floor for no reason
      }
    };

    const startTimer = setTimeout(() => {
      tryClaim();
      pollId = setInterval(tryClaim, 400);
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (pollId) clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, pageKey, alreadySeen]);

  // Release the floor the moment this tour stops being active — whether it
  // finished/was skipped (active flips to false) or the component unmounted
  // outright (route change mid-tour) — so a queued tour elsewhere is never
  // left waiting on a lock nobody will ever release again.
  useEffect(() => {
    if (!active) return undefined;
    return () => releaseTour(pageKey);
  }, [active, pageKey]);

  const currentStep = resolvedSteps[stepIndex];

  // Keeps the spotlight glued to the live target for as long as this step
  // is shown. Scrolls it into view only if it isn't already fully visible,
  // then re-measures on a light 300ms poll (not a per-frame loop) — cheap
  // enough to run for the step's whole lifetime, which is what makes this
  // self-healing: a smooth-scroll settling, a skeleton swapping for real
  // content, a late-loading image shifting the layout, all correct
  // themselves within one tick instead of leaving the ring/clip stranded at
  // a stale position ("misaligned focus"). A per-frame (rAF) tracker was
  // tried first and dropped — ~60 re-renders/sec fought with the ring's own
  // glow animation below, which is what made it look like the highlight
  // animation was missing entirely.
  useLayoutEffect(() => {
    if (!active || !currentStep) return undefined;
    const el = document.querySelector(currentStep.target);
    if (!el) { setStepIndex((i) => Math.min(i + 1, resolvedSteps.length - 1)); return undefined; }

    const initialRect = el.getBoundingClientRect();
    const alreadyVisible = initialRect.top >= 0 && initialRect.left >= 0
      && initialRect.bottom <= window.innerHeight && initialRect.right <= window.innerWidth;
    if (!alreadyVisible) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    setRect(initialRect);

    const remeasure = () => {
      const live = document.querySelector(currentStep.target);
      if (!live) return;
      const next = live.getBoundingClientRect();
      setRect((prev) => (rectsEqual(prev, next) ? prev : next));
    };
    const settle = setInterval(remeasure, 300);
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      clearInterval(settle);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [active, currentStep, resolvedSteps.length]);

  const finish = useCallback(() => {
    setActive(false);
    persistTourSeen(pageKey);
  }, [persistTourSeen, pageKey]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= resolvedSteps.length - 1) { finish(); return i; }
      return i + 1;
    });
  }, [resolvedSteps.length, finish]);

  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish, next, back]);

  if (!active || !currentStep || !rect) return null;

  return createPortal(
    <TourOverlay
      rect={rect}
      step={currentStep}
      stepIndex={stepIndex}
      totalSteps={resolvedSteps.length}
      isMobile={isMobile}
      isDark={isDark}
      onNext={next}
      onBack={back}
      onSkip={finish}
    />,
    document.body
  );
};

const TourOverlay = ({ rect, step, stepIndex, totalSteps, isMobile, isDark, onNext, onBack, onSkip }) => {
  const pad = SPOTLIGHT_PADDING;
  const spot = {
    top: Math.max(0, rect.top - pad),
    left: Math.max(0, rect.left - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const scrim = isDark ? 'rgba(5,9,24,0.68)' : 'rgba(10,22,40,0.52)';

  // Space below/above the spotlight decides which side the card anchors to
  // (desktop only — mobile always uses a bottom sheet regardless).
  const spaceBelow = vh - (spot.top + spot.height);
  const spaceAbove = spot.top;
  const placement = step.placement || (spaceBelow >= 200 || spaceBelow >= spaceAbove ? 'bottom' : 'top');

  const cardLeft = Math.min(Math.max(16, spot.left + spot.width / 2 - CARD_WIDTH / 2), vw - CARD_WIDTH - 16);
  // Only used to keep the card fully on-screen — the card's real rendered
  // height can differ slightly, which is fine since this purely bounds a
  // `top` px value rather than sizing anything.
  const CARD_EST_HEIGHT = 210;
  const cardTop = Math.min(
    Math.max(16, placement === 'bottom' ? spot.top + spot.height + 16 : spot.top - 16 - CARD_EST_HEIGHT),
    vh - CARD_EST_HEIGHT - 16
  );

  const cardStyle = isMobile
    ? {
        // Anchored a little clear of the true bottom edge (rather than
        // bottom: 0) plus a real safe-area gap on top of that — flush
        // bottom: 0 rendered underneath the home-indicator / gesture bar on
        // iOS and behind a collapsed browser toolbar on Android, cutting the
        // Skip/Next row off. maxHeight + its own scroll is a safety net for
        // a long description on a short phone in landscape.
        position: 'fixed', left: 12, right: 12, bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        borderRadius: 16,
        maxHeight: '80dvh', overflowY: 'auto',
      }
    : { position: 'fixed', top: cardTop, left: cardLeft, width: CARD_WIDTH, borderRadius: 14 };

  const isLast = stepIndex === totalSteps - 1;

  // A single "keyhole" polygon — the full viewport, minus the spotlight
  // rect cut out of it via a zero-width bridge — so the dim + blur below
  // is ONE clipped element rather than several panels butted up against the
  // spotlight's edges. That distinction matters: `backdrop-filter: blur()`
  // samples a soft radius AROUND an element's own edge, so separate blurred
  // panels each bleed a couple of blurred pixels past their own boundary and
  // into the "clear" gap between them — the highlighted element itself ends
  // up looking faintly blurred at its edges instead of perfectly crisp.
  // `clip-path` is a hard geometric clip (not a filter), so nothing —
  // background OR blur — ever paints inside the cut-out at all, regardless
  // of blur radius.
  const L = spot.left, T = spot.top, R = spot.left + spot.width, B = spot.top + spot.height;
  const clipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${L}px ${T}px, ${L}px ${B}px, ${R}px ${B}px, ${R}px ${T}px, ${L}px ${T}px)`;

  return (
    <>
      {/* ── Single dimmed + blurred scrim, clipped around the spotlight ── */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: scrim,
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          clipPath,
          WebkitClipPath: clipPath,
          transition: 'clip-path 0.35s cubic-bezier(0.32,0.72,0,1)',
        }}
      />

      {/* ── Glowing spotlight ring ── */}
      <motion.div
        style={{
          position: 'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height,
          borderRadius: 12, border: '2px solid var(--primary)', pointerEvents: 'none', zIndex: 9999,
          transition: 'top 0.35s cubic-bezier(0.32,0.72,0,1), left 0.35s cubic-bezier(0.32,0.72,0,1), width 0.35s cubic-bezier(0.32,0.72,0,1), height 0.35s cubic-bezier(0.32,0.72,0,1)',
        }}
        animate={RING_GLOW_ANIMATE}
        transition={RING_GLOW_TRANSITION}
      />

      {/* ── Tooltip card — exactly one, for exactly the current step ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={isMobile ? { opacity: 0, y: 40 } : { opacity: 0, y: placement === 'bottom' ? 10 : -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={isMobile ? { opacity: 0, y: 24 } : { opacity: 0, y: placement === 'bottom' ? -6 : 6, scale: 0.98 }}
          transition={{ duration: 0.32, ease: EASE }}
          style={{
            ...cardStyle,
            zIndex: 10000,
            background: isDark ? 'rgba(22,32,72,0.97)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(79,70,229,0.1)'}`,
            boxShadow: isDark
              ? '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 30px 80px rgba(30,41,90,0.22), inset 0 1px 0 rgba(255,255,255,0.7)',
            padding: '18px 20px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: i === stepIndex ? 16 : 6, height: 6, borderRadius: 3,
                    background: i === stepIndex ? 'var(--primary)' : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(79,70,229,0.18)'),
                    transition: 'width 0.25s ease, background 0.25s ease',
                    display: 'inline-block',
                  }}
                />
              ))}
            </div>
            <button
              onClick={onSkip}
              aria-label="Close tour"
              title="Close"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, margin: -4,
                color: 'var(--on-muted)', display: 'flex', alignItems: 'center', flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Step {stepIndex + 1} of {totalSteps}
          </p>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>{step.title}</h4>
          <p style={{ fontSize: 13, color: 'var(--on-muted)', opacity: 0.85, lineHeight: 1.5, margin: '0 0 16px' }}>{step.description}</p>

          {/* One shared Next/Skip row per step — never one per highlighted
              element, even when a single step's spotlight wraps a cluster
              of several related controls (e.g. a whole stat-card row). */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onSkip}
              style={{ borderRadius: 8, paddingLeft: 8, paddingRight: 10 }}
            >
              Skip, I know everything
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {stepIndex > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={onBack}
                  aria-label="Back"
                  style={{ borderRadius: 8, padding: '6px 8px' }}
                >
                  <ChevronLeft size={14} />
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={onNext}
                style={{ borderRadius: 8 }}
              >
                {isLast ? 'Got it!' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default PageTour;
