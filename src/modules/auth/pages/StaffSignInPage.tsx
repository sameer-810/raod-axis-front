import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { getApiErrorMessage } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { AuthShell } from "../components/AuthShell";
import { useAuth, useStaffLogin } from "../hooks/useAuth";
import { staffLoginSchema, type StaffLoginForm } from "../validations/auth.validation";

/**
 * Staff sign-in — business owners and RoadAxis administrators.
 *
 * A password rather than a code: these people come back daily and a two-message
 * round trip forty times a week is hostile. A separate route rather than a mode
 * switch, because one screen serving both would ask every driver which they are.
 */
export function StaffSignInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo");
  const { complete, isSignedIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const login = useStaffLogin();

  const form = useForm<StaffLoginForm>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  /**
   * Only for someone who arrives already signed in — captured once on mount.
   * Reacting to the flag itself would also fire for someone who just signed in
   * here, duplicating the navigation `complete()` performs. See SignInPage.
   */
  const arrivedSignedIn = useRef(isSignedIn);
  useEffect(() => {
    if (arrivedSignedIn.current) navigate(returnTo || "/portal", { replace: true });
    // Mount only. See above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: StaffLoginForm) {
    setFormError(null);
    try {
      complete(await login.mutateAsync(values), returnTo);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  return (
    <AuthShell
      eyebrow="For garages and workshops"
      headline={
        <>
          Your listing.
          <br />
          Your inbox.
        </>
      }
      points={[
        "Booking requests land on the WhatsApp number you already use.",
        "Keep your hours, photos and services right without ringing anyone.",
        "See how fast you reply — the number that wins repeat customers.",
      ]}
      backTo="/for-business"
      backLabel="Listing your business"
    >
      <p className="ra-eyebrow text-muted-foreground">Business sign-in</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        For garages and workshops managing their RoadAxis listing.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-1" noValidate>
        <Field
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@yourgarage.co.uk"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />

        <div className="relative">
          <Field
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pe-12"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
          {/*
            Offset from the top rather than centred: the field has a label above
            it and a message slot below, so vertical centring would put this on
            the label.
          */}
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="ra-tap absolute end-0 top-[1.55rem] flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        {/* Never disabled while typing — see SignInPage for why. */}
        <button type="submit" className="ra-btn-primary mt-2 w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
        <p>
          Looking for a garage?{" "}
          <Link to="/sign-in" className="font-medium text-primary-text hover:underline">
            Sign in as a driver
          </Link>
        </p>
        <p>
          Not listed yet?{" "}
          <Link to="/for-business" className="font-medium text-primary-text hover:underline">
            Add your business
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
