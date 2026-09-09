import { Link } from "react-router-dom";
import { CalendarClock, Search } from "lucide-react";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatAge, formatDateFriendly } from "@/shared/lib/format";
import { useMyBookingRequests } from "../hooks/useBookings";
import { BookingStatusBadge } from "../components/StatusBadge";

/**
 * A driver's own requests.
 *
 * Deliberately thin. The conversation happens on WhatsApp — this is a record of
 * what was asked and where it got to, not a second inbox. Nothing here says
 * anything about delivery: telling a driver "delivered" invites them to
 * conclude they are being ignored, and "failed" invites them to conclude the
 * business is broken.
 */
export function MyRequestsPage() {
  const { data, isLoading } = useMyBookingRequests();
  const items = data?.items ?? [];

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="ra-public">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            My requests
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Businesses reply on WhatsApp. This is what you've asked for and where it got to.
          </p>
        </header>

        {items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="You haven't asked anyone yet"
            description="Find a garage near you and send them a request."
            action={
              <Link
                to="/search"
                className="ra-tap flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Find a service
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {items.map((request) => (
              <li key={request.id} className="ra-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {request.business?.slug ? (
                        <Link to={`/business/${request.business.slug}`} className="hover:underline">
                          {request.business.name}
                        </Link>
                      ) : (
                        request.business?.name
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {request.serviceName} ·{" "}
                      <span className="font-mono tabular-nums">
                        {formatDateFriendly(request.preferredDate)}, {request.preferredTime}
                      </span>
                    </p>
                  </div>
                  <BookingStatusBadge status={request.status} />
                </div>

                {/* The one thing a declined driver genuinely needs: what to do
                    next. */}
                {request.declineReason && (
                  <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {request.declineReason}
                  </p>
                )}

                <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="font-mono tabular-nums">{request.reference}</span>
                  <span>{formatAge(request.createdAt)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
