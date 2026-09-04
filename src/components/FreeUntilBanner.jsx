import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';

// Auto-dismissing "Virtual Workspace is free until X" banner for the
// Dashboard page — same underlying free-window status
// VirtualWorkspaceSubscriptionCard.jsx surfaces on Organization Profile/
// Subscription, but shown briefly here on every visit instead of staying
// put: slides open on mount, holds for SHOWN_MS, then slides shut on its
// own. DSA_ADMIN only, matching the /virtual-workspace/subscription route's
// own role gate (other DSA roles would just 403 on the fetch).
const SHOWN_MS = 5000;
const TRANSITION_MS = 420;
const MAX_HEIGHT_PX = 120; // comfortably larger than the rendered banner — see phase comment below

const FreeUntilBanner = () => {
  const { hasRole } = useAuth();
  // 'idle' (nothing to show / still loading) → 'closed' (mounted, collapsed
  // — one frame only, so the browser has a starting state to transition
  // FROM) → 'open' (expanded) → 'closed' again (collapsing) → unmount.
  const [phase, setPhase] = useState('idle');
  const [freeUntilLabel, setFreeUntilLabel] = useState('');

  useEffect(() => {
    if (!hasRole('DSA_ADMIN')) return;
    let cancelled = false;
    api.get('/virtual-workspace/subscription').then((res) => {
      if (cancelled) return;
      const { is_currently_free, free_until } = res.data || {};
      if (is_currently_free && free_until) {
        setFreeUntilLabel(new Date(free_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
        setPhase('closed');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'closed' || !freeUntilLabel) return undefined;
    // Two rAFs (not one) — reliably gives the browser a full paint at
    // max-height:0 before flipping to the open value, which is what
    // actually makes the transition play instead of jumping straight open.
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('open'));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
    };
  }, [phase, freeUntilLabel]);

  useEffect(() => {
    if (phase !== 'open') return undefined;
    const t = setTimeout(() => setPhase('closing'), SHOWN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'closing') return undefined;
    const t = setTimeout(() => setPhase('gone'), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'idle' || phase === 'gone') return null;

  const isOpen = phase === 'open';

  return (
    <div
      style={{
        maxHeight: isOpen ? MAX_HEIGHT_PX : 0,
        opacity: isOpen ? 1 : 0,
        transform: `translateY(${isOpen ? 0 : -8}px)`,
        overflow: 'hidden',
        transition: `max-height ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
        marginBottom: isOpen ? 16 : 0,
      }}
    >
      <div style={{
        padding: '12px 14px',
        background: 'var(--success-bg)',
        border: '1px solid var(--success)',
        color: 'var(--success)',
        fontSize: 12.5,
        lineHeight: 1.6,
      }}>
        🎉 <strong>Congrats — Virtual Workspace is free until {freeUntilLabel}!</strong> This period will not charge your account.
      </div>
    </div>
  );
};

export default FreeUntilBanner;
