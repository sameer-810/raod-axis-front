import { Link, useLocation } from "react-router-dom";
import { Moon, Sun, LogOut, ExternalLink } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearAuth } from "@/modules/auth/authSlice";
import { useTheme } from "@/app/theme";
import { MENU } from "./menu";
import { Logo } from "@/shared/components/Logo";

/**
 * Opaque, deliberately. A frosted bar leaves table rows half-visible through it
 * as they scroll — at speed that reads as a smear — and forces a compositing
 * layer on every scroll frame.
 */
export function Topbar() {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  // The current screen's name, so the mobile header says where you are — the
  // list pages hide their own <h1> below `md` to avoid saying it twice.
  const current = MENU.find((m) => m.to && pathname.startsWith(m.to) && m.to !== "/portal");
  const title = pathname === "/portal" ? "Overview" : (current?.label ?? "RoadAxis");

  return (
    <header className="ra-safe-top flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <Logo showWordmark={false} className="md:hidden" />
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground md:text-sm md:font-medium md:text-muted-foreground">
        {title}
      </h1>

      {/* Getting back to the public site matters more here than in an internal
          tool: an owner's first question after editing is "how does it look?" */}
      <Link
        to="/"
        className="ra-tap hidden items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex md:min-h-0 md:py-1.5"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        View site
      </Link>

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

      <div className="hidden items-center gap-2 border-l border-border pl-3 md:flex">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-foreground">{user?.name}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {user?.role?.replace("_", " ")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => dispatch(clearAuth())}
        aria-label="Sign out"
        title="Sign out"
        className="ra-tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </header>
  );
}
