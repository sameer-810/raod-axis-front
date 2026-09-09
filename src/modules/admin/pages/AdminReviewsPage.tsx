import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareQuote, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/EmptyState";
import { Sheet } from "@/shared/components/Sheet";
import { Badge } from "@/shared/components/Badge";
import { formatDateTime } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { StarDisplay } from "@/modules/review/components/StarRating";
import { useAllReviews, useRemoveReview } from "@/modules/review/hooks/useReviews";
import type { AdminReview } from "@/modules/review/types";

/**
 * Review moderation — FR-SOC-05.
 *
 * Removal is soft, requires a reason and is written to the audit log. All three
 * are the same decision: the person who wrote the review will ask why it went,
 * and "an administrator removed it" with no record is an answer nobody can give.
 */
export function AdminReviewsPage() {
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useAllReviews({ includeRemoved, page });
  const remove = useRemoveReview();

  const items = data?.items ?? [];

  async function confirm() {
    if (!target) return;
    try {
      await remove.mutateAsync({ id: target.id, reason: reason.trim() });
      toast.success("Review removed");
      setTarget(null);
      setReason("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="ra-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Reviews
          </h1>
          <p className="text-sm text-muted-foreground">
            What drivers have said, and what has been taken down.
          </p>
        </div>
        <label className="ra-tap flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
          <input
            type="checkbox"
            checked={includeRemoved}
            onChange={(e) => {
              setIncludeRemoved(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Show removed
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="No reviews yet"
          description="Ratings left by drivers will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((review) => (
            <li key={review.id} className={cn("ra-panel p-4", review.isRemoved && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StarDisplay rating={review.rating} />
                <span className="text-sm font-medium text-foreground">{review.driverName}</span>
                {review.fromContact && (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Contacted this business
                  </span>
                )}
                {review.isRemoved && <Badge tone="destructive">Removed</Badge>}
                <span className="ms-auto font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(review.createdAt)}
                </span>
              </div>

              {review.business?.slug && (
                <p className="mt-1 text-sm text-muted-foreground">
                  on{" "}
                  <Link to={`/business/${review.business.slug}`} className="hover:underline">
                    {review.business.name}
                  </Link>
                </p>
              )}

              {review.text && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {review.text}
                </p>
              )}

              {review.isRemoved ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Removed {formatDateTime(review.removedAt)} — {review.removedReason}
                </p>
              ) : (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTarget(review)}
                    className="ra-tap rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="ra-tap rounded-lg border border-border px-4 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={!data.meta.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="ra-tap rounded-lg border border-border px-4 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      <Sheet
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (open) return;
          setTarget(null);
          setReason("");
        }}
        title="Remove this review"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            It stops appearing on the business's profile and the rating is recalculated without it.
            Nothing is deleted — the record and your reason are kept.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="remove-reason" className="block text-sm font-medium text-foreground">
              Why is it being removed?
            </label>
            <textarea
              id="remove-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Names a member of staff"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {/* The author will ask. "Abusive" is enough; nothing is not. */}
            <p className="text-xs text-muted-foreground">
              At least a few words. This is what the audit log records.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="ra-tap rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={reason.trim().length < 5 || remove.isPending}
              className="ra-tap rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {remove.isPending ? "Removing…" : "Remove review"}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
