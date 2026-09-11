import { cn } from "@/lib/utils";

/**
 * An on/off control that looks like one. A checkbox says "include this"; a
 * switch says "this is running" — which is what a WhatsApp number's state is.
 *
 * Underneath it is a real `<input type="checkbox">` inside a 44px label, so
 * the accessible name, the keyboard behaviour and the hit box come from the
 * platform. It keeps the checkbox role on purpose: assistive technology and
 * the test suite both address it as one.
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
        "ra-tap inline-flex cursor-pointer select-none items-center gap-2.5",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={showLabel ? undefined : label}
        className="peer sr-only"
      />
      <span
        className="ra-switch peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
        aria-checked={checked}
        aria-hidden="true"
      >
        <span className="ra-switch-thumb" />
      </span>
      {showLabel && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}
