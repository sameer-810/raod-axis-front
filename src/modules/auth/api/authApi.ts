import { http } from "@/shared/api/http";
import type { AuthUser } from "../authSlice";
import type { CodeChallenge, RequestCodesPayload, Session, VerifyCodesPayload } from "../types";

export const authApi = {
  /** Staff: email and password. */
  async login(payload: { email: string; password: string }) {
    const res = await http.post<{ data: Session }>("/auth/login", payload);
    return res.data.data;
  },

  /** Driver, step one: ask for the two codes. */
  async requestCodes(payload: RequestCodesPayload) {
    const res = await http.post<{ data: CodeChallenge }>("/auth/otp/request", payload);
    return res.data.data;
  },

  /** Driver, step two: submit both codes. */
  async verifyCodes(payload: VerifyCodesPayload) {
    const res = await http.post<{ data: Session }>("/auth/otp/verify", payload);
    return res.data.data;
  },

  /**
   * Staff only: change your own password. The server ends every other session
   * on the account and hands back a new one for this browser.
   */
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const res = await http.post<{ data: Session; message: string }>("/auth/password", payload);
    return { session: res.data.data, message: res.data.message };
  },

  async me() {
    const res = await http.get<{ data: AuthUser }>("/auth/me");
    return res.data.data;
  },
};
