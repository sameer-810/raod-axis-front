import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Lightbulb,
  MapPin,
  Moon,
  Send,
  Star,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { CategoryIcon } from "@/shared/components/CategoryIcon";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/api/http";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { LegalNote } from "@/shared/components/LegalNote";
import { useSeo } from "@/shared/hooks/useSeo";
import { formatDateFriendly, formatRating } from "@/shared/lib/format";
import { useAppSelector } from "@/app/hooks";
import { useBusiness } from "@/modules/business/hooks/useBusinesses";
import { useCreateBooking } from "../hooks/useBookings";
import { DAY_SLOTS, NIGHT_SLOT, addDays, dayParts, hourIn, todayIn } from "../lib/timeSlots";
import type { DriverBookingRequest } from "../types";

const DRAFT_KEY = "roadaxis_booking_draft";
const GENERAL_ENQUIRY = "General enquiry";
const MAX_NOTES = 500;
/** The server's own limit is `MAX_BOOKING_LEAD_DAYS`; this only guides the picker. */
const LEAD_DAYS = 90;
/** Thirteen days and "More dates": two even rows of seven. */
const DAY_TILES = 13;

/**
 * Request a Booking — the one wall in the public product, and the screen the
 * whole thing converges on. Two things matter more than anything else here:
 *
 *  - **It never says "booked".** A driver names a day and a time; nothing is
 *    held, and the business answers on WhatsApp (FR-BKG-10).
 *  - **It survives the sign-in wall.** The form is filled in before the account
 *    is asked for, and the draft is kept so nothing is retyped.
 */
