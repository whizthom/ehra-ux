import { useEffect } from "react";
import { useTheme } from "./ThemeContext";

/**
 * The Android/Chrome status bar (battery, clock, signal icons) is tinted
 * by <meta name="theme-color">, not anything from CSS — so it doesn't
 * follow the app's [data-theme="dark"] styling on its own. This mounts
 * once, listens to the same theme state everything else in the app uses
 * (see ThemeContext.jsx), and pushes the matching background color into
 * that meta tag whenever it changes — toggle the theme, and the status
 * bar recolors right along with the rest of the page.
 *
 * Values match --bg-page in src/theme/theme.css exactly (light: #f0f4f3,
 * dark: #0b141a) — if that token's value ever changes, update it here
 * too so the two stay in sync.
 *
 * The *first* paint, before this component's effect has a chance to run,
 * is handled separately by a tiny inline script in index.html's <head>
 * (reads the same localStorage key synchronously, before anything
 * renders) — this component takes over from there for every toggle
 * after that.
 */
const PAGE_BG = {
  light: "#f0f4f3",
  dark: "#0b141a",
};

// Android Chrome reads <meta name="theme-color"> for the status bar once
// at page load, but doesn't reliably repaint the status bar just because
// an existing tag's `content` attribute was mutated afterward — it only
// reliably picks up the new color when a genuinely new theme-color meta
// element is inserted into the document. setAttribute() on the existing
// node (the previous approach here) left the status bar stuck on
// whatever color it captured at launch, which is why toggling the theme
// mid-session left it mismatched against the rest of the page even
// though the tag's own content was, in fact, correct.
function setMeta(name, content) {
  const existing = document.querySelector(`meta[name="${name}"]`);
  if (existing) existing.remove();

  const meta = document.createElement("meta");
  meta.setAttribute("name", name);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

export default function ThemeColorSync() {
  const { theme } = useTheme();

  useEffect(() => {
    const color = PAGE_BG[theme] || PAGE_BG.light;

    document.documentElement.style.colorScheme = theme;
    setMeta("theme-color", color);

    // Not a standard meta tag (no browser reads it), but Round 1 added
    // it for consistency alongside theme-color — kept in sync here too
    // rather than left stale.
    setMeta("background-color", color);
  }, [theme]);

  return null;
}
