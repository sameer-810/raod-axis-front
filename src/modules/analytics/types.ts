/** One point on a daily chart. Quiet days are present with a count of 0. */
export interface SeriesPoint {
  date: string;
  count: number;
}

export interface LeaderRow {
  id: string;
  name: string;
  slug: string;
  views: number;
  /** Null when nobody has rated it. Never 0 — see DESIGN.md. */
  averageRating: number | null;
  reviewCount: number;
  claimStatus: "unclaimed" | "pending" | "claimed";
}

export interface Performance {
  total: number;
  accepted: number;
  declined: number;
  responded: number;
  /** Null when nothing has been decided. A rate from no data is not a rate. */
  acceptanceRate: number | null;
  medianResponseMinutes: number | null;
}

export interface AnalyticsOverview {
  windowDays: number;
  since: string;
  totals: {
    businesses: number;
    liveBusinesses: number;
    draftBusinesses: number;
    suspendedBusinesses: number;
    claimedBusinesses: number;
    unclaimedBusinesses: number;
    claimRate: number | null;
    drivers: number;
    owners: number;
    admins: number;
    pendingClaims: number;
    reviews: number;
    removedReviews: number;
    favourites: number;
    bookingRequests: number;
  };
  requestsByStatus: Record<string, number>;
  performance: Performance;
  delivery: {
    byState: Record<string, number>;
    tracked: number;
    untracked: number;
    deliveryRate: number | null;
    mode: "cloud_api" | "deep_link";
  };
  leaderboards: {
    mostViewed: LeaderRow[];
    topRated: LeaderRow[];
    mostRequested: Array<{ id: string; name: string; slug: string; count: number }>;
  };
  categories: Array<{ id: string; name: string; slug: string; icon: string | null; count: number }>;
  series: { signups: SeriesPoint[]; requests: SeriesPoint[]; listings: SeriesPoint[] };
}

export interface OwnerAnalytics {
  windowDays: number;
  since: string;
  performance: Performance;
  businesses: LeaderRow[];
  totals: { listings: number; views: number; reviews: number };
  series: { requests: SeriesPoint[] };
}
