import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/analyticsApi";

export function useAnalytics(days: number) {
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: () => analyticsApi.overview(days),
    // Keeps the previous window on screen while a new one loads, so changing
    // "30 days" to "7 days" does not blank a dashboard someone is reading.
    placeholderData: (prev) => prev,
  });
}

export function useMyAnalytics(days: number) {
  return useQuery({
    queryKey: ["analytics", "mine", days],
    queryFn: () => analyticsApi.mine(days),
    placeholderData: (prev) => prev,
    // An owner who manages nothing yet gets a 403 by design; retrying it is
    // three more requests that will fail the same way.
    retry: false,
  });
}
