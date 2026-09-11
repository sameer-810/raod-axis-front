import { useEffect } from "react";

type Handler = (e: KeyboardEvent) => void;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable ||
    Boolean(el.closest('[role="dialog"] input, [role="dialog"] textarea'))
  );
}

/**
 * Global keyboard shortcuts.
 *
 * Keys are written as "mod+k", "g b" (a two-key sequence), "/" or "escape".
 * Plain keys never fire while someone is typing; `mod+` combinations always do.
 */
export function useHotkeys(map: Record<string, Handler>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let pending: string | null = null;
    let timer: number | undefined;

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod) {
        const handler = map[`mod+${key}`];
        if (handler) {
          e.preventDefault();
          handler(e);
        }
        pending = null;
        return;
      }

      if (isTyping(e.target) || e.altKey) return;

      if (pending) {
        const seq = `${pending} ${key}`;
        pending = null;
        window.clearTimeout(timer);
        const handler = map[seq];
        if (handler) {
          e.preventDefault();
          handler(e);
          return;
        }
      }

      const direct = map[key];
      if (direct) {
        e.preventDefault();
        direct(e);
        return;
      }

      // Start a sequence if any binding begins with this key.
      if (Object.keys(map).some((k) => k.startsWith(`${key} `))) {
        pending = key;
        timer = window.setTimeout(() => {
          pending = null;
        }, 900);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [map, enabled]);
}
