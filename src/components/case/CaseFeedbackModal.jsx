import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Star, X } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { caseFeedbackService } from '../../api/caseFeedbackService';

/**
 * Shown once, right when a DSA's disbursement action actually transitions a
 * case into PARTLY_DISBURSED/DISBURSED (see CaseDetailPage/PartDisbursementPage
 * — gated on the backend's `stage_changed` flag so this never fires on every
 * tranche or every page visit). Sharp corners, full-screen on mobile — same
 * conventions as FeedbackModal.jsx.
 */
const CaseFeedbackModal = ({ isOpen, onClose, caseId, disbursementType, caseLabel }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isMobile] = useState(window.innerWidth <= 480);

  if (!isOpen) return null;

  const reset = () => {
    setRating(0);
    setHoverRating(0);
    setComment('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSkip = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating.');
      return;
    }
    setSubmitting(true);
    try {
      await caseFeedbackService.submit({ case_id: caseId, type: disbursementType, rating, comment: comment.trim() || undefined });
      toast.success('Thanks for the feedback!');
      reset();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit feedback — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFull = disbursementType === 'FULL';

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-box"
        style={{ borderRadius: 0, maxWidth: 460, width: isMobile ? '100%' : '92%', height: isMobile ? '100%' : 'auto', padding: 0, boxSizing: 'border-box' }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: isMobile ? '16px 16px' : '22px 26px', borderBottom: '1px solid var(--outline)' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {isFull ? 'Case Fully Disbursed 🎉' : 'Partial Disbursement Recorded'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                {caseLabel ? `${caseLabel} — ` : ''}How was your experience with this case's journey so far?
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" style={{ borderRadius: 0 }} onClick={handleClose} aria-label="Close" disabled={submitting}>
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: isMobile ? '20px 16px' : '24px 26px', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= (hoverRating || rating);
                return (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', lineHeight: 0 }}
                  >
                    <Star size={32} color={filled ? '#f59e0b' : 'var(--outline)'} fill={filled ? '#f59e0b' : 'none'} strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', minHeight: 16 }}>
              {rating > 0 ? ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating] : 'Tap a star to rate'}
            </span>

            <div style={{ width: '100%' }}>
              <label className="form-label" htmlFor="case-feedback-comment">Comments <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>
              <textarea
                id="case-feedback-comment"
                className="form-control"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything that stood out — good or bad — about getting this case to disbursement?"
                maxLength={2000}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: isMobile ? '14px 16px' : '18px 26px', borderTop: '1px solid var(--outline)' }}>
            <button type="button" className="btn btn-secondary" style={{ borderRadius: 0 }} onClick={handleSkip} disabled={submitting}>Skip</button>
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 0, minWidth: 100, justifyContent: 'center' }} disabled={submitting || rating === 0}>
              {submitting ? <LoadingSpinner size={16} color="currentColor" /> : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseFeedbackModal;
