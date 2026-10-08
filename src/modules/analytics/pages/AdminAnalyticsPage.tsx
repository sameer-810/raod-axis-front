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
 * Money to a chosen precision. A WhatsApp message costs a fraction of a penny,
 * and rounding the rate to two places prints a number nobody was charged.
 */
const money = (amount: number, currency: string, digits = 2) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
  }).format(amount);

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
  const m = data?.measures;
  const cost = data?.cost;
  const deepLink = data?.delivery.mode === "deep_link";
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
                value={v(data?.performance.total)}
                hint={t ? `Last ${days} days · ${t.bookingRequests} all time` : `Last ${days} days`}
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

          {/* The measures the product was commissioned against. Each rate is a
              dash until there is something to divide by, and the hint says how
              many records it rests on — "100%" from one claim is not a result. */}
          <section aria-labelledby="onboarding" className="space-y-3">
            <h2 id="onboarding" className="text-sm font-semibold text-foreground">
              Bringing garages on board
            </h2>
            <StatGroup>
              <Stat
                label="Time to claim"
                value={formatDuration(m?.timeToClaim.medianMinutes)}
                hint={
                  m?.timeToClaim.sample
                    ? `Median of ${m.timeToClaim.sample} · target under 5 minutes`
                    : "From opening the form to sending it · target under 5 minutes"
                }
              />
              <Stat
                label="Claims approved"
                value={pct(m?.claimApproval.rate)}
                hint={
                  m
                    ? `${m.claimApproval.approved} approved · ${m.claimApproval.rejected} rejected · target 95%`
                    : undefined
                }
              />
              <Stat
                label="Claimed in 30 days"
                value={pct(m?.claimedWithin30Days.rate)}
                hint={
                  m?.claimedWithin30Days.listed
                    ? `${m.claimedWithin30Days.claimed} of ${m.claimedWithin30Days.listed} seeded listings · target 80%`
                    : "No seeded listing is 30 days old yet · target 80%"
                }
              />
              <Stat
                label="Using both numbers"
                value={pct(m?.bothNumbers.rate)}
                hint={
                  m
                    ? `${m.bothNumbers.both} of ${m.bothNumbers.claimed} claimed listings · target 40%`
                    : undefined
                }
              />
            </StatGroup>
          </section>

          <section aria-labelledby="engagement" className="space-y-3">
            <h2 id="engagement" className="text-sm font-semibold text-foreground">
              Coming back
            </h2>
            <StatGroup>
              <Stat
                label="Repeat drivers"
                value={v(m?.repeatDrivers.repeat)}
                hint={
                  m?.repeatDrivers.drivers
                    ? `Of ${m.repeatDrivers.drivers} who have sent a request — the proof of demand`
                    : "Drivers who have sent more than one request"
                }
              />
              <Stat
                label="Saved garages"
                value={v(t?.favourites)}
                hint="A reason to come back next time"
              />
              <Stat
                label="Reviews"
                value={v(t?.reviews)}
                hint={t?.removedReviews ? `${t.removedReviews} removed by moderation` : undefined}
              />
              <Stat label="Categories in use" value={data?.categories.length ?? "—"} />
            </StatGroup>
          </section>

          {/* PRD §8: every booking request sent through the Cloud API costs a
              message, and the cost is meant to be visible rather than
              discovered on an invoice. Nothing here is estimated. */}
          <section aria-labelledby="cost" className="space-y-3">
            <h2 id="cost" className="text-sm font-semibold text-foreground">
              What the messages cost
            </h2>
            <StatGroup columns={3}>
              <Stat
                label="Billable messages"
                value={v(cost?.billableMessages)}
                hint={
                  deepLink
                    ? "Requests leave from the driver's own WhatsApp, so nothing is billed"
                    : `Sent by RoadAxis in the last ${days} days`
                }
              />
              <Stat
                label="Message cost"
                value={
                  cost?.total === null || cost?.total === undefined
                    ? "—"
                    : money(cost.total, cost.currency)
                }
                hint={
                  cost?.unitCost === null || cost?.unitCost === undefined
                    ? "The per-message rate has not been set on the server yet"
                    : `At ${money(cost.unitCost, cost.currency, 4)} a message`
                }
              />
              <Stat
                label="Cost per request"
                value={
                  cost?.perRequest === null || cost?.perRequest === undefined
                    ? "—"
                    : money(cost.perRequest, cost.currency, 4)
                }
                hint="Message cost divided by booking requests"
              />
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
              hint={`Last ${days} days`}
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
