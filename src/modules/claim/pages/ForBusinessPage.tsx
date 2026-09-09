import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, MessageCircle, BadgeCheck, Navigation } from "lucide-react";
import { businessApi } from "@/modules/business/api/businessApi";
import { TrustRow } from "@/shared/components/TrustRow";
import { Badge } from "@/shared/components/Badge";
import type { BusinessCard } from "@/modules/business/types";

/**
 * The supply side of the marketplace.
 *
 * The most commercially important page in the product and the one the PRD's
 * own targets depend on: 80% of listings claimed within 30 days assumes owners
 * can *find* their listing. So this page leads with a search of the existing
 * directory rather than a registration form — most people arriving here are
 * already listed and do not know it, because an administrator seeded the
 * market before anyone signed up.
 *
 * Claiming is quicker for them and better for us than a duplicate somebody has
 * to merge later, so it is the path this page pushes.
 */
export function ForBusinessPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusinessCard[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { items } = await businessApi.search({ search: query });
      setResults(items);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-14">
      <div className="ra-public">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Get found by drivers near you.
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Free while we're building the network. Manage your own photos, opening hours and
            services, and take booking requests straight to WhatsApp.
          </p>
        </header>

        <section aria-labelledby="find-yours" className="ra-tile">
          <h2 id="find-yours" className="text-base font-semibold text-foreground">
            Start by finding your business
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We've already listed thousands of garages. If yours is here, claiming it is quicker
            than starting again.
          </p>

          <form onSubmit={search} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Your business name"
                aria-label="Your business name"
                className="h-12 w-full rounded-lg border border-input bg-card ps-9 pe-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="ra-tap flex items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
            >
              {searching ? "Searching…" : "Find it"}
            </button>
          </form>

          {results !== null && (
            <div className="mt-4">
              {results.length === 0 ? (
                <div className="rounded-lg border border-border px-4 py-6 text-center">
                  <p className="text-sm text-foreground">Not listed yet.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add it and we'll have you live within a working day.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/register-business")}
                    className="ra-tap mt-4 inline-flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Add my business
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.slice(0, 5).map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {b.name}
                          {b.claimStatus === "unclaimed" && <Badge className="ms-2">Unclaimed</Badge>}
                        </p>
                        <TrustRow
                          className="mt-1"
                          verified={b.isVerified}
                          averageRating={b.averageRating}
                          reviewCount={b.reviewCount}
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground">{b.address.city}</p>
                      </div>
                      {b.claimStatus === "unclaimed" ? (
                        <Link
                          to={`/business/${b.slug}/claim`}
                          className="ra-tap flex shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          This is mine
                        </Link>
                      ) : (
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {b.claimStatus === "pending" ? "Under review" : "Already claimed"}
                        </span>
                      )}
                    </li>
                  ))}
                  <li className="pt-1 text-center">
                    <Link
                      to="/register-business"
                      className="text-sm font-medium text-primary-text hover:underline"
                    >
                      None of these — add my business
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="what-you-get">
          <h2 id="what-you-get" className="text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
            What you get
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: BadgeCheck,
                title: "A verified badge",
                body: "We check ownership by hand. Drivers see the difference.",
              },
              {
                icon: MessageCircle,
                title: "Requests on WhatsApp",
                body: "Booking requests land on the number you already use.",
              },
              {
                icon: Navigation,
                title: "Found by distance",
                body: "You appear when someone nearby searches for what you do.",
              },
            ].map((s) => (
              <div key={s.title} className="ra-tile">
                <s.icon className="h-5 w-5 text-primary-text" aria-hidden="true" />
                <p className="mt-2.5 text-sm font-semibold text-foreground">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-sm text-muted-foreground">
          Already claimed your listing?{" "}
          <Link to="/staff/sign-in" className="font-medium text-primary-text hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
