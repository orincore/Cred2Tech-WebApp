import React, { useState, useEffect } from 'react';

const DevBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isClosed = localStorage.getItem('dev_banner_closed');
    if (!isClosed) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('dev_banner_closed', 'true');
  };

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        .banner-animate {
          animation: slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hazard-stripes {
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 20px,
            rgba(0, 0, 0, 0.05) 20px,
            rgba(0, 0, 0, 0.05) 40px
          );
        }
      `}</style>
      <div className="fixed top-0 left-0 right-0 z-[10000] banner-animate">
        <div className="relative bg-amber-500 text-white shadow-2xl overflow-hidden group">
          {/* Hazard Stripes Pattern Overlay */}
          <div className="absolute inset-0 hazard-stripes opacity-100" />
          
          <div className="relative h-14 md:h-12 flex items-center justify-center px-12 text-center">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] md:text-[24px] animate-pulse">
                engineering
              </span>
              <p className="text-[13px] md:text-[14px] font-black uppercase tracking-[0.05em] leading-tight">
                This website is under development by <span className="underline decoration-2 underline-offset-4">Sunby Credtech</span>. Do not operate on this.
              </p>
            </div>

            {/* Close Button */}
            <button 
              onClick={handleClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-white transition-all duration-200 border border-white/20 active:scale-95"
              aria-label="Close warning"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          
          {/* Bottom Border Accent */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/10" />
        </div>
      </div>
    </>
  );
};

export default DevBanner;
