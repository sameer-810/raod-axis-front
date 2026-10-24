import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/shared/components/CategoryIcon";
import { servicePhoto } from "@/shared/lib/servicePhotos";

/**
 * A service, as a photograph of the work with its name under it — the tile the
 * client's reference is built from. The picture is decoration (`alt=""`): the
 * name is the label, and a screen reader hears "Tyres, 11 places" rather than a
 * description of a stock photo first.
 */
export function ServiceTile({
  slug,
  name,
  icon,
  count,
  to,
  className,
}: {
  slug: string;
  name: string;
  icon?: string | null;
  count?: number;
  to: string;
  className?: string;
}) {
  const photo = servicePhoto(slug);
  return (
    <Link
      to={to}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-secondary p-1.5 transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        {photo ? (
          <img
            src={photo}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <CategoryIcon name={icon} className="h-8 w-8" />
          </span>
        )}
      </span>
      <span className="px-1 pb-1 pt-2 text-center">
        <span className="block truncate text-[14px] font-semibold leading-tight text-foreground sm:text-[15px]">
          {name}
        </span>
        {count !== undefined && (
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            <span className="font-mono">{count}</span> {count === 1 ? "place" : "places"}
          </span>
        )}
      </span>
    </Link>
  );
}
