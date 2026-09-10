import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/api/http";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { useBusiness } from "@/modules/business/hooks/useBusinesses";
import { claimApi } from "../api/claimApi";
import { ApplicantFieldset } from "../components/ApplicantFields";
import { DocumentUpload } from "../components/DocumentUpload";
import type { ApplicantFields, Claim } from "../types";

/**
 * Claim Your Business — FR-ONB-02.
 *
 * No account required, and the whole flow rests on it: a garage owner should not
 * have to create a login before they know whether their claim will be accepted.
 * The account is created on approval, with a link to set a password.
 *
 * The page opens by saying what happens next and what it costs them — one
 * document, one working day.
 */
export function ClaimBusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: business, isLoading } = useBusiness(slug);

  // Feeds the "time to claim < 5 minutes" measure in PRD §6. There is no
  // server-side way to know when somebody started typing.
  const startedAt = useRef(new Date().toISOString());

  const [fields, setFields] = useState<ApplicantFields>({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactRole: "",
    message: "",
  });
  const [documents, setDocuments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ claim: Claim; message: string } | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      claimApi.claimExisting(business!.id, { ...fields, startedAt: startedAt.current }, documents),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    // Checked here so the applicant is not made to upload before being told.
    if (documents.length === 0) {
      setErrors({ documents: "Attach at least one document showing you run this business." });
      return;
    }

    try {
      setResult(await submit.mutateAsync());
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

  if (business.claimStatus === "claimed") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={ShieldCheck}
          title={`${business.name} already has an owner`}
          description="If you believe that's wrong, get in touch and we'll look into it."
          action={
            <Link
              to={`/business/${business.slug}`}
              className="ra-tap flex items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
            >
              Back to the listing
            </Link>
          }
        />
      </div>
    );
  }

  if (result) {
    const queued = result.claim.status === "queued";
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="ra-tile text-center">
          {queued ? (
            <Clock className="mx-auto h-10 w-10 text-warning" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
          )}
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {queued ? "You're in the queue" : "Application received"}
          </h1>
          {/* The server's own words. Someone who is second in a queue must be
              told plainly, or they conclude their application vanished. */}
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{result.message}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            We'll email{" "}
            <span className="font-medium text-foreground">{result.claim.contactEmail}</span> either
            way.
          </p>
          <Link
            to={`/business/${business.slug}`}
            className="ra-tap mt-6 inline-flex items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Back to the listing
          </Link>
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
            Claim {business.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Show us you run this business and you'll be able to manage the listing — photos, opening
            hours, services, and the WhatsApp number customers reach you on.
          </p>
        </header>

        {/* What it costs and what happens next, before the form asks for
            anything. A licence request with no explanation is where people
            leave. */}
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { n: 1, title: "Send a document", body: "Proof the business is yours." },
            { n: 2, title: "We check it", body: "By hand, usually within a working day." },
            { n: 3, title: "You're in", body: "We email you a link to set a password." },
          ].map((s) => (
            <li key={s.n} className="ra-tile">
              <span className="font-mono text-xs font-semibold text-primary-text">0{s.n}</span>
              <p className="mt-1 text-sm font-semibold text-foreground">{s.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <section className="ra-tile">
            <ApplicantFieldset
              values={fields}
              errors={errors}
              onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
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

          <div className="flex gap-2">
            {/* Never disabled while typing — validate on submit and say what is
                wrong, or the applicant cannot tell which rule they failed. */}
            <button
              type="submit"
              disabled={submit.isPending}
              className="ra-tap flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 sm:flex-none sm:px-8"
            >
              {submit.isPending ? "Sending…" : "Send application"}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Your documents are kept private and are only seen by the RoadAxis team reviewing this
            application. They are never shown on your listing.
          </p>
        </form>
      </div>
    </div>
  );
}
