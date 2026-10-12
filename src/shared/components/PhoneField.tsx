import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { useMarket } from "@/app/market";

/**
 * A phone number, with the country it will be read in shown beside it.
 *
 * RoadAxis serves two countries, and "050 123 4567" means a Dubai mobile in one
 * and nothing in the other. The server reads a number typed without a country
 * code as belonging to the country in force — the visitor's for their own
 * number, the listing's for a listing's. That is correct and invisible, and an
 * invisible rule is one a person in the wrong country trips over without ever
 * being told. So the dial code sits in the field where it can be seen, and the
 * hint says how to give a number from anywhere else.
 *
 * Same contract as `Field`: a real label, an announced error, and one shared
 * slot for hint and error so the form does not jump.
 *
 * @param country the country the number belongs to — a listing's own. Left
 *        out, it is the country the visitor is browsing.
 */
interface PhoneFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  country?: string | null;
}

export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField(
  { label, error, hint, country, className, id, placeholder, ...props },
  ref,
) {
  const { marketFor, hasChoice } = useMarket();
  const market = marketFor(country);
  const reactId = useId();
  const inputId = id ?? reactId;
  const messageId = `${inputId}-message`;

  // Only worth saying where there is a second country to be in.
  const abroad = hasChoice
    ? `Outside ${market.shortName}? Start with + and your country code.`
    : "";
  const message = error ?? [hint, abroad].filter(Boolean).join(" ");

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 start-0 flex w-14 items-center justify-center border-e border-input font-mono text-xs tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          {market.dialCode}
        </span>
        <input
          type="tel"
          autoComplete="tel"
          {...props}
          id={inputId}
          ref={ref}
          placeholder={placeholder ?? market.phoneExample}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            "h-11 w-full rounded-lg border bg-card pe-3 ps-16 text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            error ? "border-destructive" : "border-input focus:border-primary",
            className,
          )}
        />
      </div>
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
