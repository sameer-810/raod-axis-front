import { lazy, Suspense, useEffect, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  List,
  Map as MapIcon,
  LocateFixed,
  SearchX,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { geocodeUk } from "@/shared/lib/geocode";
import { formatDistance } from "@/shared/lib/format";
import { useSeo } from "@/shared/hooks/useSeo";
import { Sheet } from "@/shared/components/Sheet";
import { EmptyState } from "@/shared/components/EmptyState";
import { BusinessCard } from "../components/BusinessCard";
import { SearchFiltersPanel } from "../components/SearchFilters";
import {
  useBusinessSearch,
  useCategories,
  useFacets,
  useSearchFilters,
} from "../hooks/useBusinesses";
import type { SortOption } from "../types";

/** ~150 kB of map library, kept off the critical path of the default view. */
const BusinessMap = lazy(() =>
  import("../components/BusinessMap").then((m) => ({ default: m.BusinessMap })),
);

/**
 * Search.
 *
 * The highest-leverage screen in any marketplace, and the one a driver with a
 * flat tyre lands on.
 *
 * **The desktop layout is a rail beside results, not a stack above them.** This
 * screen previously rendered the phone layout at every width: the search box,
 * then four rows of filters, then the view toggle — roughly 600px of chrome, so
 * a laptop showed *zero results* until you scrolled. Filters are used
 * repeatedly on a large screen, results are what you came for, and both belong
 * on screen at once. Everything else here is unchanged and still true:
 *
 *  - **The list is the default, not the map.** A map answers "where"; a list
 *    answers "which". Someone who already knows roughly where they are is
 *    choosing, and a map makes them work for a comparison a list gives away.
 *  - **Location is offered, never demanded.** Refusing it is one of two normal
 *    paths, not an error, and the town/postcode box is right there.
 *  - **Every filter is in the URL**, so this search can be sent to somebody.
 */
export function SearchPage() {
  const geo = useGeolocation();
  const { filters, update, activeCount, clearAll } = useSearchFilters();
  const { data: categories = [] } = useCategories();
  const { data: facets } = useFacets();

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

  useSeo({
    title: filters.search ? `${filters.search} — search` : "Find a garage near you",
    description:
      "Search garages, tyre centres, mobile fitters and recovery services across the UK. See who is open now, how far away they are, and request a booking.",
  });

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

  const filterPanel = (layout: "rail" | "sheet") => (
    <SearchFiltersPanel
      filters={filters}
      categories={categories}
      facets={facets}
      onChange={update}
      onClear={clearAll}
      activeCount={activeCount}
      hasLocation={hasLocation}
      layout={layout}
    />
  );

  return (
    <div className="min-h-full bg-background">
      {/* ── The toolbar ───────────────────────────────────────────────────
          Sticky under the site header. On a long results page the search box
          is the control people reach for after reading three cards, and
          scrolling back to the top to find it is the friction this removes. */}
      <div className="ra-toolbar">
        <div className="ra-shell flex flex-col gap-2 py-3 sm:flex-row sm:items-center md:py-3.5">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Tyres, brakes, a garage name…"
              aria-label="Search for a service or business"
              className="ra-input h-11 w-full ps-10 pe-3"
            />
          </div>

          {/* Location and Filters share a row on a phone. Stacked, the toolbar
              was three rows tall and pushed the first result off a 390px
              screen — which is the exact failure this whole layout exists to
              fix, reproduced at the other end of the range. */}
          <div className="flex gap-2 sm:contents">
            {!hasLocation ? (
              <form
                onSubmit={submitPlace}
                className="flex min-w-0 flex-1 gap-2 sm:w-auto sm:flex-none"
              >
                <input
                  value={placeInput}
                  onChange={(e) => setPlaceInput(e.target.value)}
                  placeholder="Town or postcode"
                  aria-label="Town or postcode"
                  className="ra-input h-11 min-w-0 flex-1 px-3 sm:w-44"
                />
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating || geo.status === "prompting"}
                  className="ra-tap flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
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
                className="ra-tap flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm transition-colors hover:bg-accent sm:w-auto sm:flex-none"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary-text" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-start text-muted-foreground">
                  Within{" "}
                  <span className="font-mono tabular-nums">{formatDistance(filters.radius)}</span>
                  {placeLabel ? ` of ${placeLabel}` : ""}
                </span>
                <span className="shrink-0 text-xs font-medium text-primary-text">Change</span>
              </button>
            )}

            {/* Filters live behind a button on a phone and in the rail above lg. */}
            <button
              type="button"
              onClick={() => setFilterSheet(true)}
              className={cn(
                "ra-tap flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors lg:hidden",
                activeCount > 0
                  ? "border-primary bg-primary/10 text-primary-text"
                  : "border-border bg-card text-foreground hover:bg-accent",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {/* A silently filtered list reads as a list with records missing,
                so whatever is behind the sheet reports its count. */}
              {activeCount > 0 && <span className="font-mono tabular-nums">{activeCount}</span>}
            </button>
          </div>
        </div>

        {(placeError || (geo.status === "denied" && !hasLocation)) && (
          <div className="ra-shell pb-3">
            {placeError ? (
              <p role="alert" className="text-sm text-destructive">
                {placeError}
              </p>
            ) : (
              // Not an error. One of the two normal paths — and saying so keeps
              // the person moving instead of hunting through browser settings.
              <p className="text-sm text-muted-foreground">
                No problem — type a town or postcode instead.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="ra-shell py-5 md:py-7">
        <h1 className="sr-only">Find a garage near you</h1>

        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[268px_minmax(0,1fr)]">
          {/* ── The rail ────────────────────────────────────────────────
              Sticky and independently scrollable, so a long category list
              never pushes the results down or scrolls away from them. */}
          <aside className="hidden lg:block">
            <div className="ra-rail">{filterPanel("rail")}</div>
          </aside>

          <div className="min-w-0">
            {/* ── Results header ─────────────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <ResultCount
                meta={meta}
                isLoading={isLoading}
                hasLocation={hasLocation}
                radius={filters.radius}
              />
              <div className="flex items-center gap-2">
                <SortSelect
                  value={filters.sort}
                  hasLocation={hasLocation}
                  onChange={(sort) => update({ sort })}
                />
                <ViewToggle view={view} onChange={setView} />
              </div>
            </div>

            {/* ── Results ──────────────────────────────────────────────── */}
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
                An empty result is a design problem, not an absence of one — on
                the highest-leverage screen in the product it is where a session
                ends. So it says WHY it is empty and offers the next move.
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
                        className="ra-btn-primary"
                      >
                        Search within {formatDistance(10000)}
                      </button>
                    )}
                    {activeCount > 0 && (
                      <button type="button" onClick={clearAll} className="ra-btn">
                        Clear filters
                      </button>
                    )}
                  </>
                }
              />
            ) : view === "map" ? (
              /*
                Split view above lg: the cards stay readable on the left while
                the map answers "where" on the right. A map that replaces the
                list makes you choose between the two questions people are
                actually asking at the same time.
              */
              <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-4">
                <div className="hidden max-h-[calc(100vh-13rem)] space-y-3 overflow-y-auto pe-1 lg:block">
                  {results.map((b) => (
                    <BusinessCard key={b.id} business={b} />
                  ))}
                </div>
                <div className="ra-map-frame h-[62vh] lg:sticky lg:top-[8.5rem] lg:h-[calc(100vh-13rem)]">
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
                        hasLocation
                          ? { latitude: filters.lat!, longitude: filters.lng! }
                          : undefined
                      }
                    />
                  </Suspense>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-3 xl:grid-cols-2",
                  isFetching && "opacity-60 transition-opacity",
                )}
              >
                {results.map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
              </div>
            )}

            {/* Paging. Numbered pages are a desktop affordance; on a phone
                nobody navigates deliberately to page 7 of 55. */}
            {meta && meta.totalPages > 1 && view === "list" && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
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
      </div>

      {/* The sheet exists at every width below lg, which includes tablets —
          where the rail does not fit but the phone bottom-bar does not exist
          either. */}
      <Sheet
        open={filterSheet}
        onOpenChange={setFilterSheet}
        title="Filters"
        footer={
          <button
            type="button"
            onClick={() => setFilterSheet(false)}
            className="ra-btn-primary w-full"
          >
            Show <span className="font-mono tabular-nums">{meta?.total ?? 0}</span> results
          </button>
        }
      >
        {filterPanel("sheet")}
      </Sheet>
    </div>
  );
}

