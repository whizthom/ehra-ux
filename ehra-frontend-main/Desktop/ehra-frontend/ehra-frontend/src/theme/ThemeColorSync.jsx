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

export default function ThemeColorSync() {
  const { theme } = useTheme();

  useEffect(() => {
    const color = PAGE_BG[theme] || PAGE_BG.light;

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute("content", color);

    // Not a standard meta tag (no browser reads it), but Round 1 added
    // it for consistency alongside theme-color — kept in sync here too
    // rather than left stale.
    const bgColorMeta = document.querySelector('meta[name="background-color"]');
    if (bgColorMeta) bgColorMeta.setAttribute("content", color);
  }, [theme]);

  return null;
}
