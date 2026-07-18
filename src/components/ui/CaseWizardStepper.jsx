import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

export const CASE_WIZARD_STEPS = [
  { step: 1, label: 'PAN & Contacts' },
  { step: 2, label: 'GST / ITR / Bank' },
  { step: 3, label: 'Product & Property' },
  { step: 4, label: 'Income Summary' },
  { step: 5, label: 'Bureau & Obligations' },
  { step: 6, label: 'ESR' },
  { step: 7, label: 'Proposal' },
];

/**
 * Persistent progress stepper for the case-creation journey.
 * Rendered on every page in the flow (Add Customer wizard through Proposal)
 * so the user always sees where they are across all 7 stages, not just
 * the 3 steps that live on /customers/add.
 */
export default function CaseWizardStepper({ currentStep, caseId, proposalId, onStepClick }) {
  const navigate = useNavigate();

  const routeFor = (step) => {
    if (step <= 3) return `/customers/add?caseId=${caseId}`;
    if (step === 4) return `/cases/${caseId}/income-summary`;
    if (step === 5) return `/cases/${caseId}/bureau-obligations`;
    if (step === 6) return `/cases/${caseId}/esr`;
    if (step === 7) return proposalId ? `/cases/${caseId}/proposals/${proposalId}` : null;
    return null;
  };

  return (
    <div
      className="card"
      style={{
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        position: 'relative',
        justifyContent: 'space-between',
        overflowX: 'auto',
        gap: 8,
      }}
    >
      <div style={{ position: 'absolute', top: '50%', left: 30, right: 30, height: 2, background: 'var(--border)', zIndex: 0, transform: 'translateY(-50%)' }} />
      {CASE_WIZARD_STEPS.map((s) => {
        const isActive = currentStep === s.step;
        const isCompleted = s.step < currentStep;
        // Free navigation: any step is clickable as long as its route
        // resolves, regardless of whether it's been completed yet.
        const isReachable = !isActive && !!caseId && !!routeFor(s.step);

        return (
          <div
            key={s.step}
            onClick={() => {
              if (!isReachable) return;
              // onStepClick only makes sense for steps 1-3, which all live on
              // the same /customers/add page as local state — steps 4+ are
              // separate routes and must always go through real navigation,
              // even when the caller (the add-customer wizard) passes onStepClick.
              if (onStepClick && s.step <= 3) onStepClick(s.step);
              else navigate(routeFor(s.step));
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-surface)',
              zIndex: 1,
              padding: '0 6px',
              minWidth: 74,
              cursor: isReachable ? 'pointer' : 'default',
            }}
            title={isReachable ? `Go to ${s.label}` : undefined}
          >
            <div
              style={{
                width: 28,
                height: 28,
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
            <span
              style={{
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: 11,
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
