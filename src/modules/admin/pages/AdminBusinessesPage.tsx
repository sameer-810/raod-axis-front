import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Ban, RotateCcw, Pencil, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { RecordCard } from "@/shared/components/RecordCard";
import { Fab } from "@/shared/components/Fab";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { formatDate } from "@/shared/lib/format";
import { useAdminBusinesses, useSetBusinessStatus } from "../hooks/useAdmin";
import type { BusinessCard } from "@/modules/business/types";

/**
 * The directory, as an administrator sees it.
 *
 * The one screen that shows all three states at once — visibility, ownership and
 * trust — because they are independent and the interesting records are the ones
 * where they disagree: a live listing nobody has claimed in six weeks, a claimed
 * listing that was never verified.
 */
export function AdminBusinessesPage() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "live" | "suspended">("");
  const [claimStatus, setClaimStatus] = useState<"" | "unclaimed" | "pending" | "claimed">("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<BusinessCard | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useAdminBusinesses({
    search,
    status: status || undefined,
    claimStatus: claimStatus || undefined,
    page,
  });
  const setBusinessStatus = useSetBusinessStatus();

  const items = data?.items ?? [];

  async function suspend() {
    if (!confirm) return;
    try {
      await setBusinessStatus.mutateAsync({ id: confirm.id, status: "suspended", reason });
      toast.success(`${confirm.name} suspended`);
      setConfirm(null);
      setReason("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function restore(business: BusinessCard) {
    try {
      await setBusinessStatus.mutateAsync({ id: business.id, status: "live" });
      toast.success(`${business.name} is live again`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="ra-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Businesses
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{data?.meta.total ?? 0}</span> listings
          </p>
        </div>
        <Link
          to="/admin/businesses/new"
          className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:flex"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New listing
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            type="search"
            placeholder="Search by name, city or postcode"
            aria-label="Search listings"
            className="h-11 w-full rounded-lg border border-input bg-card ps-9 pe-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <label className="sr-only" htmlFor="status">
          Visibility
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All visibility</option>
          <option value="live">Live</option>
          <option value="draft">Draft</option>
          <option value="suspended">Suspended</option>
        </select>
        <label className="sr-only" htmlFor="claim">
          Ownership
        </label>
        <select
          id="claim"
          value={claimStatus}
          onChange={(e) => {
            setClaimStatus(e.target.value as typeof claimStatus);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All ownership</option>
          <option value="unclaimed">Unclaimed</option>
          <option value="pending">Claim pending</option>
          <option value="claimed">Claimed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="ra-panel px-4 py-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No listings match"
          description="Try a different search, or clear the filters."
        />
      ) : isMobile ? (
        <div className="space-y-2">
          {items.map((b) => (
            <RecordCard
              key={b.id}
              title={b.name}
              to={`/admin/businesses/${b.id}`}
              meta={[b.address.city, b.categories.map((c) => c.name).join(", ")]}
              badge={<StatusBadges business={b} />}
            />
          ))}
        </div>
      ) : (
        <div className="ra-panel max-h-[calc(100vh-20rem)] min-h-[20rem] overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="ra-thead">
              <tr className="border-b border-border">
                {["Business", "Location", "Categories", "State", "Listed", ""].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-4 py-2.5 text-start text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((b) => (
                <tr key={b.id} className="transition-colors hover:bg-accent/40">
                  {/* The anchor column: which record am I looking at. */}
                  <td className="px-4 py-2">
                    <Link
                      to={`/admin/businesses/${b.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {b.address.city}
                    {b.address.postcode ? ` · ${b.address.postcode}` : ""}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-muted-foreground">
                    {b.categories.map((c) => c.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadges business={b} />
                  </td>
                  {/* How long it has been sitting unclaimed is the number this
                      screen exists to surface — PRD §6 targets 80% claimed
                      within 30 days of listing. */}
                  <td className="px-4 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDate(b.listedAt) || "—"}
                  </td>
                  {/* Actions last, after the data you read in order to decide. */}
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/business/${b.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${b.name} on the public site`}
                        title="View public page"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Link
                        to={`/admin/businesses/${b.id}`}
                        aria-label={`Edit ${b.name}`}
                        title="Edit"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      {/* Quiet until hover. Fifty rows of filled red trains
                          people to stop seeing red as dangerous. */}
                      <button
                        type="button"
                        onClick={() => setConfirm(b)}
                        aria-label={`Suspend ${b.name}`}
                        title="Suspend"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => restore(b)}
                        aria-label={`Restore ${b.name}`}
                        title="Restore"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <button
            type="button"
            disabled={!data.meta.hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="ra-tap rounded-lg px-3 font-medium text-muted-foreground disabled:opacity-40"
          >
            Previous
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
            Next
          </button>
        </div>
      )}

      <Fab label="New listing" onClick={() => (window.location.href = "/admin/businesses/new")} />

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="ra-overlay w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-foreground">Suspend {confirm.name}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It disappears from public search immediately. Nothing is deleted.
            </p>
            <label htmlFor="reason" className="mt-4 block text-sm font-medium text-foreground">
              Reason
            </label>
            <input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reported as a fake listing"
              className="mt-1.5 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  setReason("");
                }}
                className="ra-tap rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={suspend}
                className="ra-tap rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The three states, and only the ones worth saying.
 *
 * `live` and `claimed` are the ordinary case and get no badge — a screen where
 * every row is decorated has no signal in it. Only the exceptions are marked.
 */
function StatusBadges({ business }: { business: BusinessCard }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1")}>
      {business.isVerified && <Badge tone="success">Verified</Badge>}
      {business.claimStatus === "unclaimed" && <Badge>Unclaimed</Badge>}
      {business.claimStatus === "pending" && <Badge tone="warning">Claim pending</Badge>}
    </div>
  );
}
