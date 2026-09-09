import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS = ["Poor", "Not great", "OK", "Good", "Excellent"];

/**
 * Stars, read-only.
 *
 * The number is rendered as text alongside rather than left to the icons alone.
 * Five shapes at 16px is a picture a screen reader cannot describe and a
 * colour-blind reader has to count, and "4.6" is both smaller and more precise
 * than either.
 */
export function StarDisplay({
  rating,
  size = "sm",
  className,
}: {
  rating: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const px = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(px, n <= rating ? "fill-current text-warning" : "text-border")}
        />
      ))}
      <span className="sr-only">{rating} out of 5</span>
    </span>
  );
}

/**
 * Stars, as an input.
 *
 * A radio group rather than five buttons, so the keyboard behaviour a person
 * already knows — arrow keys move within the group, Tab leaves it — comes for
 * free and the browser enforces that exactly one is chosen. Each star carries
 * its own word ("4 — Good"), because "four stars" means different things to
 * different people and the word is what makes the scale comparable between them.
 *
 * The touch target is 44px on every star. On a phone this is the only control on
 * the form, and a 20px icon is a control most people miss on the first try.
 */
export function StarInput({
  value,
  onChange,
  name = "rating",
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className={cn(
            "ra-tap relative flex w-11 cursor-pointer items-center justify-center rounded-lg transition-colors",
            "hover:bg-accent focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          {/*
            Transparent and full-size rather than visually hidden.

            The radio *is* the target, so a tap anywhere on the star lands on the
            real control instead of on a label that forwards it — which keeps the
            hit area, the focus ring and the 44px floor all describing the same
            element. A `sr-only` input here is a 1px control sitting under a 28px
            drawing of a star, and every pointer that finds it does so by accident.
          */}
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            disabled={disabled}
            onChange={() => onChange(n)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          {/*
            `pointer-events-none`, or the icon swallows the tap and the
            visually-hidden radio behind it never receives it — which is exactly
            what a pointer landing on the drawing of a star should not do.
          */}
          <Star
            aria-hidden="true"
            className={cn(
              "pointer-events-none h-7 w-7",
              n <= value ? "fill-current text-warning" : "text-border",
            )}
          />
          <span className="sr-only">
            {n} star{n === 1 ? "" : "s"} — {LABELS[n - 1]}
          </span>
        </label>
      ))}
      {/* The word, visible. It is what makes one person's 4 comparable to
          another's, and it appears only once a choice has been made so the
          control does not shout a default nobody picked. */}
      <span className="ms-2 text-sm text-muted-foreground" aria-hidden="true">
        {value ? LABELS[value - 1] : ""}
      </span>
    </div>
  );
}
