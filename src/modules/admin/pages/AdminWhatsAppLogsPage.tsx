import { useState } from "react";
import { RefreshCw, MessageSquare, AlertTriangle, Eye } from "lucide-react";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Stat, StatGroup } from "@/shared/components/StatGroup";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageHeader } from "@/shared/components/PageHeader";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { DataTable, DensityToggle, type Column } from "@/shared/components/DataTable";
import { Pagination } from "@/shared/components/Pagination";
import { Drawer } from "@/shared/components/Drawer";
import { Button } from "@/shared/components/Button";
import { DescriptionList } from "@/shared/components/SectionCard";
import { Timeline } from "@/shared/components/Timeline";
import { RowMenu } from "@/shared/components/Menu";
import { useDensity } from "@/shared/hooks/useDensity";
import { formatAge, formatDateTime } from "@/shared/lib/format";
import { DeliveryBadge } from "@/modules/booking/components/StatusBadge";
import {
  useDeliveryStats,
  useRetryDelivery,
  useWhatsAppLogs,
} from "@/modules/booking/hooks/useBookings";
import type { WhatsAppLogEntry } from "@/modules/booking/types";

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
 * The delivery log — FR-WAP-03 and FR-WAP-06. The whole of the ">98% delivery"
 * measure, and it has to be honest about when it cannot answer: deep-link rows
 * say "not tracked" and are counted separately from success and failure.
 */
