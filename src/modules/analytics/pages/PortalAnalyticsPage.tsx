import { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { Stat, StatGroup } from "@/shared/components/StatGroup";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageHeader } from "@/shared/components/PageHeader";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { SectionCard } from "@/shared/components/SectionCard";
import { ButtonLink } from "@/shared/components/Button";
import { Skeleton } from "@/shared/components/Skeleton";
import { formatDuration } from "@/shared/lib/format";
import { Sparkline } from "../components/Sparkline";
import { useMyAnalytics } from "../hooks/useAnalytics";

const WINDOWS = [7, 30, 90].map((d) => ({ value: d, label: `${d} days` }));

/**
 * An owner's own numbers, scoped server-side to the businesses they manage.
 * "Median first reply" is here because it is the number an owner can move.
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
            <ButtonLink to="/portal" variant="secondary">
              Back to the portal
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="ra-page">
      <PageHeader
        title="Performance"
        description="How people are finding you, and how quickly you are getting back to them."
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
        <Skeleton className="h-28 w-full" />
      ) : (
        <StatGroup>
          <Stat label="Profile views" value={data?.totals.views ?? "—"} hint="All time" />
          <Stat
            label="Requests"
            value={data?.performance.total ?? "—"}
            hint={`In the last ${days} days`}
          />
          <Stat
            label="Median first reply"
            value={formatDuration(data?.performance.medianResponseMinutes)}
            hint="The number you can move"
          />
          <Stat label="Reviews" value={data?.totals.reviews ?? "—"} />
        </StatGroup>
      )}

      {data && (
        <SectionCard title="Booking requests" description={`Per day, last ${days} days`}>
          <Sparkline points={data.series.requests} label="Booking requests" />
        </SectionCard>
      )}

      {data && data.businesses.length > 0 && (
        <SectionCard title="Your listings" flush>
          <ul className="divide-y divide-border">
            {data.businesses.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-1"
              >
                <Link
                  to={`/business/${b.slug}`}
                  className="flex min-h-[44px] items-center text-sm font-medium text-foreground hover:underline md:min-h-9"
                >
                  {b.name}
                </Link>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {b.views} views ·{" "}
                  {b.averageRating === null
                    ? "no rating yet"
                    : `${b.averageRating} ★ (${b.reviewCount})`}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
