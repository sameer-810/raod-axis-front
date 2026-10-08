import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBusinessApi,
  adminCategoryApi,
  adminOwnershipApi,
  adminUserApi,
  type AdminBusinessQuery,
  type AdminUserQuery,
  type BusinessPayload,
} from "../api/adminApi";

const BUSINESS_KEY = ["admin", "businesses"] as const;
const CATEGORY_KEY = ["admin", "categories"] as const;
const USER_KEY = ["admin", "users"] as const;

// ── Accounts ───────────────────────────────────────────────────────────────

export function useAdminUsers(query: AdminUserQuery) {
  return useQuery({
    queryKey: [...USER_KEY, query],
    queryFn: () => adminUserApi.list(query),
    placeholderData: (prev) => prev,
  });
}

/** Every account write changes the list, and may change who owns a listing. */
function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: USER_KEY });
    void qc.invalidateQueries({ queryKey: BUSINESS_KEY });
    void qc.invalidateQueries({ queryKey: ["admin", "audit"] });
  };
}

export function useCreateStaffUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: adminUserApi.create, onSuccess: invalidate });
}

export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, isActive, reason }: { id: string; isActive: boolean; reason?: string }) =>
      adminUserApi.setActive(id, isActive, reason),
    onSuccess: invalidate,
  });
}

export function useSendPasswordLink() {
  return useMutation({ mutationFn: (id: string) => adminUserApi.sendPasswordLink(id) });
}

export function useEraseUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminUserApi.erase(id, reason),
    onSuccess: invalidate,
  });
}

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
 * After any write, the *public* caches are invalidated too. An administrator who
 * suspends a fake listing must not see it still there in the next tab — the
 * admin list and the public one are the same records behind different filters.
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

export function useTransferOwnership() {
  const invalidate = useInvalidateBusinesses();
  return useMutation({
    mutationFn: ({
      businessId,
      ...payload
    }: {
      businessId: string;
      email: string;
      name?: string;
      reason: string;
    }) => adminOwnershipApi.transfer(businessId, payload),
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
