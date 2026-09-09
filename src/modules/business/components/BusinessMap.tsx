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
 * **OpenStreetMap via Leaflet, not Google Maps.** Google's JavaScript SDK needs
 * a billed API key, and the MVP exists to prove demand — spending on map loads
 * before there are users is spending to look finished. Directions still hand off
 * to Google, which is where drivers actually navigate, so the trade costs
 * nothing where it matters. Attribution is required by the ODbL and is
 * non-negotiable, not decoration.
 *
 * This component is code-split (see vite.config.ts): the library is ~150 kB and
 * the list is the default view, so it must not sit on the critical path of the
 * screen a driver lands on.
 */

/**
 * Leaflet's default marker resolves its icons by relative path, which a bundler
 * rewrites and then cannot find — the classic symptom is markers rendering as
 * broken images. A drawn SVG avoids the problem entirely and inherits the brand
 * colour instead of shipping a blue pin from 2011.
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
 * Keep the viewport in step with the results.
 *
 * Without this the map holds its initial position while the list underneath it
 * changes, and a driver who narrows the radius watches pins vanish from a view
 * that never moves — which reads as a broken map rather than a working filter.
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
      // interactive by keyboard anyway and the list is the accessible path
      // through the same data.
      aria-label="Map of search results"
    >
      <TileLayer
        // CARTO's tiles come in a light and a dark set, so the map belongs to
        // the page rather than being a bright rectangle in a dark interface —
        // and dark mode is genuinely used here, at night, at the roadside.
        url={
          theme === "dark"
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        }
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
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
