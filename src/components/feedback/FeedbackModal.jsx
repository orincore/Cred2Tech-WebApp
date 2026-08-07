import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, CheckCircle2, MessageSquare, Bug, UploadCloud, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../ui/LoadingSpinner';
import { ticketService } from '../../api/ticketService';
import { compressIfImage } from '../../utils/imageCompression';

const MAX_ATTACHMENTS = 5;
const MAX_DESCRIPTION = 4000;

const TYPES = [
  {
    value: 'FEEDBACK',
    icon: MessageSquare,
    title: 'General Feedback',
    hint: 'Ideas, suggestions, or anything you liked or didn’t.',
  },
  {
    value: 'ISSUE',
    icon: Bug,
    title: 'Report an Issue',
    hint: 'Something broken or not working as expected.',
  },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The one "Submit Feedback" form shared by the MSME self-service portal and
 * the DSA/staff app — a single FEEDBACK/ISSUE type toggle instead of two
 * separate forms, since both land in the same admin ticket queue anyway.
 * Sharp corners throughout — deliberately overrides .modal-box/.btn's
 * default rounded radius (var(--radius-xl)/var(--radius)) to match the
 * square-edged look used across the rest of this app's custom UI.
 */
const FeedbackModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [type, setType] = useState('FEEDBACK');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]); // [{ file, previewUrl, compressing }]
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // the created ticket, once submitted

  const reset = () => {
    setType('FEEDBACK');
    setSubject('');
    setDescription('');
    setFiles([]);
    setResult(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const addFiles = async (picked) => {
    if (picked.length === 0) return;
    if (files.length + picked.length > MAX_ATTACHMENTS) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    const pending = picked.map((file) => ({ file, previewUrl: URL.createObjectURL(file), compressing: file.type.startsWith('image/') }));
    setFiles((prev) => [...prev, ...pending]);

    // Compress images in the background so the UI stays responsive — each
    // entry flips `compressing` off (and swaps in the smaller file) as it finishes.
    for (const entry of pending) {
      if (!entry.compressing) continue;
      const compressed = await compressIfImage(entry.file);
      setFiles((prev) => prev.map((f) => (f === entry ? { ...f, file: compressed, compressing: false } : f)));
    }
  };

  const handleFilesSelected = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file
    addFiles(picked);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const removeFile = (entry) => {
    URL.revokeObjectURL(entry.previewUrl);
    setFiles((prev) => prev.filter((f) => f !== entry));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Please fill in both subject and description.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('subject', subject.trim());
      formData.append('description', description.trim());
      files.forEach((f) => formData.append('attachments', f.file, f.file.name));

      const ticket = await ticketService.create(formData);
      setResult(ticket);
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const sharpBtn = { borderRadius: 0 };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-box"
        style={{ borderRadius: 0, maxWidth: 640, width: isMobile ? '100%' : '94%', height: isMobile ? '100%' : 'auto', maxHeight: isMobile ? '100%' : '90vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <div style={{ textAlign: 'center', padding: isMobile ? '32px 20px' : '48px 40px' }}>
            <div style={{ width: 56, height: 56, background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <CheckCircle2 size={28} color="var(--success)" />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {result.type === 'FEEDBACK' ? 'Feedback received!' : 'Ticket created'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              {result.type === 'FEEDBACK'
                ? "Thanks — we've received your feedback and will review it shortly."
                : "We've logged your issue and our team will get back to you soon."}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28 }}>
              Reference No.: <strong style={{ color: 'var(--text-primary)' }}>{result.ticket_number}</strong>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" style={sharpBtn} onClick={handleClose}>Close</button>
              <button className="btn btn-primary" style={sharpBtn} onClick={() => { handleClose(); navigate(`/tickets/${result.id}`); }}>
                View details
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: isMobile ? '16px 16px' : '22px 28px', borderBottom: '1px solid var(--outline)', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Submit Feedback</h2>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>Share feedback or report an issue — we read every one.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" style={sharpBtn} onClick={handleClose} aria-label="Close" disabled={submitting}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: isMobile ? '18px 16px' : '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? 18 : 22 }}>
              {/* Type selector — large tiles instead of a cramped pill row */}
              <div>
                <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  {TYPES.map((opt) => {
                    const Icon = opt.icon;
                    const active = type === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setType(opt.value)}
                        style={{
                          textAlign: 'left',
                          padding: 16,
                          borderRadius: 0,
                          border: `1px solid ${active ? 'var(--primary)' : 'var(--outline)'}`,
                          borderLeft: `3px solid ${active ? 'var(--primary)' : 'var(--outline)'}`,
                          background: active ? 'var(--primary)0f' : 'var(--surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        <Icon size={18} color={active ? 'var(--primary)' : 'var(--text-tertiary)'} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--primary)' : 'var(--text-primary)' }}>{opt.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{opt.hint}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="form-label" htmlFor="feedback-subject">Subject<span className="required">*</span></label>
                <input
                  id="feedback-subject"
                  type="text"
                  className="form-control"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={type === 'ISSUE' ? 'Briefly describe the issue' : "What's on your mind?"}
                  maxLength={150}
                />
              </div>

              {/* Description */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label className="form-label" htmlFor="feedback-description">Description<span className="required">*</span></label>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{description.length}/{MAX_DESCRIPTION}</span>
                </div>
                <textarea
                  id="feedback-description"
                  className="form-control"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={type === 'ISSUE' ? 'Steps to reproduce, what you expected, what happened instead…' : 'Tell us more…'}
                  maxLength={MAX_DESCRIPTION}
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>

              {/* Attachments — full-width dropzone + thumbnail grid */}
              <div>
                <label className="form-label">Attach screenshots <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `1px dashed ${isDragging ? 'var(--primary)' : 'var(--outline)'}`,
                    background: isDragging ? 'var(--primary)0f' : 'var(--surface)',
                    padding: '20px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: files.length >= MAX_ATTACHMENTS ? 'not-allowed' : 'pointer',
                    opacity: files.length >= MAX_ATTACHMENTS ? 0.5 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <UploadCloud size={22} color="var(--text-tertiary)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Click to upload or drag and drop</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    PNG, JPG, WEBP or PDF · up to {MAX_ATTACHMENTS} files · images are compressed automatically
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    multiple
                    hidden
                    disabled={files.length >= MAX_ATTACHMENTS}
                    onChange={handleFilesSelected}
                  />
                </div>

                {files.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    {files.map((f, idx) => (
                      <div key={idx} style={{ position: 'relative', width: 84, border: '1px solid var(--outline)' }}>
                        <div style={{ position: 'relative', width: '100%', height: 64, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                          {f.file.type.startsWith('image/') ? (
                            <img src={f.previewUrl} alt={f.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FileText size={20} color="var(--text-tertiary)" />
                            </div>
                          )}
                          {f.compressing && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <LoadingSpinner size={16} color="#fff" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(f)}
                            title="Remove"
                            style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, background: 'var(--error)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                        <div style={{ padding: '4px 5px', fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.file.name}>
                          {f.file.name}
                        </div>
                        <div style={{ padding: '0 5px 4px', fontSize: 10, color: 'var(--text-tertiary)' }}>{formatBytes(f.file.size)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: isMobile ? '14px 16px' : '18px 28px', borderTop: '1px solid var(--outline)', flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" style={{ ...sharpBtn, flex: isMobile ? 1 : 'none', justifyContent: 'center' }} onClick={handleClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ ...sharpBtn, flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : 110, justifyContent: 'center' }} disabled={submitting}>
                {submitting ? <LoadingSpinner size={16} color="currentColor" /> : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
