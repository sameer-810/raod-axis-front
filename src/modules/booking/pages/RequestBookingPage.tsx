import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MessageCircle, CalendarClock } from "lucide-react";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatDateFriendly } from "@/shared/lib/format";
import { useAppSelector } from "@/app/hooks";
import { useBusiness } from "@/modules/business/hooks/useBusinesses";
import { useCreateBooking } from "../hooks/useBookings";
import type { DriverBookingRequest } from "../types";

const DRAFT_KEY = "roadaxis_booking_draft";

/** Today, in the browser's own timezone, as a date input wants it. */
function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Request a Booking — the one wall in the public product, and the screen the
 * whole thing converges on. Two things matter more than anything else here:
 *
 *  - **It never says "book".** No calendar, no availability, no confirmation;
 *    the business answers on WhatsApp (FR-BKG-10).
 *  - **It survives the sign-in wall.** The form is filled in before the account
 *    is asked for, and the draft is kept so nothing is retyped.
 */
export function RequestBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { data: business, isLoading } = useBusiness(slug);

  const [form, setForm] = useState({
    serviceName: "",
    preferredDate: "",
    preferredTime: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ request: DriverBookingRequest; message: string } | null>(
    null,
  );

  const create = useCreateBooking(business?.id ?? "");

  // Restore a draft left behind by the sign-in detour.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.slug === slug) setForm(draft.form);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // A corrupt draft is an empty form, not a crash.
    }
  }, [slug]);

  // Default to the first service, because most businesses list two or three and
  // an empty required dropdown is a step with no decision in it.
  useEffect(() => {
    if (business?.services?.length && !form.serviceName) {
      setForm((f) => ({ ...f, serviceName: business.services[0].name }));
    }
  }, [business, form.serviceName]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    if (!user) {
      /**
       * The account wall, and the only one in the public product. The draft is
       * kept first so the return trip costs nothing. An unauthenticated booking
       * form would be an open relay into a real business's WhatsApp.
       */
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ slug, form }));
      } catch {
        // Private browsing. They will have to retype it, which is the reason
        // the draft exists — but not a reason to block the journey.
      }
      navigate(`/sign-in?returnTo=${encodeURIComponent(`/business/${slug}/request`)}`);
      return;
    }

    void submit();
  }

  async function submit() {
    try {
      setResult(
        await create.mutateAsync({
          serviceName: form.serviceName,
          preferredDate: form.preferredDate,
          preferredTime: form.preferredTime,
          notes: form.notes.trim() || undefined,
        }),
      );
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(getApiErrorMessage(err));
    }
  }

  if (isLoading) return <PageLoader />;

  if (!business) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="We couldn't find that business"
          description="The link may be out of date."
          action={
            <Link
              to="/search"
              className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Find a service
            </Link>
          }
        />
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="ra-tile text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
          {/* "Request sent", never "Booked". */}
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            Request sent
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{result.message}</p>

          <dl className="mx-auto mt-6 max-w-sm space-y-2 text-start text-sm">
            <Row label="Business" value={business.name} />
            <Row label="Service" value={result.request.serviceName} />
            <Row
              label="You asked for"
              value={`${formatDateFriendly(result.request.preferredDate)}, ${result.request.preferredTime}`}
            />
            <Row label="Reference" value={result.request.reference} mono />
          </dl>

          {/*
            Deep-link mode: nothing has been sent yet. The driver's own device
            opens WhatsApp with the message, so if they do not tap this the
            business never hears about the request at all — which is why it is
            the primary action here rather than a footnote.
          */}
          {result.request.deepLink && (
            <div className="mt-6">
              <a
                href={result.request.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ra-tap inline-flex items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Open WhatsApp to send it
              </a>
              <p className="mt-2 text-xs text-muted-foreground">
                Tap to send the message from your own WhatsApp.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              to="/my-requests"
              className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              My requests
            </Link>
            <Link
              to={`/business/${business.slug}`}
              className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              Back to {business.name}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <div className="ra-public">
        <Link
          to={`/business/${business.slug}`}
          className="ra-tap -ms-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {business.name}
        </Link>

        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Request a booking
          </h1>
          {/*
            Said plainly, at the top. There is no calendar and no availability
            here, and a driver who assumes otherwise turns up to a closed shop.
          */}
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Tell {business.name} when suits you. They'll reply on WhatsApp to confirm — this doesn't
            hold a slot.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <section className="ra-tile space-y-1">
            <div className="space-y-1.5">
              <label htmlFor="service" className="block text-sm font-medium text-foreground">
                What do you need?
              </label>
              {/* Built from the business's own services and nothing else
                  (FR-BKG-02) — a garage receiving a request for work they do not
                  do is a wasted conversation on both sides. */}
              <select
                id="service"
                value={form.serviceName}
                onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                aria-describedby={errors.serviceName ? "service-message" : undefined}
                className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {business.services.length === 0 && <option value="">General enquiry</option>}
                {business.services.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p
                id="service-message"
                role={errors.serviceName ? "alert" : undefined}
                className="min-h-[1.25rem] text-xs text-destructive"
              >
                {errors.serviceName}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="preferredDate"
                label="Preferred date"
                type="date"
                // The browser stops the obvious mistakes; the server is still
                // the authority on the lead-time rule.
                min={todayIso()}
                value={form.preferredDate}
                onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
                error={errors.preferredDate}
              />
              <Field
                id="preferredTime"
                label="Preferred time"
                type="time"
                value={form.preferredTime}
                onChange={(e) => setForm((f) => ({ ...f, preferredTime: e.target.value }))}
                error={errors.preferredTime}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notes" className="block text-sm font-medium text-foreground">
                Anything they should know?
              </label>
              <textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional. Make and model, the tyre size, what the noise sounds like."
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </section>

          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          <div>
            {/* Never disabled while typing — validate on submit and say what is
                wrong, or the driver cannot tell which rule they failed. */}
            <button
              type="submit"
              disabled={create.isPending}
              className="ra-tap w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 sm:w-auto sm:px-8"
            >
              {create.isPending ? "Sending…" : "Send request"}
            </button>
            {!user && (
              <p className="mt-2 text-xs text-muted-foreground">
                You'll sign in on the next step — we keep what you've typed. Businesses need a way
                to reach you back.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono tabular-nums text-foreground" : "text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
