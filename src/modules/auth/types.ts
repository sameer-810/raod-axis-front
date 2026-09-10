import type { AuthUser } from "./authSlice";

export interface Session {
  accessToken: string;
  user: AuthUser;
}

export interface CodeChallenge {
  challengeId: string;
  /** True on a first sign-in, which is when the name field is required. */
  isNew: boolean;
  expiresInMinutes: number;
  /**
   * Which channels the codes actually reached. The interface names only the ones
   * that worked — telling someone to wait for a message that was never sent is
   * worse than saying nothing.
   */
  delivery: { email: boolean; whatsapp: boolean };
  /**
   * Development and CI only. The server refuses to populate this in production
   * regardless of configuration, so a build that shows it there is impossible
   * rather than merely discouraged.
   */
  devCodes?: { email: string; phone: string };
}

export interface RequestCodesPayload {
  email: string;
  phone: string;
}

export interface VerifyCodesPayload {
  challengeId: string;
  emailCode: string;
  phoneCode: string;
  name?: string;
}
