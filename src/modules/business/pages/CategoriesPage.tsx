import { Link } from "react-router-dom";
import { useFacets } from "../hooks/useBusinesses";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { ServiceTile } from "@/shared/components/ServiceTile";
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
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">Browse by service</h1>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {facets.map((f) => (
              <ServiceTile
                key={f.slug}
                slug={f.slug}
                name={f.name}
                icon={f.icon}
                count={f.count}
                to={`/search?category=${f.slug}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
