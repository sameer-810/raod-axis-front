export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface WorkingHoursDay {
  day: number;
  closed: boolean;
  open?: string;
  close?: string;
}

export interface BusinessService {
  name: string;
  description: string | null;
  priceFrom: number | null;
}

/**
 * The trust row's data, and the two nullable fields that carry its rules.
 *
 * `averageRating: null` means no reviews — a new business, not a bad one — and
 * must render as nothing at all rather than as zero stars. `isOpen: null` means
 * the hours are unknown, which is not the same as closed. See DESIGN.md.
 */
interface Trust {
  isVerified: boolean;
  averageRating: number | null;
  reviewCount: number;
  isOpen: boolean | null;
}

/** What a search result card needs. Deliberately smaller than the profile. */
export interface BusinessCard extends Trust {
  id: string;
  slug: string;
  name: string;
  categories: Category[];
  address: { city: string | null; postcode: string | null };
  primaryPhotoUrl: string | null;
  /** Null whenever the search had no location to measure from. Never 0. */
  distanceMetres: number | null;
  coordinates: Coordinates | null;
  claimStatus: "unclaimed" | "pending" | "claimed";
  /** When it went public. The start of the 30-day claim clock in PRD §6. */
  listedAt?: string | null;
}

export interface Business extends Trust {
  id: string;
  slug: string;
  name: string;
  description: string;
  categories: Category[];
  customServices: string[];
  services: BusinessService[];
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    postcode: string | null;
    country: string;
  };
  coordinates: Coordinates | null;
  /** Built server-side, so the lat/lng ordering is decided in exactly one place. */
  directionsUrl: string | null;
  phone: string | null;
  phoneFormatted: string | null;
  email: string | null;
  website: string | null;
  /**
   * Active numbers only, each with a ready-made `wa.me` link.
   *
   * No `isPrimary`: which number a business routes automatic requests to is its
   * internal arrangement, and surfacing it would nudge every driver onto the
   * same one — the opposite of why there are two.
   */
  whatsappNumbers: Array<{ id: string; label: string; phoneFormatted: string; waLink: string }>;
  workingHours: WorkingHoursDay[];
  timezone: string;
  logo: { id: string; url: string; thumbnailUrl: string | null } | null;
  photos: Array<{ id: string; url: string; thumbnailUrl: string | null }>;
  claimStatus: "unclaimed" | "pending" | "claimed";
  status: "draft" | "live" | "suspended";
  listedAt: string | null;
  claimedAt: string | null;
}

export type SortOption = "distance" | "rating" | "newest";

/**
 * Every filter, and every one of them is in the URL.
 *
 * FR-DIS-09: a search has to be shareable, bookmarkable and reachable with the
 * Back button. That means this object round-trips through the query string
 * rather than living in component state.
 */
export interface SearchFilters {
  search: string;
  categories: string[];
  city: string;
  lat?: number;
  lng?: number;
  radius: number;
  openNow: boolean;
  verifiedOnly: boolean;
  minRating?: number;
  sort?: SortOption;
  page: number;
}

export interface SearchMeta {
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
  limit: number;
  radiusMetres: number;
  hasLocation: boolean;
}
