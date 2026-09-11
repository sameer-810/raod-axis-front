import { cn } from "@/lib/utils";

/** ⌘ on a Mac, Ctrl elsewhere — decided once. */
// eslint-disable-next-line react-refresh/only-export-components
export const MOD = /Mac|iPhone|iPad/.test(
  typeof navigator === "undefined" ? "" : navigator.platform,
)
  ? "⌘"
  : "Ctrl";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("ra-kbd", className)}>{children}</kbd>;
}

/** "⌘ K" as two keycaps, or "Ctrl K". */
export function Shortcut({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden="true">
      {keys.map((k) => (
        <Kbd key={k}>{k === "mod" ? MOD : k}</Kbd>
      ))}
    </span>
  );
}
