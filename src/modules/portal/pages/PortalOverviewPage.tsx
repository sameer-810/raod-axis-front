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
import { StatCard } from "@/shared/components/StatCard";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageLoader } from "@/shared/components/PageLoader";
import { formatAge, formatDateFriendly, formatDuration } from "@/shared/lib/format";
import { BookingStatusBadge } from "@/modules/booking/components/StatusBadge";
import { useBookingRequests } from "@/modules/booking/hooks/useBookings";
import { useMyAnalytics } from "@/modules/analytics/hooks/useAnalytics";
import { useMyBusinesses, type OwnedBusiness } from "../hooks/useMyBusiness";

/**
 * The portal dashboard — the screen an owner opens every morning.
 *
 * It answers four questions in the order an owner asks them: **can customers
 * reach me**, **has anyone asked for anything**, **how am I doing**, and **what is
 * my listing still missing**.
 *
 * Everything here links to the screen where it can be acted on. A dashboard that
 * only reports is a report.
 */
export function PortalOverviewPage() {
  const user = useAppSelector((s) => s.auth.user);
  const { data: businesses, isLoading } = useMyBusinesses();

  if (isLoading) return <PageLoader />;

  const isAdmin = user?.role === "admin";

  return (
    <div className="ra-page">
      <div>
        <p className="ra-eyebrow text-muted-foreground">Overview</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {businesses?.length
            ? "Here's how your listing is doing."
            : "Your listing appears here once a claim is approved."}
        </p>
      </div>

      {!businesses || businesses.length === 0 ? (
        isAdmin ? (
          <EmptyState
            icon={Store}
            title="You manage the platform, not a listing"
            description="Administrators reach every business through the console."
            action={
              <Link to="/admin/businesses" className="ra-btn-primary">
                Open the console
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Store}
            title="No business yet"
            description="Claim your listing and it'll show up here, with the numbers customers reach you on."
            action={
              <Link to="/for-business" className="ra-btn-primary">
                Claim your business
              </Link>
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

  /*
    What the listing is still missing. Each item is something a driver sees, or
    does not — a listing with no photograph is the most common state in the
    directory and the biggest single reason a card gets scrolled past. The
    checklist turns "your listing is live" into "here is what to do next".
  */
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

  return (
    <section aria-labelledby={`b-${business.id}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id={`b-${business.id}`}
          className="flex items-center gap-2.5 text-lg font-bold text-foreground"
        >
          {business.name}
          {business.isVerified && (
            <Badge tone="success" icon={BadgeCheck}>
              Verified
            </Badge>
          )}
        </h2>
        <Link to={`/business/${business.slug}`} className="ra-btn h-10 gap-1.5 px-3 text-sm">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          View public page
        </Link>
      </div>

      {/*
        The headline fact, stated in words. WhatsApp is the only channel this
        product has, so "can customers reach me" is not a detail on a settings
        screen — it is the dashboard.
      */}
      <Link
        to="/portal/whatsapp"
        className={cn(
          "flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
          business.routing.deliverable
            ? "border-border bg-card hover:bg-accent/40"
            : "border-destructive/30 bg-destructive/10 hover:bg-destructive/15",
        )}
      >
        <MessageCircle
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            business.routing.deliverable ? "text-success" : "text-destructive",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          {business.routing.deliverable ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Booking requests go to {business.routing.label}
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
                {business.routing.phoneMasked}
              </p>
              {business.routing.usedFallback && (
                <p className="mt-1 text-sm text-warning">
                  Your primary number is switched off, so this one is covering.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Customers can't reach you</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {business.routing.reason === "no_numbers"
                  ? "Add a WhatsApp number to start receiving booking requests."
                  : "Every number is switched off. Switch one back on."}
              </p>
            </>
          )}
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Waiting for a reply"
          value={waiting}
          tone={waiting > 0 ? "warning" : "neutral"}
          hint={waiting > 0 ? "New requests you haven't answered" : "Nothing waiting on you"}
        />
        <StatCard
          label="Median first reply"
          // "—" until something has been answered. A zero here would read as
          // instant, which is the opposite of what it means.
          value={formatDuration(analytics?.performance.medianResponseMinutes)}
          hint="Last 30 days — the number that wins repeat customers"
        />
        <StatCard
          label="Profile views"
          value={business.viewCount ?? 0}
          hint="Unique visitors, all time"
        />
        <StatCard
          label="Rating"
          value={business.averageRating ?? "—"}
          hint={
            business.reviewCount
              ? `${business.reviewCount} review${business.reviewCount === 1 ? "" : "s"}`
              : "No reviews yet"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* ── Recent requests ────────────────────────────────────────── */}
        <div className="ra-panel">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Recent requests</h3>
            <Link
              to="/portal/requests"
              className="ra-tap -my-2 inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline"
            >
              All requests
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CalendarClock className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-foreground">No requests yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When a driver asks you for a time, it lands here and on your WhatsApp.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/portal/requests"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
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
        </div>

        {/* ── Listing checklist ──────────────────────────────────────── */}
        <div className="ra-panel">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Your listing</h3>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {complete}% complete
            </span>
          </div>
          <div className="px-4 pt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full bg-primary" style={{ width: `${complete}%` }} />
            </div>
          </div>
          <ul className="divide-y divide-border">
            {checklist.map((item) => (
              <li key={item.label}>
                {item.done ? (
                  <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="line-through decoration-border">{item.label}</span>
                  </div>
                ) : (
                  <Link
                    to={item.to}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
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
        </div>
      </div>
    </section>
  );
}
