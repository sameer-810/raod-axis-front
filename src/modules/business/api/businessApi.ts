import { http } from "@/shared/api/http";
import type { Business, BusinessCard, Category, SearchFilters, SearchMeta } from "../types";

/**
 * Filters → query string. Empty values are omitted rather than sent blank, so a
 * URL only names the filters actually in force: `?search=&city=&radius=5000` is
 * the same search as `?radius=5000` and should not look different when shared.
 */
function toParams(f: Partial<SearchFilters>) {
  const params: Record<string, string> = {};
  if (f.search?.trim()) params.search = f.search.trim();
  if (f.categories?.length) params.category = f.categories.join(",");
  if (f.city?.trim()) params.city = f.city.trim();
  if (typeof f.lat === "number" && typeof f.lng === "number") {
    params.lat = String(f.lat);
    params.lng = String(f.lng);
    if (f.radius) params.radius = String(f.radius);
  }
  if (f.openNow) params.openNow = "true";
  if (f.verifiedOnly) params.verifiedOnly = "true";
  if (f.minRating) params.minRating = String(f.minRating);
  if (f.sort) params.sort = f.sort;
  if (f.page && f.page > 1) params.page = String(f.page);
  return params;
}

export const businessApi = {
  async search(filters: Partial<SearchFilters>, limit = 20) {
    const res = await http.get<{ data: BusinessCard[]; meta: SearchMeta }>("/businesses", {
      params: { ...toParams(filters), limit },
    });
    return { items: res.data.data, meta: res.data.meta };
  },

  /** By slug, not id — this is the page that has to be findable. */
  async getBySlug(slug: string) {
    const res = await http.get<{ data: Business }>(`/businesses/${slug}`);
    return res.data.data;
  },

  async facets() {
    const res = await http.get<{
      data: Array<{ id: string; name: string; slug: string; icon: string | null; count: number }>;
    }>("/businesses/facets");
    return res.data.data;
  },
};

export const categoryApi = {
  async list() {
    const res = await http.get<{ data: Category[] }>("/categories");
    return res.data.data;
  },
};

export { toParams };
