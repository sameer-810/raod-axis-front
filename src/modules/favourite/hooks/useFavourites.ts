import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favouriteApi } from "../api/favouriteApi";

const KEY = ["favourites"] as const;

export function useFavourites(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: favouriteApi.list, enabled });
}

/**
 * Save and unsave, applied to the screen before the server has answered. A heart
 * that waits for a round trip reads as a broken button, and the correction on
 * failure is cheap because the whole change is one boolean.
 *
 * The write happens **synchronously** in `onMutate` — awaiting `cancelQueries`
 * first pushes it past React's next render, which is exactly the delay the
 * optimism was there to remove.
 */
export function useToggleFavourite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, saved }: { businessId: string; saved: boolean }) =>
      saved ? favouriteApi.unsave(businessId) : favouriteApi.save(businessId),

    onMutate: ({ businessId, saved }) => {
      const next = !saved;

      // Every list of cards that might be showing this business, plus the
      // profile — they all carry `isFavourite` and they must not disagree.
      const patchCard = (b: { id: string; isFavourite?: boolean }) =>
        b.id === businessId ? { ...b, isFavourite: next } : b;

      const previous = {
        businesses: qc.getQueriesData<{ items: Array<{ id: string }> }>({
          queryKey: ["businesses"],
        }),
        business: qc.getQueriesData<{ id: string }>({ queryKey: ["business"] }),
        favourites: qc.getQueryData(KEY),
      };

      qc.setQueriesData<{ items: Array<{ id: string; isFavourite?: boolean }> }>(
        { queryKey: ["businesses"] },
        (old) => (old ? { ...old, items: old.items.map(patchCard) } : old),
      );
      qc.setQueriesData<{ id: string; isFavourite?: boolean }>({ queryKey: ["business"] }, (old) =>
        old ? patchCard(old) : old,
      );
      // On My Garages itself, unsaving removes the row rather than leaving an
      // empty heart on a list whose whole meaning is "things you saved".
      if (saved) {
        qc.setQueryData<Array<{ id: string }>>(KEY, (old) =>
          old?.filter((b) => b.id !== businessId),
        );
      }

      void qc.cancelQueries({ queryKey: ["businesses"] });
      void qc.cancelQueries({ queryKey: KEY });

      return previous;
    },

    onError: (_err, _vars, context) => {
      if (!context) return;
      for (const [key, data] of context.businesses) qc.setQueryData(key, data);
      for (const [key, data] of context.business) qc.setQueryData(key, data);
      qc.setQueryData(KEY, context.favourites);
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