/**
 * Sort, as a native select.
 *
 * A native control rather than a custom dropdown: it is one tag, it is
 * keyboard-operable and screen-reader-labelled for free, and on a phone it
 * opens the platform's own picker — which is both faster and more familiar than
 * anything a custom menu achieves here.
 */
function SortSelect({
  value,
  hasLocation,
  onChange,
}: {
  value?: SortOption;
  hasLocation: boolean;
  onChange: (sort?: SortOption) => void;
}) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor="sort">
        Sort results
      </label>
      <select
        id="sort"
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || undefined) as SortOption | undefined)}
        className="ra-tap appearance-none rounded-xl border border-border bg-card ps-3 pe-9 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {/* Nearest is only meaningful, and only offered, when we know where the
            person is. */}
        <option value="">{hasLocation ? "Nearest first" : "Most relevant"}</option>
        <option value="rating">Best rated</option>
        <option value="newest">Newest</option>
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
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
    <div
      className="flex shrink-0 rounded-xl border border-border bg-card p-1"
      role="group"
      aria-label="View"
    >
      {[
        { value: "list" as const, icon: List, label: "List" },
        { value: "map" as const, icon: MapIcon, label: "Map" },
      ].map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => onChange(v.value)}
          aria-pressed={view === v.value}
          className={cn(
            "flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
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
    <p className="text-[15px] text-muted-foreground" aria-live="polite">
      <span className="font-mono text-base font-semibold tabular-nums text-foreground">
        {meta.total}
      </span>{" "}
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
    <div className="grid gap-3 xl:grid-cols-2" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="ra-card flex gap-3.5 p-3.5">
          <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2.5 py-1">
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
