import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";
import styles from "./ThemeToggleMenu.module.css";

// Must match the CSS transition duration on .panel/.scrim below — the
// panel stays mounted for exactly this long after closing so it can
// actually play the slide-out-to-the-left animation instead of just
// vanishing.
const CLOSE_DURATION = 260;

// ── Settings icon + dropdown ─────────────────────────────────────────────
// Self-contained: drop <ThemeToggleMenu /> into any topbar. Currently the
// panel only holds the Light/Dark toggle, but it's built so more settings
// items can be added later without touching the pages that use it.
export default function ThemeToggleMenu() {
  const { theme, toggleTheme } = useTheme();
  // `mounted` = the panel exists in the DOM at all; `open` = it's in its
  // docked (visible) position. Splitting these lets the panel render
  // briefly in its off-screen position while closing, so it can slide
  // back out to the left instead of just disappearing.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const closeTimerRef = useRef(null);

  const openPanel = () => {
    clearTimeout(closeTimerRef.current);
    setMounted(true);
    // Mount off-screen first, then flip to the open position on the
    // next frame so the browser animates the transform instead of
    // snapping straight to it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpen(true));
    });
  };

  const closePanel = () => {
    setOpen(false);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setMounted(false), CLOSE_DURATION);
  };

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closePanel();
      }
    }
    if (mounted) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mounted]);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.iconBtn} ${open ? styles.iconBtnActive : ""}`}
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label="Settings"
        title="Settings"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <i className="ti ti-dots-vertical" aria-hidden="true" />
      </button>

      {mounted && (
        <>
          {/* Soft scrim so the flyout reads as a distinct layer on top
              of the page — tap anywhere on it to dismiss, same as the
              outside-click listener above but with a visible cue. */}
          <div
            className={`${styles.scrim} ${open ? styles.scrimIn : ""}`}
            aria-hidden="true"
            onClick={closePanel}
          />
          <div
            className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
            role="menu"
          >
            <div className={styles.panelHdr}>
              <span className={styles.panelTitle}>Settings</span>
              <button
                type="button"
                className={styles.panelClose}
                onClick={closePanel}
                aria-label="Close settings"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className={styles.row}>
              <span className={styles.rowLabelGroup}>
                <i
                  className={`ti ${theme === "dark" ? "ti-moon-stars" : "ti-sun"}`}
                  aria-hidden="true"
                />
                <span className={styles.rowLabel}>
                  {theme === "dark" ? "Dark mode" : "Light mode"}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={theme === "dark"}
                aria-label="Toggle dark mode"
                className={`${styles.switch} ${theme === "dark" ? styles.switchOn : ""}`}
                onClick={toggleTheme}
              >
                <span className={styles.knob} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
