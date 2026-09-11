import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ExternalLink,
  LogOut,
  Moon,
  Sun,
  Plus,
  Store,
  CornerDownLeft,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearAuth } from "@/modules/auth/authSlice";
import { useTheme } from "@/app/theme";
import { adminBusinessApi } from "@/modules/admin/api/adminApi";
import { useFocusTrap, useScrollLock } from "@/shared/hooks/useFocusTrap";
import { Kbd, MOD, Shortcut } from "@/shared/components/Kbd";
import { Dialog } from "@/shared/components/Dialog";
import { filterMenu, MENU } from "./menu";

interface PaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
}
const PaletteContext = createContext<PaletteContextValue | null>(null);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  return (
    <PaletteContext.Provider value={{ open, setOpen, shortcutsOpen, setShortcutsOpen }}>
      {children}
    </PaletteContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette must be used within <PaletteProvider>");
  return ctx;
}

interface Item {
  id: string;
  group: "Go to" | "Actions" | "Businesses";
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string[];
  keywords?: string[];
  run: () => void;
}

function score(item: Item, q: string): number {
  if (!q) return 1;
  const hay = [item.label, ...(item.keywords ?? []), item.hint ?? ""].join(" ").toLowerCase();
  if (item.label.toLowerCase().startsWith(q)) return 3;
  if (item.label.toLowerCase().includes(q)) return 2;
  // Every word of the query somewhere in the haystack.
  return q.split(/\s+/).every((w) => hay.includes(w)) ? 1 : 0;
}

/**
 * ⌘K. Navigation, the handful of actions worth a shortcut, and — for an
 * administrator — any business by name. Keyboard first: ↑↓ move, Enter runs,
 * Escape closes; the pointer works too.
 */
export function CommandPalette() {
  const { open, setOpen, setShortcutsOpen } = usePalette();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { theme, toggleTheme } = useTheme();
  const user = useAppSelector((s) => s.auth.user);
  const role = user?.role;

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  useFocusTrap(ref, open);
  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  // Businesses by name, for administrators, once two characters are typed.
  const { data: found } = useQuery({
    queryKey: ["palette", "businesses", q],
    queryFn: () => adminBusinessApi.list({ search: q }),
    enabled: open && role === "admin" && q.length >= 2,
    staleTime: 30_000,
  });

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = filterMenu(MENU, role)
      .filter((m) => m.to)
      .map((m) => ({
        id: `nav:${m.to}`,
        group: "Go to",
        label: m.label,
        icon: m.icon,
        keywords: m.keywords,
        shortcut: m.shortcut?.split(" "),
        run: () => navigate(m.to!),
      }));

    const actions: Item[] = [
      ...(role === "admin"
        ? [
            {
              id: "act:new",
              group: "Actions" as const,
              label: "New listing",
              icon: Plus,
              keywords: ["create", "add", "business"],
              run: () => navigate("/admin/businesses/new"),
            },
          ]
        : []),
      {
        id: "act:site",
        group: "Actions",
        label: "View the public site",
        icon: ExternalLink,
        keywords: ["home", "search", "open"],
        run: () => window.open("/", "_blank", "noopener"),
      },
      {
        id: "act:theme",
        group: "Actions",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? Sun : Moon,
        keywords: ["dark", "light", "appearance"],
        run: toggleTheme,
      },
      {
        id: "act:keys",
        group: "Actions",
        label: "Keyboard shortcuts",
        icon: Keyboard,
        shortcut: ["?"],
        keywords: ["help", "hotkeys"],
        run: () => setShortcutsOpen(true),
      },
      {
        id: "act:out",
        group: "Actions",
        label: "Sign out",
        icon: LogOut,
        run: () => dispatch(clearAuth()),
      },
    ];

    const businesses: Item[] = (found?.items ?? []).slice(0, 6).map((b) => ({
      id: `biz:${b.id}`,
      group: "Businesses",
      label: b.name,
      hint: [b.address.city, b.address.postcode].filter(Boolean).join(" · "),
      icon: Store,
      run: () => navigate(`/admin/businesses/${b.id}`),
    }));

    const scored = [...nav, ...actions]
      .map((it) => ({ it, s: score(it, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ it }) => it);

    return [...scored, ...businesses];
  }, [role, theme, found, q, navigate, toggleTheme, dispatch, setShortcutsOpen]);

  useEffect(() => {
    setActive(0);
  }, [q, items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const run = (item: Item) => {
    setOpen(false);
    item.run();
  };

  const groups = (["Go to", "Actions", "Businesses"] as const)
    .map((g) => ({ g, list: items.filter((i) => i.group === g) }))
    .filter(({ list }) => list.length > 0);

  let index = -1;

  return createPortal(
    <>
      <div className="ra-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        tabIndex={-1}
        className="ra-palette outline-none"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const it = items[active];
            if (it) run(it);
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              role === "admin"
                ? "Search businesses, pages and actions…"
                : "Search pages and actions…"
            }
            aria-label="Search"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          )}
          {groups.map(({ g, list }) => (
            <div key={g} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {g}
              </p>
              {list.map((item) => {
                index += 1;
                const i = index;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={active === i}
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                    className={cn(
                      "flex h-10 cursor-default select-none items-center gap-3 rounded-md px-2 text-sm",
                      active === i ? "bg-accent text-foreground" : "text-foreground/90",
                    )}
                  >
                    {Icon && (
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && (
                      <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
                    )}
                    {item.shortcut && <Shortcut keys={item.shortcut} />}
                    {active === i && (
                      <CornerDownLeft
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-surface-2 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ms-auto inline-flex items-center gap-1">
            <Kbd>{MOD}</Kbd>
            <Kbd>K</Kbd> to open anywhere
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** The cheat sheet behind "?". */
export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = usePalette();
  const role = useAppSelector((s) => s.auth.user?.role);
  const nav = filterMenu(MENU, role).filter((m) => m.shortcut);

  return (
    <Dialog
      open={shortcutsOpen}
      onClose={() => setShortcutsOpen(false)}
      title="Keyboard shortcuts"
      description="Press a sequence anywhere outside a text field."
      size="md"
    >
      <div className="grid gap-x-8 gap-y-1 pb-1 sm:grid-cols-2">
        <Row keys={["mod", "K"]} label="Search and commands" />
        <Row keys={["?"]} label="This list" />
        <Row keys={["Esc"]} label="Close any panel" />
        <Row keys={["↑", "↓"]} label="Move between rows" />
        <Row keys={["↵"]} label="Open the focused row" />
        <Row keys={["Space"]} label="Select the focused row" />
        {nav.map((m) => (
          <Row key={m.to} keys={m.shortcut!.split(" ")} label={`Go to ${m.label}`} />
        ))}
      </div>
    </Dialog>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex h-8 items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <Shortcut keys={keys} />
    </div>
  );
}
