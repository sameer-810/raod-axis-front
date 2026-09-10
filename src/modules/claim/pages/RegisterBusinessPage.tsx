import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MapPin, Search } from "lucide-react";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/api/http";
import { Field } from "@/shared/components/Field";
import { geocodeUk } from "@/shared/lib/geocode";
import { useCategories } from "@/modules/business/hooks/useBusinesses";
import { businessApi } from "@/modules/business/api/businessApi";
import { claimApi, type RegisterBusinessFields } from "../api/claimApi";
import { ApplicantFieldset } from "../components/ApplicantFields";
import { DocumentUpload } from "../components/DocumentUpload";
import type { ApplicantFields, Claim } from "../types";

/**
 * Register a business that is not listed yet — FR-ONB-03.
 *
 * The second route into the directory. It ends in the same review queue as a
 * claim, and the listing stays a **draft** until a human has read the documents:
 * publishing first would make the review decorative.
 *
 * The page checks the directory before taking a registration — most people who
 * arrive here are already listed, and claiming is quicker for them and better for
 * us than a duplicate somebody has to merge later.
 */
export function RegisterBusinessPage() {
  const { data: categories = [] } = useCategories();
  const startedAt = useRef(new Date().toISOString());

  const [applicant, setApplicant] = useState<ApplicantFields>({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactRole: "",
    message: "",
  });
  const [business, setBusiness] = useState({
    name: "",
    description: "",
    line1: "",
    line2: "",
    city: "",
    postcode: "",
    phone: "",
    website: "",
    latitude: "",
    longitude: "",
  });
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [existing, setExisting] = useState<
    Array<{ name: string; slug: string; city: string | null }>
  >([]);
  const [result, setResult] = useState<{ claim: Claim; message: string } | null>(null);

  const set =
    (key: keyof typeof business) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setBusiness((b) => ({ ...b, [key]: e.target.value }));

  /**
   * Postcode → coordinates. Required, because a listing without them is excluded
   * from every distance search — the only view that matters. Derived rather than
   * typed, since nobody knows their own latitude.
   */
  async function resolvePostcode() {
    if (!business.postcode.trim()) return;
    const hit = await geocodeUk(business.postcode);
    if (!hit) {
      setGeoNote("We couldn't place that postcode. Check it and try again.");
      return;
    }
    setGeoNote(`Found: ${hit.label}`);
    setBusiness((b) => ({
      ...b,
      latitude: String(hit.latitude),
      longitude: String(hit.longitude),
    }));
    void checkExisting(hit.latitude, hit.longitude);
  }

  /**
   * Is this already listed? Advisory and never blocking — a genuine second branch
   * is a real thing — but offering the claim route to somebody about to create a
   * duplicate saves them a week and saves us a merge.
   */
  async function checkExisting(lat: number, lng: number) {
    if (!business.name.trim()) return;
    try {
      const { items } = await businessApi.search({
        search: business.name,
        lat,
        lng,
        radius: 2000,
      });
      setExisting(
        items.slice(0, 3).map((b) => ({ name: b.name, slug: b.slug, city: b.address.city })),
      );
    } catch {
      // A missing suggestion is not worth failing the form over.
    }
  }

  const submit = useMutation({
    mutationFn: (payload: RegisterBusinessFields) => claimApi.register(payload, documents),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    if (documents.length === 0) {
      setErrors({ documents: "Attach at least one document showing you run this business." });
      return;
    }
    const latitude = Number(business.latitude);
    const longitude = Number(business.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setFormError(
        "We need to place your business on the map. Enter the postcode and tab out of the field.",
      );
      return;
    }

    try {
      setResult(
        await submit.mutateAsync({
          ...applicant,
          startedAt: startedAt.current,
          name: business.name.trim(),
          description: business.description.trim() || undefined,
          categoryIds,
          customServices: customServices
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          address: {
            line1: business.line1.trim(),
            line2: business.line2.trim() || undefined,
            city: business.city.trim(),
            postcode: business.postcode.trim(),
          },
          latitude,
          longitude,
          phone: business.phone.trim() || undefined,
          website: business.website.trim() || undefined,
        }),
      );
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(getApiErrorMessage(err));
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="ra-tile text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            Application received
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{result.message}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Your listing goes live once we've checked your documents. We'll email{" "}
            <span className="font-medium text-foreground">{result.claim.contactEmail}</span> either
            way.
          </p>
          <Link
            to="/"
            className="ra-tap mt-6 inline-flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Back to RoadAxis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <div className="ra-public">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Add your business
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Free while we're building the network. We check every application by hand, usually
            within one working day.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <section className="ra-tile space-y-1">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Your business</h2>
            <Field
              label="Business name"
              value={business.name}
              onChange={set("name")}
              error={errors.name}
              placeholder="Bridgewater Tyre & Exhaust"
            />

            {/* Most people arriving here are already listed and do not know it. */}
            {existing.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-warning-text">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Already on RoadAxis?
                </p>
                <ul className="mt-2 space-y-1.5">
                  {existing.map((b) => (
                    <li key={b.slug} className="text-sm">
                      <Link
                        to={`/business/${b.slug}/claim`}
                        className="font-medium text-primary-text hover:underline"
                      >
                        {b.name}
                      </Link>
                      {b.city ? <span className="text-muted-foreground"> — {b.city}</span> : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Claiming an existing listing is quicker. If none of these is yours, carry on
                  below.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="description" className="block text-sm font-medium text-foreground">
                What you do
              </label>
              <textarea
                id="description"
                rows={3}
                value={business.description}
                onChange={set("description")}
                placeholder="In your own words. This is what drivers read first."
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <fieldset className="pt-2">
              <legend className="mb-2 text-sm font-medium text-foreground">Services</legend>
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

            {/* The roadmap's own escape hatch: "mention your service if it is
                not listed". Searchable, and it is what tells us which category
                the taxonomy is missing. */}
            <Field
              label="Anything not listed above"
              value={customServices}
              onChange={(e) => setCustomServices(e.target.value)}
              placeholder="Cambelt replacement, DPF cleaning"
              hint="Comma separated. Customers can search for these."
            />
          </section>

          <section className="ra-tile space-y-1">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Where you are</h2>
            <Field
              label="Street address"
              value={business.line1}
              onChange={set("line1")}
              error={errors["address.line1"]}
            />
            <Field label="Address line 2" value={business.line2} onChange={set("line2")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Town or city"
                value={business.city}
                onChange={set("city")}
                error={errors["address.city"]}
              />
              <Field
                label="Postcode"
                value={business.postcode}
                onChange={set("postcode")}
                onBlur={resolvePostcode}
                error={errors["address.postcode"]}
                hint="Tab out to place you on the map."
              />
            </div>
            {geoNote && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {geoNote}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* The premises, not the person — see ApplicantFieldset. */}
              <Field
                label="Business phone"
                type="tel"
                value={business.phone}
                onChange={set("phone")}
                error={errors.phone}
                hint="Shown on your public listing."
              />
              <Field
                label="Website"
                value={business.website}
                onChange={set("website")}
                error={errors.website}
                placeholder="https://"
              />
            </div>
          </section>

          <section className="ra-tile">
            <ApplicantFieldset
              values={applicant}
              errors={errors}
              onChange={(patch) => setApplicant((a) => ({ ...a, ...patch }))}
            />
          </section>

          <section className="ra-tile">
            <DocumentUpload files={documents} onChange={setDocuments} error={errors.documents} />
          </section>

          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submit.isPending}
            className="ra-tap w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 sm:w-auto sm:px-8"
          >
            {submit.isPending ? "Sending…" : "Send application"}
          </button>
        </form>
      </div>
    </div>
  );
}
