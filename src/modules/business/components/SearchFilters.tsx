import { Star, Clock, BadgeCheck, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance } from "@/shared/lib/format";
import type { Category, SearchFilters as Filters } from "../types";

/**
 * The radius presets.
 *
 * Taken from the client's own words — "nearby 500m - 2km" — and extended
 * upwards, because 2 km is a city-centre assumption and a driver in a rural
 * county needs 10. Stored in metres always; how they *read* is
 * `formatDistance`'s job and follows the unit setting (DECISIONS.md D-002).
 */
const RADII = [500, 1000, 2000, 5000, 10000];

export interface FacetCount {
  slug: string;
  count: number;
}

/**
 * The filter controls: a persistent rail on a desktop, a sheet on a phone.
 *
 * The two layouts are genuinely different controls, not one control at two
 * widths — which is the mistake this component used to make.
 *
 *  - **`rail`** is a column beside the results, permanently on screen. Filters
 *    get used repeatedly here, so the interaction cost of reaching them has to
 *    be zero, and categories become a *checkbox list* — eleven of them scan
 *    vertically in one glance and each can carry a count.
 *  - **`sheet`** is a phone. There is no room for a permanent rail, so the same
 *    filters live behind one button and categories become a horizontal strip:
 *    eleven wrapped chips at 390px is four rows of navigation standing between
 *    a driver and the first result.
 *
 * Sorting is deliberately absent from both. It is not a filter — it does not
 * change *which* results exist — and on a desktop it belongs in the results
 * header next to the count, which is where every product this competes with
 * puts it.
 */
export function SearchFiltersPanel({
  filters,
  categories,
  facets,
  onChange,
  onClear,
  activeCount,
  hasLocation,
  layout,
}: {
  filters: Filters;
  categories: Category[];
  /** How many live businesses sit in each category, for the counts. */
  facets?: FacetCount[];
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  activeCount: number;
  hasLocation: boolean;
  layout: "rail" | "sheet";
}) {
  const rail = layout === "rail";
  const countFor = (slug: string) => facets?.find((f) => f.slug === slug)?.count;

  const toggleCategory = (slug: string) => {
    const next = filters.categories.includes(slug)
      ? filters.categories.filter((s) => s !== slug)
      : [...filters.categories, slug];
    onChange({ categories: next });
  };

  return (
    <div className={cn(rail ? "space-y-6" : "space-y-6")}>
      {rail && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary-text transition-colors hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear all
            </button>
          )}
        </div>
      )}

      {/*
        Distance only exists once we know where "here" is. Showing a radius
        control with nothing to measure from is a dead control that implies the
        results are filtered when they are not.
      */}
      {hasLocation && (
        <Group label="Distance">
          <div className={cn(rail ? "grid grid-cols-3 gap-1.5" : "ra-chips")}>
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ radius: r })}
                aria-pressed={filters.radius === r}
                className={rail ? railChip(filters.radius === r) : "ra-chip"}
              >
                <span className="font-mono tabular-nums">{formatDistance(r)}</span>
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group label="Service">
        {rail ? (
          /*
            A checkbox list, not chips. Eleven categories scan vertically in one
            glance, each row is a 44px target without any styling effort, and
            there is room for the count — which is the single most useful thing
            a filter can tell you, because it says in advance whether ticking it
            will empty the page.
          */
          <ul className="-mx-1.5 space-y-0.5">
            {categories.map((c) => {
              const checked = filters.categories.includes(c.slug);
              const count = countFor(c.slug);
              return (
                <li key={c.slug}>
                  <label
                    className={cn(
                      "ra-tap flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 text-sm transition-colors",
                      checked ? "text-foreground" : "text-foreground hover:bg-accent",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(c.slug)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                        checked ? "border-primary bg-primary" : "border-input bg-card",
                      )}
                    >
                      {checked && (
                        <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                      )}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", checked && "font-medium")}>
                      {c.name}
                    </span>
                    {count !== undefined && (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="ra-chips">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggleCategory(c.slug)}
                aria-pressed={filters.categories.includes(c.slug)}
                className="ra-chip"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </Group>

      <Group label="Show only">
        <div className={cn(rail ? "grid gap-1.5" : "flex flex-wrap gap-2")}>
          <Toggle
            rail={rail}
            active={filters.openNow}
            onClick={() => onChange({ openNow: !filters.openNow })}
            icon={Clock}
            label="Open now"
          />
          <Toggle
            rail={rail}
            active={filters.verifiedOnly}
            onClick={() => onChange({ verifiedOnly: !filters.verifiedOnly })}
            icon={BadgeCheck}
            label="Verified"
          />
          <Toggle
            rail={rail}
            active={filters.minRating === 4}
            onClick={() => onChange({ minRating: filters.minRating === 4 ? undefined : 4 })}
            icon={Star}
            label="4★ and up"
          />
        </div>
      </Group>

      {/* Sorting is a sheet-only control. On a desktop it lives in the results
          header, where the thing being sorted is visible. */}
      {!rail && (
        <Group label="Sort by">
          <div className="ra-chips">
            {[
              // Nearest is only meaningful, and only offered, when we know where
              // the person is.
              ...(hasLocation ? [{ value: undefined, label: "Nearest" }] : []),
              { value: "rating" as const, label: "Best rated" },
              { value: "newest" as const, label: "Newest" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onChange({ sort: option.value })}
                aria-pressed={filters.sort === option.value}
                className="ra-chip"
              >
                {option.label}
              </button>
            ))}
          </div>
        </Group>
      )}

      {!rail && activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="ra-tap inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

/** A compact pressed/unpressed pill for the rail, where space is tight. */
function railChip(active: boolean) {
  return cn(
    "ra-tap flex items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-accent",
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function Toggle({
  rail,
  active,
  onClick,
  icon: Icon,
  label,
}: {
  rail: boolean;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  if (!rail) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className="ra-chip">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "ra-tap flex w-full items-center gap-2.5 rounded-lg border px-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary-text"
          : "border-border bg-card text-foreground hover:bg-accent",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

export { RADII };
