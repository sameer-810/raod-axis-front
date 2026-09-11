import { cn } from "@/lib/utils";

/**
 * An empty result is a design problem, not an absence of one. "No results" on its
 * own is a dead end — so every empty state answers *why* it is empty and offers
 * the next move. Left-aligned inside a table frame (`inline`), centred as a page.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  inline,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Inside a table or panel that already has a frame. */
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        inline ? "px-6 py-14 text-center" : "ra-panel px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <span
          className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}
