import { Star, Clock, BadgeCheck, X } from "lucide-react";
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

/**
 * The filter controls, rendered inline on desktop and inside a sheet on a phone.
 *
 * `layout` says which. The distinction matters for one rule in particular: the
 * search field belongs to the page's sticky toolbar, so this component must
 * never draw its own — rendering it twice is the obvious failure mode when the
 * same controls serve two placements.
 */
export function SearchFiltersPanel({
  filters,
  categories,
  onChange,
  onClear,
  activeCount,
  hasLocation,
  layout,
}: {
  filters: Filters;
  categories: Category[];
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  activeCount: number;
  hasLocation: boolean;
  layout: "inline" | "sheet";
}) {
  const toggleCategory = (slug: string) => {
    const next = filters.categories.includes(slug)
      ? filters.categories.filter((s) => s !== slug)
      : [...filters.categories, slug];
    onChange({ categories: next });
  };

  return (
    <div className={cn("space-y-5", layout === "inline" && "space-y-4")}>
      <Group label="Category">
        {/*
          A scrolling strip, not a wrapping grid. Eleven categories wrapped at
          390px is four rows of chips standing between the driver and the first
          result; scrolling costs one gesture on the rare occasion the last chip
          is wanted.
        */}
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
      </Group>

      {/*
        Distance only exists once we know where "here" is. Showing a radius
        control with nothing to measure from is a dead control that implies the
        results are filtered when they are not.
      */}
      {hasLocation && (
        <Group label="Distance">
          <div className="ra-chips">
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ radius: r })}
                aria-pressed={filters.radius === r}
                className="ra-chip"
              >
                <span className="font-mono tabular-nums">{formatDistance(r)}</span>
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group label="Show only">
        <div className="flex flex-wrap gap-2">
          <Toggle
            active={filters.openNow}
            onClick={() => onChange({ openNow: !filters.openNow })}
            icon={Clock}
            label="Open now"
          />
          <Toggle
            active={filters.verifiedOnly}
            onClick={() => onChange({ verifiedOnly: !filters.verifiedOnly })}
            icon={BadgeCheck}
            label="Verified"
          />
          <Toggle
            active={filters.minRating === 4}
            onClick={() => onChange({ minRating: filters.minRating === 4 ? undefined : 4 })}
            icon={Star}
            label="4★ and up"
          />
        </div>
      </Group>

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

      {activeCount > 0 && (
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

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function Toggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="ra-chip">
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export { RADII };
