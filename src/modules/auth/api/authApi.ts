import { http } from "@/shared/api/http";
import type { AuthUser } from "../authSlice";
import type {
  CodeChallenge,
  RequestCodesPayload,
  Session,
  VerifyCodesPayload,
} from "../types";

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

  async me() {
    const res = await http.get<{ data: AuthUser }>("/auth/me");
    return res.data.data;
  },
};
