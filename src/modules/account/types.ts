/** Served by the API from the same configuration the retention sweep reads. */
export interface PrivacyPolicy {
  /** The data controller, as it should be named on the page. */
  controller: string;
  /** Present only when the deployment has been told them. */
  address: string | null;
  icoRegistration: string | null;
  contactEmail: string;
  /**
   * The law that protects the reader, for each country served. Which one
   * applies depends on where they are, so the page is told all of them.
   */
  jurisdictions?: Array<{
    country: string;
    name: string;
    law: string;
    lawShort: string;
    regulator: string;
    regulatorUrl: string | null;
  }>;
  signIn: "email" | "email+whatsapp";
  retention: {
    signInCodeMinutes: number;
    profileViewDays: number;
    claimDocumentDays: number;
    bookingRequestMonths: number;
    deliveryLogMonths: number;
    auditLogMonths: number;
  };
}

export interface ErasureResult {
  erased: boolean;
  bookingRequestsAnonymised: number;
  reviewsDeleted: number;
  documentsDeleted: number;
  listingsReleased: Array<{ id: string; name: string }>;
}
