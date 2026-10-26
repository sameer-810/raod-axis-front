import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/shared/components/CategoryIcon";
import { serviceImage } from "@/shared/lib/servicePhotos";

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
  photoUrl,
  count,
  to,
  className,
}: {
  slug: string;
  name: string;
  icon?: string | null;
  /** Uploaded in Console → Categories; wins over the site's own photo. */
  photoUrl?: string | null;
  count?: number;
  to: string;
  className?: string;
}) {
  const image = serviceImage(slug, photoUrl);
  return (
    <Link
      to={to}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-secondary p-1.5 transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        className={cn(
          "relative block aspect-[4/3] overflow-hidden rounded-xl",
          image?.kind === "icon" ? "bg-[#F4F4F5]" : "bg-muted",
        )}
      >
        {image ? (
          <img
            src={image.src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className={cn(
              "h-full w-full transition-transform duration-slow group-hover:scale-[1.04]",
              image.kind === "icon" ? "object-contain p-1.5 sm:p-2" : "object-cover",
            )}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <CategoryIcon name={icon} className="h-8 w-8" />
          </span>
        )}
      </span>
      <span className="px-1 pb-1 pt-2 text-center">
        {/* Two lines rather than an ellipsis: "Air Conditioning" on a 360px
            phone was "Air Conditi…", which the client caught. */}
        <span className="flex min-h-[2.4em] items-center justify-center text-[13px] font-semibold leading-[1.2] text-foreground [overflow-wrap:anywhere] sm:text-[15px]">
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
