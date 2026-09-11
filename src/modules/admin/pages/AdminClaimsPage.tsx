import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  X,
  FileText,
  AlertTriangle,
  ExternalLink,
  Store,
  Loader2,
  Clock,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { Button, ButtonAnchor } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { FilterBar, FilterSelect } from "@/shared/components/FilterBar";
import { EmptyState } from "@/shared/components/EmptyState";
import { SectionCard, DescriptionList } from "@/shared/components/SectionCard";
import { Skeleton } from "@/shared/components/Skeleton";
import { formatAge, formatDateTime } from "@/shared/lib/format";
import { adminClaimApi } from "@/modules/claim/api/claimApi";
import type { AdminClaim, ClaimStatus } from "@/modules/claim/types";

const STATUSES = [
  { value: "", label: "Awaiting a decision" },
  { value: "pending", label: "Under review" },
  { value: "queued", label: "Queued" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/** PRD §6: a decision within one working day. Past that, the row says so. */
const SLA_HOURS = 24;

/**
 * The review queue — FR-ONB-05, US-304. Built around one question: can I make
 * this decision from what is on this page? Oldest first: a claim left four days
 * is more urgent than one filed this morning.
 */
export function AdminClaimsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ClaimStatus | "">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "claims", status, search],
    queryFn: () => adminClaimApi.list({ status: status || undefined, search }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const current = items.find((c) => c.id === selected) ?? items[0] ?? null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "claims"] });
    void qc.invalidateQueries({ queryKey: ["admin", "businesses"] });
    // A decision changes what the public sees — a verified badge appearing, or
    // a draft listing going live.
    void qc.invalidateQueries({ queryKey: ["businesses"] });
    void qc.invalidateQueries({ queryKey: ["business"] });
  };

  const overdue = items.filter((c) => c.status === "pending" && c.ageHours >= SLA_HOURS).length;

  return (
    <div className="ra-page">
      <PageHeader
        title="Claims"
        description="Who is asking to control a listing, with the evidence. Approving hands them the page and the WhatsApp routing."
        meta={
          <>
            <span>
              <span className="font-mono tabular-nums text-foreground">
                {data?.meta.total ?? 0}
              </span>{" "}
              applications · oldest first
            </span>
            {overdue > 0 && <Badge tone="warning">{overdue} past one working day</Badge>}
          </>
        }
        actions={
          <FilterSelect
            id="claim-status"
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v as ClaimStatus | "");
              setSelected(null);
            }}
            options={STATUSES}
          />
        }
      />

      {/* Searched rather than scrolled — "that application from the tyre place
          in Salford" is exactly the request an administrator gets on the phone. */}
      <FilterBar
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setSelected(null);
          },
          placeholder: "Search by applicant name, email or phone",
          label: "Search applications",
        }}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]" aria-busy="true">
          <div className="ra-panel divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
          <div className="ra-panel h-64" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={status || search ? ClipboardCheck : Check}
          title={status || search ? "Nothing matches" : "Nothing waiting"}
          description={
            status || search
              ? "Try another status, or clear the search."
              : "Every application has been decided. New ones appear here as they arrive."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* The queue */}
          <ul
            className="ra-panel max-h-[70vh] divide-y divide-border self-start overflow-auto"
            aria-label="Applications"
          >
            {items.map((claim) => {
              const active = current?.id === claim.id;
              const late = claim.status === "pending" && claim.ageHours >= SLA_HOURS;
              return (
                <li key={claim.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(claim.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "ra-focus-inset relative w-full px-4 py-3 text-start transition-colors hover:bg-accent/40",
                      active && "bg-primary/[0.06]",
                    )}
                  >
                    {active && (
                      <span
                        className="absolute inset-y-0 start-0 w-0.5 bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">
                        {claim.business?.name ?? "—"}
                      </p>
                      <StatusBadge status={claim.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {claim.contactName} · {claim.contactEmail}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock
                        className={cn("h-3 w-3", late && "text-warning-text")}
                        aria-hidden="true"
                      />
                      {/* Age, not date — what the queue is triaged by. */}
                      <span className={cn("font-mono tabular-nums", late && "text-warning-text")}>
                        {formatAge(claim.createdAt)}
                      </span>
                      {claim.kind === "self_register" && <span>· new listing</span>}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {current && <ClaimDetail key={current.id} claim={current} onDecided={invalidate} />}
        </div>
      )}
    </div>
  );
}

function ClaimDetail({ claim, onDecided }: { claim: AdminClaim; onDecided: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);

  // Blob URLs are held by the browser until revoked.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const approve = useMutation({
    mutationFn: () => adminClaimApi.approve(claim.id),
    onSuccess: ({ message }) => {
      toast.success(message);
      onDecided();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const reject = useMutation({
    mutationFn: () => adminClaimApi.reject(claim.id, reason),
    onSuccess: ({ message }) => {
      toast.success(message);
      setRejecting(false);
      setReason("");
      onDecided();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  /** Private media: fetched with the session's token, shown from a blob URL. */
  async function open(doc: { id: string; filename: string; mimeType: string }) {
    setLoadingDoc(doc.id);
    try {
      const url = await adminClaimApi.documentUrl(claim.id, doc.id);
      setPreview({ url, name: doc.filename, type: doc.mimeType });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoadingDoc(null);
    }
  }

  const decided = claim.status === "approved" || claim.status === "rejected";
  const address = [
    claim.business?.address?.line1,
    claim.business?.address?.city,
    claim.business?.address?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      {/* ── The listing ────────────────────────────────────────────────── */}
      <section className="ra-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {claim.business?.name}
            </h2>
            {address && <p className="mt-0.5 text-sm text-muted-foreground">{address}</p>}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={claim.status} />
            {claim.business?.slug && (
              <ButtonAnchor
                href={`/business/${claim.business.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                icon={ExternalLink}
              >
                Listing
              </ButtonAnchor>
            )}
          </div>
        </div>

        {claim.kind === "self_register" && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted-foreground">
            <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />A new listing. It is not
            publicly visible and only goes live if you approve this.
          </p>
        )}

        {/* Advisory, never a block — a genuine second branch two streets away is real. */}
        {claim.possibleDuplicates.length > 0 && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-warning-text">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Similar listings nearby
            </p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {claim.possibleDuplicates.map((d) => (
                <li key={d.id}>
                  <a
                    href={`/business/${d.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-text hover:underline"
                  >
                    {d.name}
                  </a>
                  {d.city ? <span className="text-muted-foreground"> — {d.city}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── The applicant ──────────────────────────────────────────────── */}
      <SectionCard title="Applicant" as="h3">
        <DescriptionList
          items={[
            { label: "Name", value: claim.contactName },
            { label: "Role", value: claim.contactRole ?? "—" },
            { label: "Email", value: claim.contactEmail, mono: true },
            { label: "Phone", value: claim.contactPhone, mono: true },
            { label: "Applied", value: formatDateTime(claim.createdAt), mono: true },
            {
              label: "Waiting",
              value: (
                <span
                  className={cn(claim.ageHours >= SLA_HOURS && !decided && "text-warning-text")}
                >
                  {claim.ageHours}h
                  {claim.ageHours >= SLA_HOURS && !decided ? " · past one working day" : ""}
                </span>
              ),
              mono: true,
            },
          ]}
        />
        {claim.message && (
          <blockquote className="mt-4 whitespace-pre-line border-s-2 border-border ps-3 text-sm italic leading-relaxed text-foreground">
            {claim.message}
          </blockquote>
        )}
      </SectionCard>

      {/* ── The evidence ───────────────────────────────────────────────── */}
      <SectionCard
        title="Evidence"
        as="h3"
        aside={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {claim.documents.length} {claim.documents.length === 1 ? "file" : "files"}
          </span>
        }
        flush
      >
        {claim.documents.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No documents attached.</p>
        ) : (
          <ul className="divide-y divide-border">
            {claim.documents.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => open(doc)}
                  className="ra-focus-inset ra-control flex w-full items-center gap-3 px-4 text-start transition-colors hover:bg-accent/40 md:h-11"
                >
                  {loadingDoc === doc.id ? (
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileText
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {doc.filename}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── The decision ───────────────────────────────────────────────── */}
      {!decided && (
        <section
          className="ra-panel sticky bottom-4 z-10 p-4 shadow-lg shadow-black/5"
          aria-label="Decision"
        >
          {!rejecting ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                icon={Check}
                loading={approve.isPending}
                onClick={() => approve.mutate()}
                className="flex-1 sm:flex-none"
              >
                Approve
              </Button>
              <Button
                variant="danger-outline"
                icon={X}
                onClick={() => setRejecting(true)}
                className="flex-1 sm:flex-none"
              >
                Reject
              </Button>
              <p className="ms-auto hidden text-xs text-muted-foreground sm:block">
                Approving creates the owner's account and emails a set-password link.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="reject-reason" className="block text-sm font-medium text-foreground">
                Why are you rejecting this?
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Sent to the applicant word for word. They can apply again, so tell them what to fix.
              </p>
              <textarea
                id="reject-reason"
                rows={3}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The utility bill isn't in the business's name. Please send a business licence or a tax document."
                className="ra-input mt-2 w-full px-3 py-2"
              />
              <div className="mt-3 flex gap-2">
                <Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate()}>
                  Reject and notify
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {decided && claim.decisionReason && (
        <SectionCard title="Decision" as="h3">
          <p className="text-sm text-foreground">{claim.decisionReason}</p>
          {claim.reviewedBy && (
            <p className="mt-2 text-xs text-muted-foreground">
              {claim.reviewedBy.name} · {formatDateTime(claim.reviewedAt)}
            </p>
          )}
        </SectionCard>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={preview.name}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Close document"
            className="ra-tap absolute end-3 top-3 flex items-center justify-center rounded-lg text-white/80 transition-colors hover:text-white"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
          {preview.type === "application/pdf" ? (
            <iframe
              src={preview.url}
              title={preview.name}
              className="h-full w-full rounded-lg bg-white"
            />
          ) : (
            <img
              src={preview.url}
              alt={`Ownership document: ${preview.name}`}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ClaimStatus }) {
  if (status === "pending") return <Badge tone="warning">Under review</Badge>;
  if (status === "queued") return <Badge>Queued</Badge>;
  if (status === "approved") return <Badge tone="success">Approved</Badge>;
  if (status === "rejected") return <Badge tone="destructive">Rejected</Badge>;
  return <Badge>{status}</Badge>;
}
