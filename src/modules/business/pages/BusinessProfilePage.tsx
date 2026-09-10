import { Link, useParams } from "react-router-dom";
import {
  Navigation,
  Phone,
  Globe,
  MapPin,
  Store,
  ArrowLeft,
  SearchX,
  MessageCircle,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustRow } from "@/shared/components/TrustRow";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageLoader } from "@/shared/components/PageLoader";
import { formatCurrency } from "@/shared/lib/format";
import { useSeo, localBusinessJsonLd } from "@/shared/hooks/useSeo";
import { SaveButton } from "@/modules/favourite/components/SaveButton";
import { ReviewSection } from "@/modules/review/components/ReviewSection";
import { PhotoGallery } from "../components/PhotoGallery";
import { OpeningHours } from "../components/OpeningHours";
import { useBusiness } from "../hooks/useBusinesses";

/**
 * The business profile, ordered by the questions a driver actually asks, in the
 * order they ask them: is this the right place · can I trust it · is it open ·
 * what do they do · how do I reach them · how do I get there.
 *
 * The two actions are pinned to the bottom on a phone — someone reading this is
 * nearly always about to do one of them.
 */
export function BusinessProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: business, isLoading, error } = useBusiness(slug);

  /**
   * FR-SEO-03 and FR-SEO-04. The description is built from what the business
   * actually is — trade, town, services — because a directory of ten thousand
   * pages sharing one description is indexed once. Called unconditionally, above
   * the early returns, so the rules of hooks hold while data is still loading.
   */
  useSeo({
    title: business ? `${business.name}, ${business.address.city ?? "UK"}` : "Business",
    description: business
      ? `${business.name} — ${business.categories.map((c) => c.name).join(", ") || "vehicle services"} in ${business.address.city ?? "the UK"}. ${
          business.services.length
            ? `${business.services
                .slice(0, 4)
                .map((s) => s.name)
                .join(", ")}. `
            : ""
        }Request a booking on RoadAxis.`
      : undefined,
    structuredData: business
      ? localBusinessJsonLd({ ...business, primaryPhotoUrl: business.photos[0]?.url ?? null })
      : undefined,
  });

  if (isLoading) return <PageLoader />;

  if (error || !business) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={SearchX}
          title="We couldn't find that business"
          description="It may have been removed, or the link may be out of date."
          action={
            <Link
              to="/search"
              className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Find a service
            </Link>
          }
        />
      </div>
    );
  }

  const address = [
    business.address.line1,
    business.address.line2,
    business.address.city,
    business.address.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="ra-shell py-5 pb-28 md:py-8 lg:pb-10">
      <Link
        to="/search"
        className="ra-tap -ms-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to search
      </Link>

      {/*
        Two columns above lg, with the actions pinned in the right one.

        Someone on this page is deciding whether to contact this business, and
        every scroll they take reading the services moves the "Request a
        Booking" button further away. In a single column it ends up below the
        opening hours, the WhatsApp numbers and the reviews — three screens down
        from the decision it serves. A sticky panel keeps the decision and the
        action on screen together, which is what every product this competes
        with does and why they do it.

        Below lg the same actions are pinned to the bottom edge instead, where a
        thumb already is.
      */}
      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-10">
        <div className="ra-public">
          {/* ── Identity and trust ───────────────────────────────────────── */}
          <header>
            <div className="flex items-start gap-3">
              {business.logo && (
                <img
                  src={business.logo.thumbnailUrl ?? business.logo.url}
                  alt={`${business.name} logo`}
                  className="h-14 w-14 shrink-0 rounded-lg border border-border object-contain"
                />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  {business.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {business.categories.map((c) => c.name).join(" · ")}
                </p>
              </div>
              {/* Labelled here, unlike on the card. There is room, and on the page
                where somebody decides they like this garage the word is what
                makes the heart's meaning obvious the first time. */}
              <SaveButton
                businessId={business.id}
                businessName={business.name}
                isFavourite={business.isFavourite}
                variant="labelled"
                className="shrink-0"
              />
            </div>

            <TrustRow
              className="mt-3"
              verified={business.isVerified}
              averageRating={business.averageRating}
              reviewCount={business.reviewCount}
              isOpen={business.isOpen ?? undefined}
            />

            {/*
            Addressed to the owner, not the driver. It is an invitation with an
            action attached, styled as neutral information — an unclaimed listing
            says nothing bad about the business, only that nobody has taken it
            over yet.
          */}
            {business.claimStatus === "unclaimed" && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">
                    Is this your business? Claim it to manage the listing.
                  </span>
                </div>
                <Link
                  to={`/business/${business.slug}/claim`}
                  className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Claim Your Business
                </Link>
              </div>
            )}
          </header>

          {business.photos.length > 0 && (
            <section aria-label="Photos">
              <PhotoGallery photos={business.photos} businessName={business.name} />
            </section>
          )}

          {business.description && (
            <section>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                {business.description}
              </p>
            </section>
          )}

          <div className="space-y-6">
            <div className="space-y-6">
              {business.services.length > 0 && (
                <section aria-labelledby="services">
                  <h2 id="services" className="text-base font-semibold text-foreground">
                    Services
                  </h2>
                  <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {business.services.map((s) => (
                      <li key={s.name} className="flex items-start justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          {s.description && (
                            <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                          )}
                        </div>
                        {/*
                        "from", never a flat price. There is no payment in this
                        product and a firm figure on a listing is a promise the
                        platform cannot keep on the business's behalf.
                      */}
                        {s.priceFrom !== null && (
                          <p className="shrink-0 text-sm text-muted-foreground">
                            from{" "}
                            <span className="font-mono tabular-nums text-foreground">
                              {formatCurrency(s.priceFrom)}
                            </span>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {business.customServices.length > 0 && (
                <section aria-labelledby="also">
                  <h2 id="also" className="text-base font-semibold text-foreground">
                    They also do
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {business.customServices.map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/*
          Reviews last in the reading column, below everything a driver needs to
          act. Someone at the roadside is deciding whether to call, not reading;
          the social proof matters to the smaller number of people still weighing
          it up, and they are the ones who scroll.
        */}
          <ReviewSection
            businessId={business.id}
            businessName={business.name}
            averageRating={business.averageRating}
            reviewCount={business.reviewCount}
          />
        </div>

        {/* ── The action rail ──────────────────────────────────────────── */}
        <aside className="mt-6 lg:mt-0">
          <div className="space-y-4 lg:sticky lg:top-20">
            {/* Desktop only: below lg these same three actions are pinned to
              the bottom edge, and rendering both would be two of each. */}
            <div className="ra-tile hidden space-y-2 lg:block">
              <ProfileActions business={business} stacked />
            </div>

            <section aria-labelledby="hours" className="ra-tile">
              <h2 id="hours" className="mb-2 text-base font-semibold text-foreground">
                Opening hours
              </h2>
              {business.workingHours.length > 0 ? (
                <OpeningHours hours={business.workingHours} timezone={business.timezone} />
              ) : (
                // Unknown is not the same as closed, and saying "Closed" here
                // would send drivers away from a business that is open.
                <p className="text-sm text-muted-foreground">Not listed yet.</p>
              )}
            </section>

            {/*
              WhatsApp, offered per labelled number — FR-PRO-04.

              The driver picks; the *automatic* booking request goes to the
              business's primary number instead (DECISIONS.md D-006). Those are
              two different actions, and choosing "Emergency" over "Customer
              Support" is the entire reason a business has two numbers.
            */}
            {business.whatsappNumbers.length > 0 && (
              <section aria-labelledby="whatsapp" className="ra-tile">
                <h2 id="whatsapp" className="mb-3 text-base font-semibold text-foreground">
                  Message them
                </h2>
                <ul className="space-y-2">
                  {business.whatsappNumbers.map((number) => (
                    <li key={number.id}>
                      <a
                        href={number.waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ra-tap flex items-center justify-between gap-3 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{number.label}</span>
                          <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                            {number.phoneFormatted}
                          </span>
                        </span>
                        <MessageCircle
                          className="h-5 w-5 shrink-0 text-success"
                          aria-hidden="true"
                        />
                        <span className="sr-only">on WhatsApp, opens in a new tab</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="contact" className="ra-tile">
              <h2 id="contact" className="mb-3 text-base font-semibold text-foreground">
                Find them
              </h2>
              <address className="space-y-3 not-italic text-sm">
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{address}</span>
                </p>
                {business.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <a
                      href={`tel:${business.phone}`}
                      className="font-mono tabular-nums text-primary-text hover:underline"
                    >
                      {business.phoneFormatted}
                    </a>
                  </p>
                )}
                {business.website && (
                  <p className="flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="truncate text-primary-text hover:underline"
                    >
                      {business.website.replace(/^https?:\/\//, "")}
                    </a>
                  </p>
                )}
              </address>
            </section>
          </div>
        </aside>
      </div>

      {/*
        Below lg, the actions are pinned to the bottom edge instead of the rail
        — the only part of a phone screen a thumb reaches without regripping.
        Someone on this page is nearly always about to do one of these three
        things, and making them scroll back past the opening hours to find
        Directions is the difference between a useful page and a brochure.
      */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background p-3 lg:hidden">
        <div className="ra-safe-bottom flex gap-2">
          <ProfileActions business={business} />
        </div>
      </div>
    </div>
  );
}

/**
 * The three things a driver does from this page. `stacked` is the rail —
 * full-width buttons in a column, where the primary action can be genuinely
 * prominent. Unstacked is the pinned bottom bar on a phone, sharing one row.
 */
function ProfileActions({
  business,
  stacked = false,
}: {
  business: { name: string; slug: string; phone: string | null; directionsUrl: string | null };
  stacked?: boolean;
}) {
  const shape = stacked ? "w-full" : "flex-1";
  return (
    <>
      {/*
        The primary action, and the product's whole purpose. "Request a
        Booking", never "Book" — a driver who turns up expecting a held slot is
        a failure of copywriting (FR-BKG-10).
      */}
      <Link to={`/business/${business.slug}/request`} className={cn("ra-btn-primary", shape)}>
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Request a Booking
      </Link>
      {stacked && (
        // Said once, plainly, next to the button that means it. The
        // confirmation screen says it again after submitting.
        <p className="pb-1 pt-0.5 text-center text-xs text-muted-foreground">
          Sends a request — it doesn't hold a slot until they reply.
        </p>
      )}
      {business.phone && (
        <a href={`tel:${business.phone}`} className={cn("ra-btn", shape)}>
          <Phone className="h-4 w-4" aria-hidden="true" />
          Call
        </a>
      )}
      {business.directionsUrl && (
        <a
          href={business.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("ra-btn", shape)}
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Directions
          <span className="sr-only">to {business.name}, opens Google Maps</span>
        </a>
      )}
    </>
  );
}
