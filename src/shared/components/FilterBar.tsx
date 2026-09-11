import { useId } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/**
 * Search, a few narrow filters, and — the part that matters — the active
 * filters as removable chips with a "clear" control. A filtered table that
 * looks identical to an unfiltered one is how people misread data.
 */
export function FilterBar({
  search,
  children,
  chips,
  onClearAll,
  trailing,
  className,
}: {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    label: string;
  };
  /** The narrow filters — `FilterSelect`s. */
  children?: React.ReactNode;
  chips?: Array<{ key: string; label: string; onRemove: () => void }>;
  onClearAll?: () => void;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {search && (
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder}
              aria-label={search.label}
              className="ra-input ra-control w-full ps-9 pe-3 md:max-w-md"
            />
          </div>
        )}
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        {trailing && <div className="flex items-center gap-2 md:ms-auto">{trailing}</div>}
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="ra-focus ra-control ra-control-sm inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/[0.07] px-2 text-xs font-medium text-primary-text hover:bg-primary/10"
              aria-label={`Remove filter: ${c.label}`}
            >
              {c.label}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs">
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A native `<select>` dressed as a pill. Native because it is keyboard-operable,
 * screen-reader-labelled and opens the platform picker on a phone for free — a
 * custom dropdown buys none of that back.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  id,
  showLabel = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  id?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const reactId = useId();
  const selectId = id ?? reactId;
  const active = value !== "";
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={selectId} className={showLabel ? "sr-only" : "sr-only"}>
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "ra-focus ra-control appearance-none rounded-lg border bg-card pe-8 ps-3 text-[13px] font-medium transition-colors",
          active
            ? "border-primary/40 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
