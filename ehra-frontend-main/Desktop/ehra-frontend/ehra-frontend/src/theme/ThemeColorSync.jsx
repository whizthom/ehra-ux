import { useEffect } from "react";
import { useTheme } from "./ThemeContext";

/**
 * Keep the Android/Chrome status-bar theme color synchronized with Ehral's
 * own Light/Dark toggle.  The existing meta elements are updated in place.
 * Replacing the meta node on every toggle can make Android Chrome briefly
 * paint a 1px divider at the status-bar boundary, so the DOM node is kept
 * stable and only its content is changed.
 */
const PAGE_BG = {
  light: "#f0f4f3",
  dark: "#0b141a",
};

function setMetaContent(name, content) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  if (meta) {
    meta.setAttribute("content", content);
  }
}

export default function ThemeColorSync() {
  const { theme } = useTheme();

  useEffect(() => {
    const color = PAGE_BG[theme] || PAGE_BG.light;

    setMetaContent("theme-color", color);
    setMetaContent("background-color", color);
  }, [theme]);

  return null;
}
