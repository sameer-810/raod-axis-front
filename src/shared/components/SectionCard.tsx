import { cn } from "@/lib/utils";

/**
 * A titled panel — the unit a form, a drawer and a dashboard are built from.
 * Header and body are separated by a hairline, so a section reads as one thing
 * with a name rather than a heading floating above a box.
 */
export function SectionCard({
  title,
  description,
  aside,
  children,
  className,
  bodyClassName,
  id,
  as: Heading = "h2",
  flush,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  as?: "h2" | "h3";
  /** No body padding — for a table or a list that draws its own rows. */
  flush?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn("ra-panel", className)}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <Heading
            id={id ? `${id}-title` : undefined}
            className="text-sm font-semibold text-foreground"
          >
            {title}
          </Heading>
          {description && (
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p>
          )}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className={cn(!flush && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Label / value pairs. Two columns on a wide screen, stacked on a phone. */
export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode; mono?: boolean }>;
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {it.label}
          </dt>
          <dd
            className={cn(
              "mt-0.5 break-words text-sm text-foreground",
              it.mono && "font-mono text-[13px] tabular-nums",
            )}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
