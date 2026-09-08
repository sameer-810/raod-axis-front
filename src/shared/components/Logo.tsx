import { cn } from "@/lib/utils";

/**
 * The mark. Two counter-rotating chevrons on an axis — movement along a route,
 * which is what the name says.
 *
 * Drawn rather than imported so it inherits `currentColor` and works on the
 * dark rail, the light header and a favicon without three files that drift.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7 shrink-0"
        role="img"
        aria-label="RoadAxis"
        fill="none"
      >
        <rect width="32" height="32" rx="7" className="fill-foreground" />
        <path
          d="M8 22V10h7.2a3.9 3.9 0 0 1 1.5 7.5L20 22h-3.6l-2.9-4.3H11V22H8Zm3-6.9h3.9a1.6 1.6 0 0 0 0-3.2H11v3.2Z"
          className="fill-primary"
        />
        <path d="M22 10h2.2v12H22z" className="fill-primary opacity-60" />
      </svg>
      {showWordmark && (
        <span className="text-[17px] font-semibold tracking-tight">
          Road<span className="text-primary-text">Axis</span>
        </span>
      )}
    </span>
  );
}
