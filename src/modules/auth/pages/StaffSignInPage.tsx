import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { getApiErrorMessage } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { Logo } from "@/shared/components/Logo";
import { useAuth, useStaffLogin } from "../hooks/useAuth";
import { staffLoginSchema, type StaffLoginForm } from "../validations/auth.validation";

/**
 * Staff sign-in — business owners and RoadAxis administrators.
 *
 * A password rather than a code, because these people come back daily and a
 * two-message round trip forty times a week is hostile. It is a separate route
 * from the driver flow rather than a mode switch on one page: two audiences
 * with nothing in common between them, and one screen trying to serve both
 * would ask every driver to work out which they are.
 *
 * No stock photography, no card floating on grey, no sentence that could
 * describe any product. The identity is the mark, the orange and the type.
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
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 md:py-16">
      <Logo className="mb-6" />

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Business sign-in</h1>
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
        <button
          type="submit"
          className="ra-tap mt-2 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
          disabled={login.isPending}
        >
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
    </div>
  );
}
