import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useScrollLock } from "@/shared/hooks/useFocusTrap";
import { Button, type ButtonVariant } from "./Button";

/**
 * A centred dialog: focus-trapped, Escape closes, focus returns to the opener.
 * For anything a phone thumb has to fill in, prefer `Drawer`, which becomes a
 * bottom sheet below `md`.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  tone,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  tone?: "danger" | "warning";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="ra-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "ra-dialog outline-none",
          size === "sm" && "max-w-sm",
          size === "lg" && "max-w-2xl",
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          {tone && (
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                tone === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-warning",
              )}
              aria-hidden="true"
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold leading-6 text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            onClick={onClose}
            className="-me-2 -mt-1.5 shrink-0"
          >
            Close
          </Button>
        </div>
        {children && <div className="px-5 pt-4">{children}</div>}
        {footer && <div className="flex justify-end gap-2 px-5 pb-5 pt-5">{footer}</div>}
        {!footer && <div className="pb-5" />}
      </div>
    </>,
    document.body,
  );
}

/**
 * The one dialog the product uses most: confirm something consequential, with
 * a reason when a person on the other side will read it.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmVariant = "danger",
  tone = "danger",
  busy,
  reason,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => unknown;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  tone?: "danger" | "warning";
  busy?: boolean;
  /** Ask for a reason. `minLength` makes the confirm wait for it. */
  reason?: {
    label: string;
    placeholder?: string;
    hint?: string;
    minLength?: number;
    multiline?: boolean;
  };
  children?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const id = useId();

  // A fresh dialog each time it opens.
  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const short = reason?.minLength ? text.trim().length < reason.minLength : false;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => void onConfirm(text.trim())}
            disabled={short}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {reason && (
        <div className="space-y-1.5">
          <label htmlFor={id} className="block text-sm font-medium text-foreground">
            {reason.label}
          </label>
          {reason.multiline ? (
            <textarea
              id={id}
              data-autofocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={reason.placeholder}
              className="ra-input w-full px-3 py-2"
            />
          ) : (
            <input
              id={id}
              data-autofocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={reason.placeholder}
              className="ra-input ra-control w-full px-3"
            />
          )}
          {reason.hint && <p className="text-xs text-muted-foreground">{reason.hint}</p>}
        </div>
      )}
    </Dialog>
  );
}
