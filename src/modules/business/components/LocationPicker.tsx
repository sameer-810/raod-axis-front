import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/app/theme";
import { pin, tileConfig } from "./mapKit";

interface Position {
  latitude: number;
  longitude: number;
}

/** Five decimal places is about a metre, which is finer than a doorway. */
const round = (n: number) => Number(n.toFixed(5));

/** Follow the pin when it is moved from outside — an area chosen, a location found. */
function Follow({ position, fallback }: { position: Position | null; fallback: Position }) {
  const map = useMap();
  const target = position ?? fallback;
  const zoom = position ? 15 : 11;
  useEffect(() => {
    map.setView([target.latitude, target.longitude], zoom);
    // Keyed on the numbers; the objects are new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.latitude, target.longitude, zoom, map]);
  return null;
}

function TapToPlace({ onChange }: { onChange: (p: Position) => void }) {
  useMapEvents({
    click: (e) => onChange({ latitude: round(e.latlng.lat), longitude: round(e.latlng.lng) }),
  });
  return null;
}

/**
 * A map with one pin, for saying where a business is.
 *
 * It exists for countries without postcodes. In the UK a postcode puts a
 * garage within a street of where it is and nobody is asked for more; in the
 * UAE there is nothing to type that does that, so the owner shows us instead —
 * by tapping the map or dragging the pin.
 *
 * Not the accessible path, and not pretending to be: a map cannot be operated
 * from a keyboard in any way worth the name. "Use my current location" and the
 * coordinate fields beside this do the same job without it.
 *
 * Code-split by its caller, like the results map — the library is ~150 kB.
 */
export function LocationPicker({
  position,
  fallback,
  onChange,
}: {
  /** Where the pin is, or null before one has been placed. */
  position: Position | null;
  /** Where to open the map while there is no pin. */
  fallback: Position;
  onChange: (p: Position) => void;
}) {
  const { theme } = useTheme();
  const tiles = tileConfig(theme);
  const marker = useRef<LeafletMarker | null>(null);

  const handlers = useMemo(
    () => ({
      dragend() {
        const at = marker.current?.getLatLng();
        if (at) onChange({ latitude: round(at.lat), longitude: round(at.lng) });
      },
    }),
    [onChange],
  );

  const start = position ?? fallback;

  return (
    <div className="ra-map-frame ra-picker h-64">
      <MapContainer
        center={[start.latitude, start.longitude]}
        zoom={position ? 15 : 11}
        scrollWheelZoom={false}
        className="h-full w-full"
        aria-label="Map for placing the business. Tap to place the pin, or drag it."
      >
        <TileLayer
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={19}
          className={tiles.dim ? "ra-map-tiles-dark" : undefined}
        />
        <Follow position={position} fallback={fallback} />
        <TapToPlace onChange={onChange} />
        {position && (
          <Marker
            ref={marker}
            draggable
            position={[position.latitude, position.longitude]}
            icon={pin(true)}
            eventHandlers={handlers}
            title="The business. Drag to move."
          />
        )}
      </MapContainer>
    </div>
  );
}
