import { useState } from "react";
import { NavLink } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import { filterSections, mobileTabs } from "./menu";
import { Sheet } from "@/shared/components/Sheet";

/**
 * Bottom navigation, below `md` only.
 *
 * At the bottom edge because that is the only part of a 6" screen a right thumb
 * reaches without regripping — the hamburger it replaces sits in the top-left
 * corner, the single furthest point from it.
 *
 * Four destinations plus More. Four because a fifth label truncates at 390px,
 * and "Booking…" beside "Busines…" is worse than no fifth tab. Which four is
 * decided by `mobileTabs()` against the same role-filtered menu the sidebar
 * uses, so the bar is a view onto the menu and never a second copy of it.
 */
export function MobileTabBar() {
  const role = useAppSelector((s) => s.auth.user?.role);
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

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="All sections">
        <div className="space-y-5">
          {sections.map((section, i) => (
            <div key={section.heading ?? i}>
              {section.heading && (
                <p className="pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
        </div>
      </Sheet>
    </>
  );
}
