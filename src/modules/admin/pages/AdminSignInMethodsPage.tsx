import { KeyRound, Mail, MessageSquareText } from "lucide-react";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { PageHeader } from "@/shared/components/PageHeader";
import { Switch } from "@/shared/components/Switch";
import { EmptyState } from "@/shared/components/EmptyState";
import { Skeleton } from "@/shared/components/Skeleton";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import type { SignInMethodOverview } from "../api/adminApi";
import { useAdminSignInMethods, useSetSignInMethod } from "../hooks/useAdmin";

/**
 * Console → Sign-in methods — D-046. The client asked (5 November 2026) for
 * the "Send code by" options on the driver sign-in page to be switched on and
 * off from the console, the way countries are (D-043).
 *
 * Two things decide whether drivers see a method, and the page shows both:
 * whether it is switched on here, and whether the server can deliver it. A
 * method switched on but not connected stays hidden until it is, and the page
 * says what the server is missing. The last method drivers can actually use
 * cannot be switched off, or nobody could sign in at all.
 */
const ICONS: Record<SignInMethodOverview["method"], React.ComponentType<{ className?: string }>> = {
  whatsapp: WhatsAppIcon,
  sms: MessageSquareText,
  email: Mail,
  google: GoogleMark,
};

export function AdminSignInMethodsPage() {
  const { data: methods = [], isLoading } = useAdminSignInMethods();
  const setEnabled = useSetSignInMethod();

  const offered = methods.filter((m) => m.available);
  /** The only method drivers can use: switching it off would lock everybody out. */
  const isLastWayIn = (m: SignInMethodOverview) => m.available && offered.length <= 1;

  async function toggle(m: SignInMethodOverview, enabled: boolean) {
    try {
      await setEnabled.mutateAsync({ method: m.method, enabled });
      toast.success(enabled ? `${m.label} switched on` : `${m.label} switched off`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="ra-page">
      <PageHeader
        title="Sign-in methods"
        description="How drivers can sign in. Switch a method off and it disappears from the sign-in page straight away; switch it on and it appears, as long as the server can deliver it."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{offered.length}</span> of{" "}
            <span className="font-mono tabular-nums text-foreground">{methods.length}</span> offered
          </span>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No sign-in methods"
          description="The server returned none. Check that it is running the latest release."
        />
      ) : (
        <ul className="space-y-3" aria-label="Sign-in methods">
          {methods.map((m) => {
            const Icon = ICONS[m.method];
            return (
              <li key={m.method} className="ra-card flex items-start gap-4 p-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"
                >
                  <Icon
                    className={
                      m.method === "whatsapp"
                        ? "h-5 w-5 text-whatsapp"
                        : m.method === "sms"
                          ? "h-5 w-5 text-success"
                          : "h-5 w-5 text-foreground"
                    }
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {m.label}
                    <ConnectionBadge connection={m.connection} />
                  </p>
                  <p
                    className="mt-1 text-[13px] text-muted-foreground"
                    data-testid={`state-${m.method}`}
                  >
                    {describe(m)}
                  </p>
                  {m.connection === "not_connected" && (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      <span className="font-medium text-foreground">Needs:</span> {m.needs}
                    </p>
                  )}
                </div>
                <Switch
                  checked={m.enabled}
                  onChange={(v) => void toggle(m, v)}
                  disabled={setEnabled.isPending || (m.enabled && isLastWayIn(m))}
                  label={m.enabled ? `Switch off ${m.label}` : `Switch on ${m.label}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 space-y-1.5 text-[13px] text-muted-foreground">
        {offered.length <= 1 && methods.length > 0 && (
          <p>
            Drivers always need at least one way in. To switch this one off, switch on another that
            is connected first.
          </p>
        )}
        <p>
          A change reaches the sign-in page within a minute. Connecting a method — a WhatsApp
          Business account, a Twilio account, a mail server or a Google client — is a setting on the
          server, not here.
        </p>
      </div>
    </div>
  );
}

function describe(m: SignInMethodOverview): string {
  if (!m.enabled) return "Switched off: drivers don't see it.";
  if (m.connection === "not_connected")
    return "Switched on, but hidden until the server is connected.";
  if (m.connection === "test")
    return "Shown on the sign-in page. Test mode: codes are shown on screen, not sent.";
  return "Shown on the sign-in page.";
}

function ConnectionBadge({ connection }: { connection: SignInMethodOverview["connection"] }) {
  if (connection === "connected") return <Badge tone="success">Connected</Badge>;
  if (connection === "test") return <Badge tone="warning">Test mode</Badge>;
  return <Badge>Not connected</Badge>;
}

/** Google's G, small and in colour, as on the sign-in page's button. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
