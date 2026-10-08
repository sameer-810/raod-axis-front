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
    /** All time. The window's own count is `performance.total`. */
    bookingRequests: number;
    /** Since local midnight. */
    bookingRequestsToday: number;
  };
  requestsByStatus: Record<string, number>;
  performance: Performance;
  /**
   * The onboarding and retention measures from PRD §6. Each rate is null when
   * there is nothing to divide by, and the counts beside it say how much it is
   * resting on.
   */
  measures: {
    timeToClaim: { medianMinutes: number | null; sample: number };
    claimApproval: { approved: number; rejected: number; rate: number | null };
    claimedWithin30Days: { listed: number; claimed: number; rate: number | null };
    bothNumbers: { claimed: number; both: number; rate: number | null };
    repeatDrivers: { drivers: number; repeat: number; rate: number | null };
  };
  /**
   * What the window's WhatsApp messages cost. `unitCost` is null until the
   * per-message rate has been set from an invoice — it is never guessed.
   */
  cost: {
    currency: string;
    billableMessages: number;
    unitCost: number | null;
    total: number | null;
    perRequest: number | null;
  };
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

/** What a listing has on its plate right now. Not windowed. */
export interface RequestLoad {
  /** Arrived since local midnight. */
  today: number;
  /** Not finished yet: new, contacted or accepted. */
  open: number;
  /** The subset nobody has replied to. */
  waiting: number;
}

export interface OwnerAnalytics {
  windowDays: number;
  since: string;
  performance: Performance;
  requests: RequestLoad;
  businesses: Array<LeaderRow & { requests: RequestLoad }>;
  totals: { listings: number; views: number; reviews: number };
  series: { requests: SeriesPoint[] };
}
