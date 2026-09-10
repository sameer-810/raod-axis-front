import { cn } from "@/lib/utils";

/**
 * One number and what it means. Deliberately without an icon tile: a pastel
 * rounded square holding a glyph beside a KPI label is the most common ornament in
 * generated dashboards, and it spends a *colour* on decoration in a product where
 * colour means status.
 *
 * `tone` exists for the one case that earns it — an overdue queue, a delivery
 * failure count above zero. Left neutral, which is what most should be.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "warning" | "destructive" | "success";
  className?: string;
}) {
  return (
    <div className={cn("ra-tile", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-semibold tabular-nums",
          tone === "neutral" && "text-foreground",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
