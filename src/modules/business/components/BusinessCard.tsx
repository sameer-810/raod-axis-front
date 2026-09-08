import { Link } from "react-router-dom";
import { Navigation, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustRow } from "@/shared/components/TrustRow";
import { Badge } from "@/shared/components/Badge";
import { googleMapsDirections } from "@/shared/lib/maps";
import type { BusinessCard as BusinessCardType } from "../types";

/**
 * One search result.
 *
 * The most-repeated element in the product, so its decisions compound:
 *
 *  - **The whole card is a link**, with the name as the anchor. Keyboard users,
 *    screen readers and "copy link address" all work; the enlarged hit area is
 *    an enhancement layered on a real `<a href>`, never a replacement for one.
 *  - **Directions sits outside that link**, because for a large share of
 *    sessions it is the terminal action — someone who already knows the garage
 *    wants the route, not the profile — and burying it one tap deeper costs
 *    them a page load at the roadside.
 *  - **The trust row is the same four facts in the same order** as everywhere
 *    else. That is the whole point of it being a component.
 *  - **"Unclaimed" is addressed to owners, not drivers.** It is neutral
 *    information with an invitation attached, not a warning about the business.
 */
export function BusinessCard({ business }: { business: BusinessCardType }) {
  const href = `/business/${business.slug}`;
  const directions = business.coordinates ? googleMapsDirections(business.coordinates) : null;

  return (
    <article className="ra-card">
      <div className="flex gap-3 p-3.5">
        {/*
          A fixed-size thumbnail rather than a hero image. A photo of the actual
          workshop is the fastest trust signal available, but at 390px a
          full-width image pushes the next result off the screen and turns a
          scannable list into a carousel.
        */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
          {business.primaryPhotoUrl ? (
            <img
              src={business.primaryPhotoUrl}
              alt={`${business.name} premises`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">No photo yet</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* h2, not h3: the page's h1 is the search heading and these are
                its direct children. Skipping a level makes the document
                outline unusable for anyone navigating by heading. */}
            <h2 className="min-w-0 text-[15px] font-semibold leading-tight text-foreground">
              {/* The real anchor. `after:absolute` stretches its hit area over
                  the card without turning the card into a div pretending to be
                  a link. */}
              <Link
                to={href}
                className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {business.name}
              </Link>
            </h2>
            {business.claimStatus === "unclaimed" && (
              <Badge className="relative z-10 shrink-0">Unclaimed</Badge>
            )}
          </div>

          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {business.categories
              .map((c) => c.name)
              .slice(0, 3)
              .join(" · ")}
            {business.address.city ? ` · ${business.address.city}` : ""}
          </p>

          <TrustRow
            className="mt-2"
            verified={business.isVerified}
            averageRating={business.averageRating}
            reviewCount={business.reviewCount}
            isOpen={business.isOpen ?? undefined}
            distanceMetres={business.distanceMetres}
          />
        </div>
      </div>

      {directions && (
        <div className="relative z-10 flex border-t border-border">
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            // The card's stretched link would otherwise swallow this click.
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "ra-tap flex flex-1 items-center justify-center gap-1.5 text-sm font-medium",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            )}
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
            Directions
            <span className="sr-only">to {business.name}, opens Google Maps</span>
          </a>
        </div>
      )}
    </article>
  );
}
