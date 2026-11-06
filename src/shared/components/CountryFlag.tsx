import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The flag of a country RoadAxis serves, drawn rather than typed. Emoji flags
 * are two letters on Windows — "AE", "GB" — which is not what the client's
 * design shows, and not what anybody recognises at a glance.
 *
 * Decoration: the country's name or dial code is always beside it in text.
 */
export function CountryFlag({ code, className }: { code: string; className?: string }) {
  // useId gives ":r1:" or "«r1»", which is not a usable url(#…) reference.
  const id = `flag${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const box = cn(
    "inline-block h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
    className,
  );

  if (code === "AE") {
    return (
      <svg viewBox="0 0 12 6" className={box} aria-hidden="true" preserveAspectRatio="none">
        <rect width="12" height="2" fill="#00732F" />
        <rect y="2" width="12" height="2" fill="#FFFFFF" />
        <rect y="4" width="12" height="2" fill="#000000" />
        <rect width="3" height="6" fill="#FF0000" />
      </svg>
    );
  }

  if (code === "GB") {
    const clip = `${id}-gb`;
    return (
      <svg viewBox="0 0 60 30" className={box} aria-hidden="true" preserveAspectRatio="none">
        <clipPath id={clip}>
          <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
        </clipPath>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath={`url(#${clip})`}
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </svg>
    );
  }

  // A market added later, before its flag is: a neutral tile, never a broken image.
  return <span className={cn(box, "bg-muted")} aria-hidden="true" />;
}
