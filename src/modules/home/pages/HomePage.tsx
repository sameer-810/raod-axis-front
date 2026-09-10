import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Search,
  LocateFixed,
  MessageCircle,
  Navigation,
  Store,
  ArrowRight,
  ShieldCheck,
  Clock,
  MapPin,
} from "lucide-react";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { geocodeUk } from "@/shared/lib/geocode";
import { useSeo } from "@/shared/hooks/useSeo";
import { CategoryIcon } from "@/shared/components/CategoryIcon";
import { useCategories, useFacets } from "@/modules/business/hooks/useBusinesses";

/**
 * The workshop photograph behind the hero. Unsplash — licensed for commercial use
 * with no attribution required — hot-linked from their CDN.
 *
 * It is a picture of *a* mechanic, never of a listed business. That distinction is
 * the whole reason there is no stock photography on the business cards: a generic
 * workshop shown on "Deansgate Tyre & Exhaust" reads as a photo of their premises,
 * which would be a small lie told about a real company.
 */
const HERO =
  "https://images.unsplash.com/photo-1615906655593-ad0386982a0f?ixlib=rb-4.1.0&q=72&fm=jpg&crop=entropy&cs=srgb";

/**
 * The home page, which is still the search page.
 *
 * The hero **contains** the search rather than sitting above it. The rule that
 * matters — nothing stands between a driver with a flat tyre and the list of tyre
 * shops — is about the search staying in the first screenful, not about the page
 * being plain. Search first, then the services people actually came for, then the
 * pitch to garage owners.
 */
