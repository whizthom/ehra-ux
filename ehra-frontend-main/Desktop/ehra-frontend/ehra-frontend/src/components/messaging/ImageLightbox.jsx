import { useEffect, useState } from "react";
import styles from "./ImageLightbox.module.css";

// Full-screen in-app image viewer. Exists specifically so tapping a photo
// message never navigates the browser to the raw Cloudinary CDN URL
// (res.cloudinary.com in the address bar looks like leaving the app) —
// everything, including the download, stays inside Ehral's own UI.
export default function ImageLightbox({ url, caption, onClose }) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      // Fetching the bytes ourselves and saving via a Blob/object URL — as
      // opposed to a plain <a href={url} download> — is what stops the
      // browser from just navigating to the CDN URL when it can't infer a
      // download from cross-origin headers alone; this always saves the
      // file rather than opening a new tab.
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = url.split("/").pop()?.split("?")[0] || "image";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Last-resort fallback — still opens in-tab rather than silently
      // doing nothing, but only if the fetch itself (likely a CORS or
      // network issue) failed.
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button className={styles.closeBtn} onClick={onClose} title="Close">
        <i className="ti ti-x" />
      </button>
      <button
        className={styles.downloadBtn}
        onClick={handleDownload}
        disabled={downloading}
        title="Download"
      >
        <i className={downloading ? "ti ti-loader-2" : "ti ti-download"} />
      </button>
      <img
        src={url}
        alt={caption || ""}
        className={styles.image}
        onClick={(e) => e.stopPropagation()}
      />
      {caption && (
        <div className={styles.caption} onClick={(e) => e.stopPropagation()}>
          {caption}
        </div>
      )}
    </div>
  );
}
