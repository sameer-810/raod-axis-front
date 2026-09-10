import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { toast } from "@/shared/lib/toast";
import { useToggleFavourite } from "../hooks/useFavourites";

/**
 * The save a guest asked for, remembered across the sign-in detour.
 *
 * US-603: pressing save while signed out must ask for an account and then
 * *complete the save*, not return the driver to a page where they press the same
 * button again. The second tap is where people give up.
 *
 * `sessionStorage`, not Redux: the sign-in interceptor can reload the page, and
 * an intent that does not survive a reload does not survive the journey it exists
 * for. Scoped to the tab, and cleared the moment it is acted on.
 */
const PENDING_KEY = "roadaxis_pending_save";

function readPending(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    // Private browsing, or storage disabled. A forgotten intent is a second
    // tap, not a broken product.
    return null;
  }
}

function writePending(businessId: string | null) {
  try {
    if (businessId) window.sessionStorage.setItem(PENDING_KEY, businessId);
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* see above */
  }
}

/**
 * The ❤️ Save control — FR-SOC-06. Small, and the closest thing the MVP has to a
 * retention mechanism. Three decisions worth stating:
 *
 *  - **A guest sees it and can press it.** Hiding it until someone signs in means
 *    they never learn the feature exists; pressing it explains what it does and
 *    offers the sign-in.
 *  - **It stops the click reaching the card.** A business card is one big
 *    stretched link; without this, saving a garage navigates to it.
 *  - **The accessible name says what pressing it will do**, with `aria-pressed`
 *    carrying the state.
 */
export function SaveButton({
  businessId,
  businessName,
  isFavourite,
  variant = "icon",
  className,
}: {
  businessId: string;
  businessName: string;
  isFavourite?: boolean;
  variant?: "icon" | "labelled";
  className?: string;
}) {
  const { isSignedIn, user } = useAuth();
  const navigate = useNavigate();
  const toggle = useToggleFavourite();
  const saved = Boolean(isFavourite);

  /**
   * Finish what they started before signing in. Guarded by a ref as well as by
   * clearing the key, because this component is rendered once per card — without
   * it, returning to a search page fires one save per visible result.
   */
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current || !isSignedIn || user?.role !== "driver" || saved) return;
    if (readPending() !== businessId) return;

    claimed.current = true;
    writePending(null);
    toggle.mutate(
      { businessId, saved: false },
      { onSuccess: () => toast.success("Saved to My Garages") },
    );
  }, [businessId, isSignedIn, user?.role, saved, toggle]);

  const onClick = (event: React.MouseEvent) => {
    // The card around this is a stretched link. Without both of these, saving a
    // garage opens it.
    event.preventDefault();
    event.stopPropagation();

    if (!isSignedIn) {
      // Remembered, so they come back to a saved garage rather than to the same
      // button and a second decision.
      writePending(businessId);
      toast.info("Sign in to keep your garages in one place");
      navigate(
        `/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
      return;
    }
    if (user?.role !== "driver") {
      toast.info("My Garages is for drivers");
      return;
    }

    toggle.mutate(
      { businessId, saved },
      {
        onSuccess: () => toast.success(saved ? "Removed from My Garages" : "Saved to My Garages"),
        onError: () => toast.error("We couldn't save that. Try again in a moment."),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={
        saved ? `Remove ${businessName} from My Garages` : `Save ${businessName} to My Garages`
      }
      className={cn(
        "ra-tap relative z-10 flex items-center justify-center gap-2 rounded-lg transition-colors",
        variant === "icon"
          ? "w-11 border border-border bg-background/90 hover:bg-accent"
          : "border border-border px-4 text-sm font-medium hover:bg-accent",
        className,
      )}
    >
      <Heart
        className={cn("h-5 w-5", saved ? "fill-current text-destructive" : "text-muted-foreground")}
        aria-hidden="true"
      />
      {variant === "labelled" && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
