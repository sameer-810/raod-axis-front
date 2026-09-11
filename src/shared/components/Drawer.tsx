import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useScrollLock } from "@/shared/hooks/useFocusTrap";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * A side panel for one record, opened from a table. The list stays where it
 * was — a reviewer working down a queue never loses their place. Below `md` it
 * is a bottom sheet, because a 480px panel on a 390px screen is a modal with a
 * gap down one side.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  header,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra header content — badges, an action beside the title. */
  header?: React.ReactNode;
  width?: "md" | "lg";
}) {
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open && !isMobile);
  useScrollLock(open && !isMobile);

  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobile, onClose]);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title} footer={footer}>
        {subtitle && <p className="-mt-1 mb-3 text-sm text-muted-foreground">{subtitle}</p>}
        {header && <div className="mb-3">{header}</div>}
        {children}
      </Sheet>
    );
  }

  if (!open) return null;

  return createPortal(
    <>
      <div className="ra-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("ra-drawer outline-none", width === "lg" && "max-w-[38rem]")}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold text-foreground">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            {header && <div className="mt-2">{header}</div>}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} className="-me-2">
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
