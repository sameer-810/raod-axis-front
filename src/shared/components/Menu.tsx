import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { Shortcut } from "./Kbd";

export interface MenuActionItem {
  type?: "item";
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect?: () => void;
  href?: string;
  external?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  shortcut?: string[];
  hint?: string;
}

export type MenuEntry = MenuActionItem | { type: "separator" } | { type: "label"; label: string };

const isAction = (e: MenuEntry): e is MenuActionItem =>
  e.type !== "separator" && e.type !== "label";

/**
 * A dropdown menu on any trigger. Keyboard: ↑↓ move, Enter/Space select, Escape
 * and outside-click close, Home/End jump. Rendered in a portal at a fixed
 * position, so it escapes any `overflow: auto` table frame.
 */
export function Menu({
  items,
  trigger,
  align = "end",
  label,
}: {
  items: MenuEntry[];
  /** Receives the props the trigger must spread. */
  trigger: (props: {
    ref: React.RefCallback<HTMLElement>;
    onClick: (e: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
  }) => React.ReactNode;
  align?: "start" | "end";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const selectable = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => isAction(it) && !it.disabled)
    .map(({ i }) => i);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 240 || r.top < 240;
    const top = below
      ? r.bottom + 4
      : Math.max(8, r.top - 4 - (panelRef.current?.offsetHeight ?? 0));
    if (align === "end") setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
    else setPos({ top, left: Math.max(8, r.left) });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Focus the panel on open so arrow keys work; hand focus back to the trigger
  // on close — but only on a real close, never on mount.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      setActive(selectable[0] ?? 0);
      requestAnimationFrame(() => panelRef.current?.focus());
    } else if (wasOpen.current) {
      triggerRef.current?.focus?.({ preventScroll: true });
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const move = (dir: 1 | -1) => {
    if (!selectable.length) return;
    const idx = selectable.indexOf(active);
    const next = selectable[(idx + dir + selectable.length) % selectable.length];
    setActive(next);
  };

  const choose = (i: number) => {
    const item = items[i];
    if (!item || !isAction(item) || item.disabled) return;
    setOpen(false);
    if (item.href) {
      if (item.external) window.open(item.href, "_blank", "noopener,noreferrer");
      else window.location.assign(item.href);
      return;
    }
    item.onSelect?.();
  };

  const onPanelKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(selectable[0] ?? 0);
        break;
      case "End":
        e.preventDefault();
        setActive(selectable[selectable.length - 1] ?? 0);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <>
      {trigger({
        ref: (el) => {
          triggerRef.current = el;
        },
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        onKeyDown: (e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": id,
      })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onPanelKey}
            className="ra-menu outline-none"
            style={{ top: pos.top, left: pos.left, right: pos.right }}
          >
            {items.map((it, i) => {
              if (it.type === "separator") return <div key={i} className="ra-menu-separator" />;
              if (it.type === "label")
                return (
                  <p
                    key={i}
                    className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
                  >
                    {it.label}
                  </p>
                );
              const Icon = it.icon;
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="ra-menu-item"
                  data-active={active === i}
                  data-destructive={it.destructive || undefined}
                  aria-disabled={it.disabled || undefined}
                  onMouseEnter={() => !it.disabled && setActive(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(i);
                  }}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate text-start">{it.label}</span>
                  {it.hint && <span className="text-xs text-muted-foreground">{it.hint}</span>}
                  {it.shortcut && <Shortcut keys={it.shortcut} />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

/** The trailing "⋯" on a table row. */
export function RowMenu({
  items,
  label,
  size = "sm",
  variant = "ghost",
}: {
  items: MenuEntry[];
  label: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <Menu
      items={items}
      label={label}
      trigger={({ ref, ...props }) => (
        <Button
          ref={ref as React.Ref<HTMLButtonElement>}
          variant={variant}
          size={size}
          iconOnly
          icon={MoreHorizontal}
          className={cn("text-muted-foreground")}
          {...props}
        >
          {label}
        </Button>
      )}
    />
  );
}
