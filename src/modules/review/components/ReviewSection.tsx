import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquareQuote, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { formatDate } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { EmptyState } from "@/shared/components/EmptyState";
import { StarDisplay, StarInput } from "./StarRating";
import { useBusinessReviews, useMyReview, useSubmitReview } from "../hooks/useReviews";

/**
 * Reviews on a business profile — FR-SOC-01 … FR-SOC-04.
 *
 * The form sits above the list, not below it. Somebody who has decided to leave
 * a review has to scroll past everyone else's to find where to do it otherwise,
 * and the number of people who make that journey is much smaller than the number
 * who would have written something.
 *
 * Reading is open to guests, in line with the rest of the public product; only
 * writing needs an account, and the prompt to sign in explains why rather than
 * simply refusing.
 */
export function ReviewSection({
  businessId,
  businessName,
  averageRating,
  reviewCount,
}: {
  businessId: string;
  businessName: string;
  averageRating: number | null;
  reviewCount: number;
}) {
  const { isSignedIn, user } = useAuth();
  const canWrite = isSignedIn && user?.role === "driver";

  const { data, isLoading } = useBusinessReviews(businessId);
  const { data: mine } = useMyReview(businessId, canWrite);

  return (
    <section aria-labelledby="reviews" className="scroll-mt-20" id="reviews-section">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reviews" className="text-base font-semibold text-foreground">
          Reviews
        </h2>
        {reviewCount > 0 && averageRating !== null && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <StarDisplay rating={Math.round(averageRating)} />
            <span className="font-mono tabular-nums text-foreground">
              {averageRating.toFixed(1)}
            </span>
            <span className="font-mono tabular-nums">
              from {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </span>
          </p>
        )}
      </div>

      {canWrite ? (
        <ReviewForm businessId={businessId} existing={mine ?? null} />
      ) : (
        <SignInPrompt signedIn={isSignedIn} businessName={businessName} />
      )}

      <div className="mt-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading reviews…</p>
        ) : data && data.items.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.items.map((review) => (
              <li key={review.id} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StarDisplay rating={review.rating} />
                  <span className="text-sm font-medium text-foreground">{review.driverName}</span>
                  {/*
                    FR-SOC-04, and it says exactly what it knows. Not "Verified":
                    a driver who phoned the number on the listing had a real visit
                    too, and calling one verified implies the other is not.
                  */}
                  {review.fromContact && (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Contacted this business
                    </span>
                  )}
                  <span className="ms-auto font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </span>
                </div>
                {review.text && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {review.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MessageSquareQuote}
            title="No reviews yet"
            description={`Nobody has rated ${businessName} through RoadAxis. If you have used them, yours would be the first.`}
          />
        )}
      </div>
    </section>
  );
}

/**
 * The form. Stars are required; words are not.
 *
 * That is the whole design. Most people will give a rating and nothing else, and
 * a form that insists on a paragraph collects far fewer of both — the star is
 * one tap and the text box is a decision about how much time to spend.
 */
function ReviewForm({
  businessId,
  existing,
}: {
  businessId: string;
  existing: { id: string; rating: number; text: string | null } | null;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const submit = useSubmitReview(businessId);

  // Pre-fill once their existing review arrives, so editing starts from what
  // they actually said rather than from a blank form.
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setText(existing.text ?? "");
    }
  }, [existing]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) {
      toast.error("Choose between 1 and 5 stars");
      return;
    }
    submit.mutate(
      { rating, text: text.trim() || undefined },
      {
        onSuccess: (res) => toast.success(res.message),
        onError: () => toast.error("We couldn't save that. Try again in a moment."),
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="ra-tile mt-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          {existing ? "Your review" : "Rate this business"}
        </p>
        <div className="mt-2">
          <StarInput value={rating} onChange={setRating} disabled={submit.isPending} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="review-text" className="block text-sm font-medium text-foreground">
          Anything to add? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="review-text"
          value={text}
          maxLength={1000}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          placeholder="What was the work, and how did it go?"
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Said plainly, because a second submission silently replacing the
            first would look like the review had vanished. */}
        <p className="text-xs text-muted-foreground">
          {existing ? "Saving replaces your earlier review." : "You can change this later."}
        </p>
        <button
          type="submit"
          disabled={submit.isPending}
          className="ra-tap shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {submit.isPending ? "Saving…" : existing ? "Update review" : "Post review"}
        </button>
      </div>
    </form>
  );
}

/**
 * Why an account is needed, and a way back to this exact page afterwards.
 *
 * "Sign in to continue" with no explanation and no return journey is where
 * people leave. An owner or administrator sees a different line: they are signed
 * in, so refusing them without saying why would read as a fault.
 */
function SignInPrompt({ signedIn, businessName }: { signedIn: boolean; businessName: string }) {
  const location = useLocation();

  if (signedIn) {
    return (
      <p className="ra-tile mt-4 text-sm text-muted-foreground">
        Reviews are left by drivers. Your account manages listings rather than using them.
      </p>
    );
  }

  return (
    <div className="ra-tile mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Sign in to rate {businessName}. It takes a code sent to your phone.
      </p>
      <Link
        // The return journey travels in the URL, the same way every other
        // sign-in detour in the product does — so it survives the page reload a
        // 401 interceptor can cause.
        to={`/sign-in?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        className="ra-tap flex shrink-0 items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
      >
        Sign in to review
      </Link>
    </div>
  );
}
