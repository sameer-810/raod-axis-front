import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Stat, StatGroup } from "@/shared/components/StatGroup";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageHeader } from "@/shared/components/PageHeader";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { SectionCard } from "@/shared/components/SectionCard";
import { Skeleton } from "@/shared/components/Skeleton";
import { formatDuration } from "@/shared/lib/format";
import { Sparkline } from "../components/Sparkline";
import { useAnalytics } from "../hooks/useAnalytics";
import type { LeaderRow } from "../types";

const WINDOWS = [7, 30, 90].map((d) => ({ value: d, label: `${d} days` }));

/** "—" for anything genuinely unknown. A blank dashboard is the truth on day one. */
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value}%`;

/**
 * The platform dashboard — FR-ADM-07. Two rules: a rate computed from nothing
 * renders "—", never 0% or 100%; and a business with no reviews shows no rating.
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
  const v = (n: number | undefined) => (n === undefined ? "—" : n);

  return (
    <div className="ra-page">
      <PageHeader
        title="Analytics"
        description="How the directory is growing, and whether the loop it exists for — discover, contact, book — is closing."
        actions={
          <SegmentedControl
            label="Reporting window"
            options={WINDOWS}
            value={days}
            onChange={setDays}
          />
        }
      />

      {isLoading && !data ? (
        <div className="space-y-5" aria-busy="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <section aria-labelledby="adoption" className="space-y-3">
            <h2 id="adoption" className="text-sm font-semibold text-foreground">
              The directory
            </h2>
            <StatGroup>
              <Stat
                label="Live listings"
                value={v(t?.liveBusinesses)}
                hint={
                  t ? `${t.draftBusinesses} draft · ${t.suspendedBusinesses} suspended` : undefined
                }
              />
              <Stat
                label="Claim rate"
                value={pct(t?.claimRate)}
                hint={t ? `${t.claimedBusinesses} of ${t.liveBusinesses} claimed` : undefined}
              />
              <Stat
                label="Claims waiting"
                value={v(t?.pendingClaims)}
                tone={t && t.pendingClaims > 0 ? "warning" : "neutral"}
                hint="Owners waiting on a decision"
              />
              <Stat label="Drivers" value={v(t?.drivers)} hint={`${t?.owners ?? 0} owners`} />
            </StatGroup>
          </section>

          <section aria-labelledby="loop" className="space-y-3">
            <h2 id="loop" className="text-sm font-semibold text-foreground">
              Discover → Contact → Book
            </h2>
            <StatGroup>
              <Stat
                label="Booking requests"
                value={v(t?.bookingRequests)}
                hint={`Last ${days} days`}
              />
              <Stat
                label="Acceptance rate"
                value={pct(data?.performance.acceptanceRate)}
                hint="Of requests a business has decided"
              />
              <Stat
                label="Median first reply"
                value={formatDuration(data?.performance.medianResponseMinutes)}
                hint="Median, not mean — one late reply should not set the number"
              />
              <Stat
                label="Delivery rate"
                value={pct(data?.delivery.deliveryRate)}
                tone={data?.delivery.mode === "deep_link" ? "warning" : "neutral"}
                hint={
                  data?.delivery.mode === "deep_link"
                    ? "Deep-link mode — delivery cannot be tracked"
                    : `${data?.delivery.tracked ?? 0} trackable attempts`
                }
              />
            </StatGroup>
          </section>

          <section aria-labelledby="engagement" className="space-y-3">
            <h2 id="engagement" className="text-sm font-semibold text-foreground">
              Coming back
            </h2>
            <StatGroup columns={3}>
              <Stat
                label="Saved garages"
                value={v(t?.favourites)}
                hint="The closest thing the MVP has to retention"
              />
              <Stat
                label="Reviews"
                value={v(t?.reviews)}
                hint={t?.removedReviews ? `${t.removedReviews} removed by moderation` : undefined}
              />
              <Stat label="Categories in use" value={data?.categories.length ?? "—"} />
            </StatGroup>
          </section>

          {data && (
            <section aria-labelledby="trends" className="grid gap-4 lg:grid-cols-3">
              <h2 id="trends" className="sr-only">
                Trends
              </h2>
              <SectionCard title="New accounts" as="h3">
                <Sparkline points={data.series.signups} label="New accounts" />
              </SectionCard>
              <SectionCard title="Booking requests" as="h3">
                <Sparkline points={data.series.requests} label="Booking requests" />
              </SectionCard>
              <SectionCard title="Listings going live" as="h3">
                <Sparkline points={data.series.listings} label="Listings going live" />
              </SectionCard>
            </section>
          )}

          <section aria-labelledby="boards" className="grid gap-4 lg:grid-cols-3">
            <h2 id="boards" className="sr-only">
              Leaderboards
            </h2>
            <Leaderboard
              title="Most viewed"
              rows={data?.leaderboards.mostViewed ?? []}
              value={(b) => `${b.views}`}
              unit="views"
            />
            <Leaderboard
              title="Best rated"
              hint="Three reviews or more"
              rows={data?.leaderboards.topRated ?? []}
              value={(b) => (b.averageRating ?? 0).toFixed(1)}
              unit="★"
            />
            <SectionCard title="Most requested" as="h3" flush>
              {data?.leaderboards.mostRequested.length ? (
                <ol className="divide-y divide-border">
                  {data.leaderboards.mostRequested.map((b, i) => (
                    <li key={b.id} className="flex items-center gap-3 px-4 text-[13px]">
                      <span className="w-4 font-mono text-xs tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <Link
                        to={`/business/${b.slug}`}
                        className="flex min-h-[44px] min-w-0 flex-1 items-center truncate font-medium text-foreground hover:underline md:min-h-10"
                      >
                        {b.name}
                      </Link>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {b.count}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-4 py-3 text-[13px] text-muted-foreground">
                  No requests in this window yet.
                </p>
              )}
            </SectionCard>
          </section>
        </>
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
  value: (row: LeaderRow) => string;
  unit: string;
  hint?: string;
}) {
  return (
    <SectionCard title={title} description={hint} as="h3" flush>
      {rows.length ? (
        <ol className="divide-y divide-border">
          {rows.map((b, i) => (
            <li key={b.id} className="flex items-center gap-3 px-4 text-[13px]">
              <span className="w-4 font-mono text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <Link
                to={`/business/${b.slug}`}
                className="flex min-h-[44px] min-w-0 flex-1 items-center truncate font-medium text-foreground hover:underline md:min-h-10"
              >
                {b.name}
              </Link>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {value(b)} {unit}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-3 text-[13px] text-muted-foreground">Nothing to rank yet.</p>
      )}
    </SectionCard>
  );
}
