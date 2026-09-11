import { Suspense, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTabBar } from "./MobileTabBar";
import { SidebarProvider } from "./sidebarContext";
import { CommandPalette, PaletteProvider, ShortcutsDialog, usePalette } from "./CommandPalette";
import { filterMenu, MENU } from "./menu";
import { PageLoader } from "@/shared/components/PageLoader";
import { useHotkeys } from "@/shared/hooks/useHotkeys";
import { useAppSelector } from "@/app/hooks";

/**
 * The authenticated shell — Business Portal and Admin Console. A tool people
 * use daily, so the keyboard is a first-class way around it: ⌘K for anything,
 * "g" then a letter to jump, "?" for the list.
 */
export function AppLayout() {
  return (
    <SidebarProvider>
      <PaletteProvider>
        <Shell />
      </PaletteProvider>
    </SidebarProvider>
  );
}

function Shell() {
  const navigate = useNavigate();
  const { setOpen, setShortcutsOpen } = usePalette();
  const role = useAppSelector((s) => s.auth.user?.role);

  const hotkeys = useMemo(() => {
    const map: Record<string, () => void> = {
      "mod+k": () => setOpen(true),
      "/": () => setOpen(true),
      "?": () => setShortcutsOpen(true),
    };
    for (const item of filterMenu(MENU, role)) {
      if (item.shortcut && item.to) map[item.shortcut] = () => navigate(item.to!);
    }
    return map;
  }, [role, navigate, setOpen, setShortcutsOpen]);
  useHotkeys(hotkeys);

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        {/* `pb-24` below md clears the fixed tab bar and the FAB above it. */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="mx-auto w-full max-w-[100rem] p-4 pb-24 md:px-6 md:py-5 md:pb-8 lg:px-8">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <MobileTabBar />
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}
