import { cn } from "@/lib/utils";
import { initials } from "@/shared/lib/format";

/**
 * Initials on a neutral disc. Never a tinted pastel per person — colour means
 * status here, and a rainbow of avatars spends it on decoration.
 */
export function Avatar({
  name,
  size = "md",
  className,
  onDark,
}: {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase",
        size === "sm" && "h-6 w-6 text-[10px]",
        size === "md" && "h-8 w-8 text-[11px]",
        size === "lg" && "h-10 w-10 text-xs",
        onDark ? "bg-white/10 text-white" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
