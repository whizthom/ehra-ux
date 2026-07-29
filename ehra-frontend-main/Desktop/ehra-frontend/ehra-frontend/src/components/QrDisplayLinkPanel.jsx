import { useCallback, useEffect, useState } from "react";
import {
  getQrDisplayLink,
  generateQrDisplayLink,
  revokeQrDisplayLink,
} from "../api/attendanceApi";
import styles from "./QrDisplayLinkPanel.module.css";

/**
 * "Share Live QR" section — lets the employer generate a public link that
 * shows the live rotating QR (see pages/public/QrDisplayPage.jsx) to
 * anyone holding it, with no login required. Solves a real limitation:
 * previously the only way to display the QR on a second device (a
 * reception tablet, a screen at the entrance) was to log that device into
 * the full admin dashboard — handing out real admin access just to show
 * a QR code.
 *
 * This link only ever works for whichever business is active when it's
 * generated — the backend scopes it 1:1 to a Business (see
 * QrDisplayLink's class doc), so an employer with multiple businesses
 * needs a separate link per business, generated while that business is
 * the active workspace.
 *
 * At most one live link at a time: generating a new one immediately
 * invalidates whatever the previous link was (the backend replaces the
 * row, it doesn't keep old ones around), so there's nothing to manage
 * beyond "current link" / "none yet".
 */
export default function QrDisplayLinkPanel() {
  const [link, setLink] = useState(null); // { token, createdAt } | null
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const fetchLink = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getQrDisplayLink();
      setLink(data?.token ? data : null);
      setError("");
    } catch (err) {
      console.error("Failed to load QR display link:", err);
      setError("Couldn't load the current link.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  const shareUrl = link
    ? `${window.location.origin}/qr-display/${link.token}`
    : "";

  const handleGenerate = async () => {
    try {
      setBusy(true);
      setError("");
      const { data } = await generateQrDisplayLink();
      setLink(data);
      setConfirmingRevoke(false);
    } catch (err) {
      console.error("Failed to generate QR display link:", err);
      setError("Couldn't generate a link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setBusy(true);
      setError("");
      await revokeQrDisplayLink();
      setLink(null);
      setConfirmingRevoke(false);
    } catch (err) {
      console.error("Failed to revoke QR display link:", err);
      setError("Couldn't revoke the link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the URL
      // is still selectable/visible in the box below, so this isn't fatal.
      setError("Couldn't copy automatically — select and copy the link below.");
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Share Live QR</span>
      </div>
      <p className={styles.desc}>
        Generate a link that shows this business's live QR code to anyone who
        has it — no Ehra login needed. Useful for a reception tablet or a second
        screen at the entrance, without giving that device access to your admin
        account. Employees still scan and clock in/out exactly as normal.
      </p>

      {loading ? (
        <p className={styles.loadingText}>Loading…</p>
      ) : link ? (
        <div className={styles.linkBox}>
          <input
            className={styles.linkInput}
            type="text"
            value={shareUrl}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <button
            className={styles.copyBtn}
            onClick={handleCopy}
            disabled={busy}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : (
        <p className={styles.emptyText}>No active share link yet.</p>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.actions}>
        {link ? (
          <>
            <button
              className={styles.secondaryBtn}
              onClick={handleGenerate}
              disabled={busy}
            >
              Generate new link
            </button>
            {confirmingRevoke ? (
              <div className={styles.confirmRow}>
                <span className={styles.confirmText}>
                  This will stop the current link from working. Continue?
                </span>
                <button
                  className={styles.dangerBtn}
                  onClick={handleRevoke}
                  disabled={busy}
                >
                  Yes, revoke
                </button>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => setConfirmingRevoke(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={styles.dangerBtn}
                onClick={() => setConfirmingRevoke(true)}
                disabled={busy}
              >
                Revoke link
              </button>
            )}
          </>
        ) : (
          <button
            className={styles.primaryBtn}
            onClick={handleGenerate}
            disabled={busy}
          >
            {busy ? "Generating…" : "Generate share link"}
          </button>
        )}
      </div>
    </div>
  );
}
