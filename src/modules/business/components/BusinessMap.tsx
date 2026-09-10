import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { TrustRow } from "@/shared/components/TrustRow";
import { useTheme } from "@/app/theme";
import type { BusinessCard } from "../types";

/**
 * The map view.
 *
 * OpenStreetMap via Leaflet, not Google Maps: Google's SDK needs a billed API
 * key, and the MVP exists to prove demand. Directions still hand off to Google,
 * which is where drivers navigate. Attribution is required by the ODbL and is
 * not decoration.
 *
 * Code-split (see vite.config.ts) — the library is ~150 kB and the list is the
 * default view, so it must not sit on the critical path.
 */

/**
 * Leaflet's default marker resolves its icons by relative path, which a bundler
 * rewrites and then cannot find — the symptom is markers rendering as broken
 * images. A drawn SVG avoids it and inherits the brand colour.
 */
function pin(active: boolean) {
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
 * Keep the viewport in step with the results. Without this the map holds its
 * initial position while the list changes, and a driver who narrows the radius
 * watches pins vanish from a view that never moves.
 */
function FitToResults({ businesses }: { businesses: BusinessCard[] }) {
  const map = useMap();
  const key = businesses.map((b) => b.id).join(",");

  useEffect(() => {
    const points = businesses
      .filter((b) => b.coordinates)
      .map((b) => [b.coordinates!.latitude, b.coordinates!.longitude] as [number, number]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    // Keyed on the ids rather than the array, which is a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
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
function tileConfig(theme: string) {
  const url = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution =
    import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  return { url, attribution, dim: theme === "dark" && !import.meta.env.VITE_MAP_TILE_URL };
}

export function BusinessMap({
  businesses,
  centre,
  activeId,
}: {
  businesses: BusinessCard[];
  centre?: { latitude: number; longitude: number };
  activeId?: string | null;
}) {
  const { theme } = useTheme();
  const tiles = tileConfig(theme);

  const withCoords = useMemo(() => businesses.filter((b) => b.coordinates), [businesses]);

  const initial: [number, number] = centre
    ? [centre.latitude, centre.longitude]
    : withCoords[0]?.coordinates
      ? [withCoords[0].coordinates.latitude, withCoords[0].coordinates.longitude]
      : // Manchester, only as a last resort when there is nothing at all to show.
        [53.4808, -2.2426];

  return (
    <MapContainer
      center={initial}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
      // Leaflet renders its own focus outlines badly; the container is not
      // keyboard-interactive anyway and the list is the accessible path.
      aria-label="Map of search results"
    >
      <TileLayer
        url={tiles.url}
        attribution={tiles.attribution}
        maxZoom={19}
        className={tiles.dim ? "ra-map-tiles-dark" : undefined}
      />

      <FitToResults businesses={withCoords} />

      {/* Where the driver is. A plain disc, not a pin — it is not a result, and
          giving it the same marker as a garage is how people tap their own
          location expecting a business. */}
      {centre && (
        <CircleMarker
          center={[centre.latitude, centre.longitude]}
          radius={7}
          pathOptions={{ color: "#FF7A00", fillColor: "#FF7A00", fillOpacity: 0.9, weight: 2 }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
      )}

      {withCoords.map((b) => (
        <Marker
          key={b.id}
          position={[b.coordinates!.latitude, b.coordinates!.longitude]}
          icon={pin(activeId === b.id)}
        >
          {/* Selecting a pin shows the record without leaving the map — going
              back and forth to the profile to compare three garages is the
              thing a map view is supposed to avoid. */}
          <Popup>
            <div className="min-w-[190px] space-y-1.5">
              <Link
                to={`/business/${b.slug}`}
                className="block text-sm font-semibold text-foreground hover:underline"
              >
                {b.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {b.categories
                  .map((c) => c.name)
                  .slice(0, 2)
                  .join(" · ")}
              </p>
              <TrustRow
                verified={b.isVerified}
                averageRating={b.averageRating}
                reviewCount={b.reviewCount}
                isOpen={b.isOpen ?? undefined}
                distanceMetres={b.distanceMetres}
              />
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
