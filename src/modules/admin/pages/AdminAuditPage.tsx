import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { http } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageHeader } from "@/shared/components/PageHeader";
import { FilterBar, FilterSelect } from "@/shared/components/FilterBar";
import { Timeline, type TimelineEntry } from "@/shared/components/Timeline";
import { Pagination } from "@/shared/components/Pagination";
import { Avatar } from "@/shared/components/Avatar";
import { Skeleton } from "@/shared/components/Skeleton";
import { formatAge, formatDateTime } from "@/shared/lib/format";

interface AuditEntry {
  id: string;
  action: string;
  actor: { id: string | null; name: string; email: string | null; role: string | null };
  entity: { type: string; id: string | null; label: string | null };
  changes: Record<string, { from: unknown; to: unknown }> | null;
  reason: string | null;
  requestId: string | null;
  at: string;
}

/**
 * Actions whose consequences reach outside RoadAxis — who controls a listing, a
 * silenced phone, a business taken out of the directory. Marked so they stand
 * out; a log where every row is highlighted has no highlights.
 */
const CONSEQUENTIAL = new Set([
  "claim.approved",
  "claim.rejected",
  "business.suspended",
  "business.ownership_transferred",
  "whatsapp_number.deactivated",
  "whatsapp_number.removed",
  "user.deactivated",
]);

const ENTITY_TYPES = [
  { value: "", label: "All records" },
  { value: "business", label: "Businesses" },
  { value: "claim", label: "Claims" },
  { value: "user", label: "Accounts" },
  { value: "category", label: "Categories" },
];
const ACTIONS = [
  { value: "", label: "All actions" },
  { value: "claim.approved", label: "Claim approved" },
  { value: "claim.rejected", label: "Claim rejected" },
  { value: "business.suspended", label: "Business suspended" },
  { value: "business.ownership_transferred", label: "Ownership transferred" },
  { value: "whatsapp_number.deactivated", label: "Number switched off" },
  { value: "user.deactivated", label: "Account deactivated" },
];

/** "Today", "Yesterday", then the date. */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (same(d, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/**
 * The audit log — FR-ADM-08. Read-only by design: nothing writes, edits or
 * deletes an entry, because a log anybody can amend is not evidence.
 */
export function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", action, entityType, page],
    queryFn: async () => {
      const params: Record<string, string> = { limit: "50" };
      if (action) params.action = action;
      if (entityType) params.entityType = entityType;
      if (page > 1) params.page = String(page);
      const res = await http.get<{
        data: AuditEntry[];
        meta: {
          total: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
          page: number;
        };
      }>("/audit", { params });
      return { items: res.data.data, meta: res.data.meta };
    },
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];

  const groups = items.reduce<Array<{ label: string; entries: TimelineEntry[] }>>((acc, entry) => {
    const label = dayLabel(entry.at);
    let group = acc[acc.length - 1];
    if (!group || group.label !== label) {
      group = { label, entries: [] };
      acc.push(group);
    }
    const consequential = CONSEQUENTIAL.has(entry.action);
    group.entries.push({
      id: entry.id,
      tone: consequential ? "warning" : "neutral",
      marker: <Avatar name={entry.actor.name} size="md" className="ring-2 ring-card" />,
      title: (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{entry.actor.name}</span>
          {entry.actor.role && (
            <span className="text-xs capitalize text-muted-foreground">
              {entry.actor.role.replace("_", " ")}
            </span>
          )}
          <ActionBadge action={entry.action} />
          {entry.entity.label && (
            <span className="text-muted-foreground">
              on <span className="text-foreground">{entry.entity.label}</span>
            </span>
          )}
        </span>
      ),
      meta: <span title={formatDateTime(entry.at)}>{formatAge(entry.at)}</span>,
      body:
        entry.reason || (entry.changes && Object.keys(entry.changes).length > 0) ? (
          <div className="space-y-1.5">
            {entry.reason && (
              <blockquote className="border-s-2 border-border ps-3 text-[13px] italic text-foreground">
                {entry.reason}
              </blockquote>
            )}
            {entry.changes && Object.keys(entry.changes).length > 0 && (
              <dl className="flex flex-wrap gap-1.5">
                {Object.entries(entry.changes).map(([field, { from, to }]) => (
                  <div
                    key={field}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px]"
                  >
                    <dt className="text-muted-foreground">{field}</dt>
                    <dd className="flex items-center gap-1">
                      <span className="text-muted-foreground line-through">{render(from)}</span>
                      <span aria-hidden="true" className="text-muted-foreground">
                        →
                      </span>
                      <span className="text-foreground">{render(to)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : undefined,
    });
    return acc;
  }, []);

  return (
    <div className="ra-page">
      <PageHeader
        title="Audit log"
        description="Who did what, to which record, and what changed. Written by the system as things happen; nobody can edit it."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{data?.meta.total ?? 0}</span>{" "}
            entries · newest first
          </span>
        }
      />

      <FilterBar
        chips={[
          entityType && {
            key: "type",
            label: `Record: ${ENTITY_TYPES.find((e) => e.value === entityType)?.label}`,
            onRemove: () => {
              setEntityType("");
              setPage(1);
            },
          },
          action && {
            key: "action",
            label: `Action: ${ACTIONS.find((a) => a.value === action)?.label}`,
            onRemove: () => {
              setAction("");
              setPage(1);
            },
          },
        ].filter((c): c is { key: string; label: string; onRemove: () => void } => Boolean(c))}
        onClearAll={
          action || entityType
            ? () => {
                setAction("");
                setEntityType("");
                setPage(1);
              }
            : undefined
        }
      >
        <FilterSelect
          id="entity-type"
          label="Record type"
          value={entityType}
          onChange={(v) => {
            setEntityType(v);
            setPage(1);
          }}
          options={ENTITY_TYPES}
        />
        <FilterSelect
          id="action"
          label="Action"
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          options={ACTIONS}
        />
      </FilterBar>

      <div className="ra-panel p-4 md:p-6">
        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            inline
            icon={ScrollText}
            title="Nothing recorded yet"
            description={
              action || entityType
                ? "No entries match these filters."
                : "Administrative changes appear here as they happen."
            }
          />
        ) : (
          <Timeline groups={groups} />
        )}
      </div>

      {data && data.meta.total > 0 && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          pageSize={50}
          onChange={setPage}
          labels={{ prev: "Newer", next: "Older" }}
          noun="entries"
        />
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const label = action.replace(/[._]/g, " ");
  return CONSEQUENTIAL.has(action) ? <Badge tone="warning">{label}</Badge> : <Badge>{label}</Badge>;
}

/** `null` reads as an em dash; everything else as itself. */
function render(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}
