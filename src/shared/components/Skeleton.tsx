import { cn } from "@/lib/utils";

/** A placeholder shaped like the content it stands in for, so nothing jumps. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("ra-skeleton", className)} style={style} aria-hidden="true" />;
}

/** Table rows at the real row height. */
export function SkeletonRows({
  rows = 8,
  columns,
  density = "comfortable",
}: {
  rows?: number;
  columns: number;
  density?: "compact" | "comfortable";
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} aria-hidden="true">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c} className={density === "compact" ? "h-10" : "h-12"}>
              <Skeleton
                className={cn("h-3.5", c === 0 ? "w-40" : c === columns - 1 ? "w-8" : "w-24")}
                // Vary widths per row so the block does not read as a grid of bars.
                style={c === 0 ? { width: `${52 + ((r * 17) % 30)}%` } : undefined}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A block of text lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
