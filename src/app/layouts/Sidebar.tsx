import { NavLink } from "react-router-dom";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ChevronsUpDown,
  ExternalLink,
  LogOut,
  Moon,
  Sun,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearAuth } from "@/modules/auth/authSlice";
import { useTheme } from "@/app/theme";
import { Logo } from "@/shared/components/Logo";
import { Avatar } from "@/shared/components/Avatar";
import { Kbd, MOD } from "@/shared/components/Kbd";
import { Menu } from "@/shared/components/Menu";
import { filterSections } from "./menu";
import { useSidebar } from "./sidebarContext";
import { usePalette } from "./CommandPalette";

/**
 * The desktop rail. Hidden below `md`, where MobileTabBar takes over.
 *
 * Brand-dark in both themes. Three zones: who you are working as, where you
 * can go, and who you are — the account lives here, not in the top bar, so the
 * content area's header can be about the content.
 */
export function Sidebar() {
  const user = useAppSelector((s) => s.auth.user);
  const role = user?.role;
  const { collapsed, toggle } = useSidebar();
  const { setOpen, setShortcutsOpen } = usePalette();
  const { theme, toggleTheme } = useTheme();
  const dispatch = useAppDispatch();
  const sections = filterSections(role);

  const workspace = role === "admin" ? "Admin console" : "Business portal";

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-base ease-out md:flex",
        collapsed ? "w-14" : "w-[15rem]",
      )}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2",
          collapsed ? "justify-center px-0" : "px-3",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="ra-focus flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-sidebar-foreground focus-visible:ring-sidebar-ring"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <Logo onDark className="text-sidebar-foreground" />
              <p className="mt-0.5 ps-8 font-mono text-[10.5px] uppercase tracking-[0.12em] text-sidebar-foreground/45">
                {workspace}
              </p>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="ra-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-white/[0.06] hover:text-sidebar-foreground focus-visible:ring-sidebar-ring"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <div className={cn("shrink-0 pb-2", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search and commands"
          className={cn(
            "ra-focus flex h-8 w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.04] text-[13px] text-sidebar-foreground/60 transition-colors hover:border-white/10 hover:bg-white/[0.07] hover:text-sidebar-foreground focus-visible:ring-sidebar-ring",
            collapsed ? "justify-center px-0" : "px-2.5",
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {!collapsed && (
            <>
              <span className="flex-1 text-start">Search…</span>
              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                <Kbd className="border-white/10 bg-white/[0.06] text-sidebar-foreground/60">
                  {MOD}
                </Kbd>
                <Kbd className="border-white/10 bg-white/[0.06] text-sidebar-foreground/60">K</Kbd>
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav
        className={cn(
          "min-h-0 flex-1 space-y-5 overflow-y-auto pb-3 pt-1",
          collapsed ? "px-2" : "px-3",
        )}
        aria-label="Main"
      >
        {sections.map((section, i) => (
          <div key={section.heading ?? i}>
            {section.heading && !collapsed && (
              <p className="mb-1 px-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">
                {section.heading}
              </p>
            )}
            <ul className="space-y-px">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to!}
                    end={item.to === "/portal"}
                    title={collapsed ? item.label : undefined}
                    className={cn("ra-nav-item", collapsed && "justify-center px-0")}
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

      {/* ── Account ───────────────────────────────────────────────────── */}
      <div
        className={cn("shrink-0 border-t border-sidebar-border py-2", collapsed ? "px-2" : "px-3")}
      >
        <Menu
          label="Account"
          align="start"
          items={[
            { type: "label", label: user?.email ?? "" },
            {
              label: "View the public site",
              icon: ExternalLink,
              href: "/",
              external: true,
            },
            {
              label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
              icon: theme === "dark" ? Sun : Moon,
              onSelect: toggleTheme,
            },
            {
              label: "Keyboard shortcuts",
              icon: Keyboard,
              shortcut: ["?"],
              onSelect: () => setShortcutsOpen(true),
            },
            { type: "separator" },
            { label: "Sign out", icon: LogOut, onSelect: () => dispatch(clearAuth()) },
          ]}
          trigger={({ ref, ...props }) => (
            <button
              ref={ref as React.Ref<HTMLButtonElement>}
              type="button"
              className={cn(
                "ra-focus flex w-full items-center gap-2.5 rounded-md text-start transition-colors hover:bg-white/[0.06] focus-visible:ring-sidebar-ring",
                collapsed ? "h-9 justify-center px-0" : "h-11 px-2",
              )}
              {...props}
            >
              <Avatar name={user?.name} size="md" onDark />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-medium text-white">
                      {user?.name}
                    </span>
                    <span className="block truncate text-[11px] capitalize text-sidebar-foreground/55">
                      {user?.role?.replace("_", " ")}
                    </span>
                  </span>
                  <ChevronsUpDown
                    className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50"
                    aria-hidden="true"
                  />
                </>
              )}
              <span className="sr-only">Account menu</span>
            </button>
          )}
        />
      </div>
    </aside>
  );
}
