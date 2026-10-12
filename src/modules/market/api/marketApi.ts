import { http } from "@/shared/api/http";
import type { MarketList } from "../types";

export const marketApi = {
  /** Which countries are open, and how a phone number and an address work in each. */
  async list() {
    const res = await http.get<{ data: MarketList }>("/markets");
    return res.data.data;
  },
};
