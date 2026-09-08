import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Theme provider.
 *
 * Follows the operating system by default rather than forcing either theme.
 * RoadAxis is dark-led as a brand — the brochure's own surfaces are #0E1621 —
 * and is genuinely used at night at the roadside, so dark is not an afterthought.
 * But it is also a consumer site someone arrives at from a search result, and
 * overriding their stated OS preference on arrival is a decision we have no
 * standing to make. An explicit choice is remembered.
 *
 * The <script> in index.html applies the class before first paint to avoid a
 * flash; this provider is the source of truth at runtime and its initial read
 * must agree with that script.
 */

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "roadaxis_theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage unavailable; fall through to the OS preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readInitial());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing. The theme still applies for this session.
    }
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
