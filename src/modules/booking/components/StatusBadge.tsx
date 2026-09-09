import { Badge } from "@/shared/components/Badge";
import type { BookingStatus, Delivery } from "../types";

/**
 * Status, in the words a business would use.
 *
 * "New" rather than "Pending", "Contacted" rather than "In progress" — a garage
 * owner reads this between jobs, and the vocabulary of a ticketing system is
 * one more thing to translate.
 *
 * Only `new` is coloured. It is the one that needs acting on; if every state
 * carried a colour the queue would have no signal in it.
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
 * Delivery, and the rule that governs it.
 *
 * `tracked: false` — the `deep_link` case — is neither success nor failure. We
 * did not send the message; the driver's own device did. Rendering it as a
 * green tick would be inventing a fact, and as a red cross would be blaming
 * somebody for something that probably worked.
 */
export function DeliveryBadge({ delivery }: { delivery: Delivery }) {
  if (!delivery.state) return <Badge>Not sent</Badge>;
  if (!delivery.tracked) return <Badge>{delivery.label}</Badge>;
  if (delivery.state === "failed") return <Badge tone="destructive">{delivery.label}</Badge>;
  if (delivery.ok) return <Badge tone="success">{delivery.label}</Badge>;
  return <Badge tone="warning">{delivery.label}</Badge>;
}

export { STATUS };
