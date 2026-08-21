// Client-side downscale + re-encode before upload — a phone camera photo
// can easily be 4000x3000px and several megabytes; nothing in a chat
// bubble ever needs to display it above roughly phone-screen resolution.
// Doing this before the upload (rather than relying on Cloudinary
// transformations after the fact) means less data over the person's
// mobile connection AND lower Cloudinary storage/bandwidth cost — the
// exact thing flagged as worth doing when the scale conversation raised
// Cloudinary's usage-based pricing.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

// Only compresses when it's actually worth it — a small PNG icon or a
// GIF (canvas re-encoding would silently lose animation) is returned
// untouched rather than needlessly reprocessed.
export async function compressImageIfNeeded(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const bitmap = await createImageBitmapSafe(file);
  if (!bitmap) return file; // decoding failed for some reason — send the original rather than block sending entirely

  const { width, height } = bitmap;
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size < 1.5 * 1024 * 1024) {
    // Already small enough in both dimensions and size — recompressing
    // would only add a JPEG-artifact generation for no real benefit.
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) return file;

  // Only actually use the compressed version if it's genuinely smaller —
  // a already-efficient PNG screenshot re-encoded as JPEG can sometimes
  // come out larger, in which case sending the original is strictly
  // better.
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

async function createImageBitmapSafe(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}