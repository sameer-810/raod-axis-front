import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { http } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
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
 * Actions whose consequences reach outside RoadAxis.
 *
 * Marked so they stand out in a list that is otherwise mostly routine edits —
 * these are the ones that changed who controls a listing, silenced a phone, or
 * took a business out of the directory. Everything else stays neutral, because
 * a log where every row is highlighted has no highlights.
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

/**
 * The audit log — FR-ADM-08, and the mechanism PRD v1.1 asked for without
 * specifying.
 *
 * Read-only by design. There is no route that writes, edits or deletes an
 * entry; a log anybody can amend is not evidence of anything.
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
  });

  const items = data?.items ?? [];

  return (
    <div className="ra-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Audit log
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{data?.meta.total ?? 0}</span> entries · newest
            first
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="entity-type">
            Record type
          </label>
          <select
            id="entity-type"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All records</option>
            <option value="business">Businesses</option>
            <option value="claim">Claims</option>
            <option value="user">Accounts</option>
            <option value="category">Categories</option>
          </select>
          <label className="sr-only" htmlFor="action">
            Action
          </label>
          <select
            id="action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All actions</option>
            <option value="claim.approved">Claim approved</option>
            <option value="claim.rejected">Claim rejected</option>
            <option value="business.suspended">Business suspended</option>
            <option value="business.ownership_transferred">Ownership transferred</option>
            <option value="whatsapp_number.deactivated">Number switched off</option>
            <option value="user.deactivated">Account deactivated</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="ra-panel px-4 py-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nothing recorded yet"
          description="Administrative changes appear here as they happen."
        />
      ) : (
        <ul className="ra-panel divide-y divide-border">
          {items.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{entry.actor.name}</span>
                    {entry.actor.role && (
                      <span className="text-xs capitalize text-muted-foreground">
                        {entry.actor.role.replace("_", " ")}
                      </span>
                    )}
                    <ActionBadge action={entry.action} />
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {entry.entity.label ?? entry.entity.type}
                  </p>
                </div>
                <p
                  className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
                  title={formatDateTime(entry.at)}
                >
                  {formatAge(entry.at)}
                </p>
              </div>

              {entry.reason && (
                <p className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground">
                  {entry.reason}
                </p>
              )}

              {/* Only the fields that moved. A full snapshot of every record
                  would bury the line somebody is looking for. */}
              {entry.changes && Object.keys(entry.changes).length > 0 && (
                <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {Object.entries(entry.changes).map(([field, { from, to }]) => (
                    <div key={field} className="flex items-center gap-1.5">
                      <dt className="text-muted-foreground">{field}</dt>
                      <dd className="font-mono text-muted-foreground">
                        <span className="line-through">{render(from)}</span>{" "}
                        <span className="text-foreground">{render(to)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
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
