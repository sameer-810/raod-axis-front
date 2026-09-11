import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { MoreHorizontal, ExternalLink, LogOut, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearAuth } from "@/modules/auth/authSlice";
import { useTheme } from "@/app/theme";
import { filterSections, mobileTabs } from "./menu";
import { Sheet } from "@/shared/components/Sheet";
import { Avatar } from "@/shared/components/Avatar";

/**
 * Bottom navigation, below `md` only. Four destinations plus More — a fifth
 * label truncates at 390px. Which four comes from `mobileTabs()` against the
 * same role-filtered menu the sidebar uses, so the bar is a view onto the menu.
 * The account lives in the More sheet, where the sidebar's footer would be.
 */
export function MobileTabBar() {
  const user = useAppSelector((s) => s.auth.user);
  const role = user?.role;
  const dispatch = useAppDispatch();
  const { theme, toggleTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = mobileTabs(role);
  const sections = filterSections(role);

  if (tabs.length === 0) return null;

  return (
    <>
      <nav className="ra-bottombar ra-safe-bottom md:hidden" aria-label="Main">
        <ul className="flex">
          {tabs.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to!}
                end={item.to === "/portal"}
                className={({ isActive }) =>
                  cn(
                    "ra-tap flex w-full flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors",
                    isActive ? "text-primary-text" : "text-muted-foreground",
                  )
                }
              >
                {item.icon && <item.icon className="h-5 w-5" aria-hidden="true" />}
                <span className="max-w-full truncate px-1">{item.shortLabel ?? item.label}</span>
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="ra-tap flex w-full flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Menu">
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
            <Avatar name={user?.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {user?.role?.replace("_", " ")} · {user?.email}
              </p>
            </div>
          </div>

          {sections.map((section, i) => (
            <div key={section.heading ?? i}>
              {section.heading && (
                <p className="pb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {section.heading}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to!}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "ra-tap flex items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary-text"
                            : "text-foreground hover:bg-accent",
                        )
                      }
                    >
                      {item.icon && <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="border-t border-border pt-3">
            <ul className="space-y-0.5">
              <li>
                <Link
                  to="/"
                  onClick={() => setMoreOpen(false)}
                  className="ra-tap flex items-center gap-3 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View the public site
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="ra-tap flex w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Moon className="h-4 w-4" aria-hidden="true" />
                  )}
                  {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => dispatch(clearAuth())}
                  className="ra-tap flex w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </Sheet>
    </>
  );
}
