import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, KeyRound, LogOut, Trash2 } from "lucide-react";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/api/http";
import { useAppDispatch } from "@/app/hooks";
import { setAuth } from "@/modules/auth/authSlice";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/components/Button";
import { Dialog } from "@/shared/components/Dialog";
import { Field } from "@/shared/components/Field";
import { DescriptionList, SectionCard } from "@/shared/components/SectionCard";
import { useSeo } from "@/shared/hooks/useSeo";
import { useAuth, useChangePassword } from "@/modules/auth/hooks/useAuth";
import {
  DEFAULT_POLICY,
  useDeleteMyAccount,
  useExportMyData,
  usePrivacyPolicy,
} from "../hooks/useAccount";

/** The word that has to be typed. Upper case so it cannot be a slip of the thumb. */
const CONFIRM_WORD = "DELETE";

/**
 * Your account: what we hold, a copy of it, and the way out.
 *
 * The two rights a person actually exercises — "send me my data" and "delete
 * me" — are buttons here rather than an email address in a policy. An address
 * is a queue somebody has to staff; a button is a right that works at two in
 * the morning.
 *
 * It is also the only place a driver can sign out, which the public side of the
 * product did not have at all.
 */
export function AccountPage() {
  const { user, signOut } = useAuth();
  const { data } = usePrivacyPolicy();
  const policy = data ?? DEFAULT_POLICY;
  const exportData = useExportMyData();
  const deleteAccount = useDeleteMyAccount();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmId = useId();

  useSeo({
    title: "Your account",
    description: "Your RoadAxis account, a copy of your data, and how to delete it.",
    // Somebody's own account is not a page for a search engine.
    noIndex: true,
  });

  if (!user) return null;

  const isDriver = user.role === "driver";
  const isAdmin = user.role === "admin";
  const listings = user.businessIds?.length ?? 0;

  async function download() {
    try {
      const payload = await exportData.mutateAsync();
      // Built in the browser from the response, so the file never exists at a
      // URL anybody else could request.
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "roadaxis-my-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function erase() {
    try {
      await deleteAccount.mutateAsync();
      toast.success("Your account has been deleted");
      // The token is already worthless; this clears it and goes home.
      signOut();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  function closeConfirm() {
    setConfirming(false);
    setTyped("");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-5 md:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What we hold about you, a copy of it, and how to delete it.
        </p>
      </header>

      <SectionCard title="Your details">
        <DescriptionList
          items={[
            { label: "Name", value: user.name },
            { label: "Email", value: user.email },
            { label: "WhatsApp number", value: user.phone ?? "—", mono: Boolean(user.phone) },
            {
              label: "Account type",
              value: isDriver ? "Driver" : isAdmin ? "Administrator" : "Business owner",
            },
          ]}
        />
        <p className="mt-4 text-[13px] text-muted-foreground">
          Something wrong here? Write to{" "}
          <a
            href={`mailto:${policy.contactEmail}`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {policy.contactEmail}
          </a>{" "}
          and we&rsquo;ll put it right.
        </p>
      </SectionCard>

      <SectionCard title="Where to next" flush>
        <ul className="divide-y divide-border">
          {(isDriver
            ? [
                { to: "/my-requests", label: "My requests", hint: "Every request you've sent" },
                { to: "/my-garages", label: "My garages", hint: "The places you've saved" },
              ]
            : [{ to: "/portal", label: "Open the portal", hint: "Your listing and requests" }]
          ).map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="ra-focus-inset flex min-h-[52px] items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Your data"
        description="Everything RoadAxis holds about you, in one file you can keep."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={Download} onClick={() => void download()} loading={exportData.isPending}>
            Download my data
          </Button>
          <p className="text-[13px] text-muted-foreground">
            How long each thing is kept is in our{" "}
            <Link
              to="/privacy#retention"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </SectionCard>

      {/* Staff only. A driver signs in with a code and has no password. */}
      {!isDriver && <ChangePasswordCard />}

      <SectionCard title="Sign out">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Signs you out on this device. Your account and everything in it stays.
          </p>
          <Button icon={LogOut} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Delete your account"
        description="Permanent. There is no way to bring an account back."
      >
        {isAdmin ? (
          <p className="text-sm text-muted-foreground">
            An administrator account is removed by another administrator, so that the console is
            never left with nobody able to open it.
          </p>
        ) : (
          <div className="space-y-3">
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground marker:text-muted-foreground">
              <li>Your reviews and saved garages are deleted.</li>
              <li>
                Your name, number and notes are removed from any booking request you sent. The
                garage keeps the fact that a request was made.
              </li>
              {!isDriver && listings > 0 && (
                <li>
                  Your {listings === 1 ? "listing goes" : `${listings} listings go`} back to being
                  unclaimed, the Verified badge is removed, and the WhatsApp numbers on{" "}
                  {listings === 1 ? "it" : "them"} are deleted.
                </li>
              )}
            </ul>
            <Button variant="danger-outline" icon={Trash2} onClick={() => setConfirming(true)}>
              Delete my account
            </Button>
          </div>
        )}
      </SectionCard>

      <Dialog
        open={confirming}
        onClose={closeConfirm}
        tone="danger"
        title="Delete your account?"
        description="This cannot be undone. Everything listed below the button is removed straight away."
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={deleteAccount.isPending}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              onClick={() => void erase()}
              disabled={typed.trim() !== CONFIRM_WORD}
              loading={deleteAccount.isPending}
            >
              Delete for good
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <label htmlFor={confirmId} className="block text-sm font-medium text-foreground">
            Type {CONFIRM_WORD} to confirm
          </label>
          <input
            id={confirmId}
            data-autofocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="ra-input ra-control w-full px-3 font-mono"
          />
        </div>
      </Dialog>
    </div>
  );
}

/**
 * Change your own password.
 *
 * Staff had no way to do this. The first administrator is created from a seed
 * whose password is printed in the repository, and nothing in the product could
 * change it — which is how a live console ended up behind a published password.
 *
 * The server ends every other session on the account and hands this browser a
 * new one, so the person who changed it stays signed in and nobody else does.
 */
function ChangePasswordCard() {
  const dispatch = useAppDispatch();
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    // The server checks both again; this only saves a round trip.
    if (!current) return setErrors({ currentPassword: "Enter your current password" });
    if (next.length < 10) return setErrors({ newPassword: "Use at least 10 characters" });

    try {
      const { session, message } = await change.mutateAsync({
        currentPassword: current,
        newPassword: next,
      });
      dispatch(setAuth(session));
      setCurrent("");
      setNext("");
      toast.success(message);
    } catch (err) {
      const fields = getApiFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(getApiErrorMessage(err));
    }
  }

  return (
    <SectionCard
      title="Change password"
      description="Changing it signs you out everywhere else. You stay signed in here."
    >
      <form onSubmit={submit} className="space-y-1" noValidate>
        <Field
          label="Current password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.currentPassword}
        />
        <Field
          label="New password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint="At least 10 characters. A long phrase beats a short puzzle."
          error={errors.newPassword}
        />
        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Never disabled while typing — validate on submit and say what is wrong. */}
          <Button type="submit" variant="primary" icon={KeyRound} loading={change.isPending}>
            Change password
          </Button>
          <Button variant="ghost" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? "Hide passwords" : "Show passwords"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
