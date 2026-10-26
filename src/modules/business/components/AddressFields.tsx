import { lazy, Suspense, useCallback, useId, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Field } from "@/shared/components/Field";
import { useMarket } from "@/app/market";
import { findPlace, geocodeUk, isInside } from "@/shared/lib/geocode";

/** ~150 kB of map library, loaded only where there is no postcode to do its job. */
const LocationPicker = lazy(() =>
  import("./LocationPicker").then((m) => ({ default: m.LocationPicker })),
);

/** The address and position of a business, as the form holds them: all text. */
export interface AddressDraft {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  latitude: string;
  longitude: string;
}

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Where a business is — its address, and its position on the map.
 *
 * One component for both forms that ask (an owner adding their garage, and the
 * listing editor), because the hard part is the same in each: **what an address
 * is depends on the country.**
 *
 *  - In the UK a postcode completes the address and, looked up, places the
 *    business within a street of where it is. Nobody is asked for more.
 *  - In the UAE there are no postcodes. The address is a street, an area and an
 *    emirate, and the position is given separately: a known area puts the pin
 *    in the middle of it, and the owner moves it to their door — or uses the
 *    phone in their hand, or taps the map.
 *
 * The country is the listing's own. It can be chosen when a listing is being
 * created and never afterwards: a garage does not move between countries, and
 * a form that let it would change its currency, its clock and how its phone
 * number is read in one click.
 *
 * @param voice "you" speaks to an owner about their own premises; "it" to
 *        somebody editing a listing.
 */
