import { http } from "@/shared/api/http";
import type { AnalyticsOverview, OwnerAnalytics } from "../types";

export const analyticsApi = {
  async overview(days: number) {
    const res = await http.get<{ data: AnalyticsOverview }>("/analytics", {
      params: { days: String(days) },
    });
    return res.data.data;
  },

  /** Scoped server-side to what this owner manages, never by a parameter. */
  async mine(days: number) {
    const res = await http.get<{ data: OwnerAnalytics }>("/analytics/mine", {
      params: { days: String(days) },
    });
    return res.data.data;
  },
};
