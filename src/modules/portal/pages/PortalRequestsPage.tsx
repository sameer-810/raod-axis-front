import { useState } from "react";
import { Phone, MessageCircle, Inbox, Clock, ChevronRight, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageHeader } from "@/shared/components/PageHeader";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { Button, ButtonAnchor, ButtonLink } from "@/shared/components/Button";
import { Pagination } from "@/shared/components/Pagination";
import { ConfirmDialog } from "@/shared/components/Dialog";
import { DescriptionList } from "@/shared/components/SectionCard";
import { Skeleton } from "@/shared/components/Skeleton";
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
 * The business inbox — FR-BIZ-05. Built for a garage owner reading it on a
 * phone between jobs: the two things they will actually do — ring the customer,
 * or reply on WhatsApp — are on every row. Rows expand in place, so working
 * down the list never loses the list.
 */
export function PortalRequestsPage() {
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [declining, setDeclining] = useState<BookingRequest | null>(null);

  const { data, isLoading } = useBookingRequests({ status, page });
  const setBookingStatus = useSetBookingStatus();
  const items = data?.items ?? [];

  async function move(request: BookingRequest, next: BookingStatus, why?: string) {
    try {
      await setBookingStatus.mutateAsync({ id: request.id, status: next, reason: why });
      toast.success(`${request.reference} marked ${next}`);
      setDeclining(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="ra-page">
      <PageHeader
        title="Booking requests"
        description="Reply on WhatsApp, then mark what happened here so the customer knows where they stand."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{data?.meta.total ?? 0}</span>{" "}
            requests
          </span>
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-0.5 md:mx-0 md:px-0">
          <SegmentedControl
            label="Filter by status"
            options={FILTERS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
              setExpanded(null);
            }}
          />
        </div>
      </PageHeader>

      {isLoading ? (
        <ul className="ra-panel divide-y divide-border" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
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
              <ButtonLink to="/portal/whatsapp" variant="secondary">
                Check your WhatsApp numbers
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ul className="ra-panel divide-y divide-border" aria-label="Booking requests">
          {items.map((request) => {
            const open = expanded === request.id;
            const isNew = request.status === "new";
            return (
              <li
                key={request.id}
                className={cn(
                  "transition-colors",
                  isNew && "shadow-[inset_3px_0_0_hsl(var(--primary))]",
                  open && "bg-surface-2",
                )}
              >
                <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : request.id)}
                    aria-expanded={open}
                    className="ra-focus flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded text-start md:min-h-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {request.driverName}
                        <BookingStatusBadge status={request.status} />
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {request.serviceName} ·{" "}
                        <span className="font-mono tabular-nums">
                          {formatDateFriendly(request.preferredDate)}, {request.preferredTime}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatAge(request.createdAt)}
                        </span>
                        <span className="font-mono tabular-nums">{request.reference}</span>
                        {request.responseMinutes !== null && (
                          <span>replied in {formatDuration(request.responseMinutes)}</span>
                        )}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-base ease-out",
                        open && "rotate-90",
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {/* On every row, not one tap deeper — the difference between a
                      two-hour reply and a two-day one. */}
                  <div className="flex shrink-0 gap-2">
                    <ButtonAnchor
                      href={`tel:${request.driverPhone}`}
                      variant="secondary"
                      size="sm"
                      icon={Phone}
                      className="flex-1 md:flex-none"
                    >
                      Call
                    </ButtonAnchor>
                    <ButtonAnchor
                      href={`https://wa.me/${request.driverPhone.replace(/^\+/, "")}?text=${encodeURIComponent(
                        `Hello ${request.driverName}, about your RoadAxis request ${request.reference} —`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="secondary"
                      size="sm"
                      icon={MessageCircle}
                      className="flex-1 md:flex-none"
                    >
                      WhatsApp
                    </ButtonAnchor>
                  </div>
                </div>

                {open && (
                  <div className="space-y-4 border-t border-border px-4 py-4 md:ps-5">
                    <DescriptionList
                      items={[
                        { label: "Phone", value: request.driverPhoneFormatted, mono: true },
                        {
                          label: "Sent to WhatsApp",
                          value: <DeliveryBadge delivery={request.delivery} />,
                        },
                      ]}
                    />
                    {request.notes && (
                      <blockquote className="whitespace-pre-line border-s-2 border-border ps-3 text-sm italic leading-relaxed text-foreground">
                        {request.notes}
                      </blockquote>
                    )}
                    {request.declineReason && (
                      <p className="text-[13px] text-muted-foreground">
                        Declined: {request.declineReason}
                      </p>
                    )}
                    {/* Only the moves this request can actually make. */}
                    <div className="flex flex-wrap gap-2">
                      {request.status === "new" && (
                        <Button variant="secondary" onClick={() => move(request, "contacted")}>
                          Mark contacted
                        </Button>
                      )}
                      {(request.status === "new" || request.status === "contacted") && (
                        <Button variant="primary" onClick={() => move(request, "accepted")}>
                          Accept
                        </Button>
                      )}
                      {(request.status === "contacted" || request.status === "accepted") && (
                        <Button variant="secondary" onClick={() => move(request, "completed")}>
                          Mark done
                        </Button>
                      )}
                      {!["completed", "declined", "cancelled"].includes(request.status) && (
                        <Button variant="danger-outline" onClick={() => setDeclining(request)}>
                          Decline
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && data.meta.total > 0 && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          pageSize={20}
          onChange={setPage}
          labels={{ prev: "Newer", next: "Older" }}
          noun="requests"
        />
      )}

      <ConfirmDialog
        open={Boolean(declining)}
        onClose={() => setDeclining(null)}
        title={`Decline ${declining?.driverName ?? "this"}'s request?`}
        confirmLabel="Decline"
        busy={setBookingStatus.isPending}
        onConfirm={(reason) => declining && move(declining, "declined", reason)}
        reason={{
          label: "Why?",
          hint: "The customer sees this, so tell them something useful.",
          placeholder: "Fully booked that week — try us the following Monday.",
          multiline: true,
          minLength: 3,
        }}
      />
    </div>
  );
}
