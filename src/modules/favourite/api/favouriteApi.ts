import { http } from "@/shared/api/http";
import type { BusinessCard } from "@/modules/business/types";

/** A saved garage is a business card plus when it was saved. */
export interface SavedBusiness extends BusinessCard {
  savedAt: string;
}

export const favouriteApi = {
  async list() {
    const res = await http.get<{ data: SavedBusiness[]; meta: { total: number } }>("/favourites");
    return res.data.data;
  },

  /** PUT, not POST: saving is idempotent and a double-tap is not an error. */
  async save(businessId: string) {
    await http.put(`/favourites/${businessId}`);
  },

  async unsave(businessId: string) {
    await http.delete(`/favourites/${businessId}`);
  },
};
