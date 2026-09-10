import { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/shared/components/StatCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatDuration } from "@/shared/lib/format";
import { Sparkline } from "../components/Sparkline";
import { useMyAnalytics } from "../hooks/useAnalytics";

const WINDOWS = [7, 30, 90];

/**
 * An owner's own numbers, scoped server-side to the businesses they manage —
 * there is no business id in this request, deliberately.
 *
 * "Median first reply" rather than an average, and it is here rather than only
 * in the admin console because it is the number an owner can actually move.
 */
export function PortalAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useMyAnalytics(days);

  if (error) {
    return (
      <div className="ra-page">
        <EmptyState
          icon={BarChart3}
          title="No listings yet"
          description="Once a claim is approved, your listing's performance appears here."
          action={
            <Link
              to="/portal"
              className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              Back to the portal
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="ra-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            How people are finding you, and how quickly you are getting back to them.
          </p>
        </div>
        <div className="ra-chips" role="group" aria-label="Reporting window">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              aria-pressed={days === w}
              className={cn(
                "ra-tap rounded-lg border px-3 text-sm font-medium transition-colors",
                days === w
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {w} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Profile views" value={data?.totals.views ?? "—"} hint="All time" />
        <StatCard
          label="Requests"
          value={data?.performance.total ?? "—"}
          hint={`In the last ${days} days`}
        />
        <StatCard
          label="Median first reply"
          // "—" when nothing has been answered yet. A zero here would read as
          // instant, which is the opposite of what it means.
          value={formatDuration(data?.performance.medianResponseMinutes)}
          hint="The number you can move"
        />
        <StatCard label="Reviews" value={data?.totals.reviews ?? "—"} />
      </div>

      {data && (
        <section aria-labelledby="requests-trend" className="ra-tile">
          <h2 id="requests-trend" className="text-sm font-medium text-foreground">
            Booking requests
          </h2>
          <Sparkline points={data.series.requests} label="Booking requests" className="mt-2" />
        </section>
      )}

      {data && data.businesses.length > 0 && (
        <section aria-labelledby="listings">
          <h2 id="listings" className="mb-3 text-base font-semibold text-foreground">
            Your listings
          </h2>
          <ul className="space-y-2">
            {data.businesses.map((b) => (
              <li key={b.id} className="ra-tile flex flex-wrap items-center justify-between gap-3">
                <Link
                  to={`/business/${b.slug}`}
                  className="ra-tap inline-flex items-center font-medium hover:underline"
                >
                  {b.name}
                </Link>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {b.views} views ·{" "}
                  {/* No rating rather than nought stars — the same rule as the
                      trust row, for the same reason. */}
                  {b.averageRating === null
                    ? "no rating yet"
                    : `${b.averageRating} ★ (${b.reviewCount})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading && !data && <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}
