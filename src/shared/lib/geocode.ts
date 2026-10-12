/**
 * @module geocode
 * @description Turning a typed place into coordinates — the other half of
 * FR-DIS-05, so someone who refuses location access can still search.
 *
 * How a place is found depends on the country, because countries do not agree
 * on what a place is:
 *
 *  - **The UK** has postcodes, and **postcodes.io** resolves them: free, no key,
 *    no rate limit worth worrying about at this scale. It handles both a full
 *    postcode and a place name, which between them cover nearly everything a
 *    driver types.
 *  - **The UAE** has no postcodes. The server sends a list of its cities and
 *    districts with each one's centre, and a typed name is matched against it
 *    here — no request, no key, and nothing to be down.
 *
 * A paid geocoder is the right answer when either list stops being enough.
 */
import type { Market } from "@/modules/market/types";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

const BASE = "https://api.postcodes.io";

/** Loose — the authority on whether a postcode exists is the lookup, not a regex. */
function looksLikePostcode(value: string): boolean {
  return /^[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}$/i.test(value.trim());
}

async function lookupPostcode(postcode: string): Promise<GeocodeResult | null> {
  const res = await fetch(`${BASE}/postcodes/${encodeURIComponent(postcode.trim())}`);
  if (!res.ok) return null;
  const body = await res.json();
  const r = body?.result;
  if (typeof r?.latitude !== "number") return null;
  return {
    latitude: r.latitude,
    longitude: r.longitude,
    label: `${r.postcode}, ${r.admin_district ?? r.region ?? "UK"}`,
  };
}

/**
 * A place name — "Manchester", "Chorlton".
 *
 * postcodes.io answers this through its outcode and place endpoints; the place
 * search is the one that handles town names, so it is tried first and the
 * partial-postcode path picks up the rest.
 */
async function lookupPlace(query: string): Promise<GeocodeResult | null> {
  const res = await fetch(`${BASE}/places?q=${encodeURIComponent(query.trim())}&limit=1`);
  if (!res.ok) return null;
  const body = await res.json();
  const r = body?.result?.[0];
  if (typeof r?.latitude !== "number") return null;
  return {
    latitude: r.latitude,
    longitude: r.longitude,
    label: [r.name_1, r.county_unitary].filter(Boolean).join(", "),
  };
}

/**
 * @returns coordinates, or null when the place could not be found.
 *
 * Never throws. A geocoder being down must degrade to "we couldn't find that
 * place, here's text search instead" rather than breaking the page — losing the
 * radius filter is a smaller failure than losing the site.
 */
export async function geocodeUk(query: string): Promise<GeocodeResult | null> {
  const value = query.trim();
  if (!value) return null;
  try {
    if (looksLikePostcode(value)) {
      const hit = await lookupPostcode(value);
      if (hit) return hit;
    }
    return await lookupPlace(value);
  } catch {
    return null;
  }
}

const fold = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * A place by name, from the country's own list.
 *
 * Exact first, then "Al Quoz, Dubai" written out in full, then a name that
 * starts with what was typed, then one that merely contains it — so "quoz"
 * finds Al Quoz and "marina" finds Dubai Marina, but neither wins over a place
 * actually called that.
 */
export function findPlace(market: Market, query: string): GeocodeResult | null {
  const wanted = fold(query);
  if (!wanted) return null;
  const named = market.places.map((p) => ({
    p,
    name: fold(p.name),
    full: fold(`${p.name} ${p.region}`),
  }));
  const hit =
    named.find((x) => x.name === wanted) ??
    named.find((x) => x.full === wanted) ??
    named.find((x) => x.name.startsWith(wanted)) ??
    named.find((x) => x.full.includes(wanted));
  if (!hit) return null;
  return {
    latitude: hit.p.latitude,
    longitude: hit.p.longitude,
    label: hit.p.name === hit.p.region ? hit.p.name : `${hit.p.name}, ${hit.p.region}`,
  };
}

/**
 * Turn what a visitor typed into somewhere to search around, by the rules of
 * the country they are browsing.
 *
 * @returns coordinates, or null when the place could not be found. Never throws.
 */
export async function geocodePlace(query: string, market: Market): Promise<GeocodeResult | null> {
  if (market.address.postcode === "required") return geocodeUk(query);
  return findPlace(market, query);
}

/**
 * Is this position plainly inside the country? A box, not a border: it exists
 * so that a location remembered in Manchester is never used to search Dubai.
 */
export function isInside(market: Market, latitude: number, longitude: number): boolean {
  const b = market.bounds;
  return latitude >= b.south && latitude <= b.north && longitude >= b.west && longitude <= b.east;
}
