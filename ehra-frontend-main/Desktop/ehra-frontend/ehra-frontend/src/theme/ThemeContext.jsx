import { createContext, useContext, useEffect, useState } from "react";

// ── Theme context ─────────────────────────────────────────────────────────
// Provides `theme` ("light" | "dark") and `toggleTheme()` to the whole app.
// Persists the user's choice in localStorage and mirrors it onto
// <html data-theme="..."> so plain CSS (see src/theme.css) can react to it
// via `[data-theme="dark"] { ... }` overrides. This file only adds new
// behavior — it doesn't touch any existing app logic.

const STORAGE_KEY = "ehra-theme";

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back silently
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore persistence failures
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
