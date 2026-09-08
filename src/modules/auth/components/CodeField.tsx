import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A six-digit code input.
 *
 * One field, not six boxes. Six separate boxes look considered and are worse:
 * paste behaviour has to be reimplemented by hand, backspace across a boundary
 * is a special case, screen readers announce six unlabelled fields, and browser
 * autofill — the thing that actually makes this painless — targets a single
 * input.
 *
 * The details that matter:
 *  - `inputMode="numeric"` brings up the digit keypad rather than a full
 *    keyboard, on a screen where someone is copying six characters between two
 *    apps.
 *  - `autoComplete="one-time-code"` lets the platform offer the code from the
 *    notification. It is set only on the channel that can realistically supply
 *    it; two fields both claiming it would have them fight.
 *  - `font-mono` with wide tracking, because a code is read one character at a
 *    time and proportional digits make 1 and 7 harder to separate at a glance.
 */
interface CodeFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const CodeField = forwardRef<HTMLInputElement, CodeFieldProps>(function CodeField(
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
        type="text"
        inputMode="numeric"
        // Six digits and no more, so an accidental seventh keystroke does not
        // silently invalidate a correct code.
        maxLength={6}
        // Codes are the one thing a password manager must never remember.
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "h-12 w-full rounded-lg border bg-card px-3 text-center font-mono text-lg tracking-[0.4em] tabular-nums transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          error ? "border-destructive" : "border-input focus:border-primary",
          className,
        )}
      />
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
