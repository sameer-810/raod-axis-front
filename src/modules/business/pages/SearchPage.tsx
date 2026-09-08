import { lazy, Suspense, useEffect, useState } from "react";
import { Search, SlidersHorizontal, MapPin, List, Map as MapIcon, LocateFixed, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { geocodeUk } from "@/shared/lib/geocode";
import { formatDistance } from "@/shared/lib/format";
import { Sheet } from "@/shared/components/Sheet";
import { EmptyState } from "@/shared/components/EmptyState";
import { BusinessCard } from "../components/BusinessCard";
import { SearchFiltersPanel } from "../components/SearchFilters";
import { useBusinessSearch, useCategories, useSearchFilters } from "../hooks/useBusinesses";

/** ~150 kB of map library, kept off the critical path of the default view. */
const BusinessMap = lazy(() =>
  import("../components/BusinessMap").then((m) => ({ default: m.BusinessMap })),
);

/**
 * Search.
 *
 * The highest-leverage screen in any marketplace, and the one a driver with a
 * flat tyre lands on. Three things it does deliberately:
 *
 *  - **The list is the default, not the map.** A map answers "where"; a list
 *    answers "which". Someone who already knows roughly where they are is
 *    choosing, and a map makes them work for a comparison a list gives away.
 *  - **Location is offered, never demanded.** Refusing it is one of two normal
 *    paths, not an error, and the town/postcode box is right there.
 *  - **Every filter is in the URL**, so this search can be sent to somebody.
 */
export function SearchPage() {
  const isMobile = useIsMobile();
  const geo = useGeolocation();
  const { filters, update, activeCount, clearAll } = useSearchFilters();
  const { data: categories = [] } = useCategories();

  const [view, setView] = useState<"list" | "map">("list");
  const [filterSheet, setFilterSheet] = useState(false);
  const [placeInput, setPlaceInput] = useState("");
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const hasLocation = typeof filters.lat === "number" && typeof filters.lng === "number";
  const { data, isLoading, isFetching, error } = useBusinessSearch(filters);
  const results = data?.items ?? [];
  const meta = data?.meta;

  // A remembered or freshly granted position flows into the URL, so the
  // resulting search is still a link someone can share.
  useEffect(() => {
    if (geo.status === "granted" && geo.latitude && geo.longitude && !hasLocation) {
      update({ lat: geo.latitude, lng: geo.longitude }, { replace: true });
      setPlaceLabel("your location");
    }
  }, [geo.status, geo.latitude, geo.longitude, hasLocation, update]);

  async function useMyLocation() {
    setPlaceError(null);
    setLocating(true);
    geo.request();
    setLocating(false);
  }

  async function submitPlace(e: React.FormEvent) {
    e.preventDefault();
    if (!placeInput.trim()) return;
    setPlaceError(null);
    const hit = await geocodeUk(placeInput);
    if (!hit) {
      // Losing the radius filter is a far smaller failure than losing the site.
      setPlaceError("We couldn't find that place. Try a postcode, or search by name below.");
      return;
    }
    setPlaceLabel(hit.label);
    update({ lat: hit.latitude, lng: hit.longitude });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 md:py-8">
      <div className="ra-public">
        {/* ── Where ────────────────────────────────────────────────────── */}
        <section aria-label="Search">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Find a garage near you
          </h1>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => update({ search: e.target.value })}
                placeholder="Tyres, brakes, a garage name…"
                aria-label="Search for a service or business"
                className="h-12 w-full rounded-lg border border-input bg-card ps-9 pe-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {!hasLocation ? (
              <form onSubmit={submitPlace} className="flex gap-2 sm:w-auto">
                <input
                  value={placeInput}
                  onChange={(e) => setPlaceInput(e.target.value)}
                  placeholder="Town or postcode"
                  aria-label="Town or postcode"
                  className="h-12 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring sm:w-44"
                />
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating || geo.status === "prompting"}
                  className="ra-tap flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <LocateFixed className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Use my location</span>
                  <span className="sr-only sm:hidden">Use my location</span>
                </button>
              </form>
            ) : (
              /*
                The whole pill is the control, not a small "Change" link inside
                it. A 17px text link beside a label is under half the touch
                floor, and every maps application already teaches that tapping
                the location chip is how you change the location — so the
                affordance costs nothing to learn and gains a target a thumb can
                actually hit.
              */
              <button
                type="button"
                onClick={() => {
                  update({ lat: undefined, lng: undefined });
                  setPlaceLabel(null);
                  geo.clear();
                }}
                className="ra-tap flex items-center gap-2 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-accent sm:w-auto"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary-text" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-start text-muted-foreground">
                  Within <span className="font-mono tabular-nums">{formatDistance(filters.radius)}</span>
                  {placeLabel ? ` of ${placeLabel}` : ""}
                </span>
                <span className="shrink-0 text-xs font-medium text-primary-text">Change</span>
              </button>
            )}
          </div>

          {placeError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {placeError}
            </p>
          )}
          {geo.status === "denied" && !hasLocation && (
            // Not an error. One of the two normal paths — and saying so keeps
            // the person moving instead of hunting through browser settings.
            <p className="mt-2 text-sm text-muted-foreground">
              No problem — type a town or postcode instead.
            </p>
          )}
        </section>

        {/* ── Narrow ───────────────────────────────────────────────────── */}
        {isMobile ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterSheet(true)}
              className={cn(
                "ra-tap flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                activeCount > 0
                  ? "border-primary bg-primary/10 text-primary-text"
                  : "border-border text-muted-foreground",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {/* A silently filtered list reads as a list with records missing,
                  so whatever is behind the sheet reports its count. */}
              {activeCount > 0 && <span className="font-mono tabular-nums">{activeCount}</span>}
            </button>
            <ViewToggle view={view} onChange={setView} />
          </div>
        ) : (
          <>
            <SearchFiltersPanel
              filters={filters}
              categories={categories}
              onChange={update}
              onClear={clearAll}
              activeCount={activeCount}
              hasLocation={hasLocation}
              layout="inline"
            />
            <div className="flex items-center justify-between gap-3">
              <ResultCount meta={meta} isLoading={isLoading} hasLocation={hasLocation} radius={filters.radius} />
              <ViewToggle view={view} onChange={setView} />
            </div>
          </>
        )}

        {isMobile && (
          <>
            <ResultCount meta={meta} isLoading={isLoading} hasLocation={hasLocation} radius={filters.radius} />
            <Sheet
              open={filterSheet}
              onOpenChange={setFilterSheet}
              title="Filters"
              footer={
                <button
                  type="button"
                  onClick={() => setFilterSheet(false)}
                  className="ra-tap w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Show <span className="font-mono tabular-nums">{meta?.total ?? 0}</span> results
                </button>
              }
            >
              <SearchFiltersPanel
                filters={filters}
                categories={categories}
                onChange={update}
                onClear={clearAll}
                activeCount={activeCount}
                hasLocation={hasLocation}
                layout="sheet"
              />
            </Sheet>
          </>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {error ? (
          <EmptyState
            icon={SearchX}
            title="We couldn't load the results"
            description="Check your connection and try again."
          />
        ) : isLoading ? (
          <ResultSkeleton />
        ) : results.length === 0 ? (
          /*
            An empty result is a design problem, not an absence of one — on the
            highest-leverage screen in the product it is where a session ends.
            So it says WHY it is empty and offers the next move.
          */
          <EmptyState
            icon={SearchX}
            title="Nothing here yet"
            description={
              hasLocation
                ? `No businesses within ${formatDistance(filters.radius)}${
                    activeCount ? " matching your filters" : ""
                  }. Try a wider distance${activeCount ? " or clear a filter" : ""}.`
                : "Try a different search term, or add a town or postcode to see what's nearby."
            }
            action={
              <>
                {hasLocation && filters.radius < 10000 && (
                  <button
                    type="button"
                    onClick={() => update({ radius: 10000 })}
                    className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Search within {formatDistance(10000)}
                  </button>
                )}
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    Clear filters
                  </button>
                )}
              </>
            }
          />
        ) : view === "map" ? (
          <div className="h-[60vh] overflow-hidden rounded-lg border border-border md:h-[70vh]">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading map…
                </div>
              }
            >
              <BusinessMap
                businesses={results}
                centre={
                  hasLocation ? { latitude: filters.lat!, longitude: filters.lng! } : undefined
                }
              />
            </Suspense>
          </div>
        ) : (
          <div className={cn("space-y-2.5", isFetching && "opacity-60 transition-opacity")}>
            {results.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        )}

        {/* Paging. Numbered pages are a desktop affordance; on a phone nobody
            navigates deliberately to page 7 of 55. */}
        {meta && meta.totalPages > 1 && view === "list" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <button
              type="button"
              disabled={!meta.hasPrevPage}
              onClick={() => update({ page: filters.page - 1 })}
              className="ra-tap rounded-lg px-3 font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {meta.page} / {meta.totalPages}
            </span>
            <button
              type="button"
              disabled={!meta.hasNextPage}
              onClick={() => update({ page: filters.page + 1 })}
              className="ra-tap rounded-lg px-3 font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "list" | "map";
  onChange: (v: "list" | "map") => void;
}) {
  return (
    <div className="flex shrink-0 rounded-lg border border-border p-0.5" role="group" aria-label="View">
      {(
        [
          { value: "list" as const, icon: List, label: "List" },
          { value: "map" as const, icon: MapIcon, label: "Map" },
        ]
      ).map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => onChange(v.value)}
          aria-pressed={view === v.value}
          className={cn(
            "flex min-h-[40px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            view === v.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <v.icon className="h-4 w-4" aria-hidden="true" />
          {v.label}
        </button>
      ))}
    </div>
  );
}

function ResultCount({
  meta,
  isLoading,
  hasLocation,
  radius,
}: {
  meta?: { total: number };
  isLoading: boolean;
  hasLocation: boolean;
  radius: number;
}) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Searching…</p>;
  if (!meta) return null;
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      <span className="font-mono tabular-nums text-foreground">{meta.total}</span>{" "}
      {meta.total === 1 ? "business" : "businesses"}
      {hasLocation ? ` within ${formatDistance(radius)}` : ""}
    </p>
  );
}

/**
 * A skeleton shaped like the result it replaces, so the page does not jump when
 * the data lands. A centred spinner over an empty page reads as "nothing here".
 */
function ResultSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="ra-card flex gap-3 p-3.5">
          <div className="h-20 w-20 shrink-0 animate-pulse rounded-lg bg-muted sm:h-24 sm:w-24" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
