import { Link } from "react-router-dom";
import { BadgeCheck, Clock, MapPin, MessageCircle, Navigation, Star, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/Badge";
import { CategoryIcon } from "@/shared/components/CategoryIcon";
import { googleMapsDirections } from "@/shared/lib/maps";
import { formatDistance, formatNextChange, formatRating } from "@/shared/lib/format";
import { useMarket } from "@/app/market";
import { SaveButton } from "@/modules/favourite/components/SaveButton";
import type { BusinessCard as BusinessCardType } from "../types";

/**
 * One garage in a list — the most-repeated element in the product.
 *
 * Laid out the way the client's reference lays it out, because it answers the
 * questions in the order a driver asks them: what does the place look like,
 * is it real (the verified tick), what do they do, where are they, are they
 * open and until when, and then the two things to do about it — message them
 * on WhatsApp, or drive there.
 *
 *  - **The whole card is a link**, with the name as the anchor; the two
 *    actions sit above that link so pressing them does not open the profile.
 *  - **The tick is blue and next to the name**, as it is everywhere a person
 *    has seen one. It is only ever drawn for a business whose claim RoadAxis
 *    approved against a document.
 *  - **Closed is stated, with when it opens**, rather than hidden: a driver
 *    who drives to a shut garage has been misled.
 */
export function BusinessCard({ business }: { business: BusinessCardType }) {
  const { marketFor } = useMarket();
  const market = marketFor(business.country);
  const href = `/business/${business.slug}`;
  const directions = business.coordinates ? googleMapsDirections(business.coordinates) : null;
  const rating = formatRating(business.averageRating, business.reviewCount);
  const distance = formatDistance(business.distanceMetres);
  const services = business.categories
    .map((c) => c.name)
    .slice(0, 3)
    .join(" · ");
  const place = [business.address.city, business.address.region]
    .filter(Boolean)
    .filter((v, i, all) => all.indexOf(v) === i)
    .join(", ");
  const when = formatNextChange(business.nextChange, {
    locale: market.locale,
    timeZone: market.timezone,
  });

  return (
    // A container, so the card lays itself out by its own width rather than the
    // screen's: two-up in a search grid it is as narrow as on a phone.
    <article className="ra-card flex flex-col [container-type:inline-size]">
      <div className="flex gap-3 p-3 [@container(min-width:560px)]:gap-4">
        {/*
          The workshop's own photograph, or its trade's icon on grey — never a
          stock photo standing in for a named business.
        */}
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-muted [@container(min-width:560px)]:h-[124px] [@container(min-width:560px)]:w-[150px]">
          {business.primaryPhotoUrl ? (
            <img
              src={business.primaryPhotoUrl}
              alt={`${business.name} premises`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="ra-photo-empty">
              <CategoryIcon name={business.categories[0]?.icon} className="h-8 w-8" />
              <span className="sr-only">No photo yet</span>
            </div>
          )}
          {business.isOpen === true && (
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 start-1.5 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
              Open now
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-1.5">
            {/* h2: the page's h1 is the search heading and these are its
                direct children. */}
            <h2 className="min-w-0 font-display text-[17px] font-bold leading-tight text-foreground">
              <Link
                to={href}
                className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {business.name}
              </Link>
              {business.isVerified && (
                <>
                  {/* A word joiner: the tick stays on the line with the last
                      word of the name, never alone on a line of its own. */}
                  {"⁠"}
                  <span
                    role="img"
                    aria-label="Verified"
                    title="Verified by RoadAxis"
                    className="relative z-10 inline-flex translate-y-[2px] ps-1 text-verified"
                  >
                    <BadgeCheck className="h-[18px] w-[18px] fill-current [&>path:last-child]:stroke-white" />
                  </span>
                </>
              )}
            </h2>
            <SaveButton
              businessId={business.id}
              businessName={business.name}
              isFavourite={business.isFavourite}
              className="relative z-10 -mt-1.5 -me-1.5 border-0 bg-transparent"
            />
          </div>

          {(rating || business.claimStatus === "unclaimed") && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {rating && (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-current text-warning" aria-hidden="true" />
                  <span className="font-mono font-semibold text-foreground">{rating.value}</span>
                  <span className="font-mono text-muted-foreground">({rating.count})</span>
                  <span className="sr-only">
                    out of 5, from {rating.count} review{rating.count === 1 ? "" : "s"}
                  </span>
                </span>
              )}
              {business.claimStatus === "unclaimed" && (
                <Badge className="relative z-10">Unclaimed</Badge>
              )}
            </div>
          )}

          <ul
            data-facts
            className="mt-1.5 space-y-1 text-[14px] leading-snug text-muted-foreground"
          >
            {services && (
              <li className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{services}</span>
              </li>
            )}
            {(place || distance) && (
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-text" aria-hidden="true" />
                <span className="truncate">
                  {place}
                  {place && distance && " · "}
                  {distance && (
                    <span
                      className="font-mono"
                      data-distance-metres={business.distanceMetres ?? undefined}
                    >
                      {distance}
                    </span>
                  )}
                  {distance && <span className="sr-only"> away</span>}
                </span>
              </li>
            )}
            {business.isOpen !== null && business.isOpen !== undefined && (
              <li className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  <span className={cn("font-semibold", business.isOpen && "text-success")}>
                    {business.isOpen ? "Open now" : "Closed"}
                  </span>
                  {when && ` · ${when}`}
                </span>
              </li>
            )}
          </ul>
        </div>

        <CardActions
          business={business}
          directions={directions}
          className="hidden [@container(min-width:560px)]:flex"
        />
      </div>

      <CardActions
        business={business}
        directions={directions}
        className="border-t border-border p-3 pt-2.5 [@container(min-width:560px)]:hidden"
        row
      />
    </article>
  );
}

/**
 * The two terminal actions. WhatsApp first, because a message is how these
 * businesses already work; Directions second, for the driver who is going
 * anyway. Beside the details on a wide screen, beneath them on a phone.
 */
function CardActions({
  business,
  directions,
  className,
  row = false,
}: {
  business: BusinessCardType;
  directions: string | null;
  className?: string;
  row?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative z-10 shrink-0 gap-2",
        row ? "flex" : "w-[150px] flex-col justify-center",
        className,
      )}
    >
      <Link
        to={`/business/${business.slug}/request`}
        className={cn("ra-btn ra-btn-whatsapp flex-1", !row && "flex-none")}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        WhatsApp
        <span className="sr-only">: request a booking from {business.name}</span>
      </Link>
      {directions && (
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn("ra-btn ra-btn-outline flex-1", !row && "flex-none")}
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Directions
          <span className="sr-only">to {business.name}, opens Google Maps</span>
        </a>
      )}
    </div>
  );
}
