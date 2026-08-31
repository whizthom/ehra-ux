import { useEffect } from "react";

// Keeps a `--app-vh` custom property on <html> in sync with the ACTUAL
// visible viewport height (window.visualViewport.height), not just the
// layout viewport that 100vh/100dvh are based on.
//
// Why this exists: an on-screen keyboard resizes the browser's *visual*
// viewport, but plenty of real devices/OS versions don't reliably shrink
// the *layout* viewport to match — even with the
// `interactive-widget=resizes-content` hint in index.html, which only
// Chrome 108+/Safari 16.4+ honor. When the layout viewport doesn't
// shrink, 100dvh keeps reporting the pre-keyboard height, so a flex
// column sized off it doesn't actually get shorter — the keyboard just
// sits on top of (or the browser pans to reveal input over) whatever was
// at the bottom, which is what was dragging the chat header out of view.
//
// window.visualViewport.height is the one number that's correct in both
// cases, on every browser that implements the API at all (iOS Safari
// 13+, Chrome/Android since 2018) — so .dash consumes it via
// `height: var(--app-vh, 100dvh)`, with 100dvh as the fallback for the
// rare browser with neither. When that happens, the whole app shell
// (header included, since it's a flex child, not something separately
// positioned) genuinely shrinks to fit above the keyboard instead of
// being covered or shifted by it.
export default function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // unsupported browser — the CSS 100dvh fallback still applies

    const root = document.documentElement;
    let raf = null;

    const apply = () => {
      raf = null;
      root.style.setProperty("--app-vh", `${vv.height}px`);
    };

    const onChange = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    apply();
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty("--app-vh");
    };
  }, []);
}