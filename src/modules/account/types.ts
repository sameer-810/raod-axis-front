/** Served by the API from the same configuration the retention sweep reads. */
export interface PrivacyPolicy {
  /** The data controller, as it should be named on the page. */
  controller: string;
  /** Present only when the deployment has been told them. */
  address: string | null;
  icoRegistration: string | null;
  contactEmail: string;
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
