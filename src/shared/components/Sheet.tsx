import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet — the mobile counterpart to a centred dialog. Rises from the edge
 * the thumb is already near, takes the full width, and can be dismissed by
 * dragging down. Dragging is direct manipulation rather than decoration, which is
 * why it is the one place motion is allowed to track input.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and the page behind must not scroll while a sheet is open —
  // otherwise flicking the sheet's content scrolls the list underneath it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onOpenChange]);

  // Move focus into the sheet on open, so a keyboard or screen-reader user is
  // not left behind on the page underneath.
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else setDragY(0);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 animate-overlay-in bg-black/50"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="ra-sheet ra-safe-bottom relative animate-sheet-up outline-none"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        onTouchStart={(e) => {
          startY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (startY.current === null) return;
          // Downward only. Dragging up would let the sheet leave the top of the
          // screen, which no platform's sheet does.
          const delta = e.touches[0].clientY - startY.current;
          if (delta > 0) setDragY(delta);
        }}
        onTouchEnd={() => {
          // ~110px is far enough to be deliberate and short enough not to be a
          // workout on a tall sheet.
          if (dragY > 110) onOpenChange(false);
          else setDragY(0);
          startY.current = null;
        }}
      >
        <div className="ra-sheet-grip" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="ra-tap -mr-2 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}
