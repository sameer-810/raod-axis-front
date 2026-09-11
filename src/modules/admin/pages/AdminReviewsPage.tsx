import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareQuote, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/EmptyState";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { Pagination } from "@/shared/components/Pagination";
import { ConfirmDialog } from "@/shared/components/Dialog";
import { Skeleton } from "@/shared/components/Skeleton";
import { formatDateTime } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { StarDisplay } from "@/modules/review/components/StarRating";
import { useAllReviews, useRemoveReview } from "@/modules/review/hooks/useReviews";
import type { AdminReview } from "@/modules/review/types";

/**
 * Review moderation — FR-SOC-05. A list rather than a table, because the
 * content is prose: what somebody wrote is the thing being judged, and a
 * truncated cell hides exactly that.
 *
 * Removal is soft, requires a reason and is audited: the person who wrote it
 * will ask why it went.
 */
export function AdminReviewsPage() {
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminReview | null>(null);

  const { data, isLoading } = useAllReviews({ includeRemoved, page });
  const remove = useRemoveReview();
  const items = data?.items ?? [];

  async function confirm(reason: string) {
    if (!target) return;
    try {
      await remove.mutateAsync({ id: target.id, reason });
      toast.success("Review removed");
      setTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="ra-page">
      <PageHeader
        title="Reviews"
        description="What drivers have said about listings, newest first, and what has been taken down."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{data?.meta.total ?? 0}</span>{" "}
            reviews
          </span>
        }
        actions={
          <label className="ra-control inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-accent">
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
        }
      />

      {isLoading ? (
        <ul className="ra-panel divide-y divide-border" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-3/4" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="No reviews yet"
          description="Ratings left by drivers appear here as they are posted."
        />
      ) : (
        <ul className="ra-panel divide-y divide-border">
          {items.map((review) => (
            <li
              key={review.id}
              className={cn("px-4 py-4 md:px-5", review.isRemoved && "bg-surface-2")}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-2">
                  <StarDisplay rating={review.rating} />
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    review.isRemoved ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {review.driverName}
                </span>
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
                <p className="mt-1 text-[13px] text-muted-foreground">
                  on{" "}
                  <Link
                    to={`/business/${review.business.slug}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {review.business.name}
                  </Link>
                </p>
              )}

              {review.text && (
                <p
                  className={cn(
                    "mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed",
                    review.isRemoved ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {review.text}
                </p>
              )}

              {review.isRemoved ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Removed {formatDateTime(review.removedAt)} — {review.removedReason}
                </p>
              ) : (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setTarget(review)}>
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.total > 0 && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          pageSize={20}
          onChange={setPage}
          noun="reviews"
        />
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Remove this review"
        description="It stops appearing on the business's profile and the rating is recalculated without it. Nothing is deleted — the record and your reason are kept."
        confirmLabel="Remove review"
        busy={remove.isPending}
        onConfirm={confirm}
        reason={{
          label: "Why is it being removed?",
          placeholder: "Names a member of staff",
          hint: "At least a few words. This is what the audit log records.",
          minLength: 5,
          multiline: true,
        }}
      />
    </div>
  );
}
