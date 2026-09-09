export type BookingStatus =
  "new" | "contacted" | "accepted" | "completed" | "declined" | "cancelled";

/**
 * How delivery reads to a human.
 *
 * `tracked: false` is the `deep_link` case — nothing was sent by us, so we
 * genuinely do not know whether it arrived. It must never be rendered as a
 * success or a failure (FR-WAP-04).
 */
export interface Delivery {
  state: "queued" | "sent" | "delivered" | "read" | "failed" | "deep_link" | null;
  label: string;
  tracked: boolean;
  ok: boolean;
}

export interface StatusEvent {
  status: BookingStatus;
  at: string;
  byRole: "driver" | "business_owner" | "admin" | "system" | null;
  reason: string | null;
}

/** What the business and an administrator see. */
export interface BookingRequest {
  id: string;
  reference: string;
  business: { id: string; name: string | null; slug: string | null } | null;
  driverName: string;
  /** In full, deliberately — a masked number the garage cannot ring is useless. */
  driverPhone: string;
  driverPhoneFormatted: string;
  serviceName: string;
  preferredDate: string;
  preferredTime: string;
  notes: string | null;
  status: BookingStatus;
  declineReason: string | null;
  delivery: Delivery;
  history: StatusEvent[];
  firstResponseAt: string | null;
  /** `firstResponseAt − createdAt`. The response-time KPI. */
  responseMinutes: number | null;
  createdAt: string;
}

/**
 * What the driver sees about their own request.
 *
 * No delivery state: telling a driver "delivered" invites them to conclude they
 * are being ignored, and "failed" invites them to conclude the business is
 * broken. Neither is a judgement we should hand them.
 */
export interface DriverBookingRequest {
  id: string;
  reference: string;
  business: { id: string; name: string | null; slug: string | null } | null;
  serviceName: string;
  preferredDate: string;
  preferredTime: string;
  notes: string | null;
  status: BookingStatus;
  declineReason: string | null;
  createdAt: string;
  /**
   * Only in deep-link mode. The driver's own device opens WhatsApp with the
   * message — if this is present and the client ignores it, the business never
   * hears about the request at all.
   */
  deepLink?: string | null;
  delivered?: boolean;
}

/** One delivery attempt, for the admin log. */
export interface WhatsAppLogEntry {
  id: string;
  reference: string | null;
  bookingRequestId: string | null;
  business: { id: string; name: string | null } | null;
  /** Masked — a delivery log is read by more people than the record itself. */
  to: string;
  toLabel: string | null;
  channel: "cloud_api" | "deep_link";
  delivery: Delivery;
  attempt: number;
  usedFallback: boolean;
  error: string | null;
  isRetry: boolean;
  history: Array<{ state: string; at: string; detail: string | null }>;
  createdAt: string;
}

export interface CreateBookingPayload {
  serviceName: string;
  preferredDate: string;
  preferredTime: string;
  notes?: string;
}
