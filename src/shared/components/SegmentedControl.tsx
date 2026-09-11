import { cn } from "@/lib/utils";

/**
 * A row of mutually exclusive options — reporting windows, list/map, a status
 * filter with five states. `aria-pressed` on each, so the chosen one is
 * announced and testable without reading a colour.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  options: Array<{ value: T; label: React.ReactNode; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className={cn("ra-segmented", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("ra-segment", size === "sm" && "px-2.5 text-xs")}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                "ms-1.5 rounded-full px-1.5 font-mono text-[11px] tabular-nums",
                o.value === value
                  ? "bg-primary/10 text-primary-text"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
