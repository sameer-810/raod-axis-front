import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  SquareCheck,
} from "lucide-react";
import axios from "axios";
import { getApiErrorMessage } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { LegalNote } from "@/shared/components/LegalNote";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { useSeo } from "@/shared/hooks/useSeo";
import { useMarket } from "@/app/market";
import { cn } from "@/lib/utils";
import { AuthShell } from "../components/AuthShell";
import { CodeField } from "../components/CodeField";
import { GoogleButton } from "../components/GoogleButton";
import { MobileNumberField } from "../components/MobileNumberField";
import { looksLikeMobile, toInternational } from "../lib/phoneNumber";
import { GoogleCancelled, requestGoogleToken } from "../lib/googleIdentity";
import {
  useAuth,
  useAuthProviders,
  useGoogleSignIn,
  useRequestCodes,
  useVerifyCodes,
} from "../hooks/useAuth";
import {
  emailField,
  googleDetailsSchema,
  verifyBothCodesSchema,
  verifyEmailCodeSchema,
  verifyWhatsAppCodeSchema,
  type GoogleDetailsForm,
  type VerifyCodesForm,
} from "../validations/auth.validation";
import type {
  CodeChallenge,
  GoogleSignInPayload,
  GoogleSignInResult,
  PhoneChannel,
  RequestCodesPayload,
  SignInMethod,
} from "../types";

/** A booking form the driver left to sign in, by its path. */
const BOOKING_PATH = /^\/business\/[^/]+\/request\/?$/;

/**
 * Driver sign-in, to the client's design of 5 November 2026 (D-046).
 *
 * The mobile number comes first, because it is what a garage replies to. A
 * code to it — by WhatsApp or by text message, the driver's choice — is the
 * whole sign-in: no email, no password. Email and "Continue with Google" are
 * there too, and they still need the number, which the driver has already
 * typed at the top.
 *
 * Which buttons appear is the server's decision (`/auth/providers`): a method
 * is offered when it is connected and an administrator has not switched it
 * off in the console. With one phone method, the choice disappears and the
 * button just says where the code goes.
 *
 * How many codes a challenge needs is also the server's decision, carried on
 * the challenge. The code screen asks for exactly those, names only the
 * messages that were actually sent, and asks for a name only the first time.
 */
