import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "@/shared/components/EmptyState";
import { useSeo } from "@/shared/hooks/useSeo";

export function NotFoundPage() {
  // A single-page app answers every address with 200, so this is the only way
  // to tell a crawler that an address which does not exist should not be kept.
  useSeo({ title: "Page not found", noIndex: true });

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState
        icon={Compass}
        title="That page doesn't exist"
        description="The link may be out of date, or the business may have been removed."
        action={
          <>
            <Link
              to="/search"
              className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Find a service
            </Link>
            <Link
              to="/"
              className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              Home
            </Link>
          </>
        }
      />
    </div>
  );
}