export function AddressFields({
  value,
  onChange,
  errors,
  voice,
  countryLocked = false,
  anyCountry = false,
  onLocated,
}: {
  value: AddressDraft;
  onChange: (patch: Partial<AddressDraft>) => void;
  errors: Record<string, string>;
  voice: "you" | "it";
  countryLocked?: boolean;
  /**
   * Offer every country the server serves, paused ones included. The console's
   * form does; the public registration form offers only open countries.
   */
  anyCountry?: boolean;
  /** Called when a lookup has placed the business, for duplicate checks. */
  onLocated?: (latitude: number, longitude: number) => void;
}) {
  const { markets: open, allMarkets, marketFor } = useMarket();
  const markets = anyCountry ? allMarkets : open;
  const hasChoice = markets.length > 1;
  const market = marketFor(value.country);
  const byPostcode = market.address.postcode === "required";
  const [note, setNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const ids = useId();

  const set = (key: keyof AddressDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ [key]: e.target.value });

  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const hasPosition =
    value.latitude !== "" &&
    value.longitude !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  /** Postcode → coordinates, on blur. Nobody knows their own latitude. */
  async function resolvePostcode() {
    if (!value.postcode.trim()) return;
    const hit = await geocodeUk(value.postcode);
    if (!hit) {
      setNote(
        voice === "you"
          ? "We couldn't place that postcode. Check it and try again."
          : "Couldn't place that postcode. Check it, or enter coordinates below.",
      );
      return;
    }
    setNote(`${voice === "you" ? "Found" : "Located"}: ${hit.label}`);
    onChange({
      latitude: String(hit.latitude),
      longitude: String(hit.longitude),
      // Only the listing editor fills the town in, and only when it is empty.
      ...(voice === "it" && !value.city ? { city: hit.label.split(",")[1]?.trim() ?? "" } : {}),
    });
    onLocated?.(hit.latitude, hit.longitude);
  }

  /**
   * A named area → the middle of it. A starting point for the pin, said to be
   * one: an owner who leaves it there is listed in the right district, and one
   * who moves it is listed at their door.
   */
  function resolveArea() {
    if (!value.city.trim()) return;
    const hit = findPlace(market, value.city);
    if (!hit) {
      if (!hasPosition) {
        setNote(
          `We don't have "${value.city.trim()}" on our list. Use your current location, or tap the map where the business is.`,
        );
      }
      return;
    }
    const place = market.places.find(
      (p) => p.latitude === hit.latitude && p.longitude === hit.longitude,
    );
    setNote(`Placed in the middle of ${hit.label}. Move the pin to the exact spot.`);
    onChange({
      latitude: String(hit.latitude),
      longitude: String(hit.longitude),
      ...(place && !value.region ? { region: place.region } : {}),
    });
    onLocated?.(hit.latitude, hit.longitude);
  }

  /** The phone in the owner's hand, when they are standing in the workshop. */
  function placeAtDevice() {
    if (!("geolocation" in navigator)) {
      setNote("This device can't share its location. Tap the map where the business is.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        if (!isInside(market, lat, lng)) {
          setNote(
            `This device doesn't seem to be in ${market.shortName}. Tap the map where the business is instead.`,
          );
          return;
        }
        setNote("Placed where you are now. Move the pin if it isn't quite right.");
        onChange({ latitude: String(lat), longitude: String(lng) });
        onLocated?.(lat, lng);
      },
      () => {
        setLocating(false);
        setNote("We couldn't get your location. Tap the map where the business is.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const movePin = useCallback(
    (p: { latitude: number; longitude: number }) => {
      setNote("Pin placed. This is where drivers will be sent.");
      onChange({ latitude: String(p.latitude), longitude: String(p.longitude) });
    },
    [onChange],
  );

  // The areas offered are the chosen emirate's, or all of them before one is.
  const areas = market.places.filter((p) => !value.region || p.region === value.region);
  // A district rather than the emirate's own name, which is no example of an area.
  const example = (areas.find((p) => p.name !== p.region) ?? areas[0])?.name ?? "Al Quoz";

  return (
    <>
      {hasChoice &&
        (countryLocked ? (
          <div className="space-y-1.5 pb-[1.625rem]">
            <p className="text-sm font-medium text-foreground">Country</p>
            <p className="flex h-11 items-center rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground">
              {market.name}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-country`} className="block text-sm font-medium text-foreground">
              Country
            </label>
            <select
              id={`${ids}-country`}
              value={market.code}
              onChange={(e) => {
                setNote(null);
                // A different country is a different kind of address, and a
                // position in the last one means nothing in this one.
                onChange({
                  country: e.target.value,
                  region: "",
                  postcode: "",
                  latitude: "",
                  longitude: "",
                });
              }}
              aria-describedby={errors["address.country"] ? `${ids}-country-message` : undefined}
              className={selectClass}
            >
              {markets.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
            <p
              id={`${ids}-country-message`}
              role={errors["address.country"] ? "alert" : undefined}
              className="min-h-[1.25rem] text-xs text-destructive"
            >
              {errors["address.country"]}
            </p>
          </div>
        ))}

      <Field
        label="Street address"
        value={value.line1}
        onChange={set("line1")}
        error={errors["address.line1"]}
      />
      <Field label="Address line 2" value={value.line2} onChange={set("line2")} />

      <div className="grid gap-3 sm:grid-cols-2">
        {byPostcode ? (
          <>
            <Field
              label={market.address.cityLabel}
              value={value.city}
              onChange={set("city")}
              error={errors["address.city"]}
            />
            <Field
              label={market.address.postcodeLabel ?? "Postcode"}
              value={value.postcode}
              onChange={set("postcode")}
              onBlur={resolvePostcode}
              error={errors["address.postcode"]}
              hint={`Tab out to place ${voice} on the map.`}
            />
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label
                htmlFor={`${ids}-region`}
                className="block text-sm font-medium text-foreground"
              >
                {market.address.regionLabel ?? "Region"}
              </label>
              <select
                id={`${ids}-region`}
                value={value.region}
                onChange={(e) => onChange({ region: e.target.value })}
                aria-invalid={errors["address.region"] ? true : undefined}
                aria-describedby={`${ids}-region-message`}
                className={selectClass}
              >
                <option value="">Choose…</option>
                {market.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p
                id={`${ids}-region-message`}
                role={errors["address.region"] ? "alert" : undefined}
                aria-live="polite"
                className="min-h-[1.25rem] text-xs text-destructive"
              >
                {errors["address.region"]}
              </p>
            </div>
            <Field
              label={market.address.cityLabel}
              value={value.city}
              onChange={set("city")}
              onBlur={resolveArea}
              error={errors["address.city"]}
              list={`${ids}-areas`}
              hint={`For example ${example}. Tab out to place ${voice} on the map.`}
            />
            <datalist id={`${ids}-areas`}>
              {areas.map((p) => (
                <option key={`${p.region}-${p.name}`} value={p.name} />
              ))}
            </datalist>
          </>
        )}
      </div>

      {note && (
        <p
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
          aria-live="polite"
        >
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {note}
        </p>
      )}

      {!byPostcode && (
        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Position on the map</p>
            <button
              type="button"
              onClick={placeAtDevice}
              disabled={locating}
              className="ra-tap inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
              {locating ? "Finding you…" : "Use my current location"}
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground">
            There are no postcodes in {market.shortName}, so show us where{" "}
            {voice === "you" ? "you are" : "it is"}: tap the map, or drag the pin. This is where
            drivers are sent.
          </p>
          <Suspense fallback={<div className="ra-map-frame h-64" aria-hidden="true" />}>
            <LocationPicker
              position={hasPosition ? { latitude, longitude } : null}
              fallback={
                market.places.find((p) => p.name === value.region && p.region === value.region) ??
                market.centre
              }
              onChange={movePin}
            />
          </Suspense>
        </div>
      )}

      {/* The path that needs neither a postcode nor a map: the numbers themselves. */}
      {(voice === "it" || !byPostcode) && (
        <details className="pt-1">
          <summary className="ra-control inline-flex cursor-pointer items-center text-[13px] text-muted-foreground hover:text-foreground">
            Map coordinates
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field
              label="Latitude"
              value={value.latitude}
              onChange={set("latitude")}
              className="font-mono"
            />
            <Field
              label="Longitude"
              value={value.longitude}
              onChange={set("longitude")}
              className="font-mono"
            />
          </div>
        </details>
      )}
    </>
  );
}
