import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { queryClient } from "@/app/queryClient";
import { authApi } from "../api/authApi";
import { forgetStoredSession, setAuth, type AuthUser } from "../authSlice";
import type { Session } from "../types";

/**
 * Where a given role belongs after signing in. A driver signs in *because they
 * were doing something*, so the caller's `returnTo` always wins. Staff have a
 * home: the console for an administrator, the portal for an owner.
 */
function landingFor(user: AuthUser): string {
  if (user.role === "driver") return "/";
  return user.role === "admin" ? "/admin" : "/portal";
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, accessToken } = useAppSelector((s) => s.auth);

  const complete = useCallback(
    (session: Session, returnTo?: string | null) => {
      dispatch(setAuth(session));
      // The cache belongs to whoever was signed in a moment ago. Anything held
      // from a previous session — or from browsing as a guest — is now wrong.
      queryClient.clear();
      navigate(returnTo || landingFor(session.user), { replace: true });
    },
    [dispatch, navigate],
  );

  /**
   * Sign out and go home, as a fresh load of the page.
   *
   * A full load rather than a client-side navigation, deliberately: see
   * `forgetStoredSession` for the race it avoids. It also drops every cached
   * response and every piece of in-memory state belonging to whoever was
   * signed in, which on a shared phone is the point of signing out.
   */
  const signOut = useCallback(() => {
    forgetStoredSession();
    window.location.replace("/");
  }, []);

  return { user, accessToken, isSignedIn: Boolean(accessToken && user), complete, signOut };
}

export function useRequestCodes() {
  return useMutation({ mutationFn: authApi.requestCodes });
}

export function useVerifyCodes() {
  return useMutation({ mutationFn: authApi.verifyCodes });
}

export function useStaffLogin() {
  return useMutation({ mutationFn: authApi.login });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword });
}
