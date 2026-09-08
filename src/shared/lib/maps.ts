/**
 * @module maps
 * @description Google Maps links, built in one place.
 *
 * The profile gets `directionsUrl` from the server, which is where the
 * coordinate ordering is decided. This exists for the search card, which
 * receives raw coordinates and would otherwise assemble the string itself in a
 * dozen components — and GeoJSON stores [lng, lat] while every map URL is
 * lat,lng, so a transposition is one careless line away and puts a Manchester
 * garage in the North Sea.
 *
 * The `?api=1` universal form is the one Google documents as opening the native
 * app on Android and iOS and the web elsewhere, which is why it is used rather
 * than a platform-specific scheme.
 */

export function googleMapsDirections({
  latitude,
  longitude,
  placeId,
}: {
  latitude: number;
  longitude: number;
  placeId?: string | null;
}): string {
  const params = new URLSearchParams({ api: "1", destination: `${latitude},${longitude}` });
  if (placeId) params.set("destination_place_id", placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
