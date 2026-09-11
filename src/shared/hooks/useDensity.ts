import { useCallback, useEffect, useState } from "react";

export type Density = "compact" | "comfortable";
const KEY = "roadaxis_density";

/**
 * Table density is a user setting, not a design opinion — an administrator
 * clearing a 400-row import wants compact; an owner reading five requests wants
 * air. Remembered per browser.
 */
export function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensityState] = useState<Density>(() => {
    try {
      return window.localStorage.getItem(KEY) === "compact" ? "compact" : "comfortable";
    } catch {
      return "comfortable";
    }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setDensityState(e.newValue === "compact" ? "compact" : "comfortable");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try {
      window.localStorage.setItem(KEY, d);
    } catch {
      // Private browsing; the choice lasts the session.
    }
  }, []);

  return [density, setDensity];
}
