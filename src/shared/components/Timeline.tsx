import { cn } from "@/lib/utils";

export interface TimelineEntry {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  body?: React.ReactNode;
  tone?: "neutral" | "warning" | "success" | "destructive";
  /** Replaces the dot — an avatar, an icon. Expected to be 32px square. */
  marker?: React.ReactNode;
}

/**
 * Events in time order, with a rail. Grouped by day, because "what happened
 * on Tuesday" is how an administrator asks the question.
 */
export function Timeline({
  groups,
  className,
}: {
  groups: Array<{ label: string; entries: TimelineEntry[] }>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <p className="mb-2 ps-11 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {g.label}
          </p>
          <ol className="ra-timeline">
            {g.entries.map((e) => (
              <li key={e.id} className="relative py-2 pe-2 ps-11">
                {e.marker ? (
                  <span className="absolute start-0 top-1.5">{e.marker}</span>
                ) : (
                  <span
                    className="ra-timeline-dot"
                    data-tone={e.tone ?? "neutral"}
                    aria-hidden="true"
                  />
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <div className="min-w-0 text-[13px] leading-5 text-foreground">{e.title}</div>
                  {e.meta && (
                    <div className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {e.meta}
                    </div>
                  )}
                </div>
                {e.body && <div className="mt-1.5">{e.body}</div>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
