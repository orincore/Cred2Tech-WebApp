import React from 'react';
import { FileWarning, X, Scissors, FilePlus2, Layers } from 'lucide-react';

/**
 * Blocking popup for a statement file that can't be processed (over the
 * 5MB size or 80-page limit) — replaces a toast for this specific rejection
 * since a transient toast isn't enough room to actually walk someone through
 * the fix (split the file, upload each part, we combine them).
 */
const FileLimitModal = ({ isOpen, onClose, fileName, reasonDetail }) => {
    if (!isOpen) return null;

    const steps = [
        { icon: Scissors, text: 'Split the statement into smaller parts — e.g. one PDF per half-year.' },
        { icon: FilePlus2, text: 'Upload each part separately using "Add Another File".' },
        { icon: Layers, text: "We'll automatically combine every part into one full analysis." },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 42, height: 42,
                            borderRadius: '50%',
                            background: 'var(--error-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <FileWarning size={20} color="var(--error)" />
                        </div>
                        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Can't process this file</h2>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {fileName && (
                    <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                        marginBottom: 8, wordBreak: 'break-word',
                    }}>
                        "{fileName}"
                    </div>
                )}

                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                    This file exceeds the size/page limit we can send for analysis{reasonDetail ? ` — ${reasonDetail}.` : '.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                    {steps.map(({ icon: Icon, text }, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)',
                            }}>
                                {i + 1}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 3 }}>
                                <Icon size={15} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={onClose}>Got it</button>
                </div>
            </div>
        </div>
    );
};

export default FileLimitModal;
