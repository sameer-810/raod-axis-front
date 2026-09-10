import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import type { Role } from "@/modules/auth/authSlice";

/**
 * Gate a route behind a session, and optionally behind a role. Two things:
 *
 *  1. Carries the intended destination forward. Signing in and landing on a home
 *     page, having lost what you were doing, is how authentication friction
 *     turns into abandonment.
 *  2. Sends the wrong role home rather than to a sign-in page they are already
 *     past, which would be a loop.
 *
 * Convenience and navigation, **not** the access control — that is enforced on
 * the server, on every route (FR-AUT-05).
 */
export function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { accessToken, user } = useAppSelector((s) => s.auth);
  const location = useLocation();

  if (!accessToken || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?returnTo=${returnTo}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
