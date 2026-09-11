import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The top of every console screen: what this is, how many, what you can do.
 *
 * The `<h1>` is `sr-only` below `md` rather than hidden. The mobile header bar
 * already says where you are, and a screen printing its own name twice in the
 * first 80px is the mark of a template — but a page with no heading in the
 * accessibility tree is worse. This is the document's one `<h1>` at every width;
 * on a phone only the eye is spared it.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
  back,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small facts under the description — counts, a sort order. */
  meta?: React.ReactNode;
  back?: { to: string; label: string };
  /** A row below the header — tabs, a segmented filter. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {back && (
        <Link
          to={back.to}
          className="ra-focus -ms-1.5 inline-flex min-h-[44px] items-center gap-1 rounded-md px-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:h-7 md:min-h-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="ra-eyebrow mb-1 text-muted-foreground">{eyebrow}</p>}
          <h1 className="sr-only font-display text-[22px] font-semibold leading-7 tracking-tight text-foreground md:not-sr-only md:block">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          {meta && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
