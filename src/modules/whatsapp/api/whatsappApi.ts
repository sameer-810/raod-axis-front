import { http } from "@/shared/api/http";
import type { NumbersResult, WhatsAppNumber } from "../types";

/**
 * The whole collection comes back from every write.
 *
 * The invariants are collective — exactly one Primary, at most two numbers,
 * routing that falls through — so patching a single row into local state would
 * leave the client to recompute them and get it wrong. The list is two items
 * long; there is nothing to save by being clever.
 */
function unwrap(res: {
  data: { data: WhatsAppNumber[]; meta?: { warning?: string } };
}): NumbersResult {
  return { numbers: res.data.data, warning: res.data.meta?.warning ?? null };
}

export const whatsappApi = {
  async list(businessId: string) {
    const res = await http.get<{ data: WhatsAppNumber[] }>(
      `/businesses/${businessId}/whatsapp-numbers`,
    );
    return res.data.data;
  },

  async add(businessId: string, payload: { label: string; phone: string; isPrimary?: boolean }) {
    return unwrap(
      await http.post<{ data: WhatsAppNumber[]; meta?: { warning?: string } }>(
        `/businesses/${businessId}/whatsapp-numbers`,
        payload,
      ),
    );
  },

  async update(
    businessId: string,
    numberId: string,
    payload: { label?: string; isActive?: boolean; isPrimary?: boolean; reason?: string },
  ) {
    return unwrap(
      await http.patch<{ data: WhatsAppNumber[]; meta?: { warning?: string } }>(
        `/businesses/${businessId}/whatsapp-numbers/${numberId}`,
        payload,
      ),
    );
  },

  async remove(businessId: string, numberId: string) {
    return unwrap(
      await http.delete<{ data: WhatsAppNumber[]; meta?: { warning?: string } }>(
        `/businesses/${businessId}/whatsapp-numbers/${numberId}`,
      ),
    );
  },
};
