import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "warning" | "destructive" | "success";

/**
 * One number and what it means. No icon tile — a pastel square holding a glyph
 * beside a KPI is the most common ornament in generated dashboards, and it
 * spends a colour on decoration in a product where colour means status.
 *
 * Stands alone as a tile, or sits inside a `StatGroup` where the tiles become
 * one strip with hairline dividers.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  trend,
  className,
  size = "md",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  /** A change over the window, rendered as a small arrow and figure. */
  trend?: { value: number; suffix?: string; good?: "up" | "down" };
  className?: string;
  size?: "md" | "lg";
}) {
  const up = trend && trend.value > 0;
  const flat = trend && trend.value === 0;
  const positive = trend && (trend.good === "down" ? trend.value < 0 : trend.value > 0);

  return (
    <div className={cn("ra-tile min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2.5 flex items-baseline gap-2">
        <p
          className={cn(
            "font-mono font-semibold tabular-nums leading-none",
            size === "lg" ? "text-[28px]" : "text-2xl",
            tone === "neutral" && "text-foreground",
            tone === "warning" && "text-warning-text",
            tone === "destructive" && "text-destructive",
            tone === "success" && "text-success",
          )}
        >
          {value}
        </p>
        {trend && !flat && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-mono text-xs tabular-nums",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {Math.abs(trend.value)}
            {trend.suffix ?? "%"}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Metrics as one instrument: a strip with dividers, not a row of cards. */
export function StatGroup({
  children,
  columns,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ra-stat-group grid-cols-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-3",
        (columns === 4 || !columns) && "lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
