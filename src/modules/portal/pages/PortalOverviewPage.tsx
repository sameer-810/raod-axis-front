import { BadgeCheck } from "lucide-react";
import { useAppSelector } from "@/app/hooks";
import { StatCard } from "@/shared/components/StatCard";
import { Badge } from "@/shared/components/Badge";

/**
 * Phase 1 — the portal's landing page.
 *
 * Deliberately not a mocked-up dashboard. The tiles it will carry — today's
 * requests, open requests, WhatsApp status — need Phase 4 and Phase 5 behind
 * them, and inventing plausible numbers now would invite sign-off on something
 * with nothing underneath it.
 *
 * What it does prove is the part Phase 1 delivers: the shell, the role-filtered
 * navigation, and that the session is real and scoped to the right person.
 */
export function PortalOverviewPage() {
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div className="ra-page">
      <div>
        <Badge tone="primary">Phase 1 · Identity</Badge>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your listing, WhatsApp numbers and booking requests arrive here as each phase lands.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Signed in as" value={user?.name ?? "—"} hint={user?.email} />
        <StatCard
          label="Role"
          value={<span className="capitalize">{user?.role?.replace("_", " ") ?? "—"}</span>}
          hint="Enforced on the server, on every route"
        />
        <StatCard
          label="Businesses"
          value={user?.businessIds?.length ?? 0}
          hint="Granted when a claim is approved"
        />
      </div>

      <div className="ra-tile">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Your account is verified on both channels
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Email {user?.email}
              {user?.phone ? ` · WhatsApp ${user.phone}` : ""}. Booking requests will reach you on
              the numbers you set up in Phase 4.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
