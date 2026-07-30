import { useEffect, useState, useCallback, useRef } from 'react';
import { subscribeToCasePulls, refreshCasePulls, subscribeToConnectionStatus } from '../lib/realtime';

/**
 * Live GST / ITR / Bank pull status for a case, pushed from the server.
 *
 * Replaces the per-component `setInterval` polling the three step-2 components
 * used to run. The important property is that the snapshot is *complete* and
 * arrives on join: a component that unmounts (user moves to another wizard
 * step) and remounts later paints the true current state on its first render,
 * with no refresh and no intermediate "Pending" flash.
 *
 * @param {number|string|null} caseId
 * @returns {{snapshot: object|null, connected: boolean, refresh: () => void}}
 */
export function useCasePullStatus(caseId) {
  const [snapshot, setSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!caseId) {
      setSnapshot(null);
      return undefined;
    }
    // Drop any snapshot belonging to the previous case before subscribing, so
    // switching cases can never render one case's status under another's id.
    setSnapshot(null);
    return subscribeToCasePulls(caseId, setSnapshot);
  }, [caseId]);

  useEffect(() => subscribeToConnectionStatus((s) => setConnected(s === 'connected')), []);

  const refresh = useCallback(() => refreshCasePulls(caseId), [caseId]);

  return { snapshot, connected, refresh };
}

const EMPTY = { requests: [], overall: { phase: 'NOT_STARTED', label: '', progress: 0, live: false, total: 0, completed: 0 } };

/**
 * Narrow a snapshot to the single request a component is responsible for.
 *
 * ITR and bank statement components are rendered once per applicant, with the
 * primary borrower identified by a null applicant_id — so matching has to be
 * on that, not on array position.
 *
 * @param {object|null} snapshot
 * @param {'gst'|'itr'|'bank'} type
 * @param {number|null|undefined} applicantId
 */
export function selectPullForApplicant(snapshot, type, applicantId) {
  const section = snapshot?.[type] || EMPTY;
  const wanted = applicantId == null ? null : Number(applicantId);
  // Newest first (the server orders by created_at desc), so this picks the
  // current attempt and ignores superseded ones.
  return section.requests.find((r) => (r.applicant_id ?? null) === wanted) || null;
}

/**
 * Fire `onEnter` once each time the live phase transitions into a terminal
 * state — used for the "report ready" / "failed" toasts, which must not
 * re-fire on every snapshot push (one arrives roughly every 2s while live).
 */
export function usePhaseTransition(phase, handlers) {
  const previous = useRef(phase);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const prev = previous.current;
    if (phase && prev && phase !== prev) {
      handlersRef.current?.[phase]?.(prev);
    }
    previous.current = phase;
  }, [phase]);
}
