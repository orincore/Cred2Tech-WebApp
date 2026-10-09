import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Small inline icon button that copies `text` to the clipboard, with a
// brief checkmark swap for immediate visual feedback (on top of the toast,
// which can be missed next to a dense row of badges/buttons).
export default function CopyButton({ text, label = 'Copied', size = 12, style = {} }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
    } catch {
      // Clipboard API can be unavailable (older browser, insecure context) —
      // fall back to a hidden textarea + execCommand rather than failing silently.
      const el = document.createElement('textarea');
      el.value = String(text);
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); } catch { /* give up quietly */ }
      document.body.removeChild(el);
    }
    setCopied(true);
    toast.success(label);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy"
      aria-label="Copy"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'transparent', padding: 2, margin: 0,
        cursor: 'pointer', color: copied ? 'var(--success)' : 'var(--text-tertiary)',
        lineHeight: 0, ...style
      }}
    >
      {copied ? <Check size={size} strokeWidth={2} /> : <Copy size={size} strokeWidth={2} />}
    </button>
  );
}
