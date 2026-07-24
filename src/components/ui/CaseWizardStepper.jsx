import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export const CASE_WIZARD_STEPS = [
  { step: 1, label: 'Customer Profile' },
  { step: 2, label: 'GST / ITR / Bank' },
  { step: 3, label: 'Loan Product & Collateral' },
  { step: 4, label: 'Income Summary' },
  { step: 5, label: 'Bureau & Obligations' },
  { step: 6, label: 'ESR' },
  { step: 7, label: 'Proposal' },
];

/**
 * Persistent progress stepper for the case-creation journey. All 7 steps
 * render inside the same mounted wizard component (AddCustomerWizardPage) —
 * switching steps is always a local state change via onStepClick, never a
 * route navigation, so effects that only run "while mounted" (PAN/GST/bureau
 * auto-fetch) stay alive across the whole journey.
 */
export default function CaseWizardStepper({ currentStep, caseId, proposalId, onStepClick }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Step 7 needs a proposal to exist first (minted when the user creates one
  // from step 6) — every other step just needs a case to exist.
  const isStepUnlocked = (step) => {
    if (!caseId) return false;
    if (step === 7) return !!proposalId;
    return true;
  };

  const goToStep = (s) => {
    const isReachable = currentStep !== s.step && isStepUnlocked(s.step);
    if (!isReachable) return;
    onStepClick?.(s.step);
  };

  const current = CASE_WIZARD_STEPS.find(s => s.step === currentStep);

  return (
    <div className="case-stepper card" style={{ padding: isMobile ? '14px 12px' : '20px 24px', marginBottom: 24 }}>
      <style>{`
        .case-stepper .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .case-stepper .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {isMobile && current && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 10 }}>
          Step {currentStep} of {CASE_WIZARD_STEPS.length} — {current.label}
        </div>
      )}

      <div className="hide-scrollbar" style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto' }}>
        {CASE_WIZARD_STEPS.map((s, idx) => {
          const isActive = currentStep === s.step;
          const isCompleted = s.step < currentStep;
          // Free navigation: any unlocked step is clickable regardless of
          // whether it's been completed yet.
          const isReachable = !isActive && isStepUnlocked(s.step);

          return (
            <React.Fragment key={s.step}>
              <div
                onClick={() => goToStep(s)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  width: isMobile ? 56 : 88,
                  cursor: isReachable ? 'pointer' : 'default',
                }}
                title={isReachable ? `Go to ${s.label}` : undefined}
              >
                <div
                  style={{
                    width: isMobile ? 24 : 28,
                    height: isMobile ? 24 : 28,
                    borderRadius: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'var(--primary)' : isReachable ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                    border: isReachable ? '2px solid var(--primary)' : 'none',
                    color: isActive ? 'white' : isReachable ? 'var(--primary)' : 'var(--text-tertiary)',
                    fontWeight: 600,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : s.step}
                </div>
                {!isMobile && (
                  <span
                    style={{
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: 11,
                      lineHeight: 1.3,
                      textAlign: 'center',
                    }}
                  >
                    {s.label}
                  </span>
                )}
              </div>

              {/* Connector — a normal-flow flex item between circles, never
                  absolutely positioned, so it can never drift out of sync
                  with the circles/labels while the row scrolls on mobile. */}
              {idx < CASE_WIZARD_STEPS.length - 1 && (
                <div
                  style={{
                    flex: isMobile ? '0 0 14px' : '1 1 32px',
                    minWidth: isMobile ? 14 : 32,
                    height: 2,
                    background: 'var(--border)',
                    marginTop: isMobile ? 11 : 13,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
