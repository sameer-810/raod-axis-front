import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { businessApi, categoryApi } from "../api/businessApi";
import type { SearchFilters, SortOption } from "../types";

const DEFAULT_RADIUS = 5000;

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.list,
    // The taxonomy changes when an administrator edits it, which is rarely.
    // Re-fetching per search screen would be a request per navigation.
    staleTime: 30 * 60 * 1000,
  });
}

export function useFacets() {
  return useQuery({
    queryKey: ["business-facets"],
    queryFn: businessApi.facets,
    staleTime: 300_000,
  });
}

export function useBusinessSearch(filters: Partial<SearchFilters>, enabled = true) {
  return useQuery({
    queryKey: ["businesses", filters],
    queryFn: () => businessApi.search(filters),
    enabled,
    // Keeps the previous page on screen while the next loads, instead of
    // blanking the list — on a slow connection a flash of "no results" reads as
    // a broken search.
    placeholderData: (prev) => prev,
  });
}

export function useBusiness(slug: string | undefined) {
  return useQuery({
    queryKey: ["business", slug],
    queryFn: () => businessApi.getBySlug(slug!),
    enabled: Boolean(slug),
  });
}

/**
 * Filter state, held in the URL rather than in component state — FR-DIS-09. A
 * search someone cannot share, bookmark or return to with Back is one they
 * rebuild every time, and the query string makes history the undo stack.
 */
export function useSearchFilters() {
  const [params, setParams] = useSearchParams();

  const filters: SearchFilters = useMemo(() => {
    const lat = params.get("lat");
    const lng = params.get("lng");
    return {
      search: params.get("q") ?? "",
      categories: (params.get("category") ?? "").split(",").filter(Boolean),
      city: params.get("city") ?? "",
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radius: Number(params.get("radius") ?? DEFAULT_RADIUS),
      openNow: params.get("openNow") === "true",
      verifiedOnly: params.get("verified") === "true",
      minRating: params.get("minRating") ? Number(params.get("minRating")) : undefined,
      sort: (params.get("sort") as SortOption) || undefined,
      page: Number(params.get("page") ?? 1),
    };
  }, [params]);

  /**
   * Apply a change to the URL.
   *
   * The base is read from `window.location`, not from the hook's `params` and not
   * from `setSearchParams`'s functional form. Two changes dispatched before React
   * re-rendered both started from the *same* stale snapshot and the second
   * silently discarded the first — tap "Open now" then "Verified" quickly in the
   * filter sheet and only "Verified" survived. React Router builds the functional
   * form over the `searchParams` captured at the last render, so it has the same
   * window; it merely narrowed it enough to pass on a desktop and fail on a phone.
   */
  const update = useCallback(
    (patch: Partial<SearchFilters>, options?: { replace?: boolean }) => {
      const apply = (current: URLSearchParams) => {
        const next = new URLSearchParams(current);

        const set = (key: string, value: string | undefined | null) => {
          // An absent key rather than an empty one, so the URL only ever names
          // the filters in force and two identical searches look identical.
          if (value === undefined || value === null || value === "") next.delete(key);
          else next.set(key, value);
        };

        if ("search" in patch) set("q", patch.search);
        if ("categories" in patch) set("category", patch.categories?.join(","));
        if ("city" in patch) set("city", patch.city);
        if ("lat" in patch) set("lat", patch.lat?.toString());
        if ("lng" in patch) set("lng", patch.lng?.toString());
        if ("radius" in patch) {
          set("radius", patch.radius === DEFAULT_RADIUS ? "" : String(patch.radius));
        }
        if ("openNow" in patch) set("openNow", patch.openNow ? "true" : "");
        if ("verifiedOnly" in patch) set("verified", patch.verifiedOnly ? "true" : "");
        if ("minRating" in patch) set("minRating", patch.minRating?.toString());
        if ("sort" in patch) set("sort", patch.sort);

        // Any change to what is being searched invalidates the page number.
        // Without this, narrowing a filter on page 4 shows an empty list and
        // reads as "no results" rather than "you are past the end".
        if ("page" in patch) set("page", patch.page && patch.page > 1 ? String(patch.page) : "");
        else next.delete("page");

        return next;
      };

      setParams(apply(new URLSearchParams(window.location.search)), {
        replace: options?.replace ?? false,
      });
    },
    [setParams],
  );

  /**
   * Filters narrowing the list, excluding search and location. Shown as a count
   * on the mobile Filters button, because once the controls are behind a sheet a
   * silently filtered list reads as a list with records missing.
   */
  const activeCount =
    filters.categories.length +
    (filters.openNow ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.city ? 1 : 0);

  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    // Location survives a filter reset. It is not a filter — it is where the
    // person is standing, and making them re-grant it is hostile.
    const lat = params.get("lat");
    const lng = params.get("lng");
    if (lat && lng) {
      next.set("lat", lat);
      next.set("lng", lng);
    }
    setParams(next);
  }, [params, setParams]);

  return { filters, update, activeCount, clearAll, DEFAULT_RADIUS };
}
