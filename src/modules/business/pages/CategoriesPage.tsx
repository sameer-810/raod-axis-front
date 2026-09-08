import { Link } from "react-router-dom";
import { useFacets } from "../hooks/useBusinesses";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";

/**
 * Browse by service.
 *
 * Built from the *facets* rather than the category list, so every tile carries a
 * real count and a category nobody is listed under does not appear. A grid of
 * categories that lead to empty results is the fastest way to teach someone the
 * directory is empty — even when it is not.
 */
export function CategoriesPage() {
  const { data: facets, isLoading } = useFacets();

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <div className="ra-public">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Browse by service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every category with at least one business listed.
          </p>
        </header>

        {!facets || facets.length === 0 ? (
          <EmptyState
            title="Nothing listed yet"
            description="Businesses are being added. Try a search instead."
            action={
              <Link
                to="/search"
                className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Search
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facets.map((f) => (
              <Link
                key={f.slug}
                to={`/search?category=${f.slug}`}
                className="ra-card p-4 transition-colors hover:bg-accent/40"
              >
                <p className="text-sm font-semibold text-foreground">{f.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span className="font-mono tabular-nums">{f.count}</span>{" "}
                  {f.count === 1 ? "business" : "businesses"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
