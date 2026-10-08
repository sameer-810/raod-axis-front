import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Dialog } from "@/shared/components/Dialog";

/**
 * Shown in exactly one situation: an owner was granted a listing and the email
 * carrying their set-password link did not go.
 *
 * Without this the approval looks finished — the listing is verified, the queue
 * is one shorter — and the garage is locked out of its own page with nobody
 * aware of it. The administrator who just granted the access is the one person
 * who can safely carry the link by hand, so it is put in front of them, with a
 * sentence saying what to do with it.
 *
 * The link is a credential. It is shown here once and is not stored in the
 * interface; closing the dialog is the end of it.
 */
export function InviteLinkDialog({
  link,
  recipient,
  onClose,
}: {
  /** Null keeps the dialog closed. */
  link: string | null;
  /** Who it is for, so the instruction can name them. */
  recipient?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // No clipboard permission: the field is selectable, so they can still
      // copy it by hand. Nothing to report.
    }
  }

  return (
    <Dialog
      open={Boolean(link)}
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      tone="warning"
      title="The email could not be sent"
      description={
        <>
          The decision is saved, but {recipient ?? "the new owner"} has not been told. Send them
          this link yourself — it lets them set a password, works once and expires in 7 days.
        </>
      }
      footer={
        <Button
          variant="primary"
          onClick={() => {
            setCopied(false);
            onClose();
          }}
        >
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link ?? ""}
          aria-label="Set-password link"
          onFocus={(e) => e.currentTarget.select()}
          className="ra-input ra-control min-w-0 flex-1 px-3 font-mono text-xs"
        />
        <Button icon={copied ? Check : Copy} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </Dialog>
  );
}
