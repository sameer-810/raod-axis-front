import { http } from "@/shared/api/http";
import type { AdminReview, MyReview, Review, ReviewAggregate, ReviewPayload } from "../types";

interface ListMeta {
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  page: number;
}

export const reviewApi = {
  /** Public. A driver deciding at the roadside reads these without an account. */
  async listForBusiness(businessId: string, page = 1) {
    const res = await http.get<{ data: Review[]; meta: ListMeta }>(
      `/businesses/${businessId}/reviews`,
      { params: { page: String(page), limit: "10" } },
    );
    return { items: res.data.data, meta: res.data.meta };
  },

  /** Null when they have not reviewed this business, so the form opens blank. */
  async mine(businessId: string) {
    const res = await http.get<{ data: MyReview | null }>(`/businesses/${businessId}/reviews/mine`);
    return res.data.data;
  },

  /**
   * Leave or edit. The same call for both — a second submission edits the first,
   * because people change their minds about a garage.
   */
  async upsert(businessId: string, payload: ReviewPayload) {
    const res = await http.post<{ data: Review; meta: ReviewAggregate; message: string }>(
      `/businesses/${businessId}/reviews`,
      payload,
    );
    return { review: res.data.data, aggregate: res.data.meta, message: res.data.message };
  },

  async listAll(query: { businessId?: string; includeRemoved?: boolean; page?: number }) {
    const params: Record<string, string> = { limit: "20" };
    if (query.businessId) params.businessId = query.businessId;
    if (query.includeRemoved) params.includeRemoved = "true";
    if (query.page && query.page > 1) params.page = String(query.page);

    const res = await http.get<{ data: AdminReview[]; meta: ListMeta }>("/reviews", { params });
    return { items: res.data.data, meta: res.data.meta };
  },

  async remove(id: string, reason: string) {
    const res = await http.post<{ data: AdminReview }>(`/reviews/${id}/remove`, { reason });
    return res.data.data;
  },
};
