import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import axios from "axios";
import { getApiErrorMessage } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { PhoneField } from "@/shared/components/PhoneField";
import { LegalNote } from "@/shared/components/LegalNote";
import { useSeo } from "@/shared/hooks/useSeo";
import { AuthShell } from "../components/AuthShell";
import { CodeField } from "../components/CodeField";
import { GoogleButton } from "../components/GoogleButton";
import { GoogleCancelled, requestGoogleToken } from "../lib/googleIdentity";
import {
  useAuth,
  useAuthProviders,
  useGoogleSignIn,
  useRequestCodes,
  useVerifyCodes,
} from "../hooks/useAuth";
import {
  googleDetailsSchema,
  requestCodesSchema,
  verifyBothCodesSchema,
  verifyEmailCodeSchema,
  verifyWhatsAppCodeSchema,
  type GoogleDetailsForm,
  type RequestCodesForm,
  type VerifyCodesForm,
} from "../validations/auth.validation";
import type { CodeChallenge, GoogleSignInPayload, GoogleSignInResult } from "../types";

/**
 * Driver sign-in. Two steps, one screen each, with copy that explains itself at
 * every point — this is the only wall in the public product.
 *
 * How many codes is the server's decision, carried on the challenge. With the
 * WhatsApp service connected there are two, because the phone is what a garage
 * messages back and an unverified number means a real business contacts a
 * stranger. Without it there is one, to the email. The page asks for whichever
 * the challenge names and never mentions a message that was not sent.
 *
 * "Continue with Google" (D-039) replaces the emailed code and nothing else.
 * Google proves the address; the WhatsApp number is still asked for when the
 * account has none, and still proved by its code where numbers are — on the
 * same code screen, which then asks for that one code.
 */
