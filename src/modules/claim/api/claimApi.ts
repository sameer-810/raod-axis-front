import { http } from "@/shared/api/http";
import type { AdminClaim, ApplicantFields, Claim, ClaimStatus } from "../types";

/**
 * Claims are submitted as multipart, because the ownership documents come with
 * them. The applicant has no account yet, so there is no separate authenticated
 * upload step to attach files to first — and asking them to register before
 * they know whether the claim will be accepted is friction at exactly the wrong
 * moment.
 */
function toFormData(fields: Record<string, unknown>, documents: File[]) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    // Nested values survive the trip as JSON; the server parses them back.
    form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  for (const file of documents) form.append("documents", file);
  return form;
}

export interface RegisterBusinessFields extends ApplicantFields {
  name: string;
  description?: string;
  categoryIds?: string[];
  customServices?: string[];
  address: { line1: string; line2?: string; city: string; postcode: string };
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
}

export const claimApi = {
  /** Claim a listing an administrator already created. */
  async claimExisting(businessId: string, fields: ApplicantFields, documents: File[]) {
    const res = await http.post<{ data: Claim; message: string }>(
      `/claims/business/${businessId}`,
      toFormData({ ...fields }, documents),
    );
    return { claim: res.data.data, message: res.data.message };
  },

  /** Register a business that is not in the directory yet. */
  async register(fields: RegisterBusinessFields, documents: File[]) {
    const res = await http.post<{ data: Claim; message: string }>(
      "/claims/register",
      toFormData(
        {
          ...fields,
          categoryIds: fields.categoryIds?.join(","),
          customServices: fields.customServices?.join(","),
        },
        documents,
      ),
    );
    return { claim: res.data.data, message: res.data.message };
  },
};

export const adminClaimApi = {
  async list(query: { status?: ClaimStatus | ""; kind?: string; search?: string; page?: number }) {
    const params: Record<string, string> = { limit: "20" };
    if (query.status) params.status = query.status;
    if (query.kind) params.kind = query.kind;
    if (query.search?.trim()) params.search = query.search.trim();
    if (query.page && query.page > 1) params.page = String(query.page);

    const res = await http.get<{
      data: AdminClaim[];
      meta: {
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
        page: number;
      };
    }>("/claims", { params });
    return { items: res.data.data, meta: res.data.meta };
  },

  async get(id: string) {
    const res = await http.get<{ data: AdminClaim }>(`/claims/${id}`);
    return res.data.data;
  },

  /**
   * The only route by which an ownership document is reachable.
   *
   * Fetched with the session's token rather than linked directly — the file is
   * private, and an `<img src>` or a plain anchor carries no Authorization
   * header. The blob URL is revoked by the caller when the preview closes.
   */
  async documentUrl(claimId: string, mediaId: string) {
    const res = await http.get(`/claims/${claimId}/documents/${mediaId}`, {
      responseType: "blob",
    });
    return URL.createObjectURL(res.data as Blob);
  },

  async approve(id: string) {
    const res = await http.post<{ data: AdminClaim; message: string }>(`/claims/${id}/approve`);
    return { claim: res.data.data, message: res.data.message };
  },

  async reject(id: string, reason: string) {
    const res = await http.post<{ data: AdminClaim; message: string }>(`/claims/${id}/reject`, {
      reason,
    });
    return { claim: res.data.data, message: res.data.message };
  },

  async transfer(businessId: string, payload: { email: string; name?: string; reason: string }) {
    await http.post(`/businesses/${businessId}/transfer`, payload);
  },
};
