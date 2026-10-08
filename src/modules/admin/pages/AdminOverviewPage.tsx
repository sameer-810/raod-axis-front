import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  MessageSquare,
  ScrollText,
  Store,
  Upload,
} from "lucide-react";
import { Avatar } from "@/shared/components/Avatar";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageHeader } from "@/shared/components/PageHeader";
import { SectionCard } from "@/shared/components/SectionCard";
import { Skeleton } from "@/shared/components/Skeleton";
import { Stat, StatGroup } from "@/shared/components/StatGroup";
import { formatAge, formatDateTime } from "@/shared/lib/format";
import { useAnalytics } from "@/modules/analytics/hooks/useAnalytics";
import { actionLabel, auditApi } from "../api/auditApi";

/** The window behind the one figure here that is not "now": requests this week. */
const WEEK = 7;

/**
 * The administrator's first screen — FR-ADM-01.
 *
 * It answers one question: what needs me today. So it is four numbers about
 * the state of the directory, a short list of things that are actually waiting,
 * and what has just happened. How the directory is *trending* is a different
 * question with a different screen, and Analytics is one click away.
 *
 * The console used to open on the businesses table, which is a place to work
 * rather than a place to arrive.
 */
export function AdminOverviewPage() {
  const { data, isLoading, error } = useAnalytics(WEEK);
  const activity = useQuery({
    queryKey: ["admin", "audit", "recent"],
    queryFn: () => auditApi.recent(8),
  });

  if (error) {
    return (
      <div className="ra-page">
        <EmptyState
          icon={AlertTriangle}
          title="We couldn't load the overview"
          description="Try again in a moment."
        />
      </div>
    );
  }

  const t = data?.totals;
  const failed = data?.delivery.byState.failed ?? 0;
  const v = (n: number | undefined) => (n === undefined ? "—" : n);

  /**
   * Only what is genuinely waiting. A row that says "0 claims" is noise that
   * teaches people to stop reading the list.
   */
  const waiting = [
    t && t.pendingClaims > 0
      ? {
          to: "/admin/claims",
          icon: ClipboardCheck,
          label: `${t.pendingClaims} ownership claim${t.pendingClaims === 1 ? "" : "s"} to review`,
          hint: "An owner is waiting to hear back.",
        }
      : null,
    failed > 0
      ? {
          to: "/admin/whatsapp-logs",
          icon: MessageSquare,
          label: `${failed} message${failed === 1 ? "" : "s"} failed to send this week`,
          hint: "A business did not receive a booking request.",
        }
      : null,
    t && t.draftBusinesses > 0
      ? {
          to: "/admin/businesses",
          icon: Store,
          label: `${t.draftBusinesses} listing${t.draftBusinesses === 1 ? " is" : "s are"} still a draft`,
          hint: "Not visible to drivers until published.",
        }
      : null,
  ].filter((w): w is NonNullable<typeof w> => Boolean(w));

  return (
    <div className="ra-page">
      <PageHeader
        title="Overview"
        description="Where the directory stands today, and what is waiting on you."
      />

      {isLoading && !data ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <StatGroup>
          <Stat
            label="Businesses"
            value={v(t?.businesses)}
            hint={
              t
                ? `${t.liveBusinesses} live · ${t.draftBusinesses} draft · ${t.suspendedBusinesses} suspended`
                : undefined
            }
          />
          <Stat
            label="Unclaimed"
            value={v(t?.unclaimedBusinesses)}
            hint={
              t?.claimRate === null || t?.claimRate === undefined
                ? "Live listings nobody has claimed"
                : `${t.claimRate}% of live listings are claimed`
            }
          />
          <Stat
            label="Claims waiting"
            value={v(t?.pendingClaims)}
            tone={t && t.pendingClaims > 0 ? "warning" : "neutral"}
            hint={t && t.pendingClaims > 0 ? "Owners waiting on a decision" : "The queue is clear"}
          />
          <Stat
            label="Requests today"
            value={v(t?.bookingRequestsToday)}
            hint={data ? `${data.performance.total} in the last ${WEEK} days` : undefined}
          />
        </StatGroup>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          <SectionCard title="Waiting on you" flush>
            {waiting.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                Nothing needs you right now.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {waiting.map((w) => (
                  <li key={w.to}>
                    <Link
                      to={w.to}
                      className="ra-focus-inset flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <w.icon className="h-4 w-4 shrink-0 text-warning-text" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{w.label}</span>
                        <span className="block text-xs text-muted-foreground">{w.hint}</span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Grow the directory" flush>
            <ul className="divide-y divide-border">
              {[
                { to: "/admin/businesses/new", icon: Store, label: "Add a listing" },
                {
                  to: "/admin/businesses/import",
                  icon: Upload,
                  label: "Import from a spreadsheet",
                },
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="ra-focus-inset flex min-h-[44px] items-center gap-3 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
                  >
                    <item.icon
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1">{item.label}</span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard
          title="Recent activity"
          flush
          aside={
            <Link
              to="/admin/audit"
              className="ra-focus inline-flex min-h-[44px] items-center gap-1 rounded text-[13px] font-medium text-primary-text hover:underline md:min-h-0"
            >
              Audit log
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        >
          {activity.isLoading ? (
            <div className="space-y-4 p-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activity.data?.length ? (
            <div className="px-4 py-8 text-center">
              <ScrollText className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-foreground">Nothing recorded yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Approvals, edits and suspensions appear here as they happen.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-border" aria-label="Recent activity">
              {activity.data.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                  <Avatar name={entry.actor.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-5 text-foreground">
                      <span className="font-medium">{entry.actor.name}</span>{" "}
                      <span className="text-muted-foreground">{actionLabel(entry.action)}</span>
                      {entry.entity.label && (
                        <>
                          {" "}
                          <span className="text-muted-foreground">on</span> {entry.entity.label}
                        </>
                      )}
                    </p>
                    {entry.reason && (
                      <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                        {entry.reason}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
                    title={formatDateTime(entry.at)}
                  >
                    {formatAge(entry.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
