import { useState } from "react";
import { RefreshCw, MessageSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { StatCard } from "@/shared/components/StatCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatAge, formatDateTime } from "@/shared/lib/format";
import { DeliveryBadge } from "@/modules/booking/components/StatusBadge";
import {
  useDeliveryStats,
  useRetryDelivery,
  useWhatsAppLogs,
} from "@/modules/booking/hooks/useBookings";

const STATES = [
  { value: "", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "read", label: "Read" },
  { value: "sent", label: "Sent" },
  { value: "queued", label: "Sending" },
  { value: "failed", label: "Failed" },
  { value: "deep_link", label: "Not tracked" },
];

/**
 * The delivery log — FR-WAP-03 and FR-WAP-06.
 *
 * The whole of the ">98% delivery" measure in PRD §6, and the screen that has to
 * be honest about when it cannot answer. In deep-link mode nothing is sent by
 * us at all, so those rows say "not tracked" and are counted separately from
 * both success and failure — averaging them in either direction would make the
 * headline figure meaningless.
 */
export function AdminWhatsAppLogsPage() {
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useWhatsAppLogs({ state, page });
  const { data: stats } = useDeliveryStats();
  const retry = useRetryDelivery();

  const items = data?.items ?? [];

  async function resend(id: string) {
    try {
      await retry.mutateAsync(id);
      toast.success("Message re-sent");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="ra-page">
      <div>
        <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
          WhatsApp logs
        </h1>
        <p className="text-sm text-muted-foreground">
          Every attempt to put a booking request on a business's phone.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Delivery rate"
          // Null, not 100%, when nothing is trackable — a rate computed from no
          // data is not a rate, and showing a confident number here would be
          // the exact failure this screen exists to prevent.
          value={
            stats?.deliveryRate === null || stats?.deliveryRate === undefined
              ? "—"
              : `${stats.deliveryRate}%`
          }
          hint={
            stats?.tracked ? `of ${stats.tracked} trackable` : "Nothing trackable yet — see below"
          }
          tone={
            stats?.deliveryRate !== null &&
            stats?.deliveryRate !== undefined &&
            stats.deliveryRate < 98
              ? "warning"
              : "neutral"
          }
        />
        <StatCard
          label="Failed"
          value={stats?.byState?.failed ?? 0}
          hint="Can be re-sent"
          tone={stats?.byState?.failed ? "destructive" : "neutral"}
        />
        <StatCard
          label="Not tracked"
          value={stats?.untracked ?? 0}
          hint="Sent from the driver's own device"
        />
      </div>

      {/*
        The most important sentence on the page when it applies. Without Cloud
        API credentials the delivery figure above is not a low number — it is no
        number, and an administrator has to know which they are looking at.
      */}
      {(stats?.untracked ?? 0) > 0 && stats?.tracked === 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span className="text-foreground">
            RoadAxis is running in deep-link mode: booking requests are opened from the driver's own
            WhatsApp, so delivery can't be observed. Connect the WhatsApp Business Cloud API to
            measure it.
          </span>
        </p>
      )}

      <div className="ra-chips" role="group" aria-label="Filter by delivery state">
        {STATES.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              setState(s.value);
              setPage(1);
            }}
            aria-pressed={state === s.value}
            className="ra-chip"
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="ra-panel px-4 py-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nothing here"
          description="Delivery attempts appear as booking requests are sent."
        />
      ) : (
        <ul className="ra-panel divide-y divide-border">
          {items.map((log) => (
            <li key={log.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono tabular-nums text-foreground">
                      {log.reference ?? "—"}
                    </span>
                    <DeliveryBadge delivery={log.delivery} />
                    {log.usedFallback && (
                      <span className="text-xs text-warning">via fallback number</span>
                    )}
                    {log.isRetry && <span className="text-xs text-muted-foreground">re-sent</span>}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {log.business?.name} · {log.toLabel ?? "—"}{" "}
                    <span className="font-mono tabular-nums">{log.to}</span>
                  </p>
                  {log.error && <p className="mt-1 text-xs text-destructive">{log.error}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="font-mono text-xs tabular-nums text-muted-foreground"
                    title={formatDateTime(log.createdAt)}
                  >
                    {formatAge(log.createdAt)}
                  </span>
                  {/* A new row rather than a mutation of this one — the first
                      attempt did happen, and deleting the evidence would make
                      the delivery rate look better than it was. */}
                  {log.delivery.state === "failed" && (
                    <button
                      type="button"
                      onClick={() => resend(log.id)}
                      disabled={retry.isPending}
                      aria-label={`Re-send ${log.reference}`}
                      title="Re-send"
                      className={cn(
                        "ra-tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        retry.isPending && "opacity-60",
                      )}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
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
    </div>
  );
}
