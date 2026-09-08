import { useCallback, useEffect, useState } from "react";

/**
 * The browser's location, asked for carefully.
 *
 * Two rules, both from the research on marketplace conversion and both easy to
 * get wrong:
 *
 *  1. **Never prompt on page load.** A permission dialog on arrival, before the
 *     visitor knows what the site is, is the fastest way to a permanent denial —
 *     and once denied it cannot be asked again from the page. So this starts
 *     idle and only prompts when something calls `request()`.
 *  2. **A denial is not an error state.** It is one of the two normal paths
 *     (FR-DIS-05). The caller falls back to a town or postcode; nothing about
 *     the interface should imply the visitor did something wrong.
 */

type Status = "idle" | "prompting" | "granted" | "denied" | "unavailable";

export interface GeoState {
  status: Status;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  error?: string;
}

const STORAGE_KEY = "roadaxis_last_location";

/**
 * The last known position, remembered.
 *
 * Someone returning to the site should see nearby results immediately rather
 * than an empty screen while the device takes three seconds to get a fix. It is
 * replaced as soon as a fresh reading arrives.
 */
function readCached(): GeoState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.latitude !== "number" || typeof parsed?.longitude !== "number") return null;
    // A day old is fine for "roughly where you are"; a month old is not.
    if (Date.now() - (parsed.at ?? 0) > 24 * 60 * 60 * 1000) return null;
    return { status: "granted", latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(() => readCached() ?? { status: "idle" });

  useEffect(() => {
    if (!("geolocation" in navigator)) setState({ status: "unavailable" });
  }, []);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }
    setState((s) => ({ ...s, status: "prompting" }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: GeoState = {
          status: "granted",
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
          accuracy: pos.coords.accuracy,
        };
        setState(next);
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ latitude: next.latitude, longitude: next.longitude, at: Date.now() }),
          );
        } catch {
          // Private browsing. The reading still works for this session.
        }
      },
      (err) => {
        setState({
          status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          error: err.message,
        });
      },
      {
        // Street-level is plenty for "which garage is nearest", and asking for
        // better costs battery and several seconds on a phone that is often the
        // reason someone is on this page at all.
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  }, []);

  const clear = useCallback(() => {
    setState({ status: "idle" });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  return { ...state, request, clear };
}