export function HomePage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const { data: categories = [] } = useCategories();
  const { data: facets } = useFacets();
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useSeo({
    title: "Find trusted automotive services near you",
    description:
      "RoadAxis lists garages, tyre centres, mobile fitters and recovery services across the UK. See who is open now, how far away they are, and request a booking on WhatsApp.",
  });

  const countFor = (slug: string) => facets?.find((f) => f.slug === slug)?.count;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());

    if (place.trim()) {
      const hit = await geocodeUk(place);
      if (!hit) {
        // Losing the radius is a smaller failure than losing the search, so the
        // journey continues without it rather than stopping here.
        setError("We couldn't find that place — showing results by name instead.");
      } else {
        params.set("lat", String(hit.latitude));
        params.set("lng", String(hit.longitude));
      }
    } else if (geo.status === "granted" && geo.latitude && geo.longitude) {
      params.set("lat", String(geo.latitude));
      params.set("lng", String(geo.longitude));
    }

    setBusy(false);
    navigate(`/search?${params.toString()}`);
  }

  function nearMe() {
    if (geo.status === "granted" && geo.latitude && geo.longitude) {
      navigate(`/search?lat=${geo.latitude}&lng=${geo.longitude}`);
      return;
    }
    // Asked for on a tap, never on page load. A permission prompt before someone
    // knows what the site is buys a permanent denial.
    geo.request();
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="ra-hero">
        {/*
          The photograph is decoration, so it is `aria-hidden` and carries no
          alt text — describing it to a screen reader would announce a stock
          photo before the search box. The ink underneath is what actually
          guarantees the text contrast: if the image never loads, the hero is a
          clean dark panel rather than white-on-white.
        */}
        <img
          src={`${HERO}&w=1600`}
          srcSet={`${HERO}&w=800 800w, ${HERO}&w=1600 1600w, ${HERO}&w=2200 2200w`}
          sizes="100vw"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="ra-hero-image"
        />

        <div className="ra-shell relative py-12 md:py-20">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Independent garages across the UK
            </p>
            <h1 className="text-[34px] font-bold leading-[1.02] text-white md:text-[3.6rem]">
              Find a garage
              <br />
              you can trust.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/80 md:text-lg">
              Tyres, brakes, servicing, recovery — with opening hours, directions and a way to reach
              them in one tap.
            </p>
          </div>

          {/* The search card. Lifted off the photograph, because this is the one
              thing on the page that has to be found instantly. */}
          <form onSubmit={submit} className="ra-hero-card mt-7 md:mt-9">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="search"
                  placeholder="Tyres, brakes, a garage name…"
                  aria-label="What do you need?"
                  className="ra-input h-12 w-full border-transparent bg-transparent ps-10 pe-3 md:bg-transparent"
                />
              </div>

              <div className="hidden h-7 w-px shrink-0 bg-border md:block" aria-hidden="true" />

              <div className="relative min-w-0 md:w-56">
                <MapPin
                  className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="Town or postcode"
                  aria-label="Where?"
                  className="ra-input h-12 w-full border-transparent bg-transparent ps-10 pe-3"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="ra-btn-primary h-12 shrink-0 md:px-7"
              >
                {busy ? "Searching…" : "Search"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          {error && (
            <p role="alert" className="mt-3 text-sm text-white/90">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={nearMe}
              className="ra-tap inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-80"
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
              {geo.status === "prompting" ? "Finding you…" : "Use my current location"}
            </button>
            {geo.status === "denied" && (
              <p className="text-sm text-white/70">No problem — type a town or postcode above.</p>
            )}
          </div>

          {/* Three claims, each of which the product actually keeps. */}
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Verified businesses
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
              See who is open now
            </li>
            <li className="inline-flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              Request a booking on WhatsApp
            </li>
          </ul>
        </div>
      </section>

      <div className="ra-shell py-10 md:py-14">
        <div className="ra-public">
          {/* ── Services ───────────────────────────────────────────────── */}
          {categories.length > 0 && (
            <section aria-labelledby="browse">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="ra-eyebrow text-primary-text">Services</p>
                  <h2
                    id="browse"
                    className="mt-2 text-2xl font-bold tracking-tight text-foreground"
                  >
                    What do you need doing?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tap a service to see who does it near you.
                  </p>
                </div>
                <Link
                  to="/categories"
                  className="ra-tap inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline"
                >
                  All services
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              {/*
                A grid of tiles, not the old scrolling chip strip. Eleven names
                in a row of pills is a horizontal list nobody scrolls past the
                third item of; a grid shows every service at once, and an icon
                makes each one findable without reading.
              */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {categories.map((c) => {
                  const count = countFor(c.slug);
                  return (
                    <Link
                      key={c.slug}
                      to={`/search?category=${c.slug}`}
                      className="ra-service-tile"
                    >
                      <span className="ra-service-icon">
                        <CategoryIcon name={c.icon} className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {c.name}
                        </span>
                        {count !== undefined && (
                          <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                            {count} {count === 1 ? "place" : "places"}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── How it works ───────────────────────────────────────────── */}
          {/*
            An editorial list, not three cards in a row.

            "Three identical cards, each with an icon in a tinted circle" is the
            single most recognisable fingerprint of a generated page, and the
            previous version of this section was exactly that. A numbered list
            with hairline rules, a big mono numeral and the copy given room reads
            as something written; the same three facts, arranged by a person.
          */}
          <section
            aria-labelledby="how"
            className="lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10"
          >
            <div className="mb-5 lg:mb-0">
              <p className="ra-eyebrow text-primary-text">How it works</p>
              <h2
                id="how"
                className="mt-2 text-2xl font-bold tracking-tight text-foreground lg:text-3xl"
              >
                Three taps from a problem to a garage that answers.
              </h2>
            </div>
            <ol className="divide-y divide-border border-t border-border">
              {[
                {
                  icon: Search,
                  title: "Discover",
                  body: "Search by service and distance. See who is open right now, and how far away they are.",
                },
                {
                  icon: MessageCircle,
                  title: "Contact",
                  body: "Message them on WhatsApp, or send a booking request with the date and time you want.",
                },
                {
                  icon: Navigation,
                  title: "Go",
                  body: "They reply to confirm. Open directions straight in Google Maps and drive over.",
                },
              ].map((s, i) => (
                <li
                  key={s.title}
                  className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[4rem_minmax(0,1fr)]"
                >
                  <span
                    className="font-mono text-2xl font-medium tabular-nums text-primary-text sm:text-3xl"
                    aria-hidden="true"
                  >
                    0{i + 1}
                  </span>
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {s.title}
                    </p>
                    <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/*
            The supply side of the marketplace, and the reason the Claim flow
            exists at all. It does not hide in a footer: without businesses there
            is nothing for a driver to find.
          */}
          <section className="ra-cta">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-text">
                  <Store className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-semibold text-foreground">Run a garage?</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    You may already be listed. Claim your listing to manage your details, hours and
                    photos — free while we are building the network.
                  </p>
                </div>
              </div>
              <Link to="/for-business" className="ra-btn-primary shrink-0">
                List your business
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
