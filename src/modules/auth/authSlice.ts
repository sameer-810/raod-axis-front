import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Three roles, and the distinction that matters most is the first one:
 *
 *  - `driver` — a consumer. Browses without an account at all; signs in only to
 *    request a booking, save a favourite or leave a review.
 *  - `business_owner` — scoped to the businesses they have had approved.
 *  - `admin` — RoadAxis staff.
 *
 * A signed-out visitor is not a fourth role. They are the *default* state of the
 * public product, which is why nothing here gates public routes.
 */
export type Role = "driver" | "business_owner" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  /** Businesses this owner may manage. Empty for drivers and admins. */
  businessIds?: string[];
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /**
   * Where to return to after signing in.
   *
   * Load-bearing for conversion, not a convenience. The account wall stands at
   * exactly one door — submitting a booking request — and the research is clear
   * that authentication friction at the conversion moment measurably depresses
   * completion. Sending someone back to the home page after they sign in, having
   * lost the form they had filled in, is how that happens.
   */
  returnTo: string | null;
}

const STORAGE_KEY = "roadaxis_auth";

function readStored(): Pick<AuthState, "accessToken" | "user"> {
  if (typeof window === "undefined") return { accessToken: null, user: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, user: null };
    const parsed = JSON.parse(raw);
    return { accessToken: parsed.accessToken ?? null, user: parsed.user ?? null };
  } catch {
    // Corrupt or unreadable storage is a signed-out session, not a crash.
    return { accessToken: null, user: null };
  }
}

function persist(state: AuthState) {
  try {
    if (state.accessToken) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accessToken: state.accessToken, user: state.user }),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Private browsing, or storage disabled. The session still works for as
    // long as the tab is open, which is better than refusing to sign in.
  }
}

const initialState: AuthState = { ...readStored(), returnTo: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ accessToken: string; user: AuthUser }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      persist(state);
    },
    clearAuth(state) {
      state.accessToken = null;
      state.user = null;
      persist(state);
    },
    setReturnTo(state, action: PayloadAction<string | null>) {
      state.returnTo = action.payload;
    },
  },
});

export const { setAuth, clearAuth, setReturnTo } = authSlice.actions;
export default authSlice.reducer;
