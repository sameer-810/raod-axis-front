/**
 * @module geocode
 * @description Turning a typed place into coordinates — the other half of
 * FR-DIS-05, so someone who refuses location access can still search.
 *
 * **postcodes.io** rather than a commercial geocoder: free, no key, no rate limit
 * worth worrying about at this scale, and UK-only, which is exactly the market
 * (D-001). A paid geocoder is the right answer when multi-country arrives.
 *
 * It handles both a full postcode and a place name, which between them cover
 * nearly everything a driver types.
 */

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
