import L from "leaflet";

/**
 * What the two maps share — the results map and the pin an owner drops on
 * their own premises — so they cannot drift into looking like two products.
 */

/**
 * Leaflet's default marker resolves its icons by relative path, which a bundler
 * rewrites and then cannot find — the symptom is markers rendering as broken
 * images. A drawn SVG avoids it and inherits the brand colour.
 */
export function pin(active: boolean) {
  const fill = active ? "#FF7A00" : "#0E1621";
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${fill}"/>
      <circle cx="14" cy="14" r="5" fill="#fff"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
  });
}

/**
 * Where the map tiles come from — configurable, defaulted to OpenStreetMap.
 *
 * This used to point at CARTO's keyless basemaps, which now stamp
 * **"API KEY REQUIRED"** diagonally across tiles served without one. OSM's
 * standard tiles need no key and look right; their usage policy permits modest
 * traffic with attribution and explicitly does not cover a busy commercial
 * product, so set `VITE_MAP_TILE_URL` and `VITE_MAP_TILE_ATTRIBUTION` to a paid
 * key (MapTiler, CARTO, Thunderforest) before launch.
 *
 * There is no keyless dark basemap worth having, so dark mode dims and slightly
 * desaturates the light tiles in CSS instead.
 */
export function tileConfig(theme: string) {
  const url = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution =
    import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  return { url, attribution, dim: theme === "dark" && !import.meta.env.VITE_MAP_TILE_URL };
}
