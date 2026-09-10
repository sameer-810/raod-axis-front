import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A labelled input, and the accessibility contract that goes with it. Three things
 * that are easy to get wrong once and then repeat on every form in the product:
 *
 *  1. **The label is a real `<label>` bound by id.** A placeholder is not a label
 *     — it disappears the moment someone types, which is when they need it.
 *  2. **The error is announced, not only coloured** — wired through
 *     `aria-describedby` and `aria-invalid`, and in a live region.
 *  3. **Hint and error share one slot**, so a field never grows a line when it
 *     fails and shifts everything below it down the page mid-typing.
 */
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "h-11 w-full rounded-lg border bg-card px-3 text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          error ? "border-destructive" : "border-input focus:border-primary",
          className,
        )}
      />
      {/*
        Always rendered, so the layout does not jump when an error appears. The
        live region is polite rather than assertive: an error that interrupts
        someone mid-sentence is worse than one announced when they pause.
      */}
      <p
        id={messageId}
        role={error ? "alert" : undefined}
        aria-live="polite"
        className={cn(
          "min-h-[1.25rem] text-xs",
          error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message}
      </p>
    </div>
  );
});
