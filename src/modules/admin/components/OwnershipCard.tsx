import { useId, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Dialog } from "@/shared/components/Dialog";
import { DescriptionList, SectionCard } from "@/shared/components/SectionCard";
import { formatDate } from "@/shared/lib/format";
import { useTransferOwnership } from "../hooks/useAdmin";
import { InviteLinkDialog } from "./InviteLinkDialog";

/** The server asks for this many characters; the button waits for them too. */
const MIN_REASON = 10;

export interface OwnershipFacts {
  id: string;
  name: string;
  claimStatus: "unclaimed" | "pending" | "claimed";
  claimedAt: string | null;
  ownerAccount?: { id: string; name: string; email: string; isActive: boolean } | null;
}

/**
 * Who controls a listing, and the one way to change that by hand — FR-ONB-10.
 *
 * Garages change hands, and the alternative to a transfer is deleting the
 * listing and losing its reviews and history. The reason is required and goes
 * in the audit log: "why does somebody else control this garage's page" is the
 * most serious question this console can be asked.
 */
export function OwnershipCard({ business }: { business: OwnershipFacts }) {
  const transfer = useTransferOwnership();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const emailId = useId();
  const nameId = useId();
  const reasonId = useId();

  const owner = business.ownerAccount ?? null;
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const ready = emailOk && reason.trim().length >= MIN_REASON;

  function close() {
    setOpen(false);
    setEmail("");
    setName("");
    setReason("");
  }

  async function submit() {
    try {
      const result = await transfer.mutateAsync({
        businessId: business.id,
        email: email.trim(),
        name: name.trim() || undefined,
        reason: reason.trim(),
      });
      const recipient = email.trim();
      close();
      if (result.notification?.inviteUrl) {
        // The transfer happened but its email did not: hand over the link.
        setSentTo(recipient);
        setInviteLink(result.notification.inviteUrl);
      } else {
        toast.success(`${business.name} now belongs to ${recipient}`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <SectionCard
      id="ownership"
      title="Ownership"
      description="Who can edit this listing and receive its booking requests."
      aside={
        <Button size="sm" icon={ArrowRightLeft} onClick={() => setOpen(true)}>
          Transfer ownership
        </Button>
      }
    >
      {owner ? (
        <DescriptionList
          items={[
            {
              label: "Owner",
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  {owner.name}
                  {!owner.isActive && <Badge tone="destructive">Account switched off</Badge>}
                </span>
              ),
            },
            { label: "Email", value: owner.email },
            { label: "Claimed", value: formatDate(business.claimedAt) || "—", mono: true },
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {business.claimStatus === "pending"
            ? "A claim for this listing is waiting in the queue. Nobody controls it yet."
            : "Nobody has claimed this listing. It was seeded by RoadAxis and is managed from this console."}
        </p>
      )}

      <Dialog
        open={open}
        onClose={close}
        tone="warning"
        title={`Transfer ${business.name}?`}
        description={
          owner
            ? `${owner.name} loses access straight away. The reviews, photos and history stay with the listing.`
            : "The new owner can edit the listing and will receive its booking requests."
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={transfer.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={!ready}
              loading={transfer.isPending}
            >
              Transfer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor={emailId} className="block text-sm font-medium text-foreground">
              New owner&rsquo;s email
            </label>
            <input
              id={emailId}
              data-autofocus
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@garage.co.uk"
              className="ra-input ra-control w-full px-3"
            />
            <p className="text-xs text-muted-foreground">
              If they have no account yet, one is created and they are emailed a link to set a
              password.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="block text-sm font-medium text-foreground">
              Their name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id={nameId}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ra-input ra-control w-full px-3"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={reasonId} className="block text-sm font-medium text-foreground">
              Reason
            </label>
            <textarea
              id={reasonId}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Business sold — new owner confirmed by phone and sent the sale agreement"
              className="ra-input w-full px-3 py-2"
            />
            <p className="text-xs text-muted-foreground">
              Recorded in the audit log. At least {MIN_REASON} characters.
            </p>
          </div>
        </div>
      </Dialog>

      <InviteLinkDialog link={inviteLink} recipient={sentTo} onClose={() => setInviteLink(null)} />
    </SectionCard>
  );
}
