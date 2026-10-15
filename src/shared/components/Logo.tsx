import { cn } from "@/lib/utils";
import {
  MARK_X_TRANSFORM,
  WORDMARK_LETTERS,
  WORDMARK_RED,
  WORDMARK_VIEWBOX,
  WORDMARK_X,
} from "./logoPaths";

/**
 * The client's logo (15 October 2026): the wordmark ROADAXIS in a heavy
 * italic, with the X in red. It was supplied as white on a dark ground, and
 * that is the only colour the mark has — so the letters are drawn in
 * `currentColor` and take the ink of whatever they sit on: white on the rail
 * and the auth panel, the foreground colour on the public header in either
 * theme. The red is the logo's own and does not change with the theme.
 *
 * There is no separate symbol in the client's artwork. Where only a small
 * square fits — the favicon, the phone topbar — the X stands on its own on
 * the ink square, which is the one part of the wordmark that reads at 16 px.
 */
export function Logo({
  className,
  showWordmark = true,
  onDark = false,
}: {
  className?: string;
  showWordmark?: boolean;
  /**
   * The rail is dark in **both** themes, and the theme variables cannot say
   * "this surface is dark regardless of the theme" — so the caller that knows
   * says so, and the letters are white rather than the foreground colour.
   */
  onDark?: boolean;
}) {
  if (!showWordmark) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" role="img" aria-label="RoadAxis">
          <rect width="32" height="32" rx="7" className="fill-[#0E1621]" />
          <path fill={WORDMARK_RED} transform={MARK_X_TRANSFORM} d={WORDMARK_X} />
        </svg>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center", className)}>
      <svg
        viewBox={WORDMARK_VIEWBOX}
        className={cn("h-[18px] w-auto shrink-0", onDark ? "text-white" : "text-foreground")}
        role="img"
        aria-label="RoadAxis"
      >
        <path fill="currentColor" d={WORDMARK_LETTERS} />
        <path fill={WORDMARK_RED} d={WORDMARK_X} />
      </svg>
    </span>
  );
}