export function AdminWhatsAppLogsPage() {
  const [density, setDensity] = useDensity();
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<WhatsAppLogEntry | null>(null);
  const { data, isLoading } = useWhatsAppLogs({ state, page });
  const { data: stats } = useDeliveryStats();
  const retry = useRetryDelivery();
  const items = data?.items ?? [];

  async function resend(log: WhatsAppLogEntry) {
    try {
      await retry.mutateAsync(log.id);
      toast.success(`${log.reference ?? "Message"} re-sent`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const rowActions = (log: WhatsAppLogEntry) => [
    { label: "View attempt", icon: Eye, onSelect: () => setOpen(log) },
    ...(log.delivery.state === "failed"
      ? [{ label: "Re-send", icon: RefreshCw, onSelect: () => void resend(log) }]
      : []),
  ];

  const columns: Column<WhatsAppLogEntry>[] = [
    {
      key: "reference",
      header: "Reference",
      cell: (log) => (
        <span className="font-mono text-[13px] tabular-nums text-foreground">
          {log.reference ?? "—"}
        </span>
      ),
    },
    {
      key: "state",
      header: "Delivery",
      cell: (log) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <DeliveryBadge delivery={log.delivery} />
          {log.usedFallback && <span className="text-xs text-warning-text">via fallback</span>}
          {log.isRetry && <span className="text-xs text-muted-foreground">re-sent</span>}
        </span>
      ),
    },
    {
      key: "business",
      header: "Business",
      cell: (log) => <span className="text-foreground">{log.business?.name ?? "—"}</span>,
    },
    {
      key: "to",
      header: "To",
      hideBelow: "lg",
      cell: (log) => (
        <span className="text-muted-foreground">
          {log.toLabel ?? "—"} <span className="ms-1 font-mono text-xs tabular-nums">{log.to}</span>
        </span>
      ),
    },
    {
      key: "at",
      header: "Sent",
      align: "end",
      cell: (log) => (
        <span className="text-xs text-muted-foreground" title={formatDateTime(log.createdAt)}>
          {formatAge(log.createdAt)}
        </span>
      ),
    },
  ];

  const deliveryTone =
    stats?.deliveryRate !== null && stats?.deliveryRate !== undefined && stats.deliveryRate < 98
      ? "warning"
      : "neutral";

  return (
    <div className="ra-page">
      <PageHeader
        title="WhatsApp logs"
        description="Every attempt to put a booking request on a business's phone, and what Meta said happened to it."
        actions={<DensityToggle density={density} onChange={setDensity} />}
      />

      <StatGroup columns={3}>
        <Stat
          label="Delivery rate"
          // Null, not 100%, when nothing is trackable — a rate from no data is not a rate.
          value={
            stats?.deliveryRate === null || stats?.deliveryRate === undefined
              ? "—"
              : `${stats.deliveryRate}%`
          }
          hint={
            stats?.tracked ? `of ${stats.tracked} trackable` : "Nothing trackable yet — see below"
          }
          tone={deliveryTone}
        />
        <Stat
          label="Failed"
          value={stats?.byState?.failed ?? 0}
          hint="Can be re-sent"
          tone={stats?.byState?.failed ? "destructive" : "neutral"}
        />
        <Stat
          label="Not tracked"
          value={stats?.untracked ?? 0}
          hint="Sent from the driver's own device"
        />
      </StatGroup>

      {/* The most important sentence on the page when it applies. */}
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

      <div className="-mx-4 overflow-x-auto px-4 pb-0.5 md:mx-0 md:px-0">
        <SegmentedControl
          label="Filter by delivery state"
          options={STATES}
          value={state}
          onChange={(v) => {
            setState(v);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        label="Delivery attempts"
        rows={items}
        columns={columns}
        rowKey={(log) => log.id}
        loading={isLoading}
        density={density}
        onRowClick={setOpen}
        rowActions={rowActions}
        rowActionsLabel={(log) => `Actions for ${log.reference ?? "attempt"}`}
        rowTone={(log) => (log.delivery.state === "failed" ? "danger" : undefined)}
        empty={
          <EmptyState
            inline
            icon={MessageSquare}
            title="Nothing here"
            description={
              state
                ? "No attempts in this state."
                : "Delivery attempts appear as booking requests are sent."
            }
          />
        }
        mobileRow={(log) => (
          <div className="ra-card p-3.5">
            <button
              type="button"
              onClick={() => setOpen(log)}
              className="ra-tap ra-focus block w-full rounded text-start"
            >
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono tabular-nums text-foreground">
                  {log.reference ?? "—"}
                </span>
                <DeliveryBadge delivery={log.delivery} />
              </p>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">
                {log.business?.name} · {log.toLabel ?? "—"}{" "}
                <span className="font-mono tabular-nums">{log.to}</span>
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                {formatAge(log.createdAt)}
              </p>
            </button>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              {log.delivery.state === "failed" && (
                <Button
                  size="md"
                  variant="secondary"
                  icon={RefreshCw}
                  loading={retry.isPending}
                  onClick={() => void resend(log)}
                >
                  Re-send
                </Button>
              )}
              <RowMenu
                items={rowActions(log)}
                label={`Actions for ${log.reference ?? "attempt"}`}
                size="md"
                variant="secondary"
              />
            </div>
          </div>
        )}
        footer={
          data && (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              pageSize={30}
              onChange={setPage}
              labels={{ prev: "Newer", next: "Older" }}
              noun="attempts"
            />
          )
        }
      />

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.reference ?? "Delivery attempt"}
        subtitle={open?.business?.name ?? undefined}
        header={open && <DeliveryBadge delivery={open.delivery} />}
        footer={
          open?.delivery.state === "failed" ? (
            <Button
              variant="primary"
              icon={RefreshCw}
              loading={retry.isPending}
              onClick={() => open && void resend(open)}
            >
              Re-send now
            </Button>
          ) : undefined
        }
      >
        {open && (
          <div className="space-y-5">
            <DescriptionList
              items={[
                { label: "Sent to", value: `${open.toLabel ?? "—"} · ${open.to}`, mono: true },
                {
                  label: "Channel",
                  value:
                    open.channel === "cloud_api"
                      ? "WhatsApp Cloud API"
                      : "Deep link (driver's device)",
                },
                {
                  label: "Attempt",
                  value: `#${open.attempt}${open.isRetry ? " · re-send" : ""}`,
                  mono: true,
                },
                { label: "Created", value: formatDateTime(open.createdAt), mono: true },
              ]}
            />
            {open.usedFallback && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-foreground">
                Sent to the fallback number — the Primary was switched off at the time.
              </p>
            )}
            {open.error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
                {open.error}
              </p>
            )}
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                What Meta reported
              </h3>
              {open.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status updates yet.</p>
              ) : (
                <Timeline
                  groups={[
                    {
                      label: "History",
                      entries: open.history.map((h, i) => ({
                        id: `${h.at}-${i}`,
                        title: <span className="capitalize">{h.state.replace("_", " ")}</span>,
                        meta: formatDateTime(h.at),
                        body: h.detail ? (
                          <p className="text-xs text-muted-foreground">{h.detail}</p>
                        ) : undefined,
                        tone:
                          h.state === "failed"
                            ? "destructive"
                            : h.state === "delivered" || h.state === "read"
                              ? "success"
                              : "neutral",
                      })),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
