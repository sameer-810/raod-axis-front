import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import { filterSections } from "./menu";
import { useSidebar } from "./sidebarContext";
import { Logo } from "@/shared/components/Logo";

/**
 * The desktop rail. Hidden below `md`, where MobileTabBar takes over.
 *
 * Brand-dark in both themes, matching the brochure's own surfaces, so the
 * product's identity is continuous whichever theme the user picked.
 */
export function Sidebar() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const { collapsed, toggle } = useSidebar();
  const sections = filterSections(role);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <Logo showWordmark={!collapsed} className="text-sidebar-foreground" />
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2" aria-label="Main">
        {sections.map((section, i) => (
          <div key={section.heading ?? i}>
            {/* The heading is dropped when collapsed rather than truncated — a
                two-character group label is noise, not information. */}
            {section.heading && !collapsed && (
              <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/45">
                {section.heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to!}
                    // `end` on the index route only, so /portal does not stay
                    // highlighted while you are on /portal/requests.
                    end={item.to === "/portal"}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )
                    }
                  >
                    {item.icon && <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex h-11 shrink-0 items-center gap-2.5 border-t border-sidebar-border px-3.5 text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            Collapse
          </>
        )}
      </button>
    </aside>
  );
}
