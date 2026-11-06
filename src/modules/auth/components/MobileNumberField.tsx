import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/shared/components/CountryFlag";
import type { Market } from "@/modules/market/types";
import { countryLabel } from "../lib/phoneNumber";

/**
 * A mobile number with its country chosen beside it — the client's design for
 * driver sign-in (D-046): the flag and dial code in a picker on the left, the
 * number on the right.
 *
 * The countries are the ones open to the public, so a country paused in the
 * console is not offered (D-043). With one country open there is nothing to
 * choose, and the picker is a plain label.
 *
 * The dial code is outside the field, so the example number is shown without
 * its leading zero ("50 123 4567", not "050 123 4567"). Either is accepted: the
 * zero is the trunk prefix and is dropped when the number is put together.
 */

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  markets: Market[];
  country: Market;
  onCountryChange: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

export const MobileNumberField = forwardRef<HTMLInputElement, Props>(function MobileNumberField(
  { label, markets, country, onCountryChange, value, onChange, error, hint, id, ...props },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const listId = `${inputId}-countries`;
  const messageId = `${inputId}-message`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const choice = markets.length > 1;

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  function openList() {
    setActive(
      Math.max(
        0,
        markets.findIndex((m) => m.code === country.code),
      ),
    );
    setOpen(true);
  }

  function choose(code: string) {
    onCountryChange(code);
    setOpen(false);
    button.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % markets.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + markets.length) % markets.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(markets[active].code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const message = error ?? hint ?? "";

  return (
    <div className="space-y-1.5" ref={wrap}>
      <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div
        className={cn(
          "relative flex h-12 items-stretch rounded-xl border bg-card transition-colors focus-within:ring-2 focus-within:ring-ring",
          error ? "border-destructive" : "border-input focus-within:border-primary",
        )}
      >
        {choice ? (
          <button
            ref={button}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-label={`Country code: ${countryLabel(country)} ${country.dialCode}. Change`}
            onClick={() => (open ? setOpen(false) : openList())}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                openList();
              }
            }}
            className="ra-tap flex shrink-0 items-center gap-2 rounded-s-xl border-e border-input ps-3 pe-2.5 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none"
          >
            <CountryFlag code={country.code} />
            <span className="tabular-nums">{country.dialCode}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="flex shrink-0 items-center gap-2 border-e border-input ps-3 pe-3 text-sm font-medium text-foreground">
            <CountryFlag code={country.code} />
            <span className="tabular-nums">{country.dialCode}</span>
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={country.phoneExample.replace(/^0/, "")}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="min-w-0 flex-1 rounded-e-xl bg-transparent px-3 text-base tabular-nums placeholder:text-muted-foreground/70 focus:outline-none"
          {...props}
        />

        {open && (
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label="Country code"
            aria-activedescendant={`${listId}-${markets[active]?.code}`}
            onKeyDown={onListKey}
            className="absolute start-0 top-[calc(100%+6px)] z-30 w-56 overflow-hidden rounded-xl border border-border bg-popover py-1 text-sm shadow-lg focus:outline-none"
          >
            {markets.map((m, i) => (
              <li
                key={m.code}
                id={`${listId}-${m.code}`}
                role="option"
                aria-selected={m.code === country.code}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(m.code)}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-center gap-3 px-3",
                  i === active && "bg-accent",
                  i > 0 && "border-t border-border",
                )}
              >
                <CountryFlag code={m.code} />
                <span className="flex-1 text-foreground">
                  {countryLabel(m)} <span className="tabular-nums">{m.dialCode}</span>
                </span>
                {m.code === country.code && (
                  <Check className="h-4 w-4 text-success" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        )}
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