export function RequestBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { data: business, isLoading } = useBusiness(slug);

  useSeo({
    title: business ? `Request a booking at ${business.name}` : "Request a booking",
    description: business
      ? `Ask ${business.name} for a date and time. They reply to you on WhatsApp — nothing is booked until they do.`
      : "Ask a garage for a date and time. They reply to you on WhatsApp.",
    // A form, not a destination: the business profile is the page to index.
    noIndex: true,
  });

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
  // an empty required dropdown is a step with no decision in it. Today is the
  // garage's today, which is the first tile; the time is left for the driver,
  // because a time nobody chose reaches the garage looking like one somebody did.
  useEffect(() => {
    if (!business) return;
    setForm((f) => ({
      ...f,
      serviceName: f.serviceName || (business.services[0]?.name ?? GENERAL_ENQUIRY),
      preferredDate: f.preferredDate || todayIn(business.timezone),
    }));
  }, [business]);

  const dateInput = useRef<HTMLInputElement>(null);
  const today = business ? todayIn(business.timezone) : "";
  const tiles = useMemo(
    () => (today ? Array.from({ length: DAY_TILES }, (_, i) => addDays(today, i)) : []),
    [today],
  );
  const chosenDay = form.preferredDate ? dayParts(form.preferredDate) : null;
  const pickedLater = Boolean(form.preferredDate) && !tiles.includes(form.preferredDate);
  // An hour that has already gone today cannot be asked for.
  const hourNow = business && form.preferredDate === today ? hourIn(business.timezone) : -1;

  const setDate = (preferredDate: string) =>
    setForm((f) => {
      const slot = DAY_SLOTS.find((s) => s.value === f.preferredTime);
      const gone =
        slot && business && preferredDate === today && slot.endHour <= hourIn(business.timezone);
      return { ...f, preferredDate, preferredTime: gone ? "" : f.preferredTime };
    });
  const setTime = (preferredTime: string) => setForm((f) => ({ ...f, preferredTime }));

  /** The browser's own calendar, from either way into it. */
  function openCalendar() {
    const input = dateInput.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // An older browser: the field itself is still there to type in.
      input.focus();
    }
  }

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
                className="ra-btn ra-btn-whatsapp px-5"
              >
                <WhatsAppIcon className="h-[18px] w-[18px]" />
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

  const rating = formatRating(business.averageRating, business.reviewCount);
  const whatsapp = business.whatsappNumbers[0];
  const photo = business.photos[0];
  const place = [business.address.city, business.address.region].filter(Boolean).join(", ");
  const dayHours = chosenDay
    ? business.workingHours.find((h) => h.day === chosenDay.dayOfWeek)
    : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:py-10">
      <div className="space-y-5">
        <Link
          to={`/business/${business.slug}`}
          className="ra-tap -ms-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {business.name}
        </Link>

        <header>
          <h1 className="text-[28px] font-extrabold leading-[1.1] text-foreground md:text-[34px]">
            Request a Booking
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Select your preferred date and time. The business will confirm your booking via
            WhatsApp.
          </p>
        </header>

        {/* Who this is going to, so the driver is sure before they choose a time. */}
        <section
          aria-label={`About ${business.name}`}
          className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary p-3"
        >
          {photo ? (
            <img
              src={photo.thumbnailUrl ?? photo.url}
              alt=""
              aria-hidden="true"
              className="h-20 w-20 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="ra-photo-empty flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-muted-foreground">
              <CategoryIcon name={business.categories[0]?.icon} className="h-7 w-7" />
            </span>
          )}
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-[17px] font-bold leading-tight text-foreground">{business.name}</p>
            {place && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {place}
              </p>
            )}
            {rating && (
              <p className="mt-0.5 flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-current text-warning" aria-hidden="true" />
                <span className="font-mono font-semibold text-foreground">{rating.value}</span>
                <span className="text-muted-foreground">
                  (<span className="font-mono">{rating.count}</span>{" "}
                  {rating.count === 1 ? "review" : "reviews"})
                </span>
              </p>
            )}
            {business.categories.length > 0 && (
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {business.categories
                  .slice(0, 3)
                  .map((c) => c.name)
                  .join(" | ")}
              </p>
            )}
          </div>
          {whatsapp && (
            <a
              href={whatsapp.waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ra-btn ra-btn-whatsapp w-full shrink-0 sm:w-auto"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" />
              Chat on WhatsApp
            </a>
          )}
        </section>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div>
            <SectionTitle icon={Wrench}>
              <label htmlFor="service">What do you need?</label>
            </SectionTitle>
            {/* Built from the business's own services and nothing else
                (FR-BKG-02) — a garage receiving a request for work they do not
                do is a wasted conversation on both sides. */}
            <select
              id="service"
              value={form.serviceName}
              onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
              aria-describedby={errors.serviceName ? "service-message" : undefined}
              className="mt-2 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {business.services.length === 0 && (
                <option value={GENERAL_ENQUIRY}>{GENERAL_ENQUIRY}</option>
              )}
              {business.services.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <FieldMessage id="service-message" message={errors.serviceName} />
          </div>

          <section aria-labelledby="date-heading">
            <SectionTitle
              id="date-heading"
              icon={CalendarDays}
              aside={
                <button
                  type="button"
                  onClick={openCalendar}
                  className="ra-tap -me-1 inline-flex items-center gap-1 px-1 text-sm font-medium text-primary-text hover:underline"
                >
                  View Calendar
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              }
            >
              Select the date
            </SectionTitle>
            <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
              {tiles.map((iso) => {
                const d = dayParts(iso);
                const chosen = form.preferredDate === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setDate(iso)}
                    aria-pressed={chosen}
                    aria-label={d.full}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center rounded-xl border text-center leading-tight transition-colors",
                      chosen
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-foreground/30",
                    )}
                  >
                    <span className="text-[11px]">{d.weekday}</span>
                    <span className="text-[16px] font-bold">{d.day}</span>
                    <span className="text-[11px]">{d.month}</span>
                  </button>
                );
              })}
              {/* The date field itself, laid over the tile: on a phone a tap on
                  it opens the phone's own calendar, with no second control. */}
              <div
                className={cn(
                  "relative flex min-h-[64px] flex-col items-center justify-center rounded-xl border text-center text-[11px] font-medium leading-tight transition-colors focus-within:ring-2 focus-within:ring-ring",
                  pickedLater
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-foreground/30",
                )}
              >
                {pickedLater && chosenDay ? (
                  <>
                    <span>{chosenDay.weekday}</span>
                    <span className="text-[16px] font-bold">{chosenDay.day}</span>
                    <span>{chosenDay.month}</span>
                  </>
                ) : (
                  <>
                    <CalendarDays className="mb-0.5 h-4 w-4" aria-hidden="true" />
                    More dates
                  </>
                )}
                <input
                  ref={dateInput}
                  type="date"
                  aria-label="Preferred date"
                  aria-describedby={errors.preferredDate ? "date-message" : undefined}
                  // The browser stops the obvious mistakes; the server is still
                  // the authority on the lead-time rule.
                  min={today}
                  max={today ? addDays(today, LEAD_DAYS) : undefined}
                  value={form.preferredDate}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  onClick={openCalendar}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
            <FieldMessage id="date-message" message={errors.preferredDate} />
          </section>

          <section aria-labelledby="time-heading">
            <SectionTitle
              id="time-heading"
              icon={Clock}
              aside={
                // The garage's real hours for that day, not a fixed range: a
                // driver who assumes otherwise turns up to a closed shop.
                chosenDay && (
                  <span className="text-[13px] text-muted-foreground">
                    {!dayHours || dayHours.closed ? (
                      `Usually closed on ${chosenDay.longWeekday}`
                    ) : (
                      <>
                        Open{" "}
                        <span className="font-mono tabular-nums">
                          {dayHours.open}–{dayHours.close}
                        </span>
                      </>
                    )}
                  </span>
                )
              }
            >
              Select the time
            </SectionTitle>
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {DAY_SLOTS.map((slot) => {
                const chosen = form.preferredTime === slot.value;
                return (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => setTime(slot.value)}
                    aria-pressed={chosen}
                    disabled={slot.endHour <= hourNow}
                    className={cn(
                      "min-h-[44px] whitespace-nowrap rounded-lg border px-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      chosen
                        ? "border-primary bg-primary font-semibold text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-foreground/30",
                    )}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center gap-3 rounded-xl bg-secondary p-3">
              <Moon className="h-6 w-6 shrink-0 text-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground">Night Time</p>
                <p className="text-[13px] text-muted-foreground">10:00 PM – 8:00 AM</p>
              </div>
              <button
                type="button"
                onClick={() => setTime(NIGHT_SLOT)}
                aria-pressed={form.preferredTime === NIGHT_SLOT}
                className={cn(
                  "min-h-[44px] shrink-0 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                  form.preferredTime === NIGHT_SLOT
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-foreground/40 bg-card text-foreground hover:border-foreground/70",
                )}
              >
                {form.preferredTime === NIGHT_SLOT ? "Night Time selected" : "Select Night Time"}
              </button>
            </div>
            <FieldMessage id="time-message" message={errors.preferredTime} />
          </section>

          <div>
            <SectionTitle
              icon={FileText}
              aside={<span className="text-[13px] text-muted-foreground">Optional</span>}
            >
              <label htmlFor="notes">Anything they should know?</label>
            </SectionTitle>
            <div className="relative mt-2">
              <textarea
                id="notes"
                rows={3}
                maxLength={MAX_NOTES}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Describe the problem or any special requests…"
                className="w-full rounded-xl border border-input bg-card px-3 pb-6 pt-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-2.5 end-3 font-mono text-xs tabular-nums text-muted-foreground"
              >
                {form.notes.length}/{MAX_NOTES}
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-[13px] text-muted-foreground">
              <Lightbulb className="h-4 w-4 shrink-0 text-primary-text" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">For example:</span> I need two front
                tyres replaced.
              </span>
            </p>
          </div>

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
              className="ra-btn-primary h-[52px] w-full"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {create.isPending ? "Sending…" : "Send Booking Request"}
            </button>
            {!user && (
              <p className="mt-2 text-xs text-muted-foreground">
                You'll sign in on the next step — we keep what you've typed. Businesses need a way
                to reach you back.
              </p>
            )}
            <LegalNote action="sending this request" className="mt-2" />
          </div>
        </form>
      </div>
    </div>
  );
}

/** A section heading with its red mark, and something on the right if it has one. */
function SectionTitle({
  id,
  icon: Icon,
  aside,
  children,
}: {
  id?: string;
  icon: typeof Clock;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[28px] items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-[18px] font-bold text-foreground">
        <Icon className="h-5 w-5 shrink-0 text-primary-text" aria-hidden="true" />
        {children}
      </h2>
      {aside}
    </div>
  );
}

/** A field's error from the server, under the field it belongs to. */
function FieldMessage({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
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
