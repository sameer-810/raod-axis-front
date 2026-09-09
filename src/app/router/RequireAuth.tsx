import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import type { Role } from "@/modules/auth/authSlice";

/**
 * Gate a route behind a session, and optionally behind a role.
 *
 * Two things this deliberately does:
 *
 *  1. **Carries the intended destination forward.** Signing in and landing on a
 *     home page, having lost what you were doing, is how authentication friction
 *     turns into abandonment — and the research is clear that the cost is worst
 *     on mobile, which is most of this product.
 *
 *  2. **Sends the wrong role somewhere useful, not to a dead end.** A signed-in
 *     driver who follows an admin link is not unauthenticated; bouncing them to
 *     a sign-in page they are already past is a loop. They go home.
 *
 * This is convenience and navigation. It is **not** the access control — that is
 * enforced on the server, on every route (FR-AUT-05). Hiding a screen is never
 * the control.
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
