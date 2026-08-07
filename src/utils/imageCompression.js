import imageCompression from 'browser-image-compression';

// Compresses a screenshot client-side before it ever leaves the browser —
// the point is to save upload bandwidth AND S3 storage, not just cap a
// request size. Non-image files (e.g. a PDF export) pass through untouched;
// compression itself never throws — a failed compression falls back to the
// original file rather than blocking the attachment.
const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressIfImage(file) {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.8,
    });
    // browser-image-compression can occasionally return a slightly larger
    // file for an already-small/simple screenshot — keep whichever is smaller.
    return compressed.size < file.size
      ? new File([compressed], file.name, { type: compressed.type || file.type })
      : file;
  } catch (err) {
    console.warn('[imageCompression] compression failed, using original file:', err.message);
    return file;
  }
}
