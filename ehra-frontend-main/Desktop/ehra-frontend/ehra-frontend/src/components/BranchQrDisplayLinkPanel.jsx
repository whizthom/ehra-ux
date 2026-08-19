import { useCallback, useEffect, useState } from "react";
import {
  getBranchQrDisplayLink,
  generateBranchQrDisplayLink,
  revokeBranchQrDisplayLink,
} from "../api/branchApi";
import styles from "./BranchQrPanel.module.css";

/**
 * Branch-scoped "Share Live QR" — same concept and same public route
 * (/qr-display/:token) as the business-wide QrDisplayLinkPanel, but this
 * link only ever shows THIS branch's own rotating QR (the backend tells
 * the two kinds apart via QrDisplayLink#branch — see its class doc). A
 * business with several locations can hand each branch's own front desk
 * its own link instead of one link that's ambiguous about which branch
 * it's actually for.
 */
export default function BranchQrDisplayLinkPanel({ branchId, branchStatus }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const isInactive = branchStatus === "INACTIVE";

  const fetchLink = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getBranchQrDisplayLink(branchId);
      setLink(data?.token ? data : null);
      setError("");
    } catch {
      setError("Couldn't load the current link.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!isInactive) fetchLink();
    else setLoading(false);
  }, [fetchLink, isInactive]);

  const shareUrl = link
    ? `${window.location.origin}/qr-display/${link.token}`
    : "";

  const handleGenerate = async () => {
    try {
      setBusy(true);
      setError("");
      const { data } = await generateBranchQrDisplayLink(branchId);
      setLink(data);
      setConfirmingRevoke(false);
    } catch {
      setError("Couldn't generate a link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setBusy(true);
      setError("");
      await revokeBranchQrDisplayLink(branchId);
      setLink(null);
      setConfirmingRevoke(false);
    } catch {
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
      setError("Couldn't copy automatically — select and copy the link below.");
    }
  };

  if (isInactive) return null;

  return (
    <div className={styles.linkPanel}>
      <div className={styles.linkPanelHeader}>
        <i className="ti ti-share" aria-hidden="true" />
        Share this branch's live QR
      </div>
      <p className={styles.linkPanelDesc}>
        Generate a link that shows only this branch's live QR — no Ehra login
        needed. Useful for a tablet or screen at this branch's own entrance.
      </p>

      {loading ? (
        <p className={styles.linkPanelLoading}>Loading…</p>
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
        <p className={styles.linkPanelEmpty}>
          No active share link for this branch yet.
        </p>
      )}

      {error && <p className={styles.linkPanelError}>{error}</p>}

      <div className={styles.linkPanelActions}>
        {link ? (
          <>
            <button
              className={styles.linkSecondaryBtn}
              onClick={handleGenerate}
              disabled={busy}
            >
              Generate new link
            </button>
            {confirmingRevoke ? (
              <div className={styles.linkConfirmRow}>
                <span>This will stop the current link from working.</span>
                <button
                  className={styles.linkDangerBtn}
                  onClick={handleRevoke}
                  disabled={busy}
                >
                  Yes, revoke
                </button>
                <button
                  className={styles.linkSecondaryBtn}
                  onClick={() => setConfirmingRevoke(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={styles.linkDangerBtn}
                onClick={() => setConfirmingRevoke(true)}
                disabled={busy}
              >
                Revoke link
              </button>
            )}
          </>
        ) : (
          <button
            className={styles.linkPrimaryBtn}
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
