import { http } from "@/shared/api/http";
import type { Business, BusinessCard, Category, SearchMeta } from "@/modules/business/types";

export interface AdminBusinessQuery {
  search?: string;
  status?: "draft" | "live" | "suspended";
  claimStatus?: "unclaimed" | "pending" | "claimed";
  city?: string;
  page?: number;
}

/** What the create/edit form submits. Coordinates are flat here and GeoJSON in the database. */
export interface BusinessPayload {
  name: string;
  description?: string;
  categoryIds?: string[];
  customServices?: string[];
  services?: Array<{ name: string; description?: string; priceFrom?: number }>;
  address: { line1: string; line2?: string; city: string; postcode: string; country?: string };
  latitude: number;
  longitude: number;
  googlePlaceId?: string;
  phone?: string;
  email?: string;
  website?: string;
  workingHours?: Array<{ day: number; closed: boolean; open?: string; close?: string }>;
  logoId?: string | null;
  photoIds?: string[];
}

export const adminBusinessApi = {
  async list(query: AdminBusinessQuery) {
    const params: Record<string, string> = { limit: "20" };
    if (query.search?.trim()) params.search = query.search.trim();
    if (query.status) params.status = query.status;
    if (query.claimStatus) params.claimStatus = query.claimStatus;
    if (query.city?.trim()) params.city = query.city.trim();
    if (query.page && query.page > 1) params.page = String(query.page);

    const res = await http.get<{ data: BusinessCard[]; meta: SearchMeta }>("/businesses/admin", {
      params,
    });
    return { items: res.data.data, meta: res.data.meta };
  },

  async get(id: string) {
    const res = await http.get<{ data: Business }>(`/businesses/admin/${id}`);
    return res.data.data;
  },

  async create(payload: BusinessPayload) {
    const res = await http.post<{ data: Business }>("/businesses", payload);
    return res.data.data;
  },

  async update(id: string, payload: Partial<BusinessPayload>) {
    const res = await http.patch<{ data: Business }>(`/businesses/${id}`, payload);
    return res.data.data;
  },

  async setStatus(id: string, status: "draft" | "live" | "suspended", reason?: string) {
    const res = await http.patch<{ data: Business }>(`/businesses/${id}/status`, {
      status,
      reason,
    });
    return res.data.data;
  },

  /**
   * Advisory, never blocking. A genuine second branch two streets away is a
   * real thing, so this informs an administrator rather than refusing anybody.
   */
  async duplicates(name: string, latitude: number, longitude: number) {
    const res = await http.get<{
      data: Array<{ id: string; name: string; slug: string; city: string | null }>;
    }>("/businesses/admin/duplicates", { params: { name, lat: latitude, lng: longitude } });
    return res.data.data;
  },
};

export const adminCategoryApi = {
  async listAll() {
    const res = await http.get<{ data: Category[] }>("/categories/all");
    return res.data.data;
  },

  async create(payload: Partial<Category>) {
    const res = await http.post<{ data: Category }>("/categories", payload);
    return res.data.data;
  },

  async update(id: string, payload: Partial<Category>) {
    const res = await http.patch<{ data: Category }>(`/categories/${id}`, payload);
    return res.data.data;
  },

  async remove(id: string) {
    await http.delete(`/categories/${id}`);
  },

  /** What businesses keep typing into "mention your service" — the taxonomy's evidence. */
  async suggestions() {
    const res = await http.get<{ data: Array<{ service: string; count: number }> }>(
      "/categories/suggestions",
    );
    return res.data.data;
  },
};
