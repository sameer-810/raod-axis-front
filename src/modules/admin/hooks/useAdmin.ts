import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBusinessApi,
  adminCategoryApi,
  type AdminBusinessQuery,
  type BusinessPayload,
} from "../api/adminApi";

const BUSINESS_KEY = ["admin", "businesses"] as const;
const CATEGORY_KEY = ["admin", "categories"] as const;

export function useAdminBusinesses(query: AdminBusinessQuery) {
  return useQuery({
    queryKey: [...BUSINESS_KEY, query],
    queryFn: () => adminBusinessApi.list(query),
    placeholderData: (prev) => prev,
  });
}

export function useAdminBusiness(id: string | undefined) {
  return useQuery({
    queryKey: [...BUSINESS_KEY, id],
    queryFn: () => adminBusinessApi.get(id!),
    enabled: Boolean(id),
  });
}

/**
 * After any write, the *public* caches are invalidated too.
 *
 * An administrator who suspends a fake listing and then opens the public search
 * in the next tab must not see it still there. The admin list and the public one
 * are the same records behind different filters, so a write to either
 * invalidates both.
 */
function useInvalidateBusinesses() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: BUSINESS_KEY });
    void qc.invalidateQueries({ queryKey: ["businesses"] });
    void qc.invalidateQueries({ queryKey: ["business"] });
    void qc.invalidateQueries({ queryKey: ["business-facets"] });
  };
}

export function useCreateBusiness() {
  const invalidate = useInvalidateBusinesses();
  return useMutation({ mutationFn: adminBusinessApi.create, onSuccess: invalidate });
}

export function useUpdateBusiness() {
  const invalidate = useInvalidateBusinesses();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BusinessPayload> }) =>
      adminBusinessApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetBusinessStatus() {
  const invalidate = useInvalidateBusinesses();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: "draft" | "live" | "suspended";
      reason?: string;
    }) => adminBusinessApi.setStatus(id, status, reason),
    onSuccess: invalidate,
  });
}

export function useAdminCategories() {
  return useQuery({ queryKey: CATEGORY_KEY, queryFn: adminCategoryApi.listAll });
}

export function useCategorySuggestions() {
  return useQuery({
    queryKey: [...CATEGORY_KEY, "suggestions"],
    queryFn: adminCategoryApi.suggestions,
  });
}

function useInvalidateCategories() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: CATEGORY_KEY });
    // The public chip strip is built from this and must not lag behind.
    void qc.invalidateQueries({ queryKey: ["categories"] });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({ mutationFn: adminCategoryApi.create, onSuccess: invalidate });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      adminCategoryApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({ mutationFn: adminCategoryApi.remove, onSuccess: invalidate });
}
