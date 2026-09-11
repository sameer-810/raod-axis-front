import { Link } from "react-router-dom";
import {
  MessageCircle,
  Store,
  BadgeCheck,
  ArrowRight,
  CalendarClock,
  Check,
  Circle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import { Stat, StatGroup } from "@/shared/components/StatGroup";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageLoader } from "@/shared/components/PageLoader";
import { SectionCard } from "@/shared/components/SectionCard";
import { ButtonLink } from "@/shared/components/Button";
import { formatAge, formatDateFriendly, formatDuration } from "@/shared/lib/format";
import { BookingStatusBadge } from "@/modules/booking/components/StatusBadge";
import { useBookingRequests } from "@/modules/booking/hooks/useBookings";
import { useMyAnalytics } from "@/modules/analytics/hooks/useAnalytics";
import { useMyBusinesses, type OwnedBusiness } from "../hooks/useMyBusiness";

/**
 * The portal dashboard — the screen an owner opens every morning. Four
 * questions in the order they ask them: can customers reach me, has anyone
 * asked for anything, how am I doing, what is my listing still missing.
 * Everything links to where it can be acted on; a dashboard that only reports
 * is a report.
 */
export function PortalOverviewPage() {
  const user = useAppSelector((s) => s.auth.user);
  const { data: businesses, isLoading } = useMyBusinesses();

  if (isLoading) return <PageLoader />;

  const isAdmin = user?.role === "admin";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="ra-page">
      {/* The greeting stays visible on a phone — it is a greeting, not a page name. */}
      <header>
        <p className="ra-eyebrow text-muted-foreground">{greeting}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          {businesses?.length
            ? "Here's how your listing is doing."
            : "Your listing appears here once a claim is approved."}
        </p>
      </header>

      {!businesses || businesses.length === 0 ? (
        isAdmin ? (
          <EmptyState
            icon={Store}
            title="You manage the platform, not a listing"
            description="Administrators reach every business through the console."
            action={
              <ButtonLink to="/admin/businesses" variant="primary">
                Open the console
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={Store}
            title="No business yet"
            description="Claim your listing and it'll show up here, with the numbers customers reach you on."
            action={
              <ButtonLink to="/for-business" variant="primary">
                Claim your business
              </ButtonLink>
            }
          />
        )
      ) : (
        businesses.map((business) => <BusinessDashboard key={business.id} business={business} />)
      )}
    </div>
  );
}

function BusinessDashboard({ business }: { business: OwnedBusiness }) {
  const { data: inbox } = useBookingRequests({ businessId: business.id });
  const { data: analytics } = useMyAnalytics(30);

  const recent = inbox?.items.slice(0, 5) ?? [];
  const waiting = inbox?.items.filter((r) => r.status === "new").length ?? 0;

  const checklist = [
    {
      done: business.photos.length > 0,
      label: "Add a photo of the workshop",
      why: "Listings with a photo get chosen first.",
      to: "/portal/listing",
    },
    {
      done: Boolean(business.description?.trim()),
      label: "Describe what you do",
      why: "In your own words — this is what drivers read first.",
      to: "/portal/listing",
    },
    {
      done: business.services.length > 0,
      label: "List your services with prices",
      why: "Drivers can only request a service you've listed.",
      to: "/portal/listing",
    },
    {
      done: business.workingHours.length > 0,
      label: "Set your opening hours",
      why: "Without them you never appear under “Open now”.",
      to: "/portal/listing",
    },
    {
      done: business.routing.deliverable,
      label: "Switch on a WhatsApp number",
      why: "It's where booking requests arrive.",
      to: "/portal/whatsapp",
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const complete = Math.round((doneCount / checklist.length) * 100);
  const reachable = business.routing.deliverable;

  return (
    <section aria-labelledby={`b-${business.id}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id={`b-${business.id}`}
          className="flex items-center gap-2.5 font-display text-lg font-semibold text-foreground"
        >
          {business.name}
          {business.isVerified && (
            <Badge tone="success" icon={BadgeCheck}>
              Verified
            </Badge>
          )}
        </h2>
        <ButtonLink
          to={`/business/${business.slug}`}
          variant="secondary"
          size="sm"
          icon={ExternalLink}
        >
          View public page
        </ButtonLink>
      </div>

      {/* The headline fact, in words. WhatsApp is the only channel, so "can
          customers reach me" is the dashboard, not a settings detail. */}
      <Link
        to="/portal/whatsapp"
        className={cn(
          "ra-focus flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
          reachable
            ? "border-border bg-card hover:bg-accent/40"
            : "border-destructive/30 bg-destructive/10 hover:bg-destructive/15",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            reachable ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
          )}
          aria-hidden="true"
        >
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {reachable ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Booking requests go to {business.routing.label}
              </p>
              <p className="mt-0.5 font-mono text-[13px] tabular-nums text-muted-foreground">
                {business.routing.phoneMasked}
              </p>
              {business.routing.usedFallback && (
                <p className="mt-1 text-[13px] text-warning-text">
                  Your primary number is switched off, so this one is covering.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Customers can't reach you</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {business.routing.reason === "no_numbers"
                  ? "Add a WhatsApp number to start receiving booking requests."
                  : "Every number is switched off. Switch one back on."}
              </p>
            </>
          )}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <StatGroup>
        <Stat
          label="Waiting for a reply"
          value={waiting}
          tone={waiting > 0 ? "warning" : "neutral"}
          hint={waiting > 0 ? "New requests you haven't answered" : "Nothing waiting on you"}
        />
        <Stat
          label="Median first reply"
          value={formatDuration(analytics?.performance.medianResponseMinutes)}
          hint="Last 30 days — the number that wins repeat customers"
        />
        <Stat
          label="Profile views"
          value={business.viewCount ?? 0}
          hint="Unique visitors, all time"
        />
        <Stat
          label="Rating"
          value={business.averageRating ?? "—"}
          hint={
            business.reviewCount
              ? `${business.reviewCount} review${business.reviewCount === 1 ? "" : "s"}`
              : "No reviews yet"
          }
        />
      </StatGroup>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SectionCard
          title="Recent requests"
          as="h3"
          flush
          aside={
            <Link
              to="/portal/requests"
              className="ra-focus inline-flex min-h-[44px] items-center gap-1 rounded text-[13px] font-medium text-primary-text hover:underline md:min-h-0"
            >
              All requests
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-foreground">No requests yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                When a driver asks you for a time, it lands here and on your WhatsApp.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/portal/requests"
                    className="ra-focus-inset flex min-h-[44px] items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/40 md:min-h-12"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.serviceName}
                        <span className="font-normal text-muted-foreground"> · {r.driverName}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateFriendly(r.preferredDate)} at{" "}
                        <span className="font-mono tabular-nums">{r.preferredTime}</span>
                        <span className="mx-1.5">·</span>
                        <span className="font-mono tabular-nums">{formatAge(r.createdAt)}</span>
                      </p>
                    </div>
                    <BookingStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Your listing"
          as="h3"
          flush
          aside={
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {complete}% complete
            </span>
          }
        >
          <div className="px-4 pt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-slow ease-out"
                style={{ width: `${complete}%` }}
              />
            </div>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {checklist.map((item) => (
              <li key={item.label}>
                {item.done ? (
                  <div className="flex min-h-10 items-center gap-3 px-4 py-2 text-[13px] text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="line-through decoration-border">{item.label}</span>
                  </div>
                ) : (
                  <Link
                    to={item.to}
                    className="ra-focus-inset flex min-h-[44px] items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <Circle
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">{item.why}</span>
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </section>
  );
}
