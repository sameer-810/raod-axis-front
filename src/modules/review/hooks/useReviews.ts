import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewApi } from "../api/reviewApi";
import type { ReviewPayload } from "../types";

const KEY = ["reviews"] as const;

export function useBusinessReviews(businessId: string | undefined, page = 1) {
  return useQuery({
    queryKey: [...KEY, businessId, page],
    queryFn: () => reviewApi.listForBusiness(businessId!, page),
    enabled: Boolean(businessId),
    placeholderData: (prev) => prev,
  });
}

/** The signed-in driver's own review, so the form opens pre-filled. */
export function useMyReview(businessId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, businessId, "mine"],
    queryFn: () => reviewApi.mine(businessId!),
    enabled: Boolean(businessId) && enabled,
  });
}

export function useSubmitReview(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReviewPayload) => reviewApi.upsert(businessId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...KEY, businessId] });
      // The star rating in the profile header and on every card is now stale.
      void qc.invalidateQueries({ queryKey: ["business"] });
      void qc.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}

export function useAllReviews(query: {
  businessId?: string;
  includeRemoved?: boolean;
  page?: number;
}) {
  return useQuery({
    queryKey: [...KEY, "admin", query],
    queryFn: () => reviewApi.listAll(query),
    placeholderData: (prev) => prev,
  });
}

export function useRemoveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reviewApi.remove(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["business"] });
    },
  });
}
