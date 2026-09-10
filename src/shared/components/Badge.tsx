import { cn } from "@/lib/utils";

/**
 * Status, and only status. `neutral` is the default and should be most of them: a
 * screen where every badge is coloured has no urgent badge, because the one that
 * needs attention is camouflaged by the four that do not.
 */
type Tone = "neutral" | "success" | "warning" | "destructive" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/30 bg-success/10 text-success",
  // `warning-text`, not `warning`: full-strength amber on its own 10% tint is
  // 3.64:1 in the light theme. See index.css.
  warning: "border-warning/30 bg-warning/10 text-warning-text",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  primary: "border-primary/30 bg-primary/10 text-primary-text",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  icon: Icon,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
