import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  X,
  FileText,
  Clock,
  AlertTriangle,
  ExternalLink,
  Store,
  Loader2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { formatAge, formatDateTime } from "@/shared/lib/format";
import { adminClaimApi } from "@/modules/claim/api/claimApi";
import type { AdminClaim, ClaimStatus } from "@/modules/claim/types";

/**
 * The review queue — FR-ONB-05, US-304.
 *
 * The screen that decides who controls a business's public listing, so it is
 * built around one question: **can I make this decision from what is on this
 * page?** Everything a reviewer needs is on it — the documents, the applicant's
 * details, the listing they are claiming, and any near-identical listing
 * already in the directory — and nothing else is.
 *
 * Oldest first, and that ordering is the product decision. A claim left four
 * days is more urgent than one filed this morning, and newest-first is how a
 * queue grows a tail nobody ever reaches.
 */
export function AdminClaimsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ClaimStatus | "">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "claims", status, search],
    queryFn: () => adminClaimApi.list({ status: status || undefined, search }),
  });

  const items = data?.items ?? [];
  const current = items.find((c) => c.id === selected) ?? items[0] ?? null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "claims"] });
    void qc.invalidateQueries({ queryKey: ["admin", "businesses"] });
    // A decision changes what the public sees — a verified badge appearing, or a
    // draft listing going live.
    void qc.invalidateQueries({ queryKey: ["businesses"] });
    void qc.invalidateQueries({ queryKey: ["business"] });
  };

  return (
    <div className="ra-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Claims
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{data?.meta.total ?? 0}</span> applications ·
            oldest first
          </p>
        </div>
        <label className="sr-only" htmlFor="claim-status">
          Status
        </label>
        <select
          id="claim-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ClaimStatus | "");
            setSelected(null);
          }}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Awaiting a decision</option>
          <option value="pending">Under review</option>
          <option value="queued">Queued</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/*
        Search, because the queue is paginated and sorted oldest-first.
        Without it, "that application from the tyre place in Salford" is only
        reachable by paging through everything filed before it — which is
        exactly the request an administrator gets when an applicant rings up.
      */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
          placeholder="Search by applicant name, email or phone"
          aria-label="Search applications"
          className="h-11 w-full rounded-lg border border-input bg-card ps-9 pe-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="ra-panel px-4 py-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Check}
          title="Nothing waiting"
          description="Every application has been decided. New ones appear here as they arrive."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* The queue */}
          <ul className="ra-panel max-h-[70vh] divide-y divide-border overflow-auto">
            {items.map((claim) => (
              <li key={claim.id}>
                <button
                  type="button"
                  onClick={() => setSelected(claim.id)}
                  className={cn(
                    "w-full px-4 py-3 text-start transition-colors hover:bg-accent/40",
                    current?.id === claim.id && "bg-accent/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-foreground">
                      {claim.business?.name ?? "—"}
                    </p>
                    <StatusBadge status={claim.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {claim.contactName} · {claim.contactEmail}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {/* Age, not date. It is what the queue is triaged by, and
                        what the one-working-day target is measured against. */}
                    <span className="font-mono tabular-nums">{formatAge(claim.createdAt)}</span>
                    {claim.kind === "self_register" && (
                      <span className="ms-1 text-muted-foreground">· new listing</span>
                    )}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {current && <ClaimDetail claim={current} onDecided={invalidate} />}
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

  // Blob URLs are held by the browser until revoked; without this a reviewer
  // working through fifty claims leaks a file's worth of memory per preview.
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

  /**
   * Documents are private and carry no Authorization header on a plain link, so
   * they are fetched with the session's token and shown from a blob URL.
   */
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

  return (
    <div className="space-y-4">
      <section className="ra-tile">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{claim.business?.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {claim.business?.address?.line1}
              {claim.business?.address?.city ? `, ${claim.business.address.city}` : ""}
              {claim.business?.address?.postcode ? ` ${claim.business.address.postcode}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={claim.status} />
            {claim.business?.slug && (
              <a
                href={`/business/${claim.business.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ra-tap flex items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Listing
              </a>
            )}
          </div>
        </div>

        {claim.kind === "self_register" && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />A new listing. It is not
            publicly visible and will only go live if you approve this.
          </p>
        )}

        {/* Advisory, never a block. A genuine second branch two streets away is
            a real thing — this is here so a reviewer can tell the difference. */}
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

      <section className="ra-tile">
        <h3 className="text-sm font-semibold text-foreground">Applicant</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <Row label="Name" value={claim.contactName} />
          <Row label="Role" value={claim.contactRole ?? "—"} />
          <Row label="Email" value={claim.contactEmail} mono />
          <Row label="Phone" value={claim.contactPhone} mono />
          <Row label="Applied" value={formatDateTime(claim.createdAt)} mono />
          <Row label="Waiting" value={`${claim.ageHours}h`} mono />
        </dl>
        {claim.message && (
          <p className="mt-3 whitespace-pre-line rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {claim.message}
          </p>
        )}
      </section>

      <section className="ra-tile">
        <h3 className="text-sm font-semibold text-foreground">
          Evidence
          <span className="ms-2 font-mono text-xs font-normal tabular-nums text-muted-foreground">
            {claim.documents.length}
          </span>
        </h3>
        <ul className="mt-2 space-y-2">
          {claim.documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => open(doc)}
                className="ra-tap flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-start transition-colors hover:bg-accent/40"
              >
                {loadingDoc === doc.id ? (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
      </section>

      {!decided && (
        <section className="ra-tile">
          {!rejecting ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="ra-tap flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 sm:flex-none"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {approve.isPending ? "Approving…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="ra-tap flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-destructive/10 hover:text-destructive sm:flex-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Reject
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="reject-reason" className="block text-sm font-medium text-foreground">
                Why are you rejecting this?
              </label>
              {/* The applicant reads this verbatim, and re-applying is allowed —
                  so the reason is the only thing that makes a second attempt any
                  different from the first. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Sent to the applicant word for word. They can apply again, so tell them what to fix.
              </p>
              <textarea
                id="reject-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The utility bill isn't in the business's name. Please send a business licence or a tax document."
                className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => reject.mutate()}
                  disabled={reject.isPending}
                  className="ra-tap rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-70"
                >
                  {reject.isPending ? "Sending…" : "Reject and notify"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                  className="ra-tap rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {decided && claim.decisionReason && (
        <section className="ra-tile">
          <h3 className="text-sm font-semibold text-foreground">Decision</h3>
          <p className="mt-1 text-sm text-muted-foreground">{claim.decisionReason}</p>
          {claim.reviewedBy && (
            <p className="mt-2 text-xs text-muted-foreground">
              {claim.reviewedBy.name} · {formatDateTime(claim.reviewedAt)}
            </p>
          )}
        </section>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-foreground", mono && "font-mono text-xs tabular-nums")}>{value}</dd>
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