export function SignInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo");
  const fromBooking = Boolean(returnTo && BOOKING_PATH.test(returnTo));
  const { complete, isSignedIn } = useAuth();
  const { market, markets, setMarket } = useMarket();

  const [countryCode, setCountryCode] = useState(market.code);
  const country = markets.find((m) => m.code === countryCode) ?? market;
  const [number, setNumber] = useState("");
  const [numberError, setNumberError] = useState<string | undefined>();
  const numberRef = useRef<HTMLInputElement>(null);

  /** The email route, opened by its button. */
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const emailRef = useRef<HTMLInputElement>(null);

  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  /** What was asked for, so "Send a new code" can ask again. */
  const lastRequest = useRef<RequestCodesPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<SignInMethod | null>(null);

  /** After Google: who they are, while the page asks for what Google does not know. */
  const [google, setGoogle] = useState<{
    accessToken: string;
    email: string;
    isNew: boolean;
    name: string;
  } | null>(null);
  /** The challenge came through Google, which already gave the name. */
  const [viaGoogle, setViaGoogle] = useState(false);
  const lastGoogle = useRef<GoogleSignInPayload | null>(null);

  const request = useRequestCodes();
  const verify = useVerifyCodes();
  const googleSignIn = useGoogleSignIn();
  const { data: providers, isLoading: providersLoading } = useAuthProviders();

  /**
   * What to draw. A server from before D-046 says nothing about methods; it
   * offered the email route and, with a client id, Google.
   */
  const methods: Record<SignInMethod, boolean> = providers?.methods ?? {
    whatsapp: false,
    sms: false,
    email: true,
    google: Boolean(providers?.google),
  };
  const phoneMethods = (["whatsapp", "sms"] as PhoneChannel[]).filter((m) => methods[m]);
  const otherMethods = methods.email || (methods.google && Boolean(providers?.google));

  useSeo({
    title: "Sign in",
    description:
      "Sign in to RoadAxis with a one-time code to send booking requests and save the garages you trust.",
  });

  const needsEmailCode = Boolean(challenge?.channels?.email);
  const phoneChannel: PhoneChannel | null =
    challenge?.phoneChannel ??
    (challenge?.channels?.sms ? "sms" : challenge?.channels?.whatsapp ? "whatsapp" : null);
  const needsPhoneCode = Boolean(phoneChannel);

  const codeForm = useForm<VerifyCodesForm>({
    // Chosen per render, so the rule always matches the fields on screen.
    resolver: zodResolver(
      !needsEmailCode
        ? verifyWhatsAppCodeSchema
        : needsPhoneCode
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
   * Someone who arrives *already* signed in is moved along. Captured once, in a
   * ref: reacting to `isSignedIn` would also fire for someone who has just
   * signed in on this page, on top of the navigation `complete()` performed.
   */
  const arrivedSignedIn = useRef(isSignedIn);
  useEffect(() => {
    if (arrivedSignedIn.current) navigate(returnTo || "/", { replace: true });
    // Mount only. See above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (emailOpen) emailRef.current?.focus();
  }, [emailOpen]);

  /** The number as the server stores it, or null after saying what is wrong. */
  function checkedNumber(): string | null {
    if (!number.trim()) {
      setNumberError("Enter your mobile number");
      numberRef.current?.focus();
      return null;
    }
    if (!looksLikeMobile(number)) {
      setNumberError("That doesn't look like a mobile number");
      numberRef.current?.focus();
      return null;
    }
    setNumberError(undefined);
    return toInternational(country.dialCode, number);
  }

  async function ask(payload: RequestCodesPayload) {
    setFormError(null);
    setPending(payload.channel);
    try {
      const result = await request.mutateAsync(payload);
      lastRequest.current = payload;
      setViaGoogle(false);
      setChallenge(result);
      codeForm.reset({ emailCode: "", phoneCode: "", name: "" });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  function sendToPhone(channel: PhoneChannel) {
    const phone = checkedNumber();
    if (phone) void ask({ channel, phone });
  }

  function sendToEmail(e?: React.FormEvent) {
    e?.preventDefault();
    const phone = checkedNumber();
    const parsed = emailField.safeParse(email);
    setEmailError(parsed.success ? undefined : parsed.error.issues[0]?.message);
    if (!parsed.success) {
      if (phone) emailRef.current?.focus();
      return;
    }
    if (phone) void ask({ channel: "email", email: parsed.data, phone });
  }

  async function onVerify(values: VerifyCodesForm) {
    if (!challenge) return;
    setFormError(null);
    try {
      const session = await verify.mutateAsync({
        challengeId: challenge.challengeId,
        emailCode: needsEmailCode ? values.emailCode : undefined,
        phoneCode: needsPhoneCode ? values.phoneCode : undefined,
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
      detailsForm.reset({ name: result.name, phone: payload.phone ?? "" });
    } else {
      setViaGoogle(true);
      setChallenge(result.challenge);
      codeForm.reset({ emailCode: "", phoneCode: "", name: "" });
    }
  }

  async function onGoogle() {
    if (!providers?.google) return;
    setFormError(null);
    setPending("google");
    try {
      const accessToken = await requestGoogleToken(providers.google.clientId);
      // The number typed at the top, when there is one: it saves the driver a
      // second screen. The server ignores it for an account that has a number.
      const phone = looksLikeMobile(number) ? toInternational(country.dialCode, number) : undefined;
      await continueWithGoogle({ accessToken, ...(phone ? { phone } : {}) });
    } catch (err) {
      // Closing Google's window is a change of mind, not an error.
      if (err instanceof GoogleCancelled) return;
      setFormError(
        axios.isAxiosError(err)
          ? getApiErrorMessage(err)
          : "Google sign-in isn't available right now. Choose another way to sign in.",
      );
    } finally {
      setPending(null);
    }
  }

  async function onGoogleDetails(values: GoogleDetailsForm) {
    if (!google) return;
    setFormError(null);
    try {
      await continueWithGoogle({
        accessToken: google.accessToken,
        phone: toInternational(country.dialCode, values.phone),
        name: google.isNew ? values.name : undefined,
      });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  async function resend() {
    setFormError(null);
    if (viaGoogle && lastGoogle.current) {
      try {
        await continueWithGoogle(lastGoogle.current);
      } catch (err) {
        setFormError(getApiErrorMessage(err));
      }
      return;
    }
    if (lastRequest.current) await ask(lastRequest.current);
  }

  function changeCountry(code: string) {
    setCountryCode(code);
    setNumberError(undefined);
    // The site follows: a driver choosing UAE +971 is in the UAE.
    setMarket(code);
  }

  const backToBooking = fromBooking && returnTo && (
    <Link
      to={returnTo}
      className="ra-tap -ml-2 mb-3 flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to booking
    </Link>
  );

  const numberField = (
    <MobileNumberField
      ref={numberRef}
      label="Mobile number"
      markets={markets}
      country={country}
      onCountryChange={changeCountry}
      value={number}
      onChange={(v) => {
        setNumber(v);
        if (numberError) setNumberError(undefined);
      }}
      error={numberError}
    />
  );

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
      formOnlyOnMobile
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
            reply to your mobile number, so we need it too.
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
            <MobileNumberField
              label="Mobile number"
              markets={markets}
              country={country}
              onCountryChange={changeCountry}
              value={detailsForm.watch("phone")}
              onChange={(v) =>
                detailsForm.setValue("phone", v, {
                  shouldValidate: detailsForm.formState.isSubmitted,
                })
              }
              hint="Businesses reply to you on this number, so it has to be right."
              error={detailsForm.formState.errors.phone?.message}
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
          {backToBooking}

          <div className="text-center">
            <span
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-foreground"
            >
              <span className="relative">
                <Smartphone className="h-8 w-8" strokeWidth={1.6} />
                <ShieldCheck
                  className="absolute -bottom-1 -right-2 h-4 w-4 rounded-full bg-muted"
                  strokeWidth={2}
                />
              </span>
            </span>
            <h1 className="mt-4 text-[1.7rem] font-bold leading-tight tracking-tight text-foreground">
              {fromBooking
                ? "Verify your mobile number to continue"
                : "Sign in with your mobile number"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {fromBooking
                ? "One quick step to continue your booking request."
                : "Garages reply to this number, so we check it's yours. No password."}
            </p>
          </div>

          <div className="mt-6">{numberField}</div>

          {phoneMethods.length > 0 && (
            <div className="mt-1">
              <p className="text-sm text-muted-foreground">
                {phoneMethods.length > 1
                  ? "Choose how you would like to receive your code."
                  : "We'll send you a code to sign in."}
              </p>
              {phoneMethods.length > 1 && (
                <p className="mt-3 text-sm font-semibold text-foreground">Send code by:</p>
              )}
              <div
                className={cn(
                  "mt-2 grid gap-3",
                  phoneMethods.length > 1 ? "grid-cols-2" : "grid-cols-1",
                )}
              >
                {phoneMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => sendToPhone(m)}
                    disabled={pending !== null}
                    className="ra-btn h-12 font-semibold"
                    aria-label={m === "whatsapp" ? "Send code by WhatsApp" : "Send code by SMS"}
                  >
                    {m === "whatsapp" ? (
                      <WhatsAppIcon className="h-6 w-6 text-whatsapp" />
                    ) : (
                      <MessageSquareText className="h-6 w-6 text-success" aria-hidden="true" />
                    )}
                    {pending === m
                      ? "Sending…"
                      : phoneMethods.length > 1
                        ? m === "whatsapp"
                          ? "WhatsApp"
                          : "SMS"
                        : m === "whatsapp"
                          ? "Send code by WhatsApp"
                          : "Send code by SMS"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formError && (
            <div className="mt-4">
              <FormError>{formError}</FormError>
            </div>
          )}

          {otherMethods && (
            <>
              {phoneMethods.length > 0 && (
                // Decoration: every button below is labelled on its own.
                <div
                  aria-hidden="true"
                  className="mt-6 flex items-center gap-3 text-sm text-muted-foreground"
                >
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              {emailOpen ? (
                <form onSubmit={sendToEmail} className="mt-5 space-y-1" noValidate>
                  <Field
                    ref={emailRef}
                    label="Email address"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(undefined);
                    }}
                    error={emailError}
                  />
                  <button
                    type="submit"
                    className="ra-btn-primary w-full"
                    disabled={pending !== null}
                  >
                    {pending === "email" ? "Sending…" : "Send code to my email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailOpen(false);
                      setEmailError(undefined);
                    }}
                    className="ra-tap w-full rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Use another way
                  </button>
                </form>
              ) : (
                <div
                  className={cn(
                    "mt-5 grid gap-3",
                    methods.email && methods.google && providers?.google
                      ? "grid-cols-2"
                      : "grid-cols-1",
                  )}
                >
                  {methods.email && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setEmailOpen(true);
                      }}
                      disabled={pending !== null}
                      className="ra-btn h-12 font-semibold"
                    >
                      <Mail className="h-5 w-5" aria-hidden="true" />
                      Email
                    </button>
                  )}
                  {methods.google && providers?.google && (
                    <GoogleButton onClick={onGoogle} busy={pending === "google"} className="h-12" />
                  )}
                </div>
              )}

              <p className="mt-2 text-center text-sm text-muted-foreground">
                We'll ask for your mobile number once, so garages can reply to you.
              </p>
            </>
          )}

          {!providersLoading && phoneMethods.length === 0 && !otherMethods && (
            <div className="mt-4">
              <FormError>
                Signing in isn't available right now. Please try again a little later.
              </FormError>
            </div>
          )}

          {fromBooking && (
            <p className="mt-5 flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
              <SquareCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
              Your booking details will be saved while you verify.
            </p>
          )}

          <LegalNote action="continuing" className="mt-5 text-center" />

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Run a garage?{" "}
            <Link to="/staff/sign-in" className="font-semibold text-primary-text hover:underline">
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

          <p className="ra-eyebrow text-muted-foreground">Last step</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {needsPhoneCode && needsEmailCode ? "Enter your codes" : "Enter your code"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {needsPhoneCode && needsEmailCode
              ? "Two codes, one to each place, so we know both reach you. They expire in "
              : needsEmailCode
                ? "We've emailed you a code. It expires in "
                : phoneChannel === "sms"
                  ? "We've texted a code to your phone, so we know the number is yours. It expires in "
                  : "We've sent a code to your WhatsApp, so we know the number is yours. It expires in "}
            <span className="font-mono tabular-nums">{challenge.expiresInMinutes}</span> minutes.
          </p>

          {/*
            Only claim a message was sent where it actually was. Telling someone
            to wait for a message that never left the building is worse than
            saying nothing.
          */}
          <ul className="mt-4 space-y-1.5 text-sm">
            {needsEmailCode && (
              <DeliveryLine
                icon={Mail}
                ok={challenge.delivery.email}
                target={lastRequest.current?.email || "your email"}
              />
            )}
            {needsPhoneCode && (
              <DeliveryLine
                icon={phoneChannel === "sms" ? MessageSquareText : WhatsAppIcon}
                ok={Boolean(
                  phoneChannel === "sms" ? challenge.delivery.sms : challenge.delivery.whatsapp,
                )}
                target={
                  (viaGoogle ? lastGoogle.current?.phone : lastRequest.current?.phone) ||
                  (phoneChannel === "sms" ? "your phone" : "your WhatsApp")
                }
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
                    {phoneChannel === "sms" ? "Text" : "WhatsApp"} code{" "}
                    <span className="font-mono">{challenge.devCodes.phone}</span>
                  </>
                )}
              </p>
            </div>
          )}

          <form onSubmit={codeForm.handleSubmit(onVerify)} className="mt-6 space-y-1" noValidate>
            {/* Asked for once, on a first sign-in; Google already gave it. */}
            {challenge.isNew && !viaGoogle && (
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
                // fields it belongs to the phone one, which is the message a
                // phone offers to fill in.
                autoComplete={needsPhoneCode ? "off" : "one-time-code"}
                error={codeForm.formState.errors.emailCode?.message}
                {...codeForm.register("emailCode")}
              />
            )}
            {needsPhoneCode && (
              <CodeField
                label={
                  phoneChannel === "sms" ? "Code from your text message" : "Code from WhatsApp"
                }
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
                : needsPhoneCode && needsEmailCode
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
