export interface WhatsAppNumber {
  id: string;
  label: string;
  phone: string;
  phoneFormatted: string;
  isActive: boolean;
  isPrimary: boolean;
  addedAt: string | null;
  deactivatedAt: string | null;
  /**
   * Who switched it off. `"admin"` is the case that matters: an intervention by
   * RoadAxis must be visible to the owner, or their next support call is "my
   * phone stopped working".
   */
  deactivatedByRole: "owner" | "admin" | null;
  deactivatedReason: string | null;
}

/** Where an automatic booking request would go right now. */
export interface RoutingStatus {
  deliverable: boolean;
  label: string | null;
  phoneMasked: string | null;
  /** True when the Primary is switched off and the other number is carrying it. */
  usedFallback: boolean;
  reason: "no_numbers" | "all_numbers_inactive" | "primary_inactive" | null;
}

/** A number as a driver sees it on a public profile. No `isPrimary`. */
export interface PublicWhatsAppNumber {
  id: string;
  label: string;
  phoneFormatted: string;
  waLink: string;
}

export interface NumbersResult {
  numbers: WhatsAppNumber[];
  /** Present when the change left the business unreachable. Not an error. */
  warning: string | null;
}
