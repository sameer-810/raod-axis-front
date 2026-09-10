import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, MessageCircle, BadgeCheck, Navigation, ArrowRight } from "lucide-react";
import { businessApi } from "@/modules/business/api/businessApi";
import { TrustRow } from "@/shared/components/TrustRow";
import { Badge } from "@/shared/components/Badge";
import { useSeo } from "@/shared/hooks/useSeo";
import type { BusinessCard } from "@/modules/business/types";

/**
 * The supply side of the marketplace, and the page the PRD's own target depends
 * on: 80% of listings claimed within 30 days assumes owners can *find* theirs.
 *
 * So it leads with a search of the existing directory rather than a registration
 * form — most people arriving here are already listed and do not know it, because
 * an administrator seeded the market before anyone signed up.
 */
export function ForBusinessPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusinessCard[] | null>(null);
  const [searching, setSearching] = useState(false);

  useSeo({
    title: "List your garage on RoadAxis",
    description:
      "Free while we build the network. Claim your existing listing or add your garage, manage your hours and photos, and take booking requests on WhatsApp.",
  });

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
    <div className="ra-shell py-8 md:py-14">
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        {/* ── The pitch ─────────────────────────────────────────────────── */}
        <header className="lg:sticky lg:top-24 lg:self-start">
          <p className="ra-eyebrow text-primary-text">For garages and workshops</p>
          <h1 className="mt-3 text-[2.1rem] font-bold leading-[1.05] text-foreground md:text-[2.75rem]">
            Get found by the drivers already near you.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Free while we're building the network. Manage your own photos, opening hours and
            services, and take booking requests straight to WhatsApp.
          </p>

          {/*
            An editorial list rather than three cards in a row — the same
            three facts, arranged like something written. Hairlines and a
            numeral carry the rhythm; there is no tinted circle for the icon
            to sit in.
          */}
          <ol className="mt-8 divide-y divide-border border-y border-border">
            {[
              {
                icon: BadgeCheck,
                title: "A verified badge",
                body: "We check ownership by hand. Drivers see the difference on every card.",
              },
              {
                icon: MessageCircle,
                title: "Requests on WhatsApp",
                body: "Booking requests land on the number you already answer.",
              },
              {
                icon: Navigation,
                title: "Found by distance",
                body: "You appear when someone nearby searches for what you do.",
              },
            ].map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 py-4">
                <span
                  className="font-mono text-lg font-medium tabular-nums text-primary-text"
                  aria-hidden="true"
                >
                  0{i + 1}
                </span>
                <div>
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                    <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm text-muted-foreground">
            Already claimed your listing?{" "}
            <Link to="/staff/sign-in" className="font-medium text-primary-text hover:underline">
              Sign in
            </Link>
          </p>
        </header>

        {/* ── The door ─────────────────────────────────────────────────── */}
        <section aria-labelledby="find-yours" className="ra-tile mt-10 p-5 lg:mt-0 lg:p-7">
          <p className="ra-eyebrow text-muted-foreground">Step 1</p>
          <h2 id="find-yours" className="mt-2 text-xl font-bold text-foreground">
            Start by finding your business
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We've already listed thousands of garages. If yours is here, claiming it is quicker than
            starting again.
          </p>

          <form onSubmit={search} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Your business name"
                aria-label="Your business name"
                className="ra-input h-12 w-full ps-10 pe-3"
              />
            </div>
            <button type="submit" disabled={searching} className="ra-btn-primary h-12 sm:px-6">
              {searching ? "Searching…" : "Find it"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {results !== null && (
            <div className="mt-5">
              {results.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center">
                  <p className="text-sm font-medium text-foreground">Not listed yet.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add it and we'll have you live within a working day.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/register-business")}
                    className="ra-btn-primary mt-4"
                  >
                    Add my business
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {results.slice(0, 5).map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {b.name}
                          {b.claimStatus === "unclaimed" && (
                            <Badge className="ms-2">Unclaimed</Badge>
                          )}
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
                        <Link to={`/business/${b.slug}/claim`} className="ra-btn-primary shrink-0">
                          This is mine
                        </Link>
                      ) : (
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {b.claimStatus === "pending" ? "Under review" : "Already claimed"}
                        </span>
                      )}
                    </li>
                  ))}
                  <li className="px-4 py-3 text-center">
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

          {results === null && (
            <p className="mt-5 text-sm text-muted-foreground">
              Not on the list at all?{" "}
              <Link
                to="/register-business"
                className="font-medium text-primary-text hover:underline"
              >
                Add your business
              </Link>{" "}
              — it takes about five minutes.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
