import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { PageLoader } from "@/shared/components/PageLoader";
import { geocodeUk } from "@/shared/lib/geocode";
import { useCategories } from "@/modules/business/hooks/useBusinesses";
import { WhatsAppNumbers } from "@/modules/whatsapp/components/WhatsAppNumbers";
import { adminBusinessApi } from "../api/adminApi";
import { useAdminBusiness, useCreateBusiness, useUpdateBusiness } from "../hooks/useAdmin";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function defaultHours() {
  return [
    { day: 0, closed: true, open: "09:00", close: "17:00" },
    ...[1, 2, 3, 4, 5].map((day) => ({ day, closed: false, open: "09:00", close: "17:00" })),
    { day: 6, closed: false, open: "09:00", close: "13:00" },
  ];
}

/**
 * Create or edit a listing — FR-ADM-02 and FR-ONB-01.
 *
 * This is the screen that seeds a market: an administrator opening a new city
 * works through it dozens of times in an afternoon, so the ordering is by how
 * often a field is filled in rather than by how the record is structured.
 *
 * Coordinates are the field everything else depends on — a listing without them
 * is excluded from every distance search, which is the only view that matters —
 * so they are derived from the postcode automatically and only shown as raw
 * numbers when that fails.
 */
export function AdminBusinessFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: categories = [] } = useCategories();
  const { data: existing, isLoading } = useAdminBusiness(id);
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
  const [hours, setHours] = useState(defaultHours());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; name: string; city: string | null }>
  >([]);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      description: existing.description ?? "",
      line1: existing.address.line1 ?? "",
      line2: existing.address.line2 ?? "",
      city: existing.address.city ?? "",
      postcode: existing.address.postcode ?? "",
      phone: existing.phone ?? "",
      email: existing.email ?? "",
      website: existing.website ?? "",
      latitude: existing.coordinates ? String(existing.coordinates.latitude) : "",
      longitude: existing.coordinates ? String(existing.coordinates.longitude) : "",
    });
    setCategoryIds(existing.categories.map((c) => c.id));
    setCustomServices(existing.customServices.join(", "));
    if (existing.workingHours.length) {
      setHours(
        DAYS.map((_, day) => {
          const found = existing.workingHours.find((h) => h.day === day);
          return {
            day,
            closed: found?.closed ?? true,
            open: found?.open ?? "09:00",
            close: found?.close ?? "17:00",
          };
        }),
      );
    }
  }, [existing]);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  /**
   * Postcode → coordinates, on blur.
   *
   * Typing latitude and longitude by hand is how a Manchester garage ends up in
   * the North Sea. The postcode is the field an administrator has in front of
   * them from the business's own paperwork; the coordinates are derived, and
   * shown only so an obvious error is visible.
   */
  async function resolvePostcode() {
    if (!form.postcode.trim()) return;
    const hit = await geocodeUk(form.postcode);
    if (!hit) {
      setGeoNote("Couldn't place that postcode. Enter coordinates manually below.");
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

  /** Advisory only — a genuine second branch two streets away is a real thing. */
  async function checkDuplicates(lat: number, lng: number) {
    if (!form.name.trim() || isEdit) return;
    try {
      setDuplicates(await adminBusinessApi.duplicates(form.name, lat, lng));
    } catch {
      // A missing warning is not worth failing the form over.
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setFormError(
        "This listing needs coordinates — without them it can't appear in any distance search. Enter the postcode and tab out of the field.",
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
      if (isEdit && id) {
        await update.mutateAsync({ id, payload });
        toast.success("Listing updated");
      } else {
        const created = await create.mutateAsync(payload);
        toast.success(`${created.name} is live`);
      }
      navigate("/admin/businesses");
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(getApiErrorMessage(err));
    }
  }

  if (isEdit && isLoading) return <PageLoader />;

  return (
    <div className="ra-page mx-auto max-w-3xl">
      <Link
        to="/admin/businesses"
        className="ra-tap -ms-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Businesses
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {isEdit ? form.name || "Edit listing" : "New listing"}
      </h1>

      <form onSubmit={submit} className="space-y-6" noValidate>
        <section className="ra-tile space-y-1">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Basics</h2>
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
              rows={3}
              placeholder="What they do, in the business's own words."
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
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
          <div className="grid gap-3 sm:grid-cols-2">
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

        <section className="ra-tile space-y-1">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Phone"
              value={form.phone}
              onChange={set("phone")}
              error={errors.phone}
              placeholder="0161 200 0101"
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
        </section>

        <section className="ra-tile">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Opening hours</h2>
          <div className="space-y-2">
            {hours.map((h, i) => (
              <div key={h.day} className="flex flex-wrap items-center gap-2">
                {/* `ra-tap` on the label, not the box: the label is what
                    receives the tap, so growing it is what gives the 16px
                    control a finger-sized target. */}
                <label className="ra-tap flex w-32 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((x, j) => (i === j ? { ...x, closed: !e.target.checked } : x)),
                      )
                    }
                    className="h-4 w-4 rounded border-input accent-primary"
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
                      className="h-10 rounded-lg border border-input bg-card px-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                      className="h-10 rounded-lg border border-input bg-card px-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

        {/*
          Only on an existing record: numbers belong to a business, and there is
          nothing to attach them to until it has been created.

          `asAdmin` is what requires a reason before switching somebody else's
          number off — the owner reads that reason in their portal.
        */}
        {isEdit && id && (
          <section className="ra-tile">
            <h2 className="mb-1 text-sm font-semibold text-foreground">WhatsApp numbers</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Changes here are recorded in the audit log and are visible to the owner.
            </p>
            <WhatsAppNumbers businessId={id} asAdmin />
          </section>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={create.isPending || update.isPending}
            className="ra-tap flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 sm:flex-none sm:px-6"
          >
            {create.isPending || update.isPending
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Create listing"}
          </button>
          <Link
            to="/admin/businesses"
            className="ra-tap flex items-center justify-center rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
