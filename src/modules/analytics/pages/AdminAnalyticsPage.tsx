import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/shared/components/StatCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatDuration } from "@/shared/lib/format";
import { Sparkline } from "../components/Sparkline";
import { useAnalytics } from "../hooks/useAnalytics";
import type { LeaderRow } from "../types";

const WINDOWS = [7, 30, 90];

/** "—" for anything genuinely unknown. A blank dashboard is the truth on day one. */
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value}%`;

/**
 * The platform dashboard — FR-ADM-07.
 *
 * Every figure in PRD §6 that can be measured, and an honest gap where one
 * cannot. Two rules run through the whole screen:
 *
 *  1. **A rate computed from nothing renders "—", never 0% or 100%.** The
 *     delivery figure is the sharp case: in deep-link mode nothing is trackable,
 *     and a confident "100%" here is the exact failure the WhatsApp log screen
 *     exists to prevent.
 *  2. **A business with no reviews shows no rating**, not nought stars — the same
 *     rule as the trust row, because this table is read by the people who decide
 *     which listings to chase.
 */
export function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useAnalytics(days);

  if (error) {
    return (
      <div className="ra-page">
        <EmptyState
          icon={AlertTriangle}
          title="We couldn't load the dashboard"
          description="Try again in a moment."
        />
      </div>
    );
  }

  const t = data?.totals;

  return (
    <div className="ra-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            How the directory is growing, and whether the loop it exists for is closing.
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

      {/* ── Adoption ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="adoption">
        <h2 id="adoption" className="mb-3 text-base font-semibold text-foreground">
          The directory
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Live listings"
            value={t?.liveBusinesses ?? "—"}
            hint={t ? `${t.draftBusinesses} draft · ${t.suspendedBusinesses} suspended` : undefined}
          />
          <StatCard
            label="Claim rate"
            // The PRD's headline adoption figure, over live listings only.
            value={pct(t?.claimRate)}
            hint={t ? `${t.claimedBusinesses} of ${t.liveBusinesses} claimed` : undefined}
          />
          <StatCard
            label="Claims waiting"
            value={t?.pendingClaims ?? "—"}
            tone={t && t.pendingClaims > 0 ? "warning" : "neutral"}
            hint="Owners waiting on a decision"
          />
          <StatCard label="Drivers" value={t?.drivers ?? "—"} hint={`${t?.owners ?? 0} owners`} />
        </div>
      </section>

      {/* ── The loop ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="loop">
        <h2 id="loop" className="mb-3 text-base font-semibold text-foreground">
          Discover → Contact → Book
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Booking requests" value={t?.bookingRequests ?? "—"} />
          <StatCard
            label="Acceptance rate"
            value={pct(data?.performance.acceptanceRate)}
            hint="Of requests a business has decided"
          />
          <StatCard
            label="Median first reply"
            value={formatDuration(data?.performance.medianResponseMinutes)}
            hint="Median, not mean — one late reply should not set the number"
          />
          <StatCard
            label="Delivery rate"
            value={pct(data?.delivery.deliveryRate)}
            tone={data?.delivery.mode === "deep_link" ? "warning" : "neutral"}
            hint={
              data?.delivery.mode === "deep_link"
                ? "Deep-link mode — delivery cannot be tracked"
                : `${data?.delivery.tracked ?? 0} trackable attempts`
            }
          />
        </div>
      </section>

      {/* ── Retention ────────────────────────────────────────────────────── */}
      <section aria-labelledby="engagement">
        <h2 id="engagement" className="mb-3 text-base font-semibold text-foreground">
          Coming back
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Saved garages"
            value={t?.favourites ?? "—"}
            hint="The closest thing the MVP has to retention"
          />
          <StatCard
            label="Reviews"
            value={t?.reviews ?? "—"}
            hint={t?.removedReviews ? `${t.removedReviews} removed by moderation` : undefined}
          />
          <StatCard label="Categories in use" value={data?.categories.length ?? "—"} />
        </div>
      </section>

      {/* ── Trends ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="trends" className="grid gap-4 lg:grid-cols-3">
        <h2 id="trends" className="sr-only">
          Trends
        </h2>
        {data && (
          <>
            <div className="ra-tile">
              <p className="text-sm font-medium text-foreground">New accounts</p>
              <Sparkline points={data.series.signups} label="New accounts" className="mt-2" />
            </div>
            <div className="ra-tile">
              <p className="text-sm font-medium text-foreground">Booking requests</p>
              <Sparkline points={data.series.requests} label="Booking requests" className="mt-2" />
            </div>
            <div className="ra-tile">
              <p className="text-sm font-medium text-foreground">Listings going live</p>
              <Sparkline
                points={data.series.listings}
                label="Listings going live"
                className="mt-2"
              />
            </div>
          </>
        )}
      </section>

      {/* ── Leaderboards ─────────────────────────────────────────────────── */}
      <section aria-labelledby="boards" className="grid gap-4 lg:grid-cols-3">
        <h2 id="boards" className="sr-only">
          Leaderboards
        </h2>
        <Leaderboard
          title="Most viewed"
          rows={data?.leaderboards.mostViewed ?? []}
          value={(b) => b.views}
          unit="views"
        />
        <Leaderboard
          title="Best rated"
          rows={data?.leaderboards.topRated ?? []}
          value={(b) => b.averageRating ?? 0}
          unit="★"
          hint="Three reviews or more"
        />
        <div className="ra-tile">
          <p className="text-sm font-medium text-foreground">Most requested</p>
          {data?.leaderboards.mostRequested.length ? (
            <ol className="mt-3 divide-y divide-border">
              {data.leaderboards.mostRequested.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                  {/* `ra-tap`: a leaderboard row is a standalone destination,
                      not a link inside a sentence, so it owes the touch floor. */}
                  <Link
                    to={`/business/${b.slug}`}
                    className="ra-tap flex min-w-0 flex-1 items-center truncate hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="font-mono tabular-nums text-muted-foreground">{b.count}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No requests in this window yet.</p>
          )}
        </div>
      </section>

      {isLoading && !data && (
        <EmptyState icon={BarChart3} title="Loading…" description="Working out the numbers." />
      )}
    </div>
  );
}

function Leaderboard({
  title,
  rows,
  value,
  unit,
  hint,
}: {
  title: string;
  rows: LeaderRow[];
  value: (row: LeaderRow) => number;
  unit: string;
  hint?: string;
}) {
  return (
    <div className="ra-tile">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {rows.length ? (
        <ol className="mt-3 divide-y divide-border">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
              <Link
                to={`/business/${b.slug}`}
                className="ra-tap flex min-w-0 flex-1 items-center truncate hover:underline"
              >
                {b.name}
              </Link>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {value(b)} {unit}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing to rank yet.</p>
      )}
    </div>
  );
}
