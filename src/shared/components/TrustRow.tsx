import { BadgeCheck, Star, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance, formatRating } from "@/shared/lib/format";

/**
 * The four facts, in the same order, everywhere a business appears:
 *
 *     [Verified ✓]   [4.6 ★ (23)]   [Open now]   [1.2 km]
 *
 * The research on marketplaces is unambiguous that trust is the thing being
 * sold and has to be designed in explicitly rather than assumed. This component
 * is that design, and it exists as one component precisely so the order cannot
 * drift between the search card, the map popup and the profile header — the eye
 * learns one position per fact and then stops reading labels.
 *
 * Three rules are encoded here rather than left to each caller, because each of
 * them was gettable wrong and damaging:
 *
 *  1. **No reviews shows nothing.** Not "0.0 ★", not "No reviews yet" in red. A
 *     new business has not failed; rendering a zero rating is a libel we
 *     generated ourselves out of an absence of data.
 *  2. **Unverified shows nothing.** "Verified" is a positive claim we can
 *     substantiate from a reviewed document. "Unverified" is an accusation we
 *     cannot — most unverified businesses are simply ones nobody has claimed yet.
 *  3. **Closed is stated, not hidden.** This is the one negative worth showing,
 *     because a driver who drives to a closed garage has been actively misled,
 *     and it is muted rather than red because being shut at 9pm is normal.
 */
export function TrustRow({
  verified,
  averageRating,
  reviewCount,
  isOpen,
  distanceMetres,
  className,
}: {
  verified?: boolean;
  averageRating?: number | null;
  reviewCount?: number | null;
  /** `undefined` when hours are unknown — which is not the same as closed. */
  isOpen?: boolean;
  distanceMetres?: number | null;
  className?: string;
}) {
  const rating = formatRating(averageRating, reviewCount);
  const distance = formatDistance(distanceMetres);

  return (
    <div className={cn("ra-trust", className)}>
      {verified && (
        <span className="ra-trust-item font-medium text-success">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          Verified
        </span>
      )}

      {rating && (
        <span className="ra-trust-item">
          <Star className="h-4 w-4 fill-current text-warning" aria-hidden="true" />
          <span className="font-mono font-medium tabular-nums text-foreground">{rating.value}</span>
          <span className="font-mono tabular-nums">({rating.count})</span>
          <span className="sr-only">
            out of 5, from {rating.count} review{rating.count === 1 ? "" : "s"}
          </span>
        </span>
      )}

      {isOpen !== undefined && (
        <span className={cn("ra-trust-item", isOpen && "text-success")}>
          <Clock className="h-4 w-4" aria-hidden="true" />
          {isOpen ? "Open now" : "Closed"}
        </span>
      )}

      {distance && (
        <span className="ra-trust-item">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {/* The raw value is exposed so tests — and anything else reading the
              page — can assert on a number rather than parse a formatted
              string whose unit and rounding are a display decision. */}
          <span className="font-mono tabular-nums" data-distance-metres={distanceMetres ?? undefined}>
            {distance}
          </span>
          {/* Leading space: without it `textContent` concatenates to "470 maway". */}
          <span className="sr-only"> away</span>
        </span>
      )}
    </div>
  );
}
