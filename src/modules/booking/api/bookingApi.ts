import { http } from "@/shared/api/http";
import type {
  BookingRequest,
  BookingStatus,
  CreateBookingPayload,
  DriverBookingRequest,
  WhatsAppLogEntry,
} from "../types";

interface ListMeta {
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
}

export const bookingApi = {
  /** Submit a request. Nested under the business, so the target cannot be forged. */
  async create(businessId: string, payload: CreateBookingPayload) {
    const res = await http.post<{ data: DriverBookingRequest; message: string }>(
      `/businesses/${businessId}/booking-requests`,
      payload,
    );
    return { request: res.data.data, message: res.data.message };
  },

  /**
   * The list, scoped server-side by who is asking — a driver gets their own, an
   * owner gets their businesses', an admin gets everything. Decided from the
   * session rather than from a parameter.
   */
  async list(query: {
    status?: BookingStatus | "";
    businessId?: string;
    search?: string;
    page?: number;
  }) {
    const params: Record<string, string> = { limit: "20" };
    if (query.status) params.status = query.status;
    if (query.businessId) params.businessId = query.businessId;
    if (query.search?.trim()) params.search = query.search.trim();
    if (query.page && query.page > 1) params.page = String(query.page);

    const res = await http.get<{ data: BookingRequest[]; meta: ListMeta }>("/booking-requests", {
      params,
    });
    return { items: res.data.data, meta: res.data.meta };
  },

  async listMine(query: { status?: BookingStatus | ""; page?: number } = {}) {
    const params: Record<string, string> = { limit: "20" };
    if (query.status) params.status = query.status;
    if (query.page && query.page > 1) params.page = String(query.page);

    const res = await http.get<{ data: DriverBookingRequest[]; meta: ListMeta }>(
      "/booking-requests",
      { params },
    );
    return { items: res.data.data, meta: res.data.meta };
  },

  async get(id: string) {
    const res = await http.get<{ data: BookingRequest }>(`/booking-requests/${id}`);
    return res.data.data;
  },

  async setStatus(id: string, status: BookingStatus, reason?: string) {
    const res = await http.patch<{ data: BookingRequest }>(`/booking-requests/${id}/status`, {
      status,
      reason,
    });
    return res.data.data;
  },

  /** The delivery attempts for one request. Not available to drivers. */
  async delivery(id: string) {
    const res = await http.get<{ data: WhatsAppLogEntry[] }>(`/booking-requests/${id}/delivery`);
    return res.data.data;
  },
};

export const whatsappLogApi = {
  async list(query: { state?: string; channel?: string; page?: number }) {
    const params: Record<string, string> = { limit: "30" };
    if (query.state) params.state = query.state;
    if (query.channel) params.channel = query.channel;
    if (query.page && query.page > 1) params.page = String(query.page);

    const res = await http.get<{ data: WhatsAppLogEntry[]; meta: ListMeta }>(
      "/booking-requests/logs",
      { params },
    );
    return { items: res.data.data, meta: res.data.meta };
  },

  async stats() {
    const res = await http.get<{
      data: {
        byState: Record<string, number>;
        tracked: number;
        untracked: number;
        /** Null when nothing is trackable — a rate from no data is not a rate. */
        deliveryRate: number | null;
      };
    }>("/booking-requests/logs/stats");
    return res.data.data;
  },

  async retry(id: string) {
    const res = await http.post<{ data: WhatsAppLogEntry }>(`/booking-requests/logs/${id}/retry`);
    return res.data.data;
  },
};
