import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { initials } from "@/shared/lib/format";

/**
 * One record as a card — what replaces a table row below `md` in the portal and
 * console.
 *
 * A table works by letting the eye run down an aligned column, and that mechanism
 * needs width. At 390px there is none, so a table degrades into sideways panning:
 * the cost of a table without its benefit. A card gives up the alignment
 * deliberately and keeps each record whole.
 */
export function RecordCard({
  title,
  meta,
  to,
  onClick,
  actions,
  badge,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode[];
  to?: string;
  onClick?: () => void;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  const label = typeof title === "string" ? title : undefined;

  const body = (
    <div className="flex items-start gap-3">
      {/* Never tinted. A coloured disc per record is the banned decorative icon
          tile in a new costume — the initials do the identifying work. */}
      <span className="ra-disc" aria-hidden="true">
        {initials(label)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {badge}
        </div>
        {meta && meta.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {meta.filter(Boolean).map((m, i) => (
              <span key={i} className="truncate">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("ra-card p-3.5", className)}>
      {/*
        `ra-tap` on the link: a record card is the whole target on a phone, and
        with a one-line title it rendered at 42px — under the floor by two
        pixels, on the most-tapped row in the admin console.
      */}
      {to ? (
        <Link
          to={to}
          className="ra-tap block outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {body}
        </button>
      ) : (
        body
      )}
      {actions && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3">{actions}</div>
      )}
    </div>
  );
}
