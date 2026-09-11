import { Link, useLocation } from "react-router-dom";
import { Moon, Sun, ExternalLink, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import { useTheme } from "@/app/theme";
import { Logo } from "@/shared/components/Logo";
import { Kbd, MOD } from "@/shared/components/Kbd";
import { sectionOf } from "./menu";
import { usePalette } from "./CommandPalette";

/**
 * A slim bar. On a desktop it carries the breadcrumb and the global controls;
 * on a phone it is the page's title bar. Opaque, deliberately: a frosted bar
 * leaves table rows half-visible through it as they scroll.
 *
 * The `<h1>` here exists only below `md` — above it the page's own header is
 * the h1, so there is exactly one at every width.
 */
export function Topbar() {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { setOpen } = usePalette();
  const role = useAppSelector((s) => s.auth.user?.role);

  const { heading, item } = sectionOf(pathname);
  const title = pathname === "/portal" ? "Overview" : (item?.label ?? "RoadAxis");
  const workspace = role === "admin" ? "Admin console" : "Business portal";

  return (
    <header className="ra-safe-top flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:px-6">
      <Logo showWordmark={false} className="md:hidden" />
      <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground md:hidden">
        {title}
      </h1>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 md:block">
        <ol className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <li className="truncate">{workspace}</li>
          {heading && (
            <>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="truncate">{heading}</li>
            </>
          )}
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="truncate font-medium text-foreground" aria-current="page">
            {title}
          </li>
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search and commands"
        className={cn(
          "ra-focus ra-control ra-control-sm inline-flex items-center gap-2 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          "min-w-[44px] justify-center px-0 md:min-w-0 md:justify-start md:border md:border-border md:bg-card md:px-2.5 md:hover:bg-accent",
        )}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden text-[13px] md:inline">Search</span>
        <span className="hidden items-center gap-0.5 md:inline-flex" aria-hidden="true">
          <Kbd>{MOD}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        className="ra-focus ra-control ra-control-sm inline-flex min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:min-w-0 md:w-8"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {/* Getting back to the public site matters more here than in an
          internal tool: an owner's first question after editing is "how does
          it look?" */}
      <Link
        to="/"
        className="ra-focus ra-control ra-control-sm hidden items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:inline-flex"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        View site
      </Link>
    </header>
  );
}
