import axios from "axios";
import { store } from "@/app/store";
import { clearAuth } from "@/modules/auth/authSlice";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5005/api",
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Public routes on this API answer without a token, so a 401 means an *expired*
 * session and never "you needed to sign in for this".
 *
 * The redirect is therefore conditional on having held a token: a guest browsing
 * search results must never be bounced to a sign-in page, which is the standard
 * failure mode when this interceptor is copied from an authenticated-only
 * product. Guests browse everything (D-005).
 */
http.interceptors.response.use(
  (response) => response,
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const hadToken = Boolean(store.getState().auth.accessToken);
      if (hadToken) {
        store.dispatch(clearAuth());
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
          const back = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.assign(`/sign-in?returnTo=${back}`);
        }
      }
    }
    return Promise.reject(err);
  },
);

type ApiErrorResponse = {
  error?: { message?: string; details?: Array<{ path?: string; message?: string }> };
};

/**
 * The message a human should see. A validation failure carries a useful per-field
 * message underneath a useless generic one, so the specific one wins — "Enter a
 * valid UK postcode" rather than "Validation error".
 */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED") return "That took too long. Check your connection and retry.";
    if (!err.response) return "Can't reach RoadAxis. Check your connection and retry.";

    const data = err.response.data as ApiErrorResponse | undefined;
    if (data?.error?.message) {
      const detail = data.error.details?.[0]?.message;
      if (data.error.message === "Validation error" && detail) return detail;
      return String(data.error.message);
    }
    if (err.message) return err.message;
  }
  return "Something went wrong";
}

/** Field-level errors, for feeding straight back into react-hook-form. */
export function getApiFieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!axios.isAxiosError(err)) return out;
  const details = (err.response?.data as ApiErrorResponse | undefined)?.error?.details ?? [];
  for (const d of details) {
    if (!d.path || !d.message) continue;
    // The server validates { body, params, query }; the form only knows the
    // field name, so the envelope prefix is stripped.
    out[d.path.replace(/^body\./, "")] = d.message;
  }
  return out;
}
