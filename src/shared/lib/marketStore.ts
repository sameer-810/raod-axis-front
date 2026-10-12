/**
 * @module marketStore
 * @description Which country the visitor is browsing, outside React.
 *
 * It lives here rather than in the provider because the first thing that needs
 * it is the HTTP client, which stamps every request with the country it is for
 * and cannot call a hook. The provider in `app/market.tsx` is the only writer.
 *
 * Two kinds of value are held, and only one is kept. A country the visitor
 * *chose* is remembered across visits. A country that was *guessed* — from the
 * device's clock — lasts for the page and is guessed again next time, so a
 * wrong guess is never something the visitor has to find a way to undo.
 */
const STORAGE_KEY = "roadaxis_market";

function readStored(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && /^[A-Z]{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * A country named in the address the page was opened at — `?country=AE` — so a
 * link shared from the UAE side opens on the UAE side. Read once, here, before
 * anything renders: by the time a component could look, the search page has
 * already tidied the address.
 */
function readAddress(): string | null {
  try {
    const value = new URLSearchParams(window.location.search).get("country")?.toUpperCase();
    return value && /^[A-Z]{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

const fromAddress = typeof window === "undefined" ? null : readAddress();
let current: string | null = typeof window === "undefined" ? null : (fromAddress ?? readStored());
const listeners = new Set<() => void>();

export const marketStore = {
  /** The country code in force, or null before one has been settled. */
  get: () => current,

  /** The country named in the address this page was opened at, if any. */
  fromAddress: () => fromAddress,

  set(code: string, { remember }: { remember: boolean }) {
    if (remember) {
      try {
        window.localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // Private browsing. The choice still holds for this page.
      }
    }
    if (code === current) return;
    current = code;
    listeners.forEach((fn) => fn());
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
