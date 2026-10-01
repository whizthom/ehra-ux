// Heart used for "save for later" across the public storefront and the
// internal customer store.
//
// Why this exists: the app loads Tabler's webfont from the CDN at @latest.
// Newer Tabler releases moved every "-filled" glyph into a separate font, so
// the `ti-heart-filled` class no longer resolves and the "saved" heart
// rendered as nothing. An inline SVG doesn't depend on any icon font, so the
// saved state is always visible. The outline state is drawn the same way so
// both states line up exactly.
export default function HeartIcon({ filled = false, className = "", style }) {
  return (
    <svg
      className={className}
      style={{
        width: "1em",
        height: "1em",
        flexShrink: 0,
        verticalAlign: "-0.125em",
        color: filled ? "#e24b4a" : undefined,
        ...style,
      }}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
    </svg>
  );
}
