import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { getApiErrorMessage } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { Logo } from "@/shared/components/Logo";
import { CodeField } from "../components/CodeField";
import { useAuth, useRequestCodes, useVerifyCodes } from "../hooks/useAuth";
import {
  requestCodesSchema,
  verifyCodesSchema,
  type RequestCodesForm,
  type VerifyCodesForm,
} from "../validations/auth.validation";
import type { CodeChallenge } from "../types";

/**
 * Driver sign-in.
 *
 * Two steps, one screen each, and the copy explains itself at every point —
 * this is the only wall in the public product, and the research is unambiguous
 * that friction here is paid for in abandoned sessions.
 *
 * Both channels are verified because the phone is what a garage messages back
 * when they answer a booking request; an unverified number means a real
 * business contacts a stranger. That cost is paid in one extra field, not one
 * extra screen.
 */
export function SignInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo");
  const { complete, isSignedIn } = useAuth();
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [identity, setIdentity] = useState<RequestCodesForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const request = useRequestCodes();
  const verify = useVerifyCodes();

  const identityForm = useForm<RequestCodesForm>({
    resolver: zodResolver(requestCodesSchema),
    defaultValues: { email: "", phone: "" },
  });
  const codeForm = useForm<VerifyCodesForm>({
    resolver: zodResolver(verifyCodesSchema),
    defaultValues: { emailCode: "", phoneCode: "", name: "" },
  });

  /**
   * Someone who arrives *already* signed in has no business on this page, so
   * they are moved along.
   *
   * The arrival state is captured once, in a ref, and that is the whole point:
   * reacting to `isSignedIn` becoming true would also fire for someone who has
   * just signed in on this very page, on top of the navigation `complete()` has
   * already performed. It did — as a `window.location.replace`, which threw away
   * the running application and reloaded the entire bundle immediately after a
   * successful sign-in.
   */
  const arrivedSignedIn = useRef(isSignedIn);
  useEffect(() => {
    if (arrivedSignedIn.current) navigate(returnTo || "/", { replace: true });
    // Mount only. See above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRequest(values: RequestCodesForm) {
    setFormError(null);
    try {
      const result = await request.mutateAsync(values);
      setChallenge(result);
      setIdentity(values);
      codeForm.reset({ emailCode: "", phoneCode: "", name: "" });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  async function onVerify(values: VerifyCodesForm) {
    if (!challenge) return;
    setFormError(null);
    try {
      const session = await verify.mutateAsync({
        challengeId: challenge.challengeId,
        emailCode: values.emailCode,
        phoneCode: values.phoneCode,
        name: values.name || undefined,
      });
      complete(session, returnTo);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 md:py-16">
      <Logo className="mb-6" />

      {!challenge ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll send a code to your email and a code to your WhatsApp. No password to
            remember.
          </p>

          <form onSubmit={identityForm.handleSubmit(onRequest)} className="mt-6 space-y-1" noValidate>
            <Field
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={identityForm.formState.errors.email?.message}
              {...identityForm.register("email")}
            />
            <Field
              label="WhatsApp number"
              type="tel"
              autoComplete="tel"
              placeholder="07700 900123"
              hint="Businesses reply to you on this number, so it has to be right."
              error={identityForm.formState.errors.phone?.message}
              {...identityForm.register("phone")}
            />

            {formError && <FormError>{formError}</FormError>}

            {/*
              Never disabled while someone is typing. Pre-emptively disabling a
              submit button is a documented anti-pattern: the user cannot tell
              which rule they have failed, only that nothing happens. Validate on
              submit and say what is wrong.
            */}
            <button
              type="submit"
              className="ra-tap mt-2 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
              disabled={request.isPending}
            >
              {request.isPending ? "Sending codes…" : "Send me a code"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Run a garage?{" "}
            <Link to="/staff/sign-in" className="font-medium text-primary-text hover:underline">
              Business sign-in
            </Link>
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setFormError(null);
            }}
            className="ra-tap -ml-2 mb-2 flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Change details
          </button>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Enter your codes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Two codes, one to each place, so we know both reach you. They expire in{" "}
            <span className="font-mono tabular-nums">{challenge.expiresInMinutes}</span> minutes.
          </p>

          {/*
            Only claim a message was sent where it actually was. Telling someone
            to wait for a WhatsApp that never left the building is worse than
            saying nothing.
          */}
          <ul className="mt-4 space-y-1.5 text-sm">
            <DeliveryLine
              icon={Mail}
              ok={challenge.delivery.email}
              target={identity?.email ?? "your email"}
            />
            <DeliveryLine
              icon={MessageCircle}
              ok={challenge.delivery.whatsapp}
              target={identity?.phone ?? "your WhatsApp"}
            />
          </ul>

          {import.meta.env.DEV && challenge.devCodes && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p className="font-medium text-warning">Development mode</p>
              <p className="mt-1 text-muted-foreground">
                Email code <span className="font-mono">{challenge.devCodes.email}</span> · WhatsApp
                code <span className="font-mono">{challenge.devCodes.phone}</span>
              </p>
            </div>
          )}

          <form onSubmit={codeForm.handleSubmit(onVerify)} className="mt-6 space-y-1" noValidate>
            {challenge.isNew && (
              <Field
                label="Your name"
                autoComplete="name"
                placeholder="Sam Okafor"
                hint="Businesses see this on your booking request."
                error={codeForm.formState.errors.name?.message}
                {...codeForm.register("name")}
              />
            )}
            <CodeField
              label="Code from your email"
              autoComplete="off"
              error={codeForm.formState.errors.emailCode?.message}
              {...codeForm.register("emailCode")}
            />
            <CodeField
              label="Code from WhatsApp"
              // Only one field may claim this, or the platform's autofill has
              // two candidates and picks arbitrarily.
              autoComplete="one-time-code"
              error={codeForm.formState.errors.phoneCode?.message}
              {...codeForm.register("phoneCode")}
            />

            {formError && <FormError>{formError}</FormError>}

            <button
              type="submit"
              className="ra-tap mt-2 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
              disabled={verify.isPending}
            >
              {verify.isPending ? "Checking…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => identity && onRequest(identity)}
              disabled={request.isPending}
              className="ra-tap w-full rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-70"
            >
              {request.isPending ? "Sending…" : "Send new codes"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function DeliveryLine({
  icon: Icon,
  ok,
  target,
}: {
  icon: React.ComponentType<{ className?: string }>;
  ok: boolean;
  target: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <Icon
        className={ok ? "h-4 w-4 text-success" : "h-4 w-4 text-muted-foreground"}
        aria-hidden="true"
      />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {ok ? `Sent to ${target}` : `Couldn't send to ${target}`}
      </span>
    </li>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  );
}
