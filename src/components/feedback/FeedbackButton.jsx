import React, { useState, useEffect } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackModal from './FeedbackModal';

/** Floating "Submit Feedback" action, mounted once per layout shell (see AppLayout/MsmeLayout). */
const FeedbackButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Submit feedback or report an issue"
        aria-label="Submit feedback or report an issue"
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isMobile ? 0 : 8,
          width: isMobile ? 44 : 'auto',
          height: isMobile ? 44 : 'auto',
          padding: isMobile ? 0 : '12px 18px',
          borderRadius: 0,
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <MessageSquarePlus size={isMobile ? 20 : 16} />
        {!isMobile && 'Feedback'}
      </button>
      <FeedbackModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default FeedbackButton;
