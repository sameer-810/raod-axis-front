import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "@/shared/components/EmptyState";

export function NotFoundPage() {
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
