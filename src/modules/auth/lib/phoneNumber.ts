/**
 * Putting a mobile number together from the country picker and what was typed
 * (D-046). Kept apart from the field so pages can use it without importing a
 * component.
 */
import type { Market } from "@/modules/market/types";

/** "the UAE" → "UAE": the short label the design uses in the list. */
export const countryLabel = (m: Pick<Market, "shortName">) => m.shortName.replace(/^the /i, "");

/**
 * The number as the server stores it. Anything typed with its own "+" or "00"
 * is taken as given — somebody abroad, or pasting a full number. Otherwise the
 * trunk zero goes and the chosen country's code goes in front.
 */
export function toInternational(dialCode: string, typed: string): string {
  const raw = typed.trim();
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `${dialCode}${digits.replace(/^0+/, "")}`;
}

/** Enough digits to be a mobile anywhere RoadAxis serves. The server decides the rest. */
export function looksLikeMobile(typed: string): boolean {
  const digits = typed.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 7 && digits.length <= 15;
}
