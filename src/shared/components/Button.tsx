import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:bg-primary/85 shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]",
  secondary:
    "border border-border bg-card text-foreground hover:bg-accent active:bg-accent/80 shadow-[0_1px_0_rgb(0_0_0/0.03)]",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/80",
  danger: "bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90",
  "danger-outline":
    "border border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
};

/**
 * Sizes are desktop heights. Below `md` every size becomes the 44px touch
 * floor through `.ra-control` — the visual weight is a desktop decision, the
 * hit box is a phone one.
 */
const SIZE: Record<ButtonSize, string> = {
  sm: "ra-control ra-control-sm px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "ra-control px-3.5 text-sm gap-2 rounded-lg",
  lg: "ra-control ra-control-lg px-5 text-sm gap-2 rounded-xl",
};
const ICON_ONLY: Record<ButtonSize, string> = {
  sm: "px-0 min-w-[44px] md:min-w-0 md:w-8",
  md: "px-0 min-w-[44px] md:min-w-0 md:w-9",
  lg: "px-0 w-11",
};

// eslint-disable-next-line react-refresh/only-export-components
export function buttonClasses({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
}) {
  return cn(
    "ra-focus inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,transform] duration-fast ease-out",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "active:translate-y-px",
    VARIANT[variant],
    SIZE[size],
    iconOnly && ICON_ONLY[size],
    className,
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Spinner replaces the leading icon; the label stays, so the width does not jump. */
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, icon: Icon, iconOnly, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, iconOnly, className })}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentType<{ className?: string }>;
  iconOnly?: boolean;
}

/** A router link that looks like a button. Still a real `<a href>`. */
export function ButtonLink({
  variant,
  size,
  icon: Icon,
  iconOnly,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, iconOnly, className })} {...rest}>
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </Link>
  );
}

/** An external link that looks like a button. */
export function ButtonAnchor({
  variant,
  size,
  icon: Icon,
  iconOnly,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentType<{ className?: string }>;
  iconOnly?: boolean;
}) {
  return (
    <a className={buttonClasses({ variant, size, iconOnly, className })} {...rest}>
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </a>
  );
}
