import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, MapPin, ImagePlus, X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { geocodeUk } from "@/shared/lib/geocode";
import { useCategories } from "@/modules/business/hooks/useBusinesses";
import { adminBusinessApi } from "@/modules/admin/api/adminApi";
import { useCreateBusiness, useUpdateBusiness } from "@/modules/admin/hooks/useAdmin";
import { mediaApi, type Media } from "../api/mediaApi";
import type { Business } from "../types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_PHOTOS = 10;

function defaultHours() {
  return [
    { day: 0, closed: true, open: "09:00", close: "17:00" },
    ...[1, 2, 3, 4, 5].map((day) => ({ day, closed: false, open: "09:00", close: "17:00" })),
    { day: 6, closed: false, open: "09:00", close: "13:00" },
  ];
}

/**
 * What the form needs from an existing record. Structural, so both the admin
 * DTO and the owner's `OwnedBusiness` satisfy it without a cast.
 */
export type BusinessFormSource = Pick<
  Business,
  | "id"
  | "name"
  | "description"
  | "categories"
  | "customServices"
  | "services"
  | "address"
  | "coordinates"
  | "phone"
  | "email"
  | "website"
  | "workingHours"
  | "photos"
>;

/**
 * The listing form — one form, two audiences.
 *
 * An administrator seeding a city and an owner keeping their own page right are
 * editing the same record under the same rules (FR-ADM-02 and FR-BIZ-01 are one
 * requirement underneath). What differs is framing, not fields: an owner is not
 * warned about duplicates of themselves and is not shown the admin's WhatsApp
 * override.
 *
 * Coordinates are the field everything else depends on — a listing without them
 * is excluded from every distance search — so they are derived from the postcode
 * and shown as raw numbers only so an obvious error is visible.
 */
