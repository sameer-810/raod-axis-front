import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useFacets } from "../hooks/useBusinesses";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { CategoryIcon } from "@/shared/components/CategoryIcon";
import { useSeo } from "@/shared/hooks/useSeo";

/**
 * Browse by service. Built from the *facets* rather than the category list, so
 * every tile carries a real count and a category nobody is listed under does not
 * appear — a grid of categories leading to empty results is the fastest way to
 * teach someone the directory is empty.
 */
export function CategoriesPage() {
  const { data: facets, isLoading } = useFacets();

  useSeo({
    title: "Browse by service",
    description:
      "Every automotive service listed on RoadAxis — tyres, brakes, servicing, recovery, mobile fitting and more, with how many businesses offer each.",
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="ra-shell py-6 md:py-10">
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
          /*
            The same tile as the home page, at a larger size. One component's
            worth of design used twice rather than two near-identical grids.
          */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {facets.map((f) => (
              <Link
                key={f.slug}
                to={`/search?category=${f.slug}`}
                className="ra-card group flex items-center gap-3.5 p-4 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="ra-service-icon">
                  <CategoryIcon name={f.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">
                    {f.name}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    <span className="font-mono tabular-nums">{f.count}</span>{" "}
                    {f.count === 1 ? "business" : "businesses"}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
