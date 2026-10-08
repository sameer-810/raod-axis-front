import { useMutation, useQuery } from "@tanstack/react-query";
import { accountApi } from "../api/accountApi";
import type { PrivacyPolicy } from "../types";

/**
 * The periods the product ships with, shown while the real ones load and if
 * they cannot be fetched. They are the server's own defaults, so on a deployment
 * that has not overridden anything the page is right even offline.
 */
export const DEFAULT_POLICY: PrivacyPolicy = {
  controller: "RoadAxis",
  address: null,
  icoRegistration: null,
  contactEmail: "privacy@roadaxis.online",
  signIn: "email",
  retention: {
    signInCodeMinutes: 10,
    profileViewDays: 90,
    claimDocumentDays: 90,
    bookingRequestMonths: 24,
    deliveryLogMonths: 24,
    auditLogMonths: 72,
  },
};

export function usePrivacyPolicy() {
  return useQuery({
    queryKey: ["privacy", "policy"],
    queryFn: accountApi.policy,
    // It changes when a deployment is reconfigured, which is not often.
    staleTime: 5 * 60 * 1000,
  });
}

export function useExportMyData() {
  return useMutation({ mutationFn: accountApi.exportMine });
}

export function useDeleteMyAccount() {
  return useMutation({ mutationFn: accountApi.eraseMine });
}
