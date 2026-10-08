import { http } from "@/shared/api/http";
import type { ErasureResult, PrivacyPolicy } from "../types";

export const accountApi = {
  /** What is kept and for how long — the numbers the Privacy Policy prints. */
  async policy() {
    const res = await http.get<{ data: PrivacyPolicy }>("/privacy/policy");
    return res.data.data;
  },

  /** Everything held about the signed-in person, as one document. */
  async exportMine() {
    const res = await http.get<{ data: Record<string, unknown> }>("/privacy/export");
    return res.data.data;
  },

  /**
   * Delete the signed-in account. The literal is the server's confirmation: a
   * bare DELETE is refused, so a mis-aimed request cannot do this.
   */
  async eraseMine() {
    const res = await http.delete<{ data: ErasureResult }>("/privacy/account", {
      data: { confirm: "DELETE" },
    });
    return res.data.data;
  },
};
