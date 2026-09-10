import { useState } from "react";
import { Link } from "react-router-dom";
import { Phone, MessageCircle, Inbox, Clock, ChevronRight, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatAge, formatDateFriendly, formatDuration } from "@/shared/lib/format";
import { useBookingRequests, useSetBookingStatus } from "@/modules/booking/hooks/useBookings";
import { BookingStatusBadge, DeliveryBadge } from "@/modules/booking/components/StatusBadge";
import type { BookingRequest, BookingStatus } from "@/modules/booking/types";

const FILTERS: Array<{ value: BookingStatus | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "accepted", label: "Accepted" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

/**
 * The business inbox — FR-BIZ-05. Built for a garage owner reading it on a phone
 * between jobs, so the two things they will actually do — ring the customer, or
 * reply on WhatsApp — are on every row rather than one tap deeper. The
 * conversation happens on WhatsApp; this screen records what happened.
 */
export function PortalRequestsPage() {
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [declining, setDeclining] = useState<BookingRequest | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useBookingRequests({ status, page });
  const setBookingStatus = useSetBookingStatus();

  const items = data?.items ?? [];

  async function move(request: BookingRequest, next: BookingStatus, why?: string) {
    try {
      await setBookingStatus.mutateAsync({ id: request.id, status: next, reason: why });
      toast.success(`${request.reference} marked ${next}`);
      setDeclining(null);
      setReason("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="ra-page">
      <div>
        <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
          Booking requests
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{data?.meta.total ?? 0}</span> requests · reply
          on WhatsApp, then mark what happened here
        </p>
      </div>

      {/* Scrolls rather than wraps — six filters wrapped at 390px is two rows
          of chrome above the first request. */}
      <div className="ra-chips" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
            aria-pressed={status === f.value}
            className="ra-chip"
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="ra-panel px-4 py-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={status ? Inbox : Store}
          title={status ? "Nothing here" : "No requests yet"}
          description={
            status
              ? "Try a different filter."
              : "When a driver asks you for a time, it lands here and on your WhatsApp."
          }
          action={
            !status ? (
              <Link
                to="/portal/whatsapp"
                className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                Check your WhatsApp numbers
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((request) => (
            <li
              key={request.id}
              className={cn("ra-tile", request.status === "new" && "border-primary/40")}
            >
              <button
                type="button"
                onClick={() => setExpanded(expanded === request.id ? null : request.id)}
                aria-expanded={expanded === request.id}
                className="flex w-full items-start justify-between gap-3 text-start"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {request.driverName}
                    <BookingStatusBadge status={request.status} />
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {request.serviceName} ·{" "}
                    <span className="font-mono tabular-nums">
                      {formatDateFriendly(request.preferredDate)}, {request.preferredTime}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {formatAge(request.createdAt)}
                    </span>
                    <span className="font-mono tabular-nums">{request.reference}</span>
                    {/* Only when the reply time is worth knowing — the KPI the
                        product exists to move. */}
                    {request.responseMinutes !== null && (
                      <span>replied in {formatDuration(request.responseMinutes)}</span>
                    )}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    expanded === request.id && "rotate-90",
                  )}
                  aria-hidden="true"
                />
              </button>

              {/*
                The two things an owner will actually do, on every row. The
                conversation happens on WhatsApp; burying the way to start it
                one tap deeper is the difference between a two-hour reply and a
                two-day one.
              */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <a
                  href={`tel:${request.driverPhone}`}
                  className="ra-tap flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent sm:flex-none"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call
                </a>
                <a
                  href={`https://wa.me/${request.driverPhone.replace(/^\+/, "")}?text=${encodeURIComponent(
                    `Hello ${request.driverName}, about your RoadAxis request ${request.reference} —`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ra-tap flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent sm:flex-none"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </div>

              {expanded === request.id && (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    <Row label="Phone" value={request.driverPhoneFormatted} mono />
                    <Row
                      label="Sent to WhatsApp"
                      value={<DeliveryBadge delivery={request.delivery} />}
                    />
                  </dl>

                  {request.notes && (
                    <p className="whitespace-pre-line rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {request.notes}
                    </p>
                  )}

                  {request.declineReason && (
                    <p className="text-sm text-muted-foreground">
                      Declined: {request.declineReason}
                    </p>
                  )}

                  {/* Only the moves this request can actually make — offering
                      one the server will refuse is a promise the interface
                      cannot keep. */}
                  <div className="flex flex-wrap gap-2">
                    {request.status === "new" && (
                      <Action onClick={() => move(request, "contacted")}>Mark contacted</Action>
                    )}
                    {(request.status === "new" || request.status === "contacted") && (
                      <Action primary onClick={() => move(request, "accepted")}>
                        Accept
                      </Action>
                    )}
                    {(request.status === "contacted" || request.status === "accepted") && (
                      <Action onClick={() => move(request, "completed")}>Mark done</Action>
                    )}
                    {!["completed", "declined", "cancelled"].includes(request.status) && (
                      <Action destructive onClick={() => setDeclining(request)}>
                        Decline
                      </Action>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <button
            type="button"
            disabled={!data.meta.hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="ra-tap rounded-lg px-3 font-medium text-muted-foreground disabled:opacity-40"
          >
            Newer
          </button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {data.meta.page} / {data.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={!data.meta.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="ra-tap rounded-lg px-3 font-medium text-muted-foreground disabled:opacity-40"
          >
            Older
          </button>
        </div>
      )}

      {declining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="ra-overlay w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-foreground">
              Decline {declining.driverName}'s request?
            </h2>
            {/* The customer reads this. "No" with nothing attached leaves them
                unable to decide whether to ask again or try somewhere else. */}
            <label
              htmlFor="decline-reason"
              className="mt-4 block text-sm font-medium text-foreground"
            >
              Why?
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              The customer sees this, so tell them something useful.
            </p>
            <textarea
              id="decline-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Fully booked that week — try us the following Monday."
              className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeclining(null);
                  setReason("");
                }}
                className="ra-tap rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => move(declining, "declined", reason)}
                className="ra-tap rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Action({
  children,
  onClick,
  primary,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ra-tap rounded-lg px-4 text-sm font-medium transition-colors",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : destructive
            ? "border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "border border-border hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-foreground", mono && "font-mono text-xs tabular-nums")}>{value}</dd>
    </div>
  );
}
