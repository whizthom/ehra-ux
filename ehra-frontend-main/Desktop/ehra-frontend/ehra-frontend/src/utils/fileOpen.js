// Shared "never let the person see the underlying storage provider's
// domain" helpers — used for documents (MessageBubble.jsx) and images
// (ImageLightbox.jsx's download button). Both fetch the file as a Blob
// and hand the browser a local blob: URL instead of ever navigating to
// or linking the raw Cloudinary CDN URL directly.

// Opens a file for VIEWING in a new tab — the browser's native PDF
// viewer, for instance — without the address bar ever showing
// res.cloudinary.com. Falls back to a direct link only if the fetch
// itself fails (e.g. a CORS or network issue), which is still strictly
// better than never being able to open the file at all.
export async function openFileInApp(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    // Revoked later rather than immediately — the new tab needs the
    // object URL to still resolve by the time it actually loads it.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// Saves a file to disk via a real download rather than a plain
// <a href download> pointed at a cross-origin URL, which browsers often
// just navigate to instead of downloading when they can't infer intent
// from cross-origin response headers alone.
export async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || url.split("/").pop()?.split("?")[0] || "file";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}