import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** A numbered sequence with one current step. For flows that have a "then". */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: Array<{ label: string; description?: string }>;
  /** Zero-based. Steps before it are done. */
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-3 sm:flex-row sm:gap-0", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="flex flex-1 items-start gap-3 sm:pe-6">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold tabular-nums",
                done && "border-success bg-success text-success-foreground",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="sr-only">
                  {done ? "Done: " : active ? "Current step: " : "Step: "}
                </span>
                {s.label}
              </p>
              {s.description && (
                <p className="text-xs leading-snug text-muted-foreground">{s.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
