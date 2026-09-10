import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi, whatsappLogApi } from "../api/bookingApi";
import type { BookingStatus, CreateBookingPayload } from "../types";

const KEY = ["booking-requests"] as const;

export function useBookingRequests(query: {
  status?: BookingStatus | "";
  businessId?: string;
  search?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => bookingApi.list(query),
    placeholderData: (prev) => prev,
    /**
     * Booking requests arrive while the page is open — that is what an inbox is.
     * A minute is often enough that an owner who leaves the tab up sees a new one
     * without reaching for refresh, and rare enough not to be a request per
     * second from every open portal.
     */
    refetchInterval: 60_000,
  });
}

export function useMyBookingRequests(query: { status?: BookingStatus | ""; page?: number } = {}) {
  return useQuery({
    queryKey: [...KEY, "mine", query],
    queryFn: () => bookingApi.listMine(query),
    placeholderData: (prev) => prev,
  });
}

export function useBookingRequest(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => bookingApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useDeliveryLog(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...KEY, id, "delivery"],
    queryFn: () => bookingApi.delivery(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateBooking(businessId: string) {
  return useMutation({
    mutationFn: (payload: CreateBookingPayload) => bookingApi.create(businessId, payload),
  });
}

export function useSetBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: BookingStatus; reason?: string }) =>
      bookingApi.setStatus(id, status, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      // The portal dashboard counts open requests.
      void qc.invalidateQueries({ queryKey: ["my-businesses"] });
    },
  });
}

export function useWhatsAppLogs(query: { state?: string; channel?: string; page?: number }) {
  return useQuery({
    queryKey: ["whatsapp-logs", query],
    queryFn: () => whatsappLogApi.list(query),
    placeholderData: (prev) => prev,
  });
}

export function useDeliveryStats() {
  return useQuery({ queryKey: ["whatsapp-logs", "stats"], queryFn: whatsappLogApi.stats });
}

export function useRetryDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: whatsappLogApi.retry,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["whatsapp-logs"] });
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
