export interface Review {
  id: string;
  driverName: string;
  rating: number;
  text: string | null;
  /**
   * Whether this person ever actually contacted the business through RoadAxis.
   *
   * Deliberately not called "verified". It says what it knows — that a booking
   * request exists — and nothing more. A driver who phoned the number on the
   * listing had a real visit too, and calling one "verified" implies the other
   * is not.
   */
  fromContact: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A driver's own review, which is all the form needs to open pre-filled.
 *
 * Smaller than the public shape on purpose: their own name and their own
 * contact history are things they already know, and sending them back would be
 * padding a request made on every profile page.
 */
export interface MyReview {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
}

/** The moderator's view. Adds what a driver has no business seeing. */
export interface AdminReview extends Review {
  business: { id: string; name: string | null; slug: string | null } | null;
  driverId: string;
  isRemoved: boolean;
  removedReason: string | null;
  removedAt: string | null;
}

export interface ReviewAggregate {
  averageRating: number;
  reviewCount: number;
}

export interface ReviewPayload {
  rating: number;
  text?: string;
}
