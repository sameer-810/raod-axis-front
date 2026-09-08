import { Suspense } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Moon, Sun, Heart, Search, LayoutGrid, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/app/theme";
import { useAppSelector } from "@/app/hooks";
import { Logo } from "@/shared/components/Logo";
import { PageLoader } from "@/shared/components/PageLoader";

/**
 * The consumer shell.
 *
 * A different problem from AppLayout and therefore a different layout, not a
 * re-skin of it. A driver reads this once, for ninety seconds, on a phone,
 * possibly at the roadside — so it is generous where the portal is dense, and
 * it carries no sidebar, no breadcrumbs and no chrome competing with the
 * content.
 *
 * Nothing here is gated. Guests browse the whole public product; the account
 * wall stands at exactly one door, and it is the booking-request form
 * (DECISIONS.md D-005).
 */
export function PublicLayout() {
  const { theme, toggleTheme } = useTheme();
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="ra-safe-top sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {/*
            `ra-tap` because the mark is a 28px glyph and this is the link back
            to home from every page — at 34px tall it was the one control on the
            public shell below the touch floor. The label is set here rather
            than left to the contents, which otherwise concatenate the mark's
            own name with the wordmark and announce "RoadAxis RoadAxis".
          */}
          <Link
            to="/"
            aria-label="RoadAxis home"
            className="ra-tap flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>

          <nav className="ms-auto hidden items-center gap-1 md:flex" aria-label="Primary">
            <PublicLink to="/search">Find a service</PublicLink>
            {/* Addressed to owners, not drivers. It is the single most important
                conversion on the supply side of the marketplace, so it does not
                hide in a footer. */}
            <PublicLink to="/for-business">List your business</PublicLink>
          </nav>

          <div className="ms-auto flex items-center gap-1 md:ms-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="ra-tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {user ? (
              <Link
                to={user.role === "driver" ? "/my-garages" : "/portal"}
                className="ra-tap hidden items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent md:flex md:min-h-0 md:py-2"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                {user.role === "driver" ? "My garages" : "Portal"}
              </Link>
            ) : (
              <Link
                to="/sign-in"
                className="ra-tap hidden items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent md:flex md:min-h-0 md:py-2"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="hidden border-t border-border py-8 md:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} RoadAxis</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
            <Link to="/for-business" className="hover:text-foreground">
              List your business
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </footer>

      <PublicTabBar signedIn={Boolean(user)} />
    </div>
  );
}

function PublicLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "text-primary-text" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      {children}
    </NavLink>
  );
}

/**
 * Three destinations on the public side, not four.
 *
 * A consumer product this shallow does not have four top-level places to be,
 * and padding the bar out to four to match a convention would invent one.
 */
function PublicTabBar({ signedIn }: { signedIn: boolean }) {
  const tabs = [
    { to: "/search", label: "Search", icon: Search, end: false },
    { to: "/categories", label: "Categories", icon: LayoutGrid, end: false },
    signedIn
      ? { to: "/my-garages", label: "Saved", icon: Heart, end: false }
      : { to: "/sign-in", label: "Sign in", icon: User, end: false },
  ];

  return (
    <nav className="ra-bottombar ra-safe-bottom md:hidden" aria-label="Main">
      <ul className="flex">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "ra-tap flex w-full flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary-text" : "text-muted-foreground",
                )
              }
            >
              <t.icon className="h-5 w-5" aria-hidden="true" />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
