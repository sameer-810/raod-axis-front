import { useState } from "react";
import { MessageCircle, Plus, Trash2, ShieldAlert, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { Field } from "@/shared/components/Field";
import { Button } from "@/shared/components/Button";
import { Switch } from "@/shared/components/Switch";
import { RowMenu } from "@/shared/components/Menu";
import { ConfirmDialog } from "@/shared/components/Dialog";
import { Skeleton } from "@/shared/components/Skeleton";
import { formatDate } from "@/shared/lib/format";
import {
  useAddNumber,
  useRemoveNumber,
  useUpdateNumber,
  useWhatsAppNumbers,
} from "../hooks/useWhatsAppNumbers";
import type { WhatsAppNumber } from "../types";

const MAX_NUMBERS = 2;

/**
 * WhatsApp number management, shared by the owner's portal and the admin
 * console. One component for both: the rules are identical and the only
 * difference is who is doing it — an administrator must give a reason when
 * switching somebody else's number off.
 *
 * Built around one sentence at the top: where the next booking request will go.
 */
export function WhatsAppNumbers({
  businessId,
  asAdmin = false,
}: {
  businessId: string;
  asAdmin?: boolean;
}) {
  const { data: numbers = [], isLoading } = useWhatsAppNumbers(businessId);
  const add = useAddNumber(businessId);
  const update = useUpdateNumber(businessId);
  const remove = useRemoveNumber(businessId);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState<WhatsAppNumber | null>(null);
  const [removing, setRemoving] = useState<WhatsAppNumber | null>(null);

  const active = numbers.filter((n) => n.isActive);
  const primary = numbers.find((n) => n.isPrimary);
  const effective = active.find((n) => n.isPrimary) ?? active[0] ?? null;

  function report(result: { warning: string | null }, message: string) {
    if (result.warning) toast.error(result.warning);
    else toast.success(message);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      report(await add.mutateAsync({ label: label.trim(), phone: phone.trim() }), "Number added");
      setLabel("");
      setPhone("");
      setAdding(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  async function setActive(number: WhatsAppNumber, isActive: boolean) {
    // An administrator switching off somebody else's number must say why.
    if (!isActive && asAdmin) {
      setConfirmOff(number);
      return;
    }
    try {
      report(
        await update.mutateAsync({ id: number.id, isActive }),
        isActive ? "Number switched on" : "Number switched off",
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function confirmDeactivate(reason: string) {
    if (!confirmOff) return;
    try {
      report(
        await update.mutateAsync({ id: confirmOff.id, isActive: false, reason }),
        "Number switched off",
      );
      setConfirmOff(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function makePrimary(number: WhatsAppNumber) {
    try {
      report(
        await update.mutateAsync({ id: number.id, isPrimary: true }),
        `${number.label} is now primary`,
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function destroy(number: WhatsAppNumber) {
    try {
      report(await remove.mutateAsync(number.id), "Number removed");
      setRemoving(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      {/* The answer to the question an owner actually has, in words. */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3",
          effective ? "border-border bg-card" : "border-destructive/30 bg-destructive/10",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            effective ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
          )}
          aria-hidden="true"
        >
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          {effective ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Booking requests go to <span className="font-semibold">{effective.label}</span>
              </p>
              <p className="mt-0.5 font-mono text-[13px] tabular-nums text-muted-foreground">
                {effective.phoneFormatted}
              </p>
              {primary && !primary.isActive && (
                <p className="mt-1 text-[13px] text-warning-text">
                  Your primary number ({primary.label}) is switched off, so this one is covering.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Booking requests can't be delivered
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {numbers.length === 0
                  ? "Add a WhatsApp number so customers can reach you."
                  : "Every number is switched off. Switch one back on to start receiving requests."}
              </p>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="ra-panel space-y-2 p-4" aria-busy="true">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ) : numbers.length === 0 ? null : (
        <ul className="ra-panel divide-y divide-border">
          {numbers.map((number) => (
            <li key={number.id} className={cn("px-4 py-3", !number.isActive && "bg-surface-2")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {number.label}
                    {number.isPrimary && (
                      <Badge tone="primary" icon={Star}>
                        Primary
                      </Badge>
                    )}
                    {!number.isActive && <Badge tone="warning">Off</Badge>}
                  </p>
                  <p className="mt-0.5 font-mono text-[13px] tabular-nums text-muted-foreground">
                    {number.phoneFormatted}
                  </p>
                  {number.addedAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Added {formatDate(number.addedAt)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {number.isActive && !number.isPrimary && (
                    <Button size="sm" variant="secondary" onClick={() => makePrimary(number)}>
                      Make primary
                    </Button>
                  )}
                  <Switch
                    checked={number.isActive}
                    onChange={(v) => void setActive(number, v)}
                    label={`${number.isActive ? "Switch off" : "Switch on"} ${number.label}`}
                  />
                  <RowMenu
                    label={`Actions for ${number.label}`}
                    items={[
                      {
                        label: "Remove number",
                        icon: Trash2,
                        destructive: true,
                        onSelect: () => setRemoving(number),
                      },
                    ]}
                  />
                </div>
              </div>

              {/* An intervention by RoadAxis, shown to the owner in their own portal. */}
              {!number.isActive && number.deactivatedByRole === "admin" && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-foreground">
                  <ShieldAlert
                    className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium">RoadAxis switched this off.</span>{" "}
                    {number.deactivatedReason}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {numbers.length < MAX_NUMBERS &&
        (adding ? (
          <form onSubmit={submitAdd} className="ra-panel space-y-1 p-4">
            <Field
              label="What is this number for?"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Customer Support"
              hint="Customers see this, so it should tell them which number to use."
              data-autofocus
            />
            <Field
              label="WhatsApp number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07700 900123"
              error={formError ?? undefined}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" loading={add.isPending}>
                Add number
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAdding(false);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ra-focus ra-control flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/[0.04] hover:text-foreground md:h-11"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a number
          </button>
        ))}

      {numbers.length >= MAX_NUMBERS && (
        <p className="text-[13px] text-muted-foreground">
          You can have up to <span className="font-mono tabular-nums">{MAX_NUMBERS}</span> numbers.
          Remove one to add another.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(confirmOff)}
        onClose={() => setConfirmOff(null)}
        title={`Switch off ${confirmOff?.label ?? "this number"}?`}
        description="The owner sees this reason in their portal. Nothing is deleted — you can switch it back on."
        confirmLabel="Switch off"
        tone="warning"
        confirmVariant="danger"
        busy={update.isPending}
        onConfirm={confirmDeactivate}
        reason={{
          label: "Reason",
          placeholder: "Reported as intercepting another garage's customers",
          minLength: 3,
        }}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.label ?? "this number"}?`}
        description="Switching it off is reversible; removing it is not. Only remove a number entered by mistake."
        confirmLabel="Remove"
        busy={remove.isPending}
        onConfirm={() => removing && destroy(removing)}
      />
    </div>
  );
}
