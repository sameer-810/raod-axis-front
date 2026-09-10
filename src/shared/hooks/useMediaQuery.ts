import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Read once on mount too: the query may have changed between the initial
    // state and the effect running (a rotation, or a resized dev window).
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * The one breakpoint the mobile layer switches on — Tailwind's `md`, 768px.
 * Deliberately one, not a scale, so there is never a state where the tab bar has
 * appeared but the table has not become cards.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** For honouring the OS motion setting in JS-driven animation. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
