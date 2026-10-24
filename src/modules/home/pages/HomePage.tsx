import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Search,
  LocateFixed,
  ShieldCheck,
  Clock,
  Map as MapIcon,
  MapPin,
  ArrowRight,
  ChevronRight,
  Store,
  LayoutGrid,
} from "lucide-react";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { geocodePlace, isInside } from "@/shared/lib/geocode";
import { useMarket } from "@/app/market";
import { useSeo } from "@/shared/hooks/useSeo";
import { ServiceTile } from "@/shared/components/ServiceTile";
import { BusinessCard } from "@/modules/business/components/BusinessCard";
import {
  useBusinessSearch,
  useCategories,
  useFacets,
} from "@/modules/business/hooks/useBusinesses";

/**
 * The home page, laid out as the client's reference lays it out: search, the
 * services as photographs, one banner, the quick filters, and the garages
 * themselves — so the first screen is already the directory, not a pitch.
 *
 * Two things are kept from before because they are what make it work rather
 * than what make it look right: the search has a "where" as well as a "what"
 * (a UK postcode is how a British driver says where they are), and location is
 * asked for on a tap, never on arrival.
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
  const { market } = useMarket();
  const placeLabel =
    market.address.postcode === "required" ? "Town or postcode" : market.address.cityLabel;
  /** The device's own position, but only when it is in the country being browsed. */
  const here =
    geo.status === "granted" &&
    geo.latitude &&
    geo.longitude &&
    isInside(market, geo.latitude, geo.longitude)
      ? { latitude: geo.latitude, longitude: geo.longitude }
      : null;

  // Nearest first when we know where the driver is; the best-rated otherwise,
  // and the heading says which — "near you" is a claim only a position earns.
  const { data: garages } = useBusinessSearch(
    here ? { lat: here.latitude, lng: here.longitude, page: 1 } : { sort: "rating", page: 1 },
  );
  const list = garages?.items.slice(0, 6) ?? [];

  useSeo({
    title: "Find trusted automotive services near you",
    description: `RoadAxis lists garages, tyre centres, mobile fitters and recovery services across ${market.shortName}. See who is open now, how far away they are, and request a booking on WhatsApp.`,
  });

  const countFor = (slug: string) => facets?.find((f) => f.slug === slug)?.count;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());

    if (place.trim()) {
      const hit = await geocodePlace(place, market);
      if (!hit) {
        setError("We couldn't find that place — showing results by name instead.");
      } else {
        params.set("lat", String(hit.latitude));
        params.set("lng", String(hit.longitude));
      }
    } else if (here) {
      params.set("lat", String(here.latitude));
      params.set("lng", String(here.longitude));
    }

    setBusy(false);
    navigate(`/search?${params.toString()}`);
  }

  function nearMe() {
    if (here) {
      navigate(`/search?lat=${here.latitude}&lng=${here.longitude}`);
      return;
    }
    if (geo.status === "granted") {
      setError(
        `Your device doesn't seem to be in ${market.shortName}. Type a ${placeLabel.toLowerCase()} instead.`,
      );
      return;
    }
    // Asked for on a tap, never on page load.
    geo.request();
  }

  const searchLink = here ? `/search?lat=${here.latitude}&lng=${here.longitude}` : "/search";

  return (
    <div className="ra-shell pb-10 pt-5 md:pb-14 md:pt-8">
      {/* ── Heading and search ─────────────────────────────────────────── */}
      <section aria-labelledby="home-title">
        <h1
          id="home-title"
          className="text-[28px] font-extrabold leading-[1.05] text-foreground md:text-[44px]"
        >
          Find a garage you can trust.
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground md:text-lg">
          Independent garages across {market.shortName}
        </p>

        <form
          onSubmit={submit}
          className="mt-4 overflow-hidden rounded-2xl border border-border bg-card md:mt-6 md:flex md:items-center md:p-1.5"
        >
          <div className="relative min-w-0 md:flex-1">
            <Search
              className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search service or garage"
              aria-label="What do you need?"
              className="h-14 w-full bg-transparent pe-3 ps-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="h-px bg-border md:mx-1 md:h-8 md:w-px" aria-hidden="true" />
          <div className="flex items-center gap-2 pe-2 md:w-[22rem] md:pe-0">
            <div className="relative min-w-0 flex-1">
              <MapPin
                className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-text"
                aria-hidden="true"
              />
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder={placeLabel}
                aria-label="Where?"
                list={market.places.length ? "home-places" : undefined}
                className="h-14 w-full bg-transparent pe-2 ps-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {market.places.length > 0 && (
                <datalist id="home-places">
                  {market.places.map((p) => (
                    <option key={`${p.region}-${p.name}`} value={p.name} />
                  ))}
                </datalist>
              )}
            </div>
            <button type="submit" disabled={busy} className="ra-btn-primary h-11 shrink-0 px-5">
              {busy ? "Searching…" : "Search"}
            </button>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* The quick filters, each a real search a tap away. */}
        <div className="ra-chips mt-4 md:mx-0 md:flex-wrap md:px-0">
          <button type="button" onClick={nearMe} className="ra-chip ra-chip-primary">
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {geo.status === "prompting" ? "Finding you…" : "Near me"}
          </button>
          <Link to="/search?verified=true" className="ra-chip">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verified
          </Link>
          <Link to="/search?openNow=true" className="ra-chip">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Open now
          </Link>
          <Link
            to={`${searchLink}${searchLink.includes("?") ? "&" : "?"}view=map`}
            className="ra-chip"
          >
            <MapIcon className="h-4 w-4" aria-hidden="true" />
            Map
          </Link>
        </div>
        {geo.status === "denied" && (
          <p className="mt-2 text-sm text-muted-foreground">
            No problem — type a {placeLabel.toLowerCase()} above.
          </p>
        )}
      </section>

      {/* ── Services ───────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section aria-labelledby="browse" className="mt-8 md:mt-10">
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 id="browse" className="text-[22px] font-bold text-foreground md:text-[26px]">
              What do you need doing?
            </h2>
            <Link
              to="/categories"
              className="ra-tap inline-flex items-center gap-0.5 text-[15px] font-semibold text-primary-text hover:underline"
            >
              All services
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {categories.map((c) => (
              <ServiceTile
                key={c.slug}
                slug={c.slug}
                name={c.name}
                icon={c.icon}
                count={countFor(c.slug)}
                to={`/search?category=${c.slug}`}
              />
            ))}
            <Link
              to="/categories"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-secondary p-3 text-[14px] font-semibold text-foreground transition-colors hover:border-foreground/25"
            >
              <LayoutGrid className="h-7 w-7 text-primary-text" aria-hidden="true" />
              View all
            </Link>
          </div>
        </section>
      )}

      {/* ── Banner ─────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="promo"
        className="relative isolate mt-8 overflow-hidden rounded-2xl bg-[#0B0B0D] md:mt-10"
      >
        <img
          src="/images/promo-car.webp"
          srcSet="/images/promo-car.webp 900w, /images/promo-car-wide.webp 1600w"
          sizes="(min-width: 768px) 80rem, 100vw"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-right opacity-90"
        />
        {/* The ink behind the words is what guarantees their contrast; the
            photograph is an enhancement on the other side of it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0B0B0D] via-[#0B0B0D]/85 to-transparent"
        />
        {/* Two racing stripes, the red of the X, between the words and the car. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 end-[-3rem] -z-10 flex -skew-x-[18deg] gap-2 md:end-[30%]"
        >
          <span className="w-4 bg-primary md:w-6" />
          <span className="w-1.5 bg-primary/70 md:w-2" />
        </div>
        <div className="max-w-md p-5 md:p-9">
          <h2
            id="promo"
            className="text-[26px] font-extrabold leading-[1.05] text-white md:text-[36px]"
          >
            The right garage, <span className="text-[#FF5A52]">without the phone calls</span>
          </h2>
          <p className="mt-2 text-[15px] text-white/80 md:text-base">
            See who is open, what they charge from, and message them on WhatsApp.
          </p>
          <Link to={searchLink} className="ra-btn-primary mt-4 h-11 rounded-full px-5">
            Explore services
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── Garages ────────────────────────────────────────────────────── */}
      {list.length > 0 && (
        <section aria-labelledby="garages" className="mt-8 md:mt-10">
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 id="garages" className="text-[22px] font-bold text-foreground md:text-[26px]">
              {here ? "Garages near you" : `Top-rated in ${market.shortName}`}
            </h2>
            <Link
              to={searchLink}
              className="ra-tap inline-flex items-center gap-0.5 text-[15px] font-semibold text-primary-text hover:underline"
            >
              View all
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        </section>
      )}

      {/* ── For owners ─────────────────────────────────────────────────── */}
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-secondary p-5 md:mt-10 md:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-foreground">Run a garage?</h2>
            <p className="mt-0.5 max-w-md text-[15px] text-muted-foreground">
              You may already be listed. Claim your listing to manage your details, hours and photos
              — free while we are building the network.
            </p>
          </div>
        </div>
        <Link to="/for-business" className="ra-btn ra-btn-outline shrink-0">
          List your business
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
