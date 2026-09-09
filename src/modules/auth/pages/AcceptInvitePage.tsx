import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { http, getApiErrorMessage } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { Logo } from "@/shared/components/Logo";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { useAuth } from "../hooks/useAuth";
import type { Session } from "../types";

/**
 * Set a first password, from the link emailed when a claim is approved.
 *
 * The link *is* the credential — there is nothing else to authenticate with,
 * because this person has never signed in. So the page validates it before
 * showing the form and names the business it belongs to: a bare password box on
 * an anonymous page is asking for trust it has not earned, and the business
 * name is what tells a garage owner this is the thing they applied for a week
 * ago rather than a phishing attempt.
 */
export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { complete } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const res = await http.get<{
        data: { email: string; name: string; businessName: string | null };
      }>(`/auth/invite/${token}`);
      return res.data.data;
    },
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await http.post<{ data: Session }>("/auth/invite/accept", { token, password });
      return res.data.data;
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Checked here rather than server-side: the server has no second field to
    // compare against, and a typo the user cannot see is the whole reason this
    // field exists.
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    try {
      // Straight into the portal. Making somebody set a password and then type
      // it back on a sign-in page is friction with nothing behind it.
      complete(await accept.mutateAsync(), "/portal");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          title="That link is incomplete"
          description="Open the link from your email exactly as it was sent."
        />
      </div>
    );
  }

  if (invite.isLoading) return <PageLoader />;

  if (invite.error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          title="That link has expired"
          description="Links work once and last seven days. Get in touch and we'll send a new one."
          action={
            <Link
              to="/"
              className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
            >
              Back to RoadAxis
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 md:py-16">
      <Logo className="mb-6" />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {invite.data?.businessName
              ? `${invite.data.businessName} is verified`
              : "Your claim was approved"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Set a password and you can start managing the listing.
          </p>
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You'll sign in with{" "}
        <span className="font-medium text-foreground">{invite.data?.email}</span>.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-1" noValidate>
        <div className="relative">
          <Field
            id="password"
            label="New password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className="pe-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 10 characters. Length beats punctuation."
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="ra-tap absolute end-0 top-[1.55rem] flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {show ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <Field
          id="confirm"
          label="Confirm password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={accept.isPending}
          className="ra-tap mt-2 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
        >
          {accept.isPending ? "Setting…" : "Set password and continue"}
        </button>
      </form>
    </div>
  );
}
