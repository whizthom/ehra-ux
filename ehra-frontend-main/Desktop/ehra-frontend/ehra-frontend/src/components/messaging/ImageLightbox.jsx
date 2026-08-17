import { useEffect, useState } from "react";
import { downloadFile } from "../../utils/fileOpen";
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
      await downloadFile(url);
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
