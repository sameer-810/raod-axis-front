import { useState } from "react";
import { MessageCircle, Plus, Trash2, ShieldAlert, AlertTriangle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { Field } from "@/shared/components/Field";
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
 * WhatsApp number management, shared by the owner's portal and the admin console.
 *
 * One component for both: the rules are identical and the only difference is who
 * is doing it — an administrator must give a reason when switching somebody else's
 * number off. Two components would drift, and the thing they would drift on is who
 * can silence a business's phone.
 *
 * The screen is built around one sentence at the top: where the next booking
 * request will go.
 */
export function WhatsAppNumbers({
  businessId,
  asAdmin = false,
}: {
  businessId: string;
  /** Requires a reason on deactivation, and labels who did it. */
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
  const [reason, setReason] = useState("");

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
    // An administrator switching off somebody else's number must say why — the
    // owner reads it in their portal.
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

  async function confirmDeactivate() {
    if (!confirmOff) return;
    try {
      report(
        await update.mutateAsync({ id: confirmOff.id, isActive: false, reason }),
        "Number switched off",
      );
      setConfirmOff(null);
      setReason("");
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
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      {/*
        The answer to the question an owner actually has. Stated in words, not
        inferred from two toggles — "is my WhatsApp working" should not require
        reading the table below and doing the routing logic in your head.
      */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border px-4 py-3",
          effective ? "border-border bg-muted/40" : "border-destructive/30 bg-destructive/10",
        )}
      >
        <MessageCircle
          className={cn("mt-0.5 h-5 w-5 shrink-0", effective ? "text-success" : "text-destructive")}
          aria-hidden="true"
        />
        <div className="min-w-0">
          {effective ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Booking requests go to <span className="font-semibold">{effective.label}</span>
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
                {effective.phoneFormatted}
              </p>
              {primary && !primary.isActive && (
                // The whole reason two numbers exist. Worth saying out loud, so
                // an owner knows the arrangement is not what they set up.
                <p className="mt-1 text-sm text-warning">
                  Your primary number ({primary.label}) is switched off, so this one is covering.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Booking requests can't be delivered
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {numbers.length === 0
                  ? "Add a WhatsApp number so customers can reach you."
                  : "Every number is switched off. Switch one back on to start receiving requests."}
              </p>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="ra-panel px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : numbers.length === 0 ? null : (
        <ul className="space-y-2">
          {numbers.map((number) => (
            <li
              key={number.id}
              className={cn("ra-tile", !number.isActive && "border-dashed opacity-80")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {number.label}
                    {number.isPrimary && (
                      <Badge tone="primary" icon={Star}>
                        Primary
                      </Badge>
                    )}
                    {!number.isActive && <Badge tone="warning">Off</Badge>}
                  </p>
                  <p className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
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
                    <button
                      type="button"
                      onClick={() => makePrimary(number)}
                      className="ra-tap rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      Make primary
                    </button>
                  )}
                  <label className="ra-tap flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={number.isActive}
                      onChange={(e) => setActive(number, e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                      aria-label={`${number.isActive ? "Switch off" : "Switch on"} ${number.label}`}
                    />
                    On
                  </label>
                  <button
                    type="button"
                    onClick={() => destroy(number)}
                    aria-label={`Remove ${number.label}`}
                    title="Remove"
                    className="ra-tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/*
                An intervention by RoadAxis, shown to the owner in their own
                portal. Without this their first sign of it is customers not
                calling, and their first thought is that we broke something.
              */}
              {!number.isActive && number.deactivatedByRole === "admin" && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
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
          <form onSubmit={submitAdd} className="ra-tile space-y-1">
            <Field
              label="What is this number for?"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Customer Support"
              hint="Customers see this, so it should tell them which number to use."
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
              <button
                type="submit"
                disabled={add.isPending}
                className="ra-tap rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
              >
                {add.isPending ? "Adding…" : "Add number"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setFormError(null);
                }}
                className="ra-tap rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ra-tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-accent/40 hover:text-foreground"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a number
          </button>
        ))}

      {numbers.length >= MAX_NUMBERS && (
        <p className="text-sm text-muted-foreground">
          You can have up to <span className="font-mono tabular-nums">{MAX_NUMBERS}</span> numbers.
          Remove one to add another.
        </p>
      )}

      {confirmOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="ra-overlay w-full max-w-sm p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
              Switch off {confirmOff.label}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The owner sees this reason in their portal. Nothing is deleted — you can switch it
              back on.
            </p>
            <label
              htmlFor="deactivate-reason"
              className="mt-4 block text-sm font-medium text-foreground"
            >
              Reason
            </label>
            <input
              id="deactivate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reported as intercepting another garage's customers"
              className="mt-1.5 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOff(null);
                  setReason("");
                }}
                className="ra-tap rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeactivate}
                className="ra-tap rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Switch off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
