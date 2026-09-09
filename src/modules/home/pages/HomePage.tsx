import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, LocateFixed, MessageCircle, Navigation, Store } from "lucide-react";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { geocodeUk } from "@/shared/lib/geocode";
import { useCategories } from "@/modules/business/hooks/useBusinesses";

/**
 * The home page, which is the search page.
 *
 * No marketing hero. Nothing stands between a driver with a flat tyre and the
 * list of tyre shops — the research is unambiguous that search is the highest-
 * leverage surface in a marketplace, and a full-screen banner is the most
 * common way that surface gets pushed below the fold.
 *
 * Category chips are visible without scrolling, because tapping "Tyres" is
 * faster than typing it and is what most arrivals actually want.
 */
export function HomePage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const { data: categories = [] } = useCategories();
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-16">
      <div className="ra-public">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Find trusted automotive services near you.
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Garages, tyre centres, mobile fitters and recovery — with opening hours, directions and
            a way to reach them in one tap.
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Tyres, brakes, a garage name…"
                aria-label="What do you need?"
                className="h-12 w-full rounded-lg border border-input bg-card ps-9 pe-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Town or postcode"
              aria-label="Where?"
              className="h-12 rounded-lg border border-input bg-card px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
            />
            <button
              type="submit"
              disabled={busy}
              className="ra-tap flex items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
            >
              {busy ? "Searching…" : "Search"}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-2 text-sm text-warning">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={nearMe}
            className="ra-tap mt-2 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-primary-text transition-colors hover:underline"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {geo.status === "prompting" ? "Finding you…" : "Use my current location"}
          </button>
          {geo.status === "denied" && (
            <p className="mt-1 text-sm text-muted-foreground">
              No problem — type a town or postcode above.
            </p>
          )}
        </section>

        {categories.length > 0 && (
          <section aria-labelledby="browse">
            <h2
              id="browse"
              className="text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground"
            >
              Browse by service
            </h2>
            {/* Above the fold, and a strip rather than a grid — eleven wrapped
                chips at 390px is four rows of navigation before any content. */}
            <div className="ra-chips mt-3">
              {categories.map((c) => (
                <Link key={c.slug} to={`/search?category=${c.slug}`} className="ra-chip">
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="how">
          <h2 id="how" className="sr-only">
            How it works
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Discover",
                body: "Search by service and distance. See who's open now.",
              },
              {
                icon: MessageCircle,
                title: "Contact",
                body: "Message them, or send a booking request.",
              },
              { icon: Navigation, title: "Go", body: "Open directions straight in Google Maps." },
            ].map((s) => (
              <div key={s.title} className="ra-tile">
                <s.icon className="h-5 w-5 text-primary-text" aria-hidden="true" />
                <p className="mt-2.5 text-sm font-semibold text-foreground">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/*
          The supply side of the marketplace, and the reason the Claim flow
          exists at all. It does not hide in a footer: without businesses there
          is nothing for a driver to find.
        */}
        <section className="ra-tile flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Run a garage?</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Claim your listing or add your business — free while we're building the network.
              </p>
            </div>
          </div>
          <Link
            to="/for-business"
            className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            List your business
          </Link>
        </section>
      </div>
    </div>
  );
}
