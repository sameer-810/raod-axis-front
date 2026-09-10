import { cn } from "@/lib/utils";

/**
 * An empty result is a design problem, not an absence of one. "No results" on its
 * own is a dead end, and on the search screen it is where a session ends — so
 * every empty state answers *why* it is empty and offers the next move.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ra-panel px-6 py-12 text-center", className)}>
      {Icon && <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}
