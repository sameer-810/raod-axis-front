import { useQuery } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import type { Business } from "@/modules/business/types";
import type { RoutingStatus, WhatsAppNumber } from "@/modules/whatsapp/types";

/**
 * A business as its owner or an administrator sees it.
 *
 * `whatsappNumbers` is **replaced**, not extended, and the `Omit` says so rather
 * than hiding it. The public profile returns active numbers with a ready-made
 * `wa.me` link and no `isPrimary`; this view returns every number with its routing
 * flags and no link. A type that pretended otherwise would let a portal screen
 * render a `waLink` that is never there.
 */
export interface OwnedBusiness extends Omit<Business, "whatsappNumbers"> {
  whatsappNumbers: WhatsAppNumber[];
  /** Where an automatic booking request would go right now. */
  routing: RoutingStatus;
  viewCount: number;
}

/**
 * The businesses this account may manage. Empty until a claim is approved, which
 * is the honest state for a `business_owner` who has applied and is waiting — and
 * the portal says so rather than showing a dashboard that looks broken.
 */
export function useMyBusinesses() {
  return useQuery({
    queryKey: ["my-businesses"],
    queryFn: async () => {
      const res = await http.get<{ data: OwnedBusiness[] }>("/businesses/mine");
      return res.data.data;
    },
  });
}
