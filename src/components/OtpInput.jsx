import React, { useRef, useEffect } from 'react';

// Classic per-digit OTP entry: one box per character, auto-advances focus as
// you type, Backspace steps back and clears, and — the part a single
// maxLength-6 text field can't do — pasting a full code into ANY box
// distributes it across all the boxes at once instead of only filling the
// one it landed in.
export default function OtpInput({ length = 6, value = '', onChange, onEnter, disabled = false, autoFocus = true }) {
  const inputsRef = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && !disabled) inputsRef.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDigit = (index, char) => {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join(''));
  };

  // Fills boxes starting at `startIndex` from a raw string (paste, or a
  // multi-character value some mobile keyboards/autofill hand back in a
  // single keystroke) and focuses whichever box comes right after the last
  // one filled.
  const distributeFrom = (startIndex, raw) => {
    const chars = String(raw).replace(/\D/g, '').split('');
    if (chars.length === 0) return;
    const next = digits.slice();
    let i = startIndex;
    let c = 0;
    while (i < length && c < chars.length) {
      next[i] = chars[c];
      i += 1;
      c += 1;
    }
    onChange(next.join(''));
    inputsRef.current[Math.min(i, length - 1)]?.focus();
  };

  const handleChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) { distributeFrom(index, raw); return; }
    setDigit(index, raw);
    if (raw && index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handlePaste = (index, e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    // A pasted code fills from the very first box regardless of which box
    // was actually clicked — that's what a paste means here (the whole
    // copied code), not "continue typing from wherever my cursor is". Only
    // a paste shorter than a full code (rare, but possible) keeps starting
    // from the clicked box instead, since that reads more like an
    // intentional partial fill.
    distributeFrom(pasted.length >= length ? 0 : index, pasted);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, '');
      } else if (index > 0) {
        setDigit(index - 1, '');
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      onEnter?.();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-10 pb-2 text-center text-[22px] font-bold bg-transparent text-[#0a1628] dark:text-[#e6edf7] border-0 border-b-2 border-gray-200 dark:border-gray-700 outline-none focus:border-indigo-600 dark:focus:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        />
      ))}
    </div>
  );
}
