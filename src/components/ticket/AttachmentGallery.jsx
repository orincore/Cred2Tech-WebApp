import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { ticketService } from '../../api/ticketService';

/**
 * Screenshot/PDF attachments for a ticket — image attachments render as real
 * thumbnails (click to enlarge in a lightbox), non-images (PDFs) render as a
 * plain file tile that downloads on click. Shared by MyTicketDetailPage and
 * AdminTicketDetailPage so both sides of a ticket see the same preview UX.
 *
 * Thumbnails are fetched as authenticated blobs (the download route needs
 * the Bearer token an <img src> can't send) and revoked on unmount.
 */
const AttachmentGallery = ({ ticketId, attachments }) => {
  const [previews, setPreviews] = useState({}); // { [attachmentId]: objectUrl }
  const [lightbox, setLightbox] = useState(null); // { url, name }

  useEffect(() => {
    if (!attachments?.length) return;
    let cancelled = false;
    const urls = [];

    (async () => {
      for (const a of attachments) {
        if (!a.mime_type?.startsWith('image/')) continue;
        try {
          const url = await ticketService.fetchAttachmentPreview(ticketId, a.id);
          if (cancelled) { URL.revokeObjectURL(url); continue; }
          urls.push(url);
          setPreviews((prev) => ({ ...prev, [a.id]: url }));
        } catch {
          // Falls back to the non-preview file tile below.
        }
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, attachments?.map((a) => a.id).join(',')]);

  if (!attachments?.length) return null;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {attachments.map((a) => {
          const isImage = a.mime_type?.startsWith('image/');
          const previewUrl = previews[a.id];

          if (isImage) {
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => previewUrl && setLightbox({ url: previewUrl, name: a.file_name })}
                title={a.file_name}
                style={{
                  width: 92, height: 92, padding: 0, border: '1px solid var(--outline)', borderRadius: 0,
                  background: 'var(--bg-elevated)', cursor: previewUrl ? 'zoom-in' : 'default', overflow: 'hidden', flexShrink: 0,
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt={a.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LoadingSpinner size={16} />
                  </div>
                )}
              </button>
            );
          }

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => ticketService.downloadAttachment(ticketId, a.id, a.file_name)}
              title={`Download ${a.file_name}`}
              style={{
                width: 92, height: 92, padding: 8, border: '1px solid var(--outline)', borderRadius: 0, flexShrink: 0,
                background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <FileText size={22} color="var(--text-tertiary)" />
              <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {a.file_name}
              </span>
            </button>
          );
        })}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close preview"
            style={{ position: 'absolute', top: 20, right: 20, width: 36, height: 36, background: 'var(--bg-surface)', border: '1px solid var(--outline)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            <X size={18} />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.name}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', border: '1px solid var(--outline)' }}
          />
        </div>
      )}
    </>
  );
};

export default AttachmentGallery;
