import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsappApi } from "../api/whatsappApi";
import type { NumbersResult, WhatsAppNumber } from "../types";

const key = (businessId: string) => ["whatsapp-numbers", businessId] as const;

export function useWhatsAppNumbers(businessId: string | undefined) {
  return useQuery({
    queryKey: key(businessId ?? ""),
    queryFn: () => whatsappApi.list(businessId!),
    enabled: Boolean(businessId),
  });
}

/**
 * What the list will look like once the server agrees.
 *
 * Applied immediately so a toggle responds to the tap rather than to the round
 * trip. Without it an owner on a workshop's connection taps "off", nothing
 * moves, they tap again — and the second tap switches it back on. A control
 * that ignores you for 400ms is a control people double-press.
 *
 * The invariants are recomputed here as well as on the server, because a
 * half-applied optimistic state is worse than none: showing two Primaries for a
 * moment teaches an owner the rule is not real.
 */
function optimistic(
  numbers: WhatsAppNumber[],
  id: string,
  patch: { label?: string; isActive?: boolean; isPrimary?: boolean },
): WhatsAppNumber[] {
  const next = numbers.map((n) =>
    n.id === id
      ? {
          ...n,
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        }
      : n,
  );
  // Exactly one Primary, and only when the request asked to move it — Primary
  // survives being switched off, so a deactivation must not reassign it.
  if (patch.isPrimary) {
    return next.map((n) => ({ ...n, isPrimary: n.id === id }));
  }
  return next;
}

/**
 * Shared write behaviour: apply the change locally, roll back on failure, and
 * let the server's answer be the last word.
 *
 * The business is invalidated too — its public profile shows the active numbers
 * and its portal view shows the routing status, and both are now stale.
 */
function useNumberMutation<TArgs>(
  businessId: string,
  fn: (args: TArgs) => Promise<NumbersResult>,
  project?: (previous: WhatsAppNumber[], args: TArgs) => WhatsAppNumber[],
) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: fn,

    onMutate(args: TArgs) {
      if (!project) return undefined;

      /**
       * Synchronous, deliberately.
       *
       * Awaiting `cancelQueries` first pushed the cache write into a later
       * microtask, and by then React had already re-rendered the controlled
       * checkbox from its unchanged props — so the toggle visibly snapped back
       * before the optimistic state arrived. Writing first and letting the
       * cancellation run in the background keeps the flip in the same tick as
       * the tap.
       */
      const previous = qc.getQueryData<WhatsAppNumber[]>(key(businessId));
      if (previous) qc.setQueryData(key(businessId), project(previous, args));
      // Still needed, so an in-flight refetch cannot land on top of the guess.
      void qc.cancelQueries({ queryKey: key(businessId) });
      return { previous };
    },

    onError(_err, _args, context) {
      // Put it back exactly as it was. A toggle that stays flipped after a
      // failed request is a lie about the state of the business's phone.
      const previous = (context as { previous?: WhatsAppNumber[] } | undefined)?.previous;
      if (previous) qc.setQueryData(key(businessId), previous);
    },

    onSuccess(result) {
      // The server returns the whole collection with its invariants applied, so
      // it replaces the guess rather than being merged into it.
      qc.setQueryData(key(businessId), result.numbers);
    },

    onSettled() {
      void qc.invalidateQueries({ queryKey: ["business"] });
      void qc.invalidateQueries({ queryKey: ["my-businesses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "businesses"] });
    },
  });
}

export function useAddNumber(businessId: string) {
  // Not optimistic: the server assigns the id and decides whether this is the
  // first number and therefore Primary. Guessing would mean rendering a row
  // that has no id to act on.
  return useNumberMutation(businessId, (payload: { label: string; phone: string }) =>
    whatsappApi.add(businessId, payload),
  );
}

export function useUpdateNumber(businessId: string) {
  return useNumberMutation(
    businessId,
    ({ id, ...payload }: { id: string; label?: string; isActive?: boolean; isPrimary?: boolean; reason?: string }) =>
      whatsappApi.update(businessId, id, payload),
    (previous, { id, ...patch }) => optimistic(previous, id, patch),
  );
}

export function useRemoveNumber(businessId: string) {
  return useNumberMutation(
    businessId,
    (id: string) => whatsappApi.remove(businessId, id),
    (previous, id) => {
      const remaining = previous.filter((n) => n.id !== id);
      // Removing the Primary must not leave the list without one, even for the
      // moment before the server answers.
      if (remaining.length && !remaining.some((n) => n.isPrimary)) {
        const takeover = remaining.find((n) => n.isActive) ?? remaining[0];
        return remaining.map((n) => ({ ...n, isPrimary: n.id === takeover.id }));
      }
      return remaining;
    },
  );
}
