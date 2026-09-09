export type ClaimKind = "claim_existing" | "self_register";
export type ClaimStatus = "pending" | "queued" | "approved" | "rejected" | "withdrawn";

export interface ClaimDocument {
  id: string;
  filename: string;
  mimeType: string;
  bytes: number | null;
  uploadedAt: string;
}

/** What an applicant is told about their own application. */
export interface Claim {
  id: string;
  kind: ClaimKind;
  status: ClaimStatus;
  business: { id: string; name: string | null; slug: string | null } | null;
  contactName: string;
  contactEmail: string;
  documentCount: number;
  decisionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** True when somebody else got there first — see FR-ONB-07. */
  queued?: boolean;
}

/** The review screen: the evidence, and nothing a driver may see. */
export interface AdminClaim extends Claim {
  contactPhone: string;
  contactRole: string | null;
  message: string | null;
  documents: ClaimDocument[];
  business:
    | (Claim["business"] & {
        address?: { line1?: string; city?: string; postcode?: string } | null;
        status?: string | null;
        claimStatus?: string | null;
        isVerified?: boolean;
      })
    | null;
  /** Advisory only. Shown side by side; never used to refuse an applicant. */
  possibleDuplicates: Array<{ id: string; name: string | null; slug: string | null; city: string | null }>;
  reviewedBy: { id: string; name: string | null } | null;
  /** How long it has been waiting. What the queue is actually triaged by. */
  ageHours: number;
  /** Development and CI only — the server refuses to emit this in production. */
  devInviteUrl?: string;
}

export interface ApplicantFields {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactRole?: string;
  message?: string;
  /** When the form was opened. Feeds the "time to claim < 5 min" measure. */
  startedAt?: string;
}
