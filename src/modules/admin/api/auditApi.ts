import { http } from "@/shared/api/http";

/** One line of the audit log, as the API returns it. */
export interface AuditEntry {
  id: string;
  action: string;
  actor: { id: string | null; name: string; email: string | null; role: string | null };
  entity: { type: string; id: string | null; label: string | null };
  changes: Record<string, { from: unknown; to: unknown }> | null;
  reason: string | null;
  requestId: string | null;
  at: string;
}

export const auditApi = {
  /** The most recent entries, newest first — the overview's activity feed. */
  async recent(limit = 8) {
    const res = await http.get<{ data: AuditEntry[] }>("/audit", {
      params: { limit: String(limit) },
    });
    return res.data.data;
  },
};

/** "claim.approved" → "claim approved". The log's own vocabulary, made readable. */
export function actionLabel(action: string) {
  return action.replace(/[._]/g, " ");
}
