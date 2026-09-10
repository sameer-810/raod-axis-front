import { Badge } from "@/shared/components/Badge";
import type { BookingStatus, Delivery } from "../types";

/**
 * Status, in the words a business would use. "New" rather than "Pending",
 * "Contacted" rather than "In progress" — a garage owner reads this between
 * jobs, and ticketing-system vocabulary is one more thing to translate.
 *
 * Only `new` is coloured: it is the one that needs acting on.
 */
const STATUS = {
  new: { label: "New", tone: "primary" as const },
  contacted: { label: "Contacted", tone: "neutral" as const },
  accepted: { label: "Accepted", tone: "success" as const },
  completed: { label: "Completed", tone: "neutral" as const },
  declined: { label: "Declined", tone: "neutral" as const },
  cancelled: { label: "Cancelled", tone: "neutral" as const },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/**
 * Delivery. `tracked: false` — the `deep_link` case — is neither success nor
 * failure: we did not send the message, the driver's own device did. A green
 * tick would invent a fact; a red cross would blame somebody for something that
 * probably worked.
 */
export function DeliveryBadge({ delivery }: { delivery: Delivery }) {
  if (!delivery.state) return <Badge>Not sent</Badge>;
  if (!delivery.tracked) return <Badge>{delivery.label}</Badge>;
  if (delivery.state === "failed") return <Badge tone="destructive">{delivery.label}</Badge>;
  if (delivery.ok) return <Badge tone="success">{delivery.label}</Badge>;
  return <Badge tone="warning">{delivery.label}</Badge>;
}

export { STATUS };
