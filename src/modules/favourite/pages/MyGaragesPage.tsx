import { Link } from "react-router-dom";
import { Heart, Search } from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { BusinessCard } from "@/modules/business/components/BusinessCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageLoader } from "@/shared/components/PageLoader";
import { useSeo } from "@/shared/hooks/useSeo";
import { useFavourites } from "../hooks/useFavourites";

/**
 * My Garages — FR-SOC-06. The retention screen: a driver with three saved garages
 * has a reason to open RoadAxis next time something goes wrong; one with none has
 * a WhatsApp thread with the garage they used last.
 *
 * The empty state does the real work here. "Nothing saved" is a dead end; this
 * one says what saving is for and puts the way to start one tap away.
 */
export function MyGaragesPage() {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = useFavourites(isSignedIn);

  useSeo({
    title: "My Garages",
    description: "The garages and services you have saved on RoadAxis.",
    // Somebody's own saved list is not a page for a search engine.
    noIndex: true,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 md:py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Garages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.length
            ? `${data.length} saved place${data.length === 1 ? "" : "s"}.`
            : "Places you save appear here."}
        </p>
      </header>

      {data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on any business to keep it here — so the next time something goes wrong you already know who to ask."
          action={
            <Link
              to="/search"
              className="ra-tap flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Find a service
            </Link>
          }
        />
      )}
    </div>
  );
}