export function SignInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo");
  const { complete, isSignedIn } = useAuth();
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [identity, setIdentity] = useState<RequestCodesForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /** After Google: who they are, while the page asks for what Google does not know. */
  const [google, setGoogle] = useState<{
    accessToken: string;
    email: string;
    isNew: boolean;
    name: string;
  } | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  /** The last thing sent to /auth/google, so "Send a new code" can send it again. */
  const lastGoogle = useRef<GoogleSignInPayload | null>(null);

  const request = useRequestCodes();
  const verify = useVerifyCodes();
  const googleSignIn = useGoogleSignIn();
  const { data: providers } = useAuthProviders();

  useSeo({
    title: "Sign in",
    description:
      "Sign in to RoadAxis with a one-time code to send booking requests and save the garages you trust.",
  });

  /** Two codes only when the challenge says so. Before one exists, assume one. */
  const needsWhatsAppCode = Boolean(challenge?.channels?.whatsapp);
  /** No emailed code when Google has already proved the address. */
  const needsEmailCode = challenge?.channels?.email !== false;

  const identityForm = useForm<RequestCodesForm>({
    resolver: zodResolver(requestCodesSchema),
    defaultValues: { email: "", phone: "" },
  });
  const codeForm = useForm<VerifyCodesForm>({
    // Chosen per render, so the rule always matches the fields on screen.
    resolver: zodResolver(
      !needsEmailCode
        ? verifyWhatsAppCodeSchema
        : needsWhatsAppCode
          ? verifyBothCodesSchema
          : verifyEmailCodeSchema,
    ),
    defaultValues: { emailCode: "", phoneCode: "", name: "" },
  });
  const detailsForm = useForm<GoogleDetailsForm>({
    resolver: zodResolver(googleDetailsSchema),
    defaultValues: { name: "", phone: "" },
  });

  /**
   * Someone who arrives *already* signed in is moved along.
   *
   * The arrival state is captured once, in a ref: reacting to `isSignedIn`
   * becoming true would also fire for someone who has just signed in on this
   * page, on top of the navigation `complete()` already performed — which it
   * did, as a `window.location.replace` that reloaded the entire bundle.
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
        emailCode: needsEmailCode ? values.emailCode : undefined,
        phoneCode: needsWhatsAppCode ? values.phoneCode : undefined,
        name: values.name || undefined,
      });
      complete(session, returnTo);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  /** Send what Google gave us, and act on what the server says is still needed. */
  async function continueWithGoogle(payload: GoogleSignInPayload) {
    lastGoogle.current = payload;
    const result: GoogleSignInResult = await googleSignIn.mutateAsync(payload);
    if (result.status === "signed_in") {
      complete(result, returnTo);
    } else if (result.status === "phone_required") {
      setGoogle({
        accessToken: payload.accessToken,
        email: result.email,
        isNew: result.isNew,
        name: result.name,
      });
      detailsForm.reset({ name: result.name, phone: "" });
    } else {
      setIdentity({ email: google?.email ?? "", phone: payload.phone ?? "" });
      setChallenge(result.challenge);
      codeForm.reset({ emailCode: "", phoneCode: "", name: "" });
    }
  }

  async function onGoogle() {
    if (!providers?.google) return;
    setFormError(null);
    setGoogleBusy(true);
    try {
      const accessToken = await requestGoogleToken(providers.google.clientId);
      await continueWithGoogle({ accessToken });
    } catch (err) {
      // Closing Google's window is a change of mind, not an error.
      if (err instanceof GoogleCancelled) return;
      setFormError(
        axios.isAxiosError(err)
          ? getApiErrorMessage(err)
          : "Google sign-in isn't available right now. Sign in with your email instead.",
      );
    } finally {
      setGoogleBusy(false);
    }
  }

  async function onGoogleDetails(values: GoogleDetailsForm) {
    if (!google) return;
    setFormError(null);
    try {
      await continueWithGoogle({
        accessToken: google.accessToken,
        phone: values.phone,
        name: google.isNew ? values.name : undefined,
      });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  async function resend() {
    setFormError(null);
    if (!needsEmailCode && lastGoogle.current) {
      try {
        await continueWithGoogle(lastGoogle.current);
      } catch (err) {
        setFormError(getApiErrorMessage(err));
      }
      return;
    }
    if (identity) await onRequest(identity);
  }

  return (
    <AuthShell
      eyebrow="For drivers"
      headline={
        <>
          Sign in once.
          <br />
          Then just ask.
        </>
      }
      points={[
        "No password — we send you a code each time.",
        "Garages reply to the number you sign in with, so it has to be yours.",
        "Save the garages you trust and see every request you've sent.",
      ]}
    >
      {!challenge && google ? (
        <>
          <button
            type="button"
            onClick={() => {
              setGoogle(null);
              setFormError(null);
            }}
            className="ra-tap -ml-2 mb-2 flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Use another way to sign in
          </button>

          <p className="ra-eyebrow text-muted-foreground">Continue with Google</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">One more thing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Google has confirmed{" "}
            <span className="font-medium text-foreground break-all">{google.email}</span>. Garages
            reply on WhatsApp, so we need your number too.
          </p>

          <form
            onSubmit={detailsForm.handleSubmit(onGoogleDetails)}
            className="mt-6 space-y-1"
            noValidate
          >
            {google.isNew && (
              <Field
                label="Your name"
                autoComplete="name"
                hint="Businesses see this on your booking request."
                error={detailsForm.formState.errors.name?.message}
                {...detailsForm.register("name")}
              />
            )}
            <PhoneField
              label="WhatsApp number"
              hint="Businesses reply to you on this number, so it has to be right."
              error={detailsForm.formState.errors.phone?.message}
              {...detailsForm.register("phone")}
            />

            {formError && <FormError>{formError}</FormError>}

            <button
              type="submit"
              className="ra-btn-primary mt-2 w-full"
              disabled={googleSignIn.isPending}
            >
              {googleSignIn.isPending ? "Checking…" : "Continue"}
            </button>
            <LegalNote action="continuing" className="pt-2 text-center" />
          </form>
        </>
      ) : !challenge ? (
        <>
          <p className="ra-eyebrow text-muted-foreground">Driver sign-in</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {providers?.google
              ? "Continue with Google, or we'll send you a code. No password to remember."
              : "We'll send you a sign-in code. No password to remember."}
          </p>

          {providers?.google && (
            <>
              <GoogleButton onClick={onGoogle} busy={googleBusy} className="mt-6" />
              {/* Decoration: the email form below is labelled on its own. */}
              <div
                aria-hidden="true"
                className="mt-5 flex items-center gap-3 text-xs text-muted-foreground"
              >
                <span className="h-px flex-1 bg-border" />
                or use your email
                <span className="h-px flex-1 bg-border" />
              </div>
              {formError && !identityForm.formState.isSubmitted && (
                <div className="mt-4">
                  <FormError>{formError}</FormError>
                </div>
              )}
            </>
          )}

          <form
            onSubmit={identityForm.handleSubmit(onRequest)}
            className={providers?.google ? "mt-3 space-y-1" : "mt-6 space-y-1"}
            noValidate
          >
            <Field
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={identityForm.formState.errors.email?.message}
              {...identityForm.register("email")}
            />
            <PhoneField
              label="WhatsApp number"
              hint="Businesses reply to you on this number, so it has to be right."
              error={identityForm.formState.errors.phone?.message}
              {...identityForm.register("phone")}
            />

            {formError && (identityForm.formState.isSubmitted || !providers?.google) && (
              <FormError>{formError}</FormError>
            )}

            {/*
              Never disabled while someone is typing. Pre-emptively disabling a
              submit button is a documented anti-pattern: the user cannot tell
              which rule they have failed, only that nothing happens. Validate on
              submit and say what is wrong.
            */}
            <button
              type="submit"
              className="ra-btn-primary mt-2 w-full"
              disabled={request.isPending}
            >
              {request.isPending ? "Sending…" : "Send me a code"}
            </button>
            <LegalNote action="continuing" className="pt-2 text-center" />
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

          <p className="ra-eyebrow text-muted-foreground">Step 2 of 2</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {needsWhatsAppCode && needsEmailCode ? "Enter your codes" : "Enter your code"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {!needsEmailCode
              ? "We've sent a code to your WhatsApp, so we know the number is yours. It expires in "
              : needsWhatsAppCode
                ? "Two codes, one to each place, so we know both reach you. They expire in "
                : "We've emailed you a code. It expires in "}
            <span className="font-mono tabular-nums">{challenge.expiresInMinutes}</span> minutes.
          </p>

          {/*
            Only claim a message was sent where it actually was. Telling someone
            to wait for a WhatsApp that never left the building is worse than
            saying nothing.
          */}
          <ul className="mt-4 space-y-1.5 text-sm">
            {needsEmailCode && (
              <DeliveryLine
                icon={Mail}
                ok={challenge.delivery.email}
                target={identity?.email || "your email"}
              />
            )}
            {needsWhatsAppCode && (
              <DeliveryLine
                icon={MessageCircle}
                ok={challenge.delivery.whatsapp}
                target={identity?.phone || "your WhatsApp"}
              />
            )}
          </ul>

          {import.meta.env.DEV && challenge.devCodes && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p className="font-medium text-warning-text">Development mode</p>
              <p className="mt-1 text-muted-foreground">
                {challenge.devCodes.email && (
                  <>
                    Email code <span className="font-mono">{challenge.devCodes.email}</span>
                  </>
                )}
                {challenge.devCodes.email && challenge.devCodes.phone && " · "}
                {challenge.devCodes.phone && (
                  <>
                    WhatsApp code <span className="font-mono">{challenge.devCodes.phone}</span>
                  </>
                )}
              </p>
            </div>
          )}

          <form onSubmit={codeForm.handleSubmit(onVerify)} className="mt-6 space-y-1" noValidate>
            {challenge.isNew && needsEmailCode && (
              <Field
                label="Your name"
                autoComplete="name"
                placeholder="Sam Okafor"
                hint="Businesses see this on your booking request."
                error={codeForm.formState.errors.name?.message}
                {...codeForm.register("name")}
              />
            )}
            {needsEmailCode && (
              <CodeField
                label="Code from your email"
                // Only one field may claim one-time-code, or the platform's
                // autofill has two candidates and picks arbitrarily. With two
                // fields it belongs to the WhatsApp one, which is the message a
                // phone offers to fill in.
                autoComplete={needsWhatsAppCode ? "off" : "one-time-code"}
                error={codeForm.formState.errors.emailCode?.message}
                {...codeForm.register("emailCode")}
              />
            )}
            {needsWhatsAppCode && (
              <CodeField
                label="Code from WhatsApp"
                autoComplete="one-time-code"
                error={codeForm.formState.errors.phoneCode?.message}
                {...codeForm.register("phoneCode")}
              />
            )}

            {formError && <FormError>{formError}</FormError>}

            <button
              type="submit"
              className="ra-btn-primary mt-2 w-full"
              disabled={verify.isPending}
            >
              {verify.isPending ? "Checking…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={resend}
              disabled={request.isPending || googleSignIn.isPending}
              className="ra-tap w-full rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-70"
            >
              {request.isPending || googleSignIn.isPending
                ? "Sending…"
                : needsWhatsAppCode && needsEmailCode
                  ? "Send new codes"
                  : "Send a new code"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
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
