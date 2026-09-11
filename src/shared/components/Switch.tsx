import { cn } from "@/lib/utils";

/**
 * An on/off control that looks like one. A checkbox says "include this"; a
 * switch says "this is running" — which is what a WhatsApp number's state is.
 *
 * The real `<input type="checkbox">` is stretched over the track at zero
 * opacity rather than hidden away in an `sr-only` corner, and the drawn track
 * is `pointer-events-none`. That way the thing a pointer, a finger and an
 * automated click all land on *is* the control — an `sr-only` input sits under
 * its own decoration, so a click aimed at it is swallowed by the graphic.
 *
 * It keeps the checkbox role on purpose: assistive technology and the test
 * suite both address it as one.
 */
export function Switch({
  checked,
  onChange,
  label,
  showLabel = false,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name. Say what the action is: "Switch off Workshop". */
  label: string;
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "ra-tap inline-flex cursor-pointer select-none items-center justify-center gap-2.5",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="relative inline-flex h-6 w-10 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={showLabel ? undefined : label}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className="ra-switch pointer-events-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
          aria-checked={checked}
          aria-hidden="true"
        >
          <span className="ra-switch-thumb" />
        </span>
      </span>
      {showLabel && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}
