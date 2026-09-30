import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./AuthTabs.module.css";

// The three ways into Ehra, shown as one segmented switch at the top of every
// pre-auth screen. Each tab is a real route, so the create-workspace flow and
// the sign-in flow keep their own state machines untouched - this component
// only decides which one you're looking at.
const TABS = [
  { key: "signin", label: "Sign in", to: "/login" },
  { key: "customer", label: "Customer sign up", to: "/signup/customer" },
  { key: "business", label: "Business sign up", to: "/" },
];

// Each tab is a separate page, so the sliding thumb would normally snap
// instead of slide. Remembering where it was last lets the next page start
// the thumb there and glide to the new tab.
const PREV_KEY = "ehra_auth_tab_prev";

function readPrev(fallback) {
  try {
    const n = Number(sessionStorage.getItem(PREV_KEY));
    return Number.isInteger(n) && n >= 0 && n < TABS.length ? n : fallback;
  } catch {
    return fallback;
  }
}

export default function AuthTabs({ active, className = "" }) {
  const index = Math.max(
    0,
    TABS.findIndex((t) => t.key === active),
  );
  const [pos, setPos] = useState(() => readPrev(index));

  useEffect(() => {
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPos(index));
    });
    try {
      sessionStorage.setItem(PREV_KEY, String(index));
    } catch {
      // sessionStorage unavailable (private mode etc.) - thumb just snaps.
    }
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [index]);

  return (
    <nav
      className={`${styles.seg} ${className}`}
      aria-label="Sign in or create an account"
      style={{ "--i": pos }}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          replace
          aria-current={t.key === active ? "page" : undefined}
          className={`${styles.tab} ${t.key === active ? styles.tabOn : ""}`}
        >
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