export function BusinessForm({
  audience,
  initial,
  onSaved,
  backTo,
  backLabel,
}: {
  audience: "admin" | "owner";
  initial?: BusinessFormSource;
  onSaved: (business: Business) => void;
  backTo: string;
  backLabel: string;
}) {
  const isEdit = Boolean(initial);
  const owner = audience === "owner";

  const { data: categories = [] } = useCategories();
  const create = useCreateBusiness();
  const update = useUpdateBusiness();

  const [form, setForm] = useState({
    name: "",
    description: "",
    line1: "",
    line2: "",
    city: "",
    postcode: "",
    phone: "",
    email: "",
    website: "",
    latitude: "",
    longitude: "",
  });
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState("");
  const [services, setServices] = useState<
    Array<{ name: string; priceFrom: string; description: string }>
  >([]);
  const [photos, setPhotos] = useState<Pick<Media, "id" | "url" | "thumbnailUrl">[]>([]);
  const [hours, setHours] = useState(defaultHours());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; name: string; city: string | null }>
  >([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial) return;
    setForm({
      name: initial.name,
      description: initial.description ?? "",
      line1: initial.address.line1 ?? "",
      line2: initial.address.line2 ?? "",
      city: initial.address.city ?? "",
      postcode: initial.address.postcode ?? "",
      phone: initial.phone ?? "",
      email: initial.email ?? "",
      website: initial.website ?? "",
      latitude: initial.coordinates ? String(initial.coordinates.latitude) : "",
      longitude: initial.coordinates ? String(initial.coordinates.longitude) : "",
    });
    setCategoryIds(initial.categories.map((c) => c.id));
    setCustomServices(initial.customServices.join(", "));
    setServices(
      initial.services.map((s) => ({
        name: s.name,
        priceFrom: s.priceFrom === null ? "" : String(s.priceFrom),
        description: s.description ?? "",
      })),
    );
    setPhotos(initial.photos);
    if (initial.workingHours.length) {
      setHours(
        DAYS.map((_, day) => {
          const found = initial.workingHours.find((h) => h.day === day);
          return {
            day,
            closed: found?.closed ?? true,
            open: found?.open ?? "09:00",
            close: found?.close ?? "17:00",
          };
        }),
      );
    }
  }, [initial]);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  /**
   * Postcode → coordinates, on blur. Typing latitude and longitude by hand is
   * how a Manchester garage ends up in the North Sea.
   */
  async function resolvePostcode() {
    if (!form.postcode.trim()) return;
    const hit = await geocodeUk(form.postcode);
    if (!hit) {
      setGeoNote("Couldn't place that postcode. Check it, or enter coordinates below.");
      return;
    }
    setGeoNote(`Located: ${hit.label}`);
    setForm((f) => ({
      ...f,
      latitude: String(hit.latitude),
      longitude: String(hit.longitude),
      city: f.city || hit.label.split(",")[1]?.trim() || f.city,
    }));
    void checkDuplicates(hit.latitude, hit.longitude);
  }

  /** Advisory, admin, create only — a genuine second branch two streets away is a real thing. */
  async function checkDuplicates(lat: number, lng: number) {
    if (owner || isEdit || !form.name.trim()) return;
    try {
      setDuplicates(await adminBusinessApi.duplicates(form.name, lat, lng));
    } catch {
      // A missing warning is not worth failing the form over.
    }
  }

  /**
   * Photos upload the moment they are chosen — see mediaApi. Each failure is
   * reported by filename, because "upload failed" for one of five photos on a
   * phone is a message with no next step in it.
   */
  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (chosen.length < files.length) {
      toast.info(`Up to ${MAX_PHOTOS} photos — the first ${chosen.length} were kept.`);
    }
    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const media = await mediaApi.upload(file, "photo");
        setPhotos((p) => [
          ...p,
          { id: media.id, url: media.url, thumbnailUrl: media.thumbnailUrl },
        ]);
      } catch (err) {
        toast.error(`${file.name}: ${getApiErrorMessage(err)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (
      !form.latitude ||
      !form.longitude ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setFormError(
        "This listing needs a location — without one it can't appear in any distance search. Enter the postcode and tab out of the field.",
      );
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      categoryIds,
      customServices: customServices
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      services: services
        .filter((s) => s.name.trim())
        .map((s) => ({
          name: s.name.trim(),
          description: s.description.trim() || undefined,
          priceFrom: s.priceFrom.trim() === "" ? undefined : Number(s.priceFrom),
        })),
      photoIds: photos.map((p) => p.id),
      address: {
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        postcode: form.postcode.trim(),
      },
      latitude,
      longitude,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      website: form.website.trim() || undefined,
      workingHours: hours.map((h) =>
        h.closed
          ? { day: h.day, closed: true }
          : { day: h.day, closed: false, open: h.open, close: h.close },
      ),
    };

    try {
      if (isEdit && initial) {
        const saved = await update.mutateAsync({ id: initial.id, payload });
        toast.success(owner ? "Your listing is updated" : "Listing updated");
        onSaved(saved);
      } else {
        const created = await create.mutateAsync(payload);
        toast.success(`${created.name} is live`);
        onSaved(created);
      }
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(getApiErrorMessage(err));
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <div className="ra-page mx-auto max-w-3xl">
      <Link
        to={backTo}
        className="ra-tap -ms-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <div>
        <p className="ra-eyebrow text-muted-foreground">
          {owner ? "My listing" : isEdit ? "Edit listing" : "New listing"}
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
          {isEdit ? form.name || "Edit listing" : "New listing"}
        </h1>
        {owner && (
          <p className="mt-1 text-sm text-muted-foreground">
            What drivers see on your public page. Changes go live as soon as you save.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="space-y-6" noValidate>
        {/* ── Photos ───────────────────────────────────────────────────── */}
        <section className="ra-tile">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Photos</h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {photos.length} / {MAX_PHOTOS}
            </span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {owner
              ? "A real photo of the workshop is the fastest way to be trusted. The first one is the cover."
              : "The first photo is the cover on search results."}
          </p>

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {photos.map((p, i) => (
              <li
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                <img
                  src={p.thumbnailUrl ?? p.url}
                  alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute start-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
                  aria-label={`Remove photo ${i + 1}`}
                  className="ra-tap absolute end-1 top-1 flex items-center justify-center rounded-lg bg-black/55 text-white transition-colors hover:bg-black/75"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}

            {photos.length < MAX_PHOTOS && (
              <li className="aspect-square">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading > 0}
                  className={cn(
                    "flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors",
                    "hover:border-primary/50 hover:bg-accent hover:text-foreground disabled:opacity-60",
                  )}
                >
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  {uploading > 0 ? `Uploading ${uploading}…` : "Add photo"}
                </button>
                {/* tabIndex={-1} and aria-hidden, or this input duplicates the
                    button's accessible name and a screen reader announces the
                    control twice. */}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  tabIndex={-1}
                  aria-hidden="true"
                  className="sr-only"
                  onChange={(e) => void addPhotos(e.target.files)}
                />
              </li>
            )}
          </ul>
        </section>

        {/* ── Basics ───────────────────────────────────────────────────── */}
        <section className="ra-tile space-y-1">
          <h2 className="mb-2 text-sm font-semibold text-foreground">About</h2>
          <Field
            label="Business name"
            value={form.name}
            onChange={set("name")}
            error={errors.name}
            placeholder="Bridgewater Tyre & Exhaust"
          />
          <div className="space-y-1.5">
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={set("description")}
              rows={4}
              placeholder={
                owner
                  ? "What you do, how long you've been doing it, what you're known for. This is what drivers read first."
                  : "What they do, in the business's own words."
              }
              className="ra-input w-full px-3 py-2"
            />
          </div>

          <fieldset className="pt-2">
            <legend className="mb-2 text-sm font-medium text-foreground">Categories</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={categoryIds.includes(c.id)}
                  onClick={() =>
                    setCategoryIds((ids) =>
                      ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                    )
                  }
                  className="ra-chip"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label="Other services"
            value={customServices}
            onChange={(e) => setCustomServices(e.target.value)}
            placeholder="Cambelt replacement, DPF cleaning"
            hint="Comma separated. Anything the categories above don't cover — these are searchable."
          />
        </section>

        {/* ── Services and prices ──────────────────────────────────────── */}
        <section className="ra-tile">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Services and prices</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {owner
              ? "Drivers can only request a service that's listed here. Prices are “from” — a guide, never a quote."
              : "The list a driver picks from when requesting a booking. Prices are shown as “from”."}
          </p>

          {services.length > 0 && (
            <ul className="mb-3 space-y-2">
              {services.map((s, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_7rem_2.75rem] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_2.75rem]"
                >
                  <input
                    value={s.name}
                    onChange={(e) =>
                      setServices((list) =>
                        list.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    aria-label={`Service ${i + 1} name`}
                    placeholder="Tyre replacement"
                    className="ra-input h-11 px-3"
                  />
                  <input
                    value={s.description}
                    onChange={(e) =>
                      setServices((list) =>
                        list.map((x, j) => (i === j ? { ...x, description: e.target.value } : x)),
                      )
                    }
                    aria-label={`Service ${i + 1} detail`}
                    placeholder="Supply and fit, per tyre"
                    className="ra-input hidden h-11 px-3 sm:block"
                  />
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      £
                    </span>
                    <input
                      value={s.priceFrom}
                      onChange={(e) =>
                        setServices((list) =>
                          list.map((x, j) => (i === j ? { ...x, priceFrom: e.target.value } : x)),
                        )
                      }
                      inputMode="decimal"
                      aria-label={`Service ${i + 1} price from`}
                      placeholder="from"
                      className="ra-input h-11 w-full ps-7 pe-2 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setServices((list) => list.filter((_, j) => j !== i))}
                    aria-label={`Remove service ${i + 1}`}
                    className="ra-tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() =>
              setServices((list) => [...list, { name: "", priceFrom: "", description: "" }])
            }
            className="ra-btn h-10 gap-1.5 px-3 text-sm"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a service
          </button>
        </section>

        {/* ── Where ────────────────────────────────────────────────────── */}
        <section className="ra-tile space-y-1">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Where</h2>
          <Field
            label="Street address"
            value={form.line1}
            onChange={set("line1")}
            error={errors["address.line1"]}
          />
          <Field label="Address line 2" value={form.line2} onChange={set("line2")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Town or city"
              value={form.city}
              onChange={set("city")}
              error={errors["address.city"]}
            />
            <Field
              label="Postcode"
              value={form.postcode}
              onChange={set("postcode")}
              onBlur={resolvePostcode}
              error={errors["address.postcode"]}
              hint="Tab out to place it on the map."
            />
          </div>

          {geoNote && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {geoNote}
            </p>
          )}

          {/* Shown so an obvious error is visible, not for typing into. */}
          <details className="pt-1">
            <summary className="ra-tap inline-flex cursor-pointer items-center text-sm text-muted-foreground">
              Map coordinates
            </summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field
                label="Latitude"
                value={form.latitude}
                onChange={set("latitude")}
                className="font-mono"
              />
              <Field
                label="Longitude"
                value={form.longitude}
                onChange={set("longitude")}
                className="font-mono"
              />
            </div>
          </details>

          {duplicates.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-warning-text">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Possibly already listed
              </p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    {d.name}
                    {d.city ? ` — ${d.city}` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">
                A second branch nearby is fine. This is a prompt to check, not a block.
              </p>
            </div>
          )}
        </section>

        {/* ── Contact ──────────────────────────────────────────────────── */}
        <section className="ra-tile space-y-1">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Phone"
              value={form.phone}
              onChange={set("phone")}
              error={errors.phone}
              placeholder="0161 200 0101"
              hint="Shown on your page with a Call button."
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              error={errors.email}
            />
          </div>
          <Field
            label="Website"
            value={form.website}
            onChange={set("website")}
            error={errors.website}
            placeholder="https://"
          />
          {owner && (
            <p className="pt-1 text-sm text-muted-foreground">
              WhatsApp numbers are managed on{" "}
              <Link to="/portal/whatsapp" className="font-medium text-primary-text hover:underline">
                their own page
              </Link>
              .
            </p>
          )}
        </section>

        {/* ── Hours ────────────────────────────────────────────────────── */}
        <section className="ra-tile">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Opening hours</h2>
          <div className="space-y-2">
            {hours.map((h, i) => (
              <div key={h.day} className="flex flex-wrap items-center gap-2">
                <label className="ra-tap flex w-32 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((x, j) => (i === j ? { ...x, closed: !e.target.checked } : x)),
                      )
                    }
                    className="rounded border-input accent-primary"
                  />
                  <span className={h.closed ? "text-muted-foreground" : "text-foreground"}>
                    {DAYS[h.day]}
                  </span>
                </label>
                {!h.closed && (
                  <>
                    <input
                      type="time"
                      value={h.open}
                      aria-label={`${DAYS[h.day]} opening time`}
                      onChange={(e) =>
                        setHours((prev) =>
                          prev.map((x, j) => (i === j ? { ...x, open: e.target.value } : x)),
                        )
                      }
                      className="ra-input h-11 px-2 font-mono"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={h.close}
                      aria-label={`${DAYS[h.day]} closing time`}
                      onChange={(e) =>
                        setHours((prev) =>
                          prev.map((x, j) => (i === j ? { ...x, close: e.target.value } : x)),
                        )
                      }
                      className="ra-input h-11 px-2 font-mono"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A closing time earlier than the opening time means overnight — a 24-hour recovery
            operator open 20:00 to 06:00 is handled correctly.
          </p>
        </section>

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || uploading > 0}
            className="ra-btn-primary flex-1 sm:flex-none sm:px-6"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create listing"}
          </button>
          <Link to={backTo} className="ra-btn px-6">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
