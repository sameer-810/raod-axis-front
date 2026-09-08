/**
 * @module format
 * @description Every figure a user reads passes through here.
 *
 * Centralised because these are the values that make the product feel local or
 * foreign. A distance in the wrong unit, a date in the American order or a time
 * in the wrong clock all say "this was not built for you" more loudly than any
 * amount of visual design says otherwise.
 */

const LOCALE = "en-GB";

/**
 * Distance.
 *
 * Metres are what the database stores and what a `2dsphere` query returns.
 * Display follows `VITE_DISTANCE_UNIT`: metric by default, because the client
 * wrote the filter in metres and kilometres ("nearby 500m - 2km"), with
 * imperial a one-line switch because UK drivers think in miles.
 * See DECISIONS.md D-002.
 */
export function formatDistance(metres: number | null | undefined): string {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) return "";

  const imperial = (import.meta.env.VITE_DISTANCE_UNIT || "metric") === "imperial";

  if (imperial) {
    const yards = metres * 1.09361;
    if (yards < 400) return `${Math.round(yards / 10) * 10} yd`;
    const miles = metres / 1609.344;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  }

  // Below a kilometre, round to the nearest 10 m. Precision beyond that is
  // false: a phone's location is rarely better than ±20 m, so "347 m" claims
  // an accuracy we do not have.
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  const km = metres / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** DD/MM/YYYY. The UK order, and never the American one. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** "Mon 15 Sep" — for anything a person reads rather than compares. */
export function formatDateFriendly(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  return `${formatDate(value)} ${formatTime(value)}`.trim();
}

/**
 * Relative age — "4h ago" — for queues, where what matters is how long
 * something has been waiting rather than exactly when it arrived.
 */
export function formatAge(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

/** Duration in minutes → "1h 20m". Used for first-response time. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Pounds. Stage 2 needs this; the MVP uses it only for indicative pricing. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: import.meta.env.VITE_CURRENCY || "GBP",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * A rating, and the rule that goes with it.
 *
 * Returns null when there are no reviews. A business with no reviews is new,
 * not bad, and rendering "0.0 ★" is a libel we generated ourselves — the trust
 * row shows nothing at all instead. See DESIGN.md, "Trust is a component".
 */
export function formatRating(
  average: number | null | undefined,
  count: number | null | undefined,
): { value: string; count: number } | null {
  if (!count || !average) return null;
  return { value: average.toFixed(1), count };
}

/** Initials for the identity disc. "Bridgewater Tyre & Exhaust" → "BT". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
